import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base='proof/growth/2026-09-23-industry-closeout';
mkdirSync(base+'/scenarios',{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const qs=read('proof/growth/2026-09-24-stability/campaigns/v1-sc09-baseline3/scenario.json');
if(qs.at(-1)[0]==='errors')qs.pop();
const ev=js=>qs.push(['eval',js]),wait=js=>qs.push(['wait','--fn',js,20000]);
const click=name=>qs.push(['find','role','button','click','--name',name,'--exact']);
click('Calculate classification');wait(`!!document.querySelector('.qs-report-panel')`);
ev(`(()=>{const p=document.querySelector('.qs-report-panel');window.__qsWhole=p.querySelector('table').textContent;window.__qsExports=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type.startsWith('text/csv'))window.__qsExports.push(b.text());return original(b)};window.__qsSelect=(index,value)=>{const s=p.querySelectorAll('select')[index];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,value);s.dispatchEvent(new Event('change',{bubbles:true}));return true};return {whole:window.__qsWhole}})()`);
for(const [w,h,name] of [[768,1024,'portrait'],[1024,768,'landscape']]) {
 qs.push(['set','viewport',String(w),String(h)]);
 ev(`window.__qsSelect(0,'unassigned')`);
 wait(`document.querySelector('.qs-report-panel select').value==='unassigned'&&document.querySelectorAll('.qs-report-panel select')[1].disabled`);
 ev(`(()=>{const p=document.querySelector('.qs-report-panel');if(p.querySelector('table').textContent!==window.__qsWhole)throw Error('Filtering changed canonical totals');p.querySelector('.industry-fields').scrollIntoView({block:'center'});if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');return {filter:'unassigned',caption:[...p.querySelectorAll('caption')].map(c=>c.textContent)}})()`);
 qs.push(['screenshot',`captures/qs-filter-${name}.png`]);
 ev(`window.__qsSelect(0,'all')`);wait(`!document.querySelectorAll('.qs-report-panel select')[1].disabled`);
 click('Collapse All');click('Expand All');
 ev(`(()=>{const p=document.querySelector('.qs-report-panel');p.scrollIntoView({block:'start'});return {viewport:[innerWidth,innerHeight],buttons:[...p.querySelectorAll('button')].map(b=>({name:b.textContent.trim(),height:b.getBoundingClientRect().height}))}})()`);
 qs.push(['screenshot',`captures/qs-report-${name}.png`]);
}
click('Download shown item rows (CSV)');
ev(`document.querySelector('[data-testid="export-hierarchical-csv-btn"]').click();true`);
ev(`(async()=>{const files=await Promise.all(window.__qsExports);if(files.length!==2||!files[0].includes('Item reference')||!files[1].includes('SUMMARY_NODE')||!files[1].includes('LEAF_ITEM'))throw Error('CSV disclosure absent');return {exportCount:files.length,flatCsv:files[0],hierarchicalCsv:files[1]}})()`);
qs.push(['errors']);
writeFileSync(base+'/scenarios/qs-complete.json',JSON.stringify(qs,null,2)+'\n');
for(const [name,source] of Object.entries({
 'hvac-pressure':'proof/growth/2026-09-23-fencing-v1/hvac-policy-pressure-scenario.json',
 'quote-issue':'proof/growth/2026-09-23-fencing-v1/quote-issue-scenario.json',
 'stock-coverage':'proof/growth/2026-09-23-fencing-cutting/stock-dev.json',
 'hvac-fittings':'proof/growth/2026-09-20-hvac-portion4/scenarios/fittings-dev.json',
}))writeFileSync(base+'/scenarios/'+name+'.json',JSON.stringify(read(source),null,2)+'\n');
console.log(JSON.stringify({qs:qs.length}));
