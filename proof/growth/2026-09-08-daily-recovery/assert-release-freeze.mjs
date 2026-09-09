import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
/** Packaging/remote actions stay unavailable until root supplies its explicit source freeze. */
export function assertReleaseFreeze() {
  const root=process.cwd(), guardFile='proof/growth/2026-09-08-daily-recovery/release-freeze-guard.json';
  assert(fs.existsSync(guardFile),'Explicit SOURCE FREEZE and passed release-freeze-guard required; no packaging/build performed');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const guard=read(guardFile);assert.equal(guard.status,'pass');assert(/^[a-f0-9]{64}$/.test(guard.scopeSha256));
  const manifestPath=path.resolve(guard.manifest);assert(manifestPath.startsWith(root+path.sep));
  const manifest=read(manifestPath);assert.equal(manifest.scopeSha256,guard.scopeSha256);assert.equal(manifest.entries.length,guard.files);
  for(const entry of manifest.entries){const target=path.resolve(entry.path);assert(target.startsWith(root+path.sep));assert.equal(createHash('sha256').update(fs.readFileSync(target)).digest('hex'),entry.sha256,`Frozen source drift: ${entry.path}`);}
  return guard;
}
