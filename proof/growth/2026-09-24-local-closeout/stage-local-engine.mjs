// Reuse the exact already-qualified engine installed on this PC; preserve the old build input.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
if (process.env.COMPUTERNAME?.toLowerCase() !== 'daniel') throw Error('Authorized DANIEL campaign only');
const expected = 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d';
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const installed = path.join(process.env.LOCALAPPDATA, 'X-Ray by Looplet/engine/bin/xray-engine.exe');
assert.equal(hash(installed), expected);
const manifest = JSON.parse(fs.readFileSync('proof/growth/2026-09-23-dans1-engine-build/engine-package-source-manifest.json', 'utf8').replace(/^\uFEFF/, ''));
for (const entry of manifest) assert.equal(hash(entry.path), entry.sha256, entry.path);
const status = spawnSync(installed, ['contract-status', '--json'], { encoding: 'utf8', windowsHide: true });
assert.equal(status.status, 0, status.stderr);
const contract = JSON.parse(status.stdout);
assert.equal(contract.requestSchema, 'xray.job-to-bom/v1');
assert.equal(contract.responseSchema, 'xray.bom/v1');
const destination = 'engine/bin/xray-engine.exe';
const originalSha256 = hash(destination);
const backupRoot = 'C:/Users/danie/XRayPrivateProof/v1-local-build';
fs.mkdirSync(backupRoot, { recursive: true });
const backup = path.join(backupRoot, `original-engine-${originalSha256}.exe`);
if (!fs.existsSync(backup)) fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL);
assert.equal(hash(backup), originalSha256);
fs.copyFileSync(installed, destination);
assert.equal(hash(destination), expected);
fs.writeFileSync('proof/growth/2026-09-24-local-closeout/engine-staging.json', JSON.stringify({
  host: process.env.COMPUTERNAME, at: new Date().toISOString(), source: installed,
  expectedSha256: expected, installedSourceUnchanged: hash(installed) === expected,
  currentEngineSourceFilesVerified: manifest.length, originalSha256, backup, destination,
  contract, statusExitCode: status.status,
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Qualified engine staged; ${manifest.length} source hashes and contract verified; old build input preserved`);
