import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const id=process.argv[2];assert(/^[a-f0-9]{12}$/.test(id??''));const base=path.resolve(`proof/growth/2026-09-08-assistant-mcp-r3/release-${id}`);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected=read(path.join(base,'transfer-record.json'));const results=[];
for(const [manifestName,archiveName,directory] of [['artifact-manifest.json','native-artifacts.tar','artifacts'],['web-artifact-manifest.json','web-artifacts.tar','web-artifacts']]){
 const manifest=read(path.join(base,manifestName)),archive=path.join(base,archiveName),destination=path.join(base,directory);
 assert.equal(manifest.sourceSha256,expected.sourceSha256);assert.equal(manifest.nativeSourceSha256,expected.nativeSourceSha256);
 assert.equal(fs.statSync(archive).size,manifest.archive.bytes);assert.equal(hash(archive),manifest.archive.sha256);
 const list=spawnSync('tar',['-tf',archive],{encoding:'utf8',windowsHide:true});assert.equal(list.status,0,list.stderr);const names=list.stdout.trim().split(/\r?\n/).map(n=>n.replaceAll('\\','/'));
 for(const name of names)assert(!/^(?:\/|[A-Za-z]:)|(?:^|\/)\.\.(?:\/|$)/.test(name),'Unsafe archive path');assert.equal(new Set(names).size,names.length);assert.deepEqual([...names].sort(),manifest.entries.map(e=>e.path.replaceAll('\\','/')).sort());
 assert(!fs.existsSync(destination),'Prior extraction preserved');fs.mkdirSync(destination);const extracted=spawnSync('tar',['-xf',archive,'-C',destination],{encoding:'utf8',windowsHide:true});assert.equal(extracted.status,0,extracted.stderr);
 for(const entry of manifest.entries){const file=path.resolve(destination,entry.path);assert(file.startsWith(destination+path.sep));assert.equal(fs.statSync(file).size,entry.bytes);assert.equal(hash(file),entry.sha256,entry.path);}
 results.push({archive:archiveName,sha256:manifest.archive.sha256,files:manifest.entries.length,destination});
}
const result={at:new Date().toISOString(),runId:id,status:'pass',sourceSha256:expected.sourceSha256,nativeSourceSha256:expected.nativeSourceSha256,archives:results,installed:false,launched:false};fs.writeFileSync(path.join(base,'artifacts-verified.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
