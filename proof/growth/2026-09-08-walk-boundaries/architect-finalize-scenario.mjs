import fs from 'node:fs';
const d='proof/growth/2026-09-08-walk-boundaries';
const c='document.querySelector(\'canvas[aria-label="Live architectural 3D model"]\')';
const commands=[['eval',"window.__boundaryRuntimeErrors=[];addEventListener('error',e=>window.__boundaryRuntimeErrors.push({type:'error',message:e.message}));addEventListener('unhandledrejection',e=>window.__boundaryRuntimeErrors.push({type:'rejection',message:String(e.reason)}));'Runtime event monitor installed'"],['console','--clear']];
for(const name of ['door-e','door-button','solids','fly']) {
 const a=JSON.parse(fs.readFileSync(`${d}/architect-${name}-attempt1.json`));
 for(const item of a) {
  const cmd=item.map(v=>v.replaceAll('attempt1','attempt2'));
  if(cmd[0]==='eval'&&cmd[1].includes('Invalid landing did not safely restore'))cmd[1]=`(()=>{const text=document.querySelector('.architect-3d [role="alert"]').textContent,before=window.__boundaryOrbit.split(',').map(Number),after=${c}.dataset.cameraPosition.split(',').map(Number),distance=Math.hypot(...before.map((v,i)=>v-after[i]));if(!text.includes('supported landing')||${c}.dataset.navigation!=='orbit'||distance>1e-6)throw Error('Invalid landing did not safely restore orbit: '+JSON.stringify({text,before,after,distance}));return {text,before,after,distance};})()`;
  if(!['errors','console'].includes(cmd[0]))commands.push(cmd);
 }
}
commands.push(['eval',`if(window.__boundaryRuntimeErrors.length)throw Error(JSON.stringify(window.__boundaryRuntimeErrors));JSON.stringify({runtimeErrors:window.__boundaryRuntimeErrors,runs:window.__boundaryRuns,dataset:{...${c}.dataset}})`],['console']);
fs.writeFileSync(`${d}/architect-final-attempt2.json`,JSON.stringify(commands,null,2));
