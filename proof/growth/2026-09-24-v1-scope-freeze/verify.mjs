import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAssessment } from '../../../planning/professional-coverage/assessment.mjs';
const base = 'proof/growth/2026-09-24-v1-scope-freeze';
const rows = JSON.parse(fs.readFileSync(`${base}/scope-index.json`));
const backlog = fs.readFileSync('POST-V1-BACKLOG.md', 'utf8');
const finish = fs.readFileSync('FINISH-LINE.md', 'utf8');
for (const row of rows) {
  assert.match(row.disposition, /^(backlog|0[1-6])$/);
  assert.ok((row.disposition === 'backlog' ? backlog : finish).includes(`${row.file}:${row.line}`));
  if (!row.historical) {
    const line = fs.readFileSync(row.file, 'utf8').split(/\r?\n/)[row.line - 1];
    assert.match(line, row.disposition === 'backlog' ? /moved to POST-V1-BACKLOG/ : /\[section 0[1-6]\]/);
  }
}
const catalogue = JSON.parse(fs.readFileSync('public/industry-coverage/catalogue.json'));
const items = catalogue.categories.flatMap(c => c.items);
const register = readAssessment(fs.readFileSync('PROFESSIONAL-A-Z-CHECKLIST.md', 'utf8'), items.map(i => i.id));
const counts = {};
for (const item of items) {
  assert.equal(item.state, register.rows.get(item.id).state);
  counts[item.state] = (counts[item.state] ?? 0) + 1;
}
assert.deepEqual(counts, { 'dependency-blocked': 19, partial: 110, gap: 239, verified: 6, failed: 1 });
const csv = fs.readFileSync('public/industry-coverage/requirements.csv', 'utf8');
for (const item of items) assert.ok(csv.split(/\r?\n/).some(line => line.startsWith(`"${item.id}",`) && line.includes(`,"${item.state}",`)));
const dashboard = fs.readFileSync('XRAY-STATUS-AND-PROOF-DASHBOARD.html', 'utf8');
assert.match(dashboard, /data-kpi="slices" data-total="20" data-done="14"/);
const manifest = JSON.parse(fs.readFileSync('scripts/src-test-files.json'));
assert.equal(manifest.length, 208);
assert.equal(new Set(manifest).size, 208);
for (const file of manifest) assert.ok(fs.existsSync(file), file);
console.log(JSON.stringify({ host: process.env.COMPUTERNAME, verdict: 'PASS', classified: rows.length, counts, slices: '14/20', sourceSuites: manifest.length }, null, 2));
