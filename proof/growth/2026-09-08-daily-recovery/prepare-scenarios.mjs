import fs from 'node:fs';
const dir='proof/growth/2026-09-08-daily-recovery';
const key='xray:fencing-job:v2';
const click=name=>['find','role','button','click','--name',name,'--exact'];
const wait=fn=>['wait','--fn',fn];
const inspect=selector=>['eval',`(()=>{const root=document.querySelector(${JSON.stringify(selector)});if(!root)throw Error('Missing notice');const rs=[...root.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();if(r.width<44||r.height<44||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth||!b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('Target blocked/clipped/small: '+b.textContent);return {text:b.textContent,x:r.x,y:r.y,width:r.width,height:r.height}});return {viewport:[innerWidth,innerHeight],buttons:rs}})()`];
const layouts=(selector,prefix)=>[[1440,1000,'desktop'],[1024,768,'landscape'],[768,1024,'portrait']].flatMap(([w,h,name])=>[['set','viewport',String(w),String(h)],['eval',`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`],inspect(selector),['screenshot',`screenshots/growth/daily-recovery-dev-${prefix}-${name}.png`]]);
const corrupt='{"schemaVersion":2,"name":"Preserve me — recovery test",\r\nBROKEN';
const commands=[
 wait(`!!document.querySelector('[data-project-record-save=saved]')`),
 ['eval',`(()=>{const raw=localStorage.getItem('${key}');if(!raw)throw Error('Missing fixture');sessionStorage.setItem('daily-recovery-original',raw);sessionStorage.setItem('daily-recovery-corrupt',${JSON.stringify(corrupt)});sessionStorage.setItem('daily-recovery-sidecars',JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='${key}'))));localStorage.setItem('${key}',${JSON.stringify(corrupt)});return {originalBytes:new TextEncoder().encode(raw).length,corruptBytes:new TextEncoder().encode(${JSON.stringify(corrupt)}).length}})()`],
 ['reload'],wait(`!!document.querySelector('[data-project-recovery=blocked]')`),
 ['eval',`(()=>{if(localStorage.getItem('${key}')!==sessionStorage.getItem('daily-recovery-corrupt'))throw Error('Corrupt record overwritten');if(document.querySelector('[data-project-record-save]'))throw Error('Normal pane mounted during recovery');const old=JSON.parse(sessionStorage.getItem('daily-recovery-sidecars'));for(const [k,v]of Object.entries(old))if(localStorage.getItem(k)!==v)throw Error('Sidecar changed '+k);return {preserved:true}})()`],
 ...layouts('[data-project-recovery=blocked]','blocked'),
 ['download','[data-project-recovery=blocked] button:nth-of-type(2)',`${dir}/downloaded-corrupt-record.txt`],
 click('Retry loading saved project'),wait(`!!document.querySelector('[data-project-recovery=blocked]')`),
 ['eval',`if(localStorage.getItem('${key}')!==sessionStorage.getItem('daily-recovery-corrupt'))throw Error('Retry damaged corrupt record')`],
 ['eval',`localStorage.setItem('${key}',sessionStorage.getItem('daily-recovery-original'))`],click('Retry loading saved project'),
 wait(`!!document.querySelector('[data-project-record-save=saved]')`),
 ['eval',`if(localStorage.getItem('${key}')!==sessionStorage.getItem('daily-recovery-original'))throw Error('Recovery altered original record')`],
 ['screenshot','screenshots/growth/daily-recovery-dev-valid-restored.png']
];
fs.writeFileSync(`${dir}/corrupt-recovery.json`,JSON.stringify(commands,null,2));
fs.writeFileSync(`${dir}/expected-corrupt-record.txt`,corrupt);
const saves=[['set','viewport','1440','1000'],click('Rename project'),['fill','.project-details input','Recovery quota unsaved name'],
 ['eval',`window.__dailySet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k==='${key}')throw new DOMException('Injected quota failure','QuotaExceededError');return window.__dailySet.call(this,k,v)}`],click('Save project name'),wait(`!!document.querySelector('[data-project-save=unsaved]')`),
 ['eval',`(()=>{if(!document.querySelector('[aria-label="Current project"] h2').textContent.includes('Recovery quota unsaved name'))throw Error('Unsaved name lost');if(document.querySelector('[data-project-record-save=saved]'))throw Error('False saved claim');if(JSON.parse(localStorage.getItem('${key}')).name==='Recovery quota unsaved name')throw Error('Quota injection failed');return {unsavedNamePreserved:true}})()`],
 ...layouts('[data-project-save=unsaved]','unsaved'),
 ['eval','Storage.prototype.setItem=window.__dailySet;delete window.__dailySet'],click('Retry saving project'),wait(`!document.querySelector('[data-project-save=unsaved]') && !!document.querySelector('[data-project-record-save=saved]')`),
 ['eval',`if(JSON.parse(localStorage.getItem('${key}')).name!=='Recovery quota unsaved name')throw Error('Retry failed')`],['reload'],click('Sheets'),wait(`document.querySelector('[aria-label="Current project"] h2')?.textContent==='Recovery quota unsaved name' && !!document.querySelector('[data-project-record-save=saved]')`),['screenshot','screenshots/growth/daily-recovery-dev-quota-reloaded.png'],['errors']];
fs.writeFileSync(`${dir}/quota-retry.json`,JSON.stringify(saves,null,2));

