import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const base='proof/growth/2026-09-08-one-floor';
const fresh=['src/studio/floorConstruction.ts','src/studio/floorDrawing.ts','src/studio/floorDrawing.test.ts','src/studio/FloorConstructionStudio.tsx','src/studio/floorConstruction.css','src/routes/floor-lab.tsx'];
let diff='';for(const file of fresh){const r=spawnSync('git',['diff','--no-index','--','NUL',file],{encoding:'utf8',windowsHide:true});if(![0,1].includes(r.status))throw Error(r.stderr);diff+=r.stdout;}
for(const file of ['src/studio/SourceBuildingViewer.tsx','src/desktop.tsx','src/routeTree.gen.ts','package.json']){
 const old=spawnSync('tar',['-xOf','proof/growth/2026-09-08-pencil-independent/transfer/source.tar',file],{encoding:'utf8',windowsHide:true,maxBuffer:3000000});if(old.status!==0)throw Error(old.stderr);
 const before=`${base}/${file.split('/').at(-1)}.before`;fs.writeFileSync(before,old.stdout);
 const r=spawnSync('git',['diff','--no-index','--',before,file],{encoding:'utf8',windowsHide:true});if(![0,1].includes(r.status))throw Error(r.stderr);diff+=r.stdout;
}fs.writeFileSync(`${base}/implementation.diff`,diff);
