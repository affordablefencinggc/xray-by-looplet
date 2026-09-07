import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('proof/growth/2026-09-08-navigation-release/release-aa8d81a110ac');
const manifest=JSON.parse(readFileSync(path.join(root,'artifact-manifest.json'),'utf8').replace(/^\uFEFF/,''));
const archive=path.join(root,'native-artifacts.tar'), destination=path.join(root,'artifacts');
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(statSync(archive).size,manifest.archive.bytes);
assert.equal(digest(archive),manifest.archive.sha256);
const listing=spawnSync('tar',['-tf',archive],{encoding:'utf8',windowsHide:true});
assert.equal(listing.status,0,listing.stderr);
const names=listing.stdout.trim().split(/\r?\n/).map(name=>name.replaceAll('\\','/'));
for(const name of names) assert(!/^(?:\/|[A-Za-z]:)|(?:^|\/)\.\.(?:\/|$)/.test(name),`Unsafe archive entry: ${name}`);
assert.deepEqual([...names].sort(),manifest.entries.map(e=>e.path).sort());
assert(!existsSync(destination),'Refuse to overwrite previously extracted artifacts');
mkdirSync(destination);
const extracted=spawnSync('tar',['-xf',archive,'-C',destination],{encoding:'utf8',windowsHide:true});
assert.equal(extracted.status,0,extracted.stderr);
for(const entry of manifest.entries){
 const target=path.resolve(destination,entry.path);
 assert(target.startsWith(destination+path.sep));
 assert.equal(statSync(target).size,entry.bytes);
 assert.equal(digest(target),entry.sha256,`Artifact mismatch: ${entry.path}`);
}
const result={status:'pass',checkedAt:new Date().toISOString(),sourceSha256:manifest.sourceSha256,nativeSourceSha256:manifest.nativeSourceSha256,archiveSha256:manifest.archive.sha256,artifacts:manifest.entries.length,destination,installed:false,launched:false};
writeFileSync(path.join(root,'artifacts-verified.json'),`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result));
