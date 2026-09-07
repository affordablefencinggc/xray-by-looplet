import fs from 'node:fs';
const old='proof/growth/2026-09-08-navigation-release', next='proof/growth/2026-09-08-walk-boundaries';
fs.mkdirSync(next,{recursive:true});
for(const [from,to] of [['package-web-hint.mjs','package-web.mjs'],['package-native-hint.mjs','package-native.mjs'],['worker-hint.ps1','worker.ps1'],['start-preview-hint.ps1','start-preview.ps1'],['launch-native.mjs','launch-native.mjs']]) {
  let source=fs.readFileSync(`${old}/${from}`,'utf8').replaceAll(old,next).replaceAll('transfer-hint','transfer');
  if(to==='start-preview.ps1')source=source.replaceAll('8089','8090');
  if(to==='worker.ps1')source=source.replace("'src/studio/FirstPersonNavigation.test.ts',", "'src/studio/walkCollision.test.ts','src/studio/WalkDoors.test.ts','src/studio/sourceWalkDoors.test.ts','src/studio/FirstPersonNavigation.test.ts',");
  fs.writeFileSync(`${next}/${to}`,source,{flag:'wx'});
}
const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
packageJson.scripts.test=packageJson.scripts.test.replace('src/studio/walkStartPlacement.test.ts','src/studio/walkStartPlacement.test.ts src/studio/walkCollision.test.ts src/studio/WalkDoors.test.ts src/studio/sourceWalkDoors.test.ts');
fs.writeFileSync('package.json',JSON.stringify(packageJson,null,2)+'\n');
fs.writeFileSync('proof/growth/staged-push/navigation-push-result.json',JSON.stringify({recordedAt:new Date().toISOString(),sourceCommit:'6b55950',evidenceCommit:'5d35437',remoteHead:'93a94a85d9ae829425fc5bde00fbe8ee2d5d5702',status:'blocked by automatic approval review',destination:'https://github.com/affordablefencinggc/xray-by-looplet.git',branch:'feat/architect-cad-engine',uploaded:false},null,2));
