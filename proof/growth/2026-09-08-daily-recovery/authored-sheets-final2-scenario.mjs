import fs from 'node:fs';
const dir='proof/growth/2026-09-08-daily-recovery/';
const commands=JSON.parse(fs.readFileSync(dir+'authored-sheets-final.json','utf8'));
for(const c of commands){
  if(c[0]==='screenshot')c[1]=c[1].replace('authored-sheets-final-','authored-sheets-final2-');
  if(c[0]==='wait'&&c[2]?.includes("document.querySelector('.arch-error')?.textContent.includes('Isolated QA quota failure')"))c[2]+="&&document.querySelector('.arch-sheet-register [role=alert]')?.textContent.includes('not saved')";
}
fs.writeFileSync(dir+'authored-sheets-final2.json',JSON.stringify(commands,null,2),{flag:'wx'});
