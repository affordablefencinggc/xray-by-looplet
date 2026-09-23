// Local file/index audit only. Product behaviour was executed on DANS1.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='proof/growth/2026-09-23-industry-closeout';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
let screenshots=0,links=0;
const runs={'closeout-qs-complete-dev01':163,'closeout-qs-built-c56ad63e9ee7':163,'closeout-qs-readable-c56ad63e9ee7':149,'closeout-hvac-fittings-dev01':65};
for(const [name,operations] of Object.entries(runs)){
 const root=base+'/'+name,report=read(root+'/browser-results.json'),launcher=read(root+'/launcher-results.json');
 assert.equal(report.host,'dans1');assert.equal(report.verdict,'PASS');assert.equal(report.completedOperations,operations);assert.equal(report.browserErrors.length,0);
 assert.equal(launcher.verdict,'PASS');assert.ok(launcher.cleanup.every(x=>['stopped','already-exited'].includes(x.status)));
 for(const shot of report.screenshots){assert.equal(hash(fs.readFileSync(root+'/'+shot.file)),shot.sha256);screenshots++;}
 const manifest=read(root+'/sha256-manifest.json');for(const f of manifest.entries)assert.equal(hash(fs.readFileSync(root+'/'+f.path)),f.sha256,f.path);
}
for(const record of read(base+'/build-c56ad63e9ee7/results.json'))assert.equal(record.exitCode,0,record.step);
const outputs=['README.md','steps/SC-01-qs-web.md','steps/SC-13-native-build-WIP.md'];
for(const name of outputs){const file=base+'/'+name;for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
 if(/^https?:/.test(match[1]))continue;const target=path.resolve(path.dirname(file),match[1]);if(target!==path.resolve(base,'evidence-audit.json'))assert.ok(fs.existsSync(target),target);links++;
}}
const web=read(base+'/transfer/source-manifest.json'),native=read(base+'/transfer/native-manifest.json');
for(const entry of [...web.entries,...native.entries])assert.equal(hash(fs.readFileSync(entry.path)),entry.sha256,entry.path);
const index=[];for(const file of [base+'/closeout-qs-built-c56ad63e9ee7/browser-results.json',base+'/closeout-qs-readable-c56ad63e9ee7/captures/qs-report-landscape.png',base+'/proof-tools.diff',base+'/ledger.diff']){
 const result=spawnSync('git',['show',':'+file],{maxBuffer:16e6});assert.equal(result.status,0);assert.equal(hash(result.stdout),hash(fs.readFileSync(file)));index.push({path:file,sha256:hash(result.stdout)});
}
fs.writeFileSync(base+'/evidence-audit.json',JSON.stringify({at:new Date().toISOString(),host:os.hostname(),scope:'Local evidence-file and Git-index integrity; product runs above were on DANS1',verdict:'PASS',runs,screenshotHashes:screenshots,proofLinks:links,unchangedProductInputs:web.entries.length+native.entries.length,index},null,2)+'\n');
console.log('Evidence audit PASS');
