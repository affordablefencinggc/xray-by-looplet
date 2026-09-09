import fs from 'node:fs';
const base='proof/growth/2026-09-08-production-pencil/2026-09-08-8093-pencil-01';
const old=JSON.parse(fs.readFileSync(base+'/tablet-controls.json','utf8'));
const check=old.find(c=>c[0]==='eval'&&c[1].includes('Target under44'));
const a=[['eval',"(()=>{if(!document.body.textContent.includes('Build 4e6d1ebd3a62'))throw Error('Wrong build');const d=document.querySelector('[aria-label=\"Model navigation\"]');return {build:'4e6d1ebd3a62',bottomDockPresent:!!d,rect:d?JSON.stringify(d.getBoundingClientRect()):null,display:d?getComputedStyle(d).display:null};})()"],['find','role','button','click','--name','Magic Pencil','--exact'],['wait','--fn',"!!document.querySelector('[data-testid=draftsman-dock]')"],['find','role','button','click','--name','Solid Finish','--exact'],['wait','--fn',"document.querySelector('.building-canvas canvas').dataset.drawPhase==='complete'"]];
for(const [w,h,label] of [[1024,768,'landscape'],[768,1024,'portrait']]) a.push(['set','viewport',String(w),String(h)],['wait','--fn',`innerWidth===${w}&&innerHeight===${h}&&document.querySelector('[data-testid=draftsman-dock]').getAnimations().every(a=>a.playState==='finished')`],check,['screenshot',`screenshots/growth/2026-09-08-8093-pencil-01-tablet-${label}-solid-supplement.png`]);
a.push(['find','role','button','click','--name','Close Draftsman mode','--exact'],['errors']);
fs.writeFileSync(base+'/tablet-solid-supplement.json',JSON.stringify(a,null,2),{flag:'wx'});
