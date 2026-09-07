import fs from 'node:fs';
const base=JSON.parse(fs.readFileSync('proof/growth/native-sheets.json','utf8'));
const centre="(()=>{const root=document.querySelector('.measure-document-preview'),v=root?.querySelector('.document-preview-viewport')?.getBoundingClientRect(),p=root?.querySelector('.document-source-page')?.getBoundingClientRect(),b=window.__portableBookmark;return !!(v&&p&&b&&Math.abs((v.left+v.width/2-p.left)/p.width-b.center.x)<.002&&Math.abs((v.top+v.height/2-p.top)/p.height-b.center.y)<.002)})()";
const commands=[['tab','t1']];
for(let i=0;i<3;i++)commands.push(...base.slice(44,54),['wait','--fn',centre],base[57].map(s=>s.replaceAll('Reload/mobile','Reload desktop').replaceAll('Reload and mobile resize','Reload')),['screenshot',`screenshots/growth/2026-09-07-sheets/native-reload-pass-${i+1}.png`]);
commands.push(...base.slice(61));
fs.writeFileSync('proof/growth/native-reload-acceptance.json',JSON.stringify(commands,null,2));
