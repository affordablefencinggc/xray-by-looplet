import fs from 'node:fs';
const dir='proof/audit/IW-PROFESSIONAL-NEXT';
const controls=[['tab','t1'],['wait','--fn',"!!document.querySelector('[data-hydration-status=ready]')"],
  ['eval',"(()=>{if(!window.__TAURI_INTERNALS__)throw Error('Not native');const j=JSON.parse(localStorage.getItem('xray:fencing-job:v2'));if(j.trade!=='general'||j.name!=='New project'||j.site.address!=='')throw Error('Nonneutral new project');return {jobId:j.id,trade:j.trade}})()"],
  ['find','role','button','click','--name','Model','--exact'],['wait','--fn',"document.querySelector('.building-primary')?.disabled===false"],
  ['find','role','button','click','--name','Open Redburn BR250157 plan in 3D','--exact'],['wait','--fn',"document.querySelector('.building-canvas canvas')?.dataset.meshCount==='198'"],
  ['find','role','button','click','--name','Front','--exact'],['find','role','button','click','--name','Zoom in model','--exact'],
  ['eval',"(()=>{const upper=document.querySelector('[aria-label=\"3D view controls\"]'),lower=document.querySelector('[aria-label=\"Model navigation\"]');if(!upper||!lower||lower.querySelectorAll('button').length!==5||upper.getBoundingClientRect().top>=lower.getBoundingClientRect().top)throw Error('Native toolbar layout');for(const b of lower.querySelectorAll('button')){const r=b.getBoundingClientRect();if(r.bottom>innerHeight||r.height<44)throw Error('Native bottom control clipped')}return {parts:document.querySelector('.building-canvas canvas').dataset.meshCount,buttons:lower.querySelectorAll('button').length}})()"],
  ['screenshot','screenshots/professional-next/native-top-bottom.png'],['errors']];
fs.writeFileSync(`${dir}/native-controls.json`,JSON.stringify(controls,null,2));
for(const [source,target] of [['production-fresh','native-pricing'],['production-reload','native-pricing-reload'],['production-backup','native-pricing-backup']]){
 const a=JSON.parse(fs.readFileSync(`proof/audit/IW-PRICE-BOOK/${source}.json`,'utf8'));
 const commands=[['tab','t1'],...a.filter(c=>c[0]!=='open' && c[0]!=='set' && !(c[0]==='wait'&&c[1]==='--load')).map(c=>c.map(v=>v.replaceAll('screenshots/price-book/production-','screenshots/professional-next/native-pricing-')))];
 fs.writeFileSync(`${dir}/${target}.json`,JSON.stringify(commands,null,2));
 if(target==='native-pricing'){
  const applyIndex=commands.findIndex(c=>c[0]==='click'&&c[1]==='.price-book-card tbody tr:first-child button');
  fs.writeFileSync(`${dir}/native-pricing-apply.json`,JSON.stringify([['tab','t1'],['eval',"document.querySelector('.price-book-card tbody tr:first-child button').scrollIntoView({block:'center'})"],...commands.slice(applyIndex)],null,2));
 }
}
