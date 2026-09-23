import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hostname } from 'node:os';
const base = process.argv[2] ?? 'proof/growth/2026-09-24-stability';
const read = file => JSON.parse(fs.readFileSync(`${base}/${file}`, 'utf8').replace(/^\uFEFF/, ''));
for (const [file, count] of [
  ['campaigns/v1-sc09-baseline3/browser-results.json', 135],
  ['sc09-production-results.json', 138],
  ['startup-measurement-results.json', 138],
  ['startup-production-results.json', 141],
  ['hvac-current-results.json', 75],
  ['hvac-46-dev-results.json', 46],
  ['hvac-46-production-results.json', 46],
]) {
  const result = read(file);
  assert.equal(result.host.toLowerCase(), 'dans1');
  assert.equal(result.verdict, 'PASS', file);
  assert.equal(result.completedOperations, count, file);
  assert.equal(result.browserErrors.length, 0, file);
  assert.equal(result.cleanup.errors.length, 0, file);
}
const closes = read('native/close-results.json');
assert.equal(closes.length, 10);
for (const close of closes) {
  assert.ok(close.requested && close.exited && !close.forced && !close.error);
  assert.ok(close.elapsedMs < 5000);
}
const workloads = read('native/all-workloads.json');
assert.equal(workloads.length, 10);
for (const workload of workloads) {
  const receipts = workload.receipt.value ?? workload.receipt;
  assert.equal(receipts.filter(r => Number.isInteger(r.index)).length, 140);
  assert.ok(!receipts.some(r => r.error));
  assert.ok(JSON.stringify(receipts.at(-1)).includes('Opened Gmail'));
}
assert.deepEqual(read('source-identity.json').drift, []);
const cleanup = read('cleanup-summary.json');
assert.ok(cleanup.scheduledTaskRemoved);
assert.ok(!cleanup.native.some(r => r.remainingSameIdentity));
assert.ok(!cleanup.browser.some(r => r.cleanup.some(c => c.status === 'cleanup-failed')));
console.log(JSON.stringify({ host: hostname(), verdict: 'PASS', sourceDrift: 0, nativeWorkloads: 10, nativeOperationsPerWorkload: 140, gracefulCloses: 10, forcedCloses: 0, fastestCloseMs: Math.min(...closes.map(r => r.elapsedMs)), slowestCloseMs: Math.max(...closes.map(r => r.elapsedMs)), limitation: 'Historical app failure causes were not reproduced; no product-code fix or installed/deployment acceptance is asserted.' }, null, 2));
