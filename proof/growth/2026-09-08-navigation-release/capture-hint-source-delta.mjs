import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = 'proof/growth/2026-09-08-navigation-release';
const previousRoot = 'proof/growth/2026-09-08-navigation-release/transfer-final';
const before = JSON.parse(fs.readFileSync(`${previousRoot}/source-manifest.json`, 'utf8'));
const after = JSON.parse(fs.readFileSync(`${root}/transfer-hint/source-manifest.json`, 'utf8'));
const old = new Map(before.entries.map(e => [e.path, e]));
const current = new Map(after.entries.map(e => [e.path, e]));
const changed = after.entries.filter(e => old.get(e.path)?.sha256 !== e.sha256);
const removed = before.entries.filter(e => !current.has(e.path));
const destination = `${root}/source-delta-hint`;
if (fs.existsSync(destination)) throw Error('Preserve previous source delta');
fs.mkdirSync(`${destination}/before`, { recursive: true });
fs.mkdirSync(`${destination}/after`, { recursive: true });
const previousPaths = [...changed.filter(e => old.has(e.path)), ...removed].map(e => e.path);
fs.writeFileSync(`${destination}/previous-files.txt`, previousPaths.join('\n') + '\n');
const extracted = spawnSync('tar', ['-xf', `${previousRoot}/source.tar`, '-C', `${destination}/before`, '-T', `${destination}/previous-files.txt`], { encoding: 'utf8', windowsHide: true });
if (extracted.status !== 0) throw Error(extracted.stderr || 'Previous source extraction failed');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const file of previousPaths) if (digest(`${destination}/before/${file}`) !== old.get(file).sha256) throw Error('Previous source mismatch: ' + file);
for (const entry of changed) {
  if (digest(entry.path) !== entry.sha256) throw Error('Current source drift: ' + entry.path);
  const target = path.join(destination, 'after', entry.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(entry.path, target);
}
let diff = '';
for (const entry of [...changed, ...removed]) {
  const previous = old.has(entry.path) ? `${destination}/before/${entry.path}` : 'NUL';
  const next = current.has(entry.path) ? `${destination}/after/${entry.path}` : 'NUL';
  const result = spawnSync('git', ['diff', '--no-index', '--', previous, next], { encoding: 'utf8', windowsHide: true });
  if (![0, 1].includes(result.status)) throw Error(result.stderr || 'Source diff failed');
  diff += result.stdout;
}
fs.writeFileSync(`${destination}/code.diff`, diff);
const result = { previousRun: '049d8ae830ee', run: 'aa8d81a110ac', capturedAt: new Date().toISOString(), changed: changed.filter(e => old.has(e.path)), added: changed.filter(e => !old.has(e.path)), removed, diffSha256: digest(`${destination}/code.diff`) };
fs.writeFileSync(`${destination}/manifest.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
