import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import assert from 'node:assert/strict';
const root = process.cwd(), base = resolve(root, 'proof/growth/2026-09-23-fencing-v1');
const read = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
const manifest = JSON.parse(read(resolve(base, 'source-hashes-03.json')));
for (const file of manifest) assert.equal(createHash('sha256').update(readFileSync(resolve(root, file.path))).digest('hex'), file.sha256, file.path);
const log = read(resolve(base, 'source-tests-03.log'));
const counts = field => [...log.matchAll(new RegExp(`(?:ℹ|#) ${field} (\\d+)`, 'g'))].reduce((sum, match) => sum + Number(match[1]), 0);
assert.equal(counts('tests'), 1958); assert.equal(counts('pass'), 1958); assert.equal(counts('fail'), 0);
const checks = JSON.parse(read(resolve(base, 'checks-03.json'))); assert.equal(checks.typecheckExit, 0); assert.equal(checks.testExit, 0);
for (const [directory, count] of [['v1-hvac-pressure-dev02', 144], ['v1-quote-issue-dev03', 58]]) {
  const report = JSON.parse(read(resolve(base, directory, 'browser-results.json')));
  assert.equal(report.summary?.verdict ?? report.verdict, 'PASS');
  const summary = report.summary ?? report;
  assert.equal(summary.completedOperations, count); assert.deepEqual(summary.browserErrors, []);
  const launcher = JSON.parse(read(resolve(base, directory, 'launcher-results.json')));
  assert.equal(launcher.verdict, 'PASS'); assert.ok(launcher.cleanup.every(entry => ['stopped', 'already-exited'].includes(entry.status)));
}
const checklist = read(resolve(root, 'V1-INDUSTRY-FENCING-TODO.md'));
const open = checklist.split(/\r?\n/).filter(line => line.startsWith('- [ ]'));
assert.equal(open.length, 13); assert.ok(open.every(line => /\[section 0[23]\]/.test(line)));
assert.match(read(resolve(root, 'XRAY-PRODUCTION-CLOSEOUT-LEDGER.md')), /Adopt the recommended mass rule/);
let links = 0;
for (const file of [resolve(root, 'V1-INDUSTRY-FENCING-TODO.md'), ...readdirSync(resolve(base, 'steps')).filter(n => n.endsWith('.md')).map(n => resolve(base, 'steps', n))]) {
  for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(match[1])) continue;
    assert.ok(existsSync(resolve(dirname(file), match[1])), `${file}: ${match[1]}`); links++;
  }
}
const result = { host: hostname(), at: new Date().toISOString(), sourceFiles: manifest.length, tests: counts('tests'), passing: counts('pass'), failing: counts('fail'), openTaggedSteps: open.length, checkedProofLinks: links, verdict: 'PASS', limit: 'Source/development checkpoint; final build and remaining handover work open.' };
writeFileSync(resolve(base, 'checkpoint-audit.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
