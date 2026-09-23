// transfer | build | collect for the 2026-09-23 engine-bearing Dans1 native build. Preserves every prior run.
import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto'; import { spawnSync } from 'node:child_process';
const base = 'proof/growth/2026-09-23-industry-closeout', [stage, runOverride] = process.argv.slice(2);
if (runOverride && !/^[a-f0-9]{12}$/.test(runOverride)) throw Error('Invalid isolated run identity');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const transfer = read(`${base}/transfer.json`), native = read(`${base}/transfer/native-manifest.json`);
const id = runOverride || transfer.source.sha256.slice(0, 12), incoming = `C:/Users/danie/XRayBuilds/incoming/${id}`, run = `C:/Users/danie/XRayBuilds/runs/${id}`;
const ENGINE_DIR = 'C:/Users/danie/XRayBuilds/industry-visible-20260913/native-engine-selected-20260913';
const ENGINE_SHA = 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d';
function exec(program, args, inherit = false) { const r = spawnSync(program, args, { encoding: 'utf8', windowsHide: true, stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 64e6 }); if (!inherit) { process.stdout.write(r.stdout ?? ''); process.stderr.write((r.stderr ?? '').replace(/^\*\*.*\n/gm, '')); } if (r.status !== 0) throw Error(`${program} failed (${r.status})`); return r.stdout; }
const ssh = (code, inherit = false) => exec('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'tonys-test-pc', 'powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], inherit);
function verifySource() { const web = read(`${base}/transfer/source-manifest.json`); const drift = [...web.entries, ...native.entries].filter(e => !fs.existsSync(e.path) || hash(e.path) !== e.sha256).map(e => e.path); if (drift.length) throw Error('Source changed after snapshot: ' + drift.slice(0, 20).join(', ')); }
console.log('run', id);
if (stage === 'transfer') {
  verifySource();
  for (const [f, h] of [['source.tar', transfer.source.sha256], ['node-runtime.tar', transfer.runtime.sha256], ['native-source.tar', native.archiveSha256]]) if (hash(`${base}/transfer/${f}`) !== h) throw Error('hash mismatch ' + f);
  ssh(`$ErrorActionPreference='Stop';if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong worker'};$p='${incoming}';if(Test-Path -LiteralPath $p){throw 'Incoming run already exists; preserved'};New-Item -ItemType Directory -Path $p | Out-Null;'created'`);
  const files = ['source.tar', 'node-runtime.tar', 'native-source.tar', 'source-manifest.json', 'native-manifest.json'].map(f => `${base}/transfer/${f}`).concat(`scripts/dans1-build-worker.ps1`);
  exec('scp', ['-q', '-o', 'BatchMode=yes', ...files, `tonys-test-pc:${incoming}/`]);
  ssh(`$ErrorActionPreference='Stop';` + files.map(f => `if((Get-FileHash -LiteralPath '${incoming}/${path.basename(f)}' -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${hash(f)}'){throw 'Transferred hash mismatch ${path.basename(f)}'}`).join(';') + `;'all transferred files verified'`);
  fs.writeFileSync(`${base}/transfer-record-${id}.json`, JSON.stringify({ at: new Date().toISOString(), runId: id, incoming, files: files.map(f => ({ path: f, sha256: hash(f) })) }, null, 2), { flag: 'wx' });
} else if (stage === 'build') {
  verifySource();
  ssh(`& '${incoming}/dans1-build-worker.ps1' -RunId '${id}' -SourceHash '${transfer.source.sha256}' -RuntimeHash '${transfer.runtime.sha256}' -NativeHash '${native.archiveSha256}' -DependencyCacheRunId '7a55db807d34' -ExpectedCacheExeSha256 'fe6dbb5ddcb6820f4c209b97af47cf3b21e6c0f502063ebd2b528502a2a64a7e' -EnginePackageDir '${ENGINE_DIR}' -ExpectedEngineSha256 '${ENGINE_SHA}'`, true);
} else if (stage === 'collect') {
  const out = `${base}/build-${id}`; fs.mkdirSync(out, { recursive: true });
  exec('scp', ['-q', '-o', 'BatchMode=yes', `tonys-test-pc:${run}/*.json`, `tonys-test-pc:${run}/*.log`, out + '/']);
  exec('scp', ['-q', '-o', 'BatchMode=yes', `tonys-test-pc:${run}/source/src-tauri/target/release/bundle/nsis/*.exe`, out + '/']);
  verifySource();
} else throw Error('usage: transfer|build|collect');
