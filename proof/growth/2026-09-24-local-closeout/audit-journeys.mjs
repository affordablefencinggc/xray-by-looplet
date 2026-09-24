import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = 'proof/growth/2026-09-24-local-closeout';
const [stage, ...requested] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(stage)) throw Error('Unique stage name required');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for (const e of read(`${base}/source-identity.json`).entries) assert.equal(hash(e.path), e.sha256, e.path);
for (const e of read(`${base}/stage1-audit.json`).artifacts) assert.equal(hash(e.path), e.sha256, e.path);
const campaigns = [];
for (const arg of requested.filter(x => x !== '--native')) {
  const [name, count] = arg.split(':');
  assert(/^[a-z0-9-]+$/.test(name));
  const directory = `${base}/${name}`;
  const result = read(`${directory}/browser-results.json`), launch = read(`${directory}/launcher-results.json`);
  assert.equal(result.host.toLowerCase(), 'daniel');
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.completedOperations, Number(count));
  assert.equal(result.browserErrors.length, 0);
  assert.equal(launch.verdict, 'PASS');
  assert(launch.cleanup.every(c => ['stopped', 'already-exited', 'not-owned'].includes(c.status)));
  for (const e of read(`${directory}/sha256-manifest.json`).entries) assert.equal(hash(`${directory}/${e.path}`), e.sha256, e.path);
  campaigns.push({ directory, operations: Number(count), resultSha256: hash(`${directory}/browser-results.json`), screenshots: result.screenshots.map(s => ({ file: s.file, sha256: hash(`${directory}/${s.file}`) })) });
}
let native = null;
if (requested.includes('--native')) {
  const directory = `${base}/native-close01`, records = read(`${directory}/close-results.json`);
  assert.equal(records.length, 10);
  let operations = 0;
  for (const r of records) {
    assert(r.host === 'DANIEL' && r.requested && r.exited && !r.forced && !r.error && r.elapsedMs < 5000 && r.defaultBundledEngine);
    assert.equal(hash(r.exe), r.sha256);
    const receipts = read(`${directory}/workload-${r.run}.json`).filter(x => Number.isInteger(x.index));
    assert.equal(receipts.length, r.workloadOperations);
    assert(receipts.every((x, i) => x.index === i && !x.error));
    assert.equal(read(`${directory}/browser-errors-${r.run}.json`).length, 0);
    operations += receipts.length;
  }
  assert.equal(operations, 1373);
  const cleanup = read(`${base}/native-cleanup.json`);
  assert.equal(cleanup.nativeProcessesRemaining, 0);
  assert.equal(cleanup.nativeCdpListenersRemaining, 0);
  assert.equal(cleanup.nativeProfileProcessesRemaining.length, 0);
  const artifacts = [];
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) artifacts.push({ path: p.replaceAll('\\', '/'), sha256: hash(p) }); } };
  walk(directory);
  native = { cleanCloses: 10, forced: 0, operations, emailRuns: 1, pdfWorkloads: 10, minMs: Math.min(...records.map(r => r.elapsedMs)), maxMs: Math.max(...records.map(r => r.elapsedMs)), artifacts,
    harness: ['native-close.ps1', 'native-probe.mjs'].map(p => ({ path: `${base}/${p}`, sha256: hash(`${base}/${p}`) })) };
}
fs.writeFileSync(`${base}/${stage}-audit.json`, JSON.stringify({ host: 'DANIEL', at: new Date().toISOString(), verdict: 'PASS', campaigns, native, sourceAndArtifactsUnchanged: true }, null, 2) + '\n');
console.log(`PASS: ${campaigns.length} browser campaigns; source/build identities unchanged${native ? '; ten graceful native closes' : ''}`);
