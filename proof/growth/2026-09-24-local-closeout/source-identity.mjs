import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const base = 'proof/growth/2026-09-24-local-closeout';
const prior = 'proof/growth/2026-09-23-industry-closeout/transfer';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const identityPath = `${base}/source-identity.json`;
if (process.argv[2] === 'verify') {
  const recorded = read(identityPath);
  const drift = recorded.entries.filter(e => !fs.existsSync(e.path) || hash(e.path) !== e.sha256).map(e => e.path);
  if (drift.length) throw Error(`Product source changed: ${drift.join(', ')}`);
  console.log(`Verified ${recorded.entries.length} unchanged product inputs; ${recorded.gitHead}`);
} else {
  const files = new Set(['source-manifest.json', 'native-manifest.json'].flatMap(name => read(`${prior}/${name}`).entries.map(e => e.path)));
  for (const p of git(['ls-files', '-z', 'src', 'scripts', 'src-tauri', 'engine', 'contracts']).split('\0').filter(Boolean)) {
    if (!p.startsWith('engine/bin/') && !p.startsWith('engine/cad/bin/') && !p.includes('/target/')) files.add(p);
  }
  const entries = [...files].sort().map(path => ({ path, sha256: hash(path) }));
  fs.writeFileSync(identityPath, JSON.stringify({
    host: os.hostname(), at: new Date().toISOString(), gitHead: git(['rev-parse', 'HEAD']).trim(),
    branch: git(['branch', '--show-current']).trim(), buildId: 'local-e74e67d4-20260924',
    authorization: 'User: do it on this pc (2026-09-24)', entries,
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Recorded ${entries.length} product inputs`);
}
