import fs from 'node:fs';
const base='proof/growth/2026-09-08-navigation-release/';
const runs=[['fly','2026-09-07T14-42-14-003Z'],['walk','2026-09-07T14-42-21-969Z'],['denied','2026-09-07T14-42-43-308Z'],['denied-walk','2026-09-07T14-42-50-757Z']];
const output=[];
for(const [name,time] of runs){
 const root=`proof/growth/runner/${time}-growth-navigation-architect-production`;
 const report=JSON.parse(fs.readFileSync(root+'.json','utf8'));
 const log=fs.readFileSync(root+'.log','utf8');
 fs.copyFileSync(root+'.log',base+`architect-production-${name}.log`);
 fs.copyFileSync(root+'.scenario.json',base+`architect-production-${name}-executed.json`);
 fs.copyFileSync(root+'.json',base+`architect-production-${name}-report.json`);
 const objects=[];
 for(let i=0;i<log.length;i++) if(log[i]==='{'){
  let depth=0,quoted=false,escaped=false;
  for(let j=i;j<log.length;j++){
   const c=log[j];
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{objects.push(JSON.parse(log.slice(i,j+1)));}catch{}i=j;break;}
  }
 }
 const result=objects.find(v=>v.keysReleased&&v.movements);
 if(report.exitCode!==0||result?.movements.length!==4)throw Error('Missing passing executed movement proof '+name);
 output.push({name,commands:report.commands,seconds:report.seconds,scenarioSha256:report.scenarioSha256,log:base+`architect-production-${name}.log`,movements:result.movements.map(m=>({key:m.code,capture:m.after.capture,yaw:m.before.yaw,pitch:m.before.pitch,before:m.before.position,after:m.after.position,delta:m.delta,distance:m.distance,signedCameraDot:m.signedCameraDot})),rapidReentry:objects.find(v=>v.rapidReentry)?.rapidReentry??null});
}
fs.writeFileSync(base+'architect-production-results.json',JSON.stringify({session:'growth-navigation-architect-production',url:'http://127.0.0.1:8088/',fixture:'Courtyard studio / demonstration; not a supplied drawing',runs:output},null,2));
console.log(JSON.stringify(output.map(v=>({name:v.name,commands:v.commands,seconds:v.seconds,distances:v.movements.map(m=>Number(m.distance.toFixed(4))),capture:v.movements[0].capture,rapidReentry:v.rapidReentry})),null,2));
