import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir='proof/growth/architect-benchmark/';
const pairs=[['appTools.before.ts','src/studio/assistant/appTools.ts'],['architectBridge.ts.before','src/studio/assistant/architectBridge.ts'],['conversation.ts.before','src/studio/assistant/conversation.ts'],['workPacketRuntime.ts.before','src/studio/assistant/workPacketRuntime.ts'],['workPacket.ts.before','src/studio/assistant/workPacket.ts'],['package.before.json','package.json'],['LiveAssistant.before.tsx','src/studio/LiveAssistant.tsx'],['Architect3D.tsx.before','src/studio/architect/Architect3D.tsx'],['designedScene.ts.before','src/studio/architect/designedScene.ts'],['designedScene.test.ts.before','src/studio/architect/designedScene.test.ts']];
let diff='';
for(const [before,after] of pairs){const r=spawnSync('git',['diff','--no-index','--',dir+before,after],{encoding:'utf8',windowsHide:true});if(r.status>1)throw Error(r.stderr);diff+=r.stdout;}
const fresh=['src/studio/assistant/actionOutcome.ts','src/studio/assistant/actionOutcome.test.ts','src/studio/architect/surfaceAppearance.ts','scripts/benchmarks/courtyard.mjs','scripts/benchmarks/courtyard.test.mjs'];
fs.writeFileSync(dir+'empty.txt','');
for(const file of fresh){const r=spawnSync('git',['diff','--no-index','--',dir+'empty.txt',file],{encoding:'utf8',windowsHide:true});if(r.status>1)throw Error(r.stderr);diff+=r.stdout;}
fs.writeFileSync(dir+'implementation.diff',diff);
const data=JSON.parse(fs.readFileSync(dir+'stage2-reloaded.json','utf8'));
const eventTypes={};const calls={};
for(const events of data.events) for(const e of events){eventTypes[e.kind]=(eventTypes[e.kind]??0)+1;const tool=e.payload?.tool;if(tool)calls[tool]=(calls[tool]??0)+1;}
const files=[...pairs.map(p=>p[1]),...fresh,'src/studio/assistant/workPacket.test.ts'];
fs.writeFileSync(dir+'source-manifest.json',JSON.stringify(files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),null,2));
console.log(JSON.stringify({eventTypes,calls,eventSample:data.events.map(e=>e[0]),counts:{walls:data.design.walls.length,openings:data.design.openings.length,slabs:data.design.slabs.length,roofs:data.design.roofs.length}},null,2));
