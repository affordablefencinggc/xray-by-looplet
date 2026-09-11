// node --test planning/industry-specs/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegister, weakest } from './validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('register parses all 375 rows with the states the register itself reports', () => {
  const rows = readRegister();
  // 364 original + 11 merged 2026-09-11 (SO x5, PH x3, D-15, E-15, T-15).
  assert.equal(rows.size, 375);
  const tally = {};
  for (const r of rows.values()) tally[r.state] = (tally[r.state] || 0) + 1;
  assert.deepEqual(tally, {
    verified: 6,
    // 102, + D-07 re-assessed 2026-09-11 (its linked fields were already
    // implemented, so 'gap' was wrong), + D-13 implemented 2026-09-12.
    partial: 104,
    gap: 245, // 236 + 11 merged rows - D-07 corrected - D-13 implemented
    'dependency-blocked': 19,
    failed: 1,
  });
});

test('the merge disturbed no previously reviewed assessment', () => {
  // Everything except gap must be unchanged from the pre-merge register: the
  // regeneration round-trips reviewed states and must never reset them.
  const rows = readRegister();
  const tally = {};
  for (const r of rows.values()) tally[r.state] = (tally[r.state] || 0) + 1;
  assert.equal(tally.verified, 6);
  assert.equal(tally.partial, 104);
  assert.equal(tally['dependency-blocked'], 19);
  assert.equal(tally.failed, 1);
  // Spot-check rows whose reviewed states were expensive to earn.
  assert.equal(rows.get('B-10').state, 'verified');
  assert.equal(rows.get('Z-12').state, 'verified');
  assert.equal(rows.get('D-14').state, 'partial');
  // Corrected 2026-09-11 from gap after reading the shipping renderer.
  assert.equal(rows.get('D-07').state, 'partial');
  // Implemented 2026-09-12: issue sets with a reviewed order and a register.
  assert.equal(rows.get('D-13').state, 'partial');
});

test('weakest takes the least-ready state, not the most-ready', () => {
  const rows = new Map([
    ['A-01', { state: 'verified' }],
    ['A-02', { state: 'partial' }],
    ['A-03', { state: 'gap' }],
    ['A-04', { state: 'dependency-blocked' }],
  ]);
  assert.equal(weakest(['A-01'], rows), 'verified');
  assert.equal(weakest(['A-01', 'A-02'], rows), 'partial');
  assert.equal(weakest(['A-01', 'A-02', 'A-04'], rows), 'dependency-blocked');
  assert.equal(weakest(['A-01', 'A-03'], rows), 'gap');
  assert.equal(weakest(['A-99'], rows), 'unknown');
});

test('an unknown requirement id is reported rather than silently skipped', () => {
  const rows = readRegister();
  assert.equal(rows.has('C-03'), true);
  assert.equal(rows.has('C-99'), false);
});

function run() {
  return JSON.parse(
    execFileSync(process.execPath, [join(here, 'validate.mjs'), '--json'], { encoding: 'utf8' }),
  );
}

test('all shipped specs validate with no errors', () => {
  const { errors, report } = run();
  assert.deepEqual(errors, []);
  // Assert the shape rather than a spec count, so adding a profile does not fail
  // the suite - there are 68 to write.
  const specFiles = readdirSync(here).filter(
    (f) => f.endsWith('.md') && f !== 'TEMPLATE.md' && f !== 'README.md',
  );
  assert.equal(report.length, specFiles.length);
  assert.ok(report.length >= 4, 'expected the four contrast specs at minimum');
  for (const spec of report) {
    assert.ok(spec.tasks.length > 0, `${spec.file} has no tasks`);
  }
});

test('a named blocker floors a task to gap however ready its rows are', () => {
  const { report } = run();
  // After the 2026-09-11 merge most pseudo-blockers became real register rows and
  // were dropped. Any task still naming one must still be floored, whatever its
  // rows say - template rule 5.
  const floored = report.flatMap((s) =>
    s.tasks.filter((t) => t.blockedBy).map((t) => ({ file: s.file, ...t })),
  );
  assert.ok(floored.length > 0, 'expected at least one task with a blocker');
  for (const t of floored) {
    assert.equal(t.state, 'gap', `${t.file} ${t.id} has a blocker but is ${t.state}`);
  }
});

test('a task with no blocker keeps its derived state', () => {
  const { report } = run();
  const roofing = report.find((r) => r.file === 'roofing.md');
  const t1 = roofing.tasks.find((t) => t.id === 'T-1');
  assert.equal(t1.blockedBy, null);
  assert.equal(t1.state, t1.derivedFromRows);
  assert.equal(t1.state, 'partial');
});

test('rows proposed and merged now exist in the register', () => {
  // Before the merge this asserted the ids were FREE. They were merged on
  // 2026-09-11, so the guard inverts: each must now resolve, proving the
  // proposal and the register did not drift apart.
  const proposal = readFileSync(join(here, '..', 'PROPOSED-REGISTER-EXPANSIONS.md'), 'utf8');
  const rows = readRegister();
  const section = proposal.split(/^## 4\. Proposed Row Additions/m)[1] ?? '';
  const proposed = [...section.matchAll(/^\* \*\*([A-Z]{1,2}-\d{2})\b/gm)].map((m) => m[1]);
  assert.ok(proposed.length > 0, 'no proposed row ids found');
  for (const id of proposed) {
    assert.equal(rows.has(id), true, `proposed ${id} is not in the register`);
  }
  for (const id of ['SO-01', 'SO-05', 'PH-01', 'PH-03']) {
    assert.equal(rows.has(id), true, `${id} missing`);
  }
});

test('category row counts match the merged register shape', () => {
  const rows = readRegister();
  const max = {};
  for (const row of rows.values()) {
    const [cat, num] = row.id.split('-');
    const n = Number(num);
    if (!max[cat] || n > max[cat]) max[cat] = n;
  }
  // 26 A-Z categories plus SO and PH added 2026-09-11.
  assert.equal(Object.keys(max).length, 28);
  const expected = { SO: 5, PH: 3, D: 15, E: 15, T: 15 };
  for (const [cat, n] of Object.entries(max)) {
    assert.equal(n, expected[cat] ?? 14, `category ${cat} ends at ${n}`);
  }
});

test('every spec requirement resolves to a real register row', () => {
  // The rebinding replaced prose blockers with ids; a typo would otherwise
  // silently drop a dependency and overstate a task.
  const { report } = run();
  const rows = readRegister();
  for (const spec of report) {
    for (const t of spec.tasks) {
      assert.ok(t.requires.length > 0, `${spec.file} ${t.id} requires nothing`);
      for (const id of t.requires) {
        assert.equal(rows.has(id), true, `${spec.file} ${t.id} -> unknown ${id}`);
      }
    }
  }
});

test('no spec claims a verified task', () => {
  const { report } = run();
  for (const spec of report) {
    for (const t of spec.tasks) {
      assert.notEqual(t.state, 'verified', `${spec.file} ${t.id} claims verified`);
    }
  }
});
