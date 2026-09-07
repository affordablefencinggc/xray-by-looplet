import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const source=read('proof/growth/production-source.json').map(c=>c.map(s=>s.replaceAll('2026-09-07-production-model','2026-09-07-tablet-built-model')));
const sheets=read('proof/growth/native-sheets-desktop.json').slice(2).map(c=>c.map(s=>s.replaceAll('/native-','/stage05-built-')));
const centre="(()=>{const root=document.querySelector('.measure-document-preview'),v=root?.querySelector('.document-preview-viewport')?.getBoundingClientRect(),p=root?.querySelector('.document-source-page')?.getBoundingClientRect(),b=window.__portableBookmark;return !!(v&&p&&b&&Math.abs((v.left+v.width/2-p.left)/p.width-b.center.x)<.002&&Math.abs((v.top+v.height/2-p.top)/p.height-b.center.y)<.002)})()";
const commands=[['open','http://127.0.0.1:8087/'],['set','viewport','1440','1000'],...source];
for(const c of sheets){if(c[0]==='eval'&&c[1].includes('Math.abs(')&&c[1].includes('p.width'))commands.push(['wait','--fn',centre]);commands.push(c);}
const tablets=read('proof/growth/2026-09-07-sheets/stage05-dev-tablet.json').map(c=>c.map(s=>s.replaceAll('stage05-dev-','stage05-built-').replaceAll('Drainage junction','Release drainage detail').replaceAll("originalPage==='3'","originalPage==='2'")));
commands.push(...tablets);
fs.writeFileSync('proof/growth/tablet-production-final.json',JSON.stringify(commands,null,2));
