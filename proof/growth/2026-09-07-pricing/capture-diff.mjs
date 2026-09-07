import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const dir='proof/growth/2026-09-07-pricing/';
const existing=['priceBooks.ts','PriceBookPanel.tsx','priceBooks.css'];
const added=['priceWorkbook.ts','priceWorkbookTable.ts','priceWorkbook.worker.ts','priceWorkbookClient.ts','priceWorkbook.test.ts'];
let output='';
for(const file of [...existing,...added]) {
  const before=existing.includes(file)?dir+'before-'+file+'.txt':'NUL';
  const result=spawnSync('git',['diff','--no-index','--',before,'src/studio/pricing/'+file],{encoding:'utf8',windowsHide:true});
  if(result.status!==0&&result.status!==1)throw Error(result.stderr);
  output+=result.stdout;
}
fs.writeFileSync(dir+'implementation.diff',output);
