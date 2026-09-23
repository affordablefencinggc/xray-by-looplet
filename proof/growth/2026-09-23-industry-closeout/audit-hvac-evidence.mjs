// File/index audit on the orchestrating host; every product run checked here was on DANS1.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const base='proof/growth/2026-09-23-industry-closeout',read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),hash=b=>createHash('sha256').update(b).digest('hex');
const cases={pressure:144,material:102,'network-corrected':136,pipe:147,fittings:375};let screenshots=0;
for(const [name,count] of Object.entries(cases)){
 const root=`${base}/closeout-hvac-${name}-c56ad63e9ee7`,r=read(root+'/browser-results.json'),l=read(root+'/launcher-results.json');
 assert.equal(r.host,'dans1');assert.equal(r.verdict,'PASS');assert.equal(r.completedOperations,count);assert.equal(r.browserErrors.length,0);assert.equal(l.verdict,'PASS');assert.ok(l.cleanup.every(x=>['stopped','already-exited'].includes(x.status)));
 for(const entry of read(root+'/sha256-manifest.json').entries)assert.equal(hash(fs.readFileSync(root+'/'+entry.path)),entry.sha256,entry.path);
 screenshots+=r.screenshots.length;
}
for(const [name,count] of [['network',119],['network-current',134]]){const r=read(`${base}/closeout-hvac-${name}-c56ad63e9ee7/browser-results.json`);assert.equal(r.verdict,'FAIL');assert.equal(r.completedOperations,count);}
for(const manifest of ['source','native'])for(const entry of read(`${base}/transfer/${manifest}-manifest.json`).entries)assert.equal(hash(fs.readFileSync(entry.path)),entry.sha256,entry.path);
let links=0;for(const name of ['SC-02-hvac-mass-web','SC-03-hvac-network-web','SC-04-hvac-delivery-web']){const file=base+'/steps/'+name+'.md';for(const m of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){const dest=path.resolve(path.dirname(file),m[1]);if(dest!==path.resolve(base,'hvac-evidence-audit.json'))assert.ok(fs.existsSync(dest),dest);links++;}}
const index=[];for(const file of [base+'/worksheet-proof.diff',base+'/ledger-hvac.diff',base+'/closeout-hvac-pressure-c56ad63e9ee7/browser-results.json']){const r=spawnSync('git',['show',':'+file],{maxBuffer:32e6});assert.equal(r.status,0);assert.equal(hash(r.stdout),hash(fs.readFileSync(file)));index.push({path:file,sha256:hash(r.stdout)});}
const ledger=fs.readFileSync('XRAY-PRODUCTION-CLOSEOUT-LEDGER.md','utf8');for(const id of ['09','12','13','14'])assert.match(ledger,new RegExp('#### SC-'+id+'[^\\n]+\\[\\[done\\]\\]'));
fs.writeFileSync(base+'/hvac-evidence-audit.json',JSON.stringify({host:os.hostname(),at:new Date().toISOString(),scope:'Local file/index audit; product evidence is DANS1 built output',verdict:'PASS',cases,operations:904,screenshotHashes:screenshots,proofLinks:links,retainedFailedRuns:2,index,limits:'Browser worksheet acceptance. No native installation, physical-device or engineering certification.'},null,2)+'\n');console.log('HVAC evidence audit PASS');
