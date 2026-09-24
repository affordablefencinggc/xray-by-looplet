import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = 'proof/growth/2026-09-24-local-closeout';
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const tests = fs.readFileSync(`${base}/source-gates02/source-tests.stdout.log`, 'utf8');
const totals = {};
for (const name of ['tests', 'pass', 'fail', 'skipped']) totals[name] = [...tests.matchAll(new RegExp('\\u2139 ' + name + ' (\\d+)', 'g'))].reduce((sum, match) => sum + Number(match[1]), 0);
assert.deepEqual(totals, { tests: 1964, pass: 1964, fail: 0, skipped: 0 });
for (const stage of ['source-gates02', 'web-build01', 'native-build01']) {
  const resource = read(`${base}/${stage}/resources.json`);
  assert.equal(resource.host, 'DANIEL');
  assert.equal(resource.jobFlags, 5);
  assert.equal(resource.jobCpuRate, 2000);
  assert(resource.appliedBeforeChildren && resource.completedAt);
  for (const check of read(`${base}/${stage}/results.json`)) assert(check.exitCode === 0 && check.inCappedJob, stage + '/' + check.name);
}
for (const entry of read(`${base}/source-identity.json`).entries) assert.equal(hash(entry.path), entry.sha256, entry.path);
const campaigns = [];
for (const [directory, operations] of [
  [`${base}/explanations-built01`, 35],
  ['C:/Users/danie/XRayPrivateProof/v1-boundaries/local-unknowns-dev02', 20],
  ['C:/Users/danie/XRayPrivateProof/v1-boundaries/local-unknowns-built01', 20],
]) {
  const result = read(`${directory}/browser-results.json`), launch = read(`${directory}/launcher-results.json`);
  assert.equal(result.host.toLowerCase(), 'daniel');
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.completedOperations, operations);
  assert.equal(result.browserErrors.length, 0);
  assert.equal(launch.verdict, 'PASS');
  assert(launch.cleanup.every(c => ['stopped', 'already-exited', 'not-owned'].includes(c.status)));
  for (const entry of read(`${directory}/sha256-manifest.json`).entries) assert.equal(hash(`${directory}/${entry.path}`), entry.sha256, entry.path);
  campaigns.push({ directory, operations, resultSha256: hash(`${directory}/browser-results.json`), screenshots: result.screenshots.map(s => ({ file: s.file, sha256: hash(`${directory}/${s.file}`) })) });
}
const assets = [];
for (const dir of ['.vercel/output/static/assets', 'dist/assets']) for (const name of fs.readdirSync(dir)) {
  const p = path.join(dir, name);
  if (!fs.statSync(p).isFile()) continue;
  assets.push({ path: p.replaceAll('\\', '/'), bytes: fs.statSync(p).size, sha256: hash(p) });
}
for (const dir of ['.vercel/output/static/assets', 'dist/assets']) assert(assets.some(a => a.path.startsWith(dir + '/') && a.path.endsWith('.js') && fs.readFileSync(a.path, 'utf8').includes('Roofing worksheet explanation rules')));
for (const p of ['src-tauri/target/release/xray-by-looplet.exe', 'src-tauri/target/release/bundle/nsis/X-Ray by Looplet_0.1.0_x64-setup.exe', 'engine/bin/xray-engine.exe']) assets.push({ path: p, bytes: fs.statSync(p).size, sha256: hash(p) });
fs.writeFileSync(`${base}/stage1-audit.json`, JSON.stringify({ host: 'DANIEL', at: new Date().toISOString(), verdict: 'PASS', totals, campaigns, artifacts: assets,
  limits: 'Local source/build/browser acceptance only. Native application runtime and installation are not established by this audit. Private drawings and profiles remain outside Git.' }, null, 2) + '\n');
console.log('PASS: 1,964 tests, three capped stages, 75 browser operations, hashes and cleanup; both builds contain current explanation guidance');
