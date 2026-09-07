import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['package.json','src/studio/Studio.tsx','src/studio/domain.ts','src/studio/domain.test.ts',
  'src/studio/persistence.ts','src/studio/persistence.test.ts','src/studio/store.ts','src/studio/workspace-shell.css',
  'src/studio/SourceBuildingViewer.tsx','src/studio/sourceBuilding.css',
  'src/studio/ProjectDetails.tsx','src/studio/projectDetails.css','src/studio/SheetManager.tsx','src/studio/sheetManager.css',
  'src/studio/sheetLifecycle.ts','src/studio/sheetLifecycle.test.ts','src/studio/useSheetLifecycle.ts',
  'src/studio/projectBackup.ts','src/studio/projectBackup.test.ts','src/studio/projectBackupStorage.ts','src/studio/ProjectBackups.tsx',
  'src/studio/pricing/PriceBookPanel.tsx','src/studio/pricing/priceBooks.ts','src/studio/pricing/priceBooks.css','src/studio/pricing/priceBooks.test.ts'];
let output = '';
for (const file of files) {
  const tracked = spawnSync('git',['ls-files','--error-unmatch','--',file],{encoding:'utf8',windowsHide:true}).status === 0;
  const r = spawnSync('git',tracked?['diff','--',file]:['diff','--no-index','--','NUL',file],{encoding:'utf8',windowsHide:true,maxBuffer:20e6});
  if (r.status !== 0 && r.status !== 1) throw Error(r.stderr);
  output += r.stdout;
}
fs.writeFileSync('proof/audit/IW-PROFESSIONAL-NEXT/implementation.diff',output);
fs.writeFileSync('proof/audit/IW-PROFESSIONAL-NEXT/changed-files.json',JSON.stringify(files,null,2));
console.log(`Recorded ${files.length} file paths; full working-tree diff includes preserved earlier edits in shared files.`);
