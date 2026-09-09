import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir='proof/growth/structured-routing/';
const before=JSON.parse(fs.readFileSync(dir+'live-edit.json','utf8'));
const reloaded=JSON.parse(fs.readFileSync('proof/growth/runner/2026-09-09T14-38-15-104Z-structured-routing.log','utf8'));
assert.deepEqual(reloaded.design,before.design);
assert.deepEqual(reloaded.packets,before.packets);
assert.ok(reloaded.journals.every(Boolean));
fs.writeFileSync(dir+'reload-proof.json',JSON.stringify({projectId:reloaded.projectId,designIdentical:true,workPacketsIdentical:true,journalsValid:true,revision:reloaded.design.revision},null,2));
const paths=fs.readdirSync(dir).filter(f=>f.endsWith('.before')).map(file=>[dir+file,file==='package.json.before'?'package.json':'src/studio/assistant/'+file.replace(/\.before$/,'')]);
let diff='';
for(const [pre,current] of paths){const result=spawnSync('git',['diff','--no-index','--',pre,current],{encoding:'utf8',windowsHide:true});if(result.status>1)throw Error(result.stderr);diff+=result.stdout;}
fs.writeFileSync(dir+'empty.txt','');
const fresh=['src/studio/assistant/workflowRouting.ts','src/studio/assistant/workflowRouting.test.ts'];
for(const file of fresh){const result=spawnSync('git',['diff','--no-index','--',dir+'empty.txt',file],{encoding:'utf8',windowsHide:true});if(result.status>1)throw Error(result.stderr);diff+=result.stdout;}
fs.writeFileSync(dir+'implementation.diff',diff);
fs.writeFileSync(dir+'source-manifest.json',JSON.stringify([...paths.map(p=>p[1]),...fresh].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),null,2));
const tools=before.events.map(events=>events.filter(e=>e.kind==='tool-intent').map(e=>e.payload.tool));
fs.writeFileSync(dir+'executed-routes.json',JSON.stringify(tools,null,2));
console.log({reloadIdentical:true,journals:reloaded.journals.length,files:paths.length+fresh.length,executedRoutes:tools});
