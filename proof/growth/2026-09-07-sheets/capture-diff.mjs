import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['sheetLifecycle.ts','sheetLifecycle.test.ts','SheetManager.tsx','sheetManager.css','useSheetLifecycle.ts','sheetBookmarks.ts','sheetBookmarks.test.ts','SourceSheetBookmarks.tsx','sheetBookmarks.css'].map(p=>'src/studio/'+p);
let output='';
for(const file of files){
 const tracked=spawnSync('git',['ls-files','--error-unmatch','--',file],{encoding:'utf8',windowsHide:true}).status===0;
 const result=spawnSync('git',tracked?['diff','--',file]:['diff','--no-index','--','NUL',file],{encoding:'utf8',windowsHide:true});
 if(result.status!==0&&result.status!==1)throw Error(result.stderr);
 output+=result.stdout;
}
fs.writeFileSync('proof/growth/2026-09-07-sheets/source.patch',output);
