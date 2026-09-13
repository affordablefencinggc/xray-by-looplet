import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-wrap';
const pages=await(await fetch('http://127.0.0.1:9342/json/list')).json();
const page=pages.find(p=>p.id==='C881A561953E464791A17AF4579C59F6');
if(!page||!page.url.startsWith('http://127.0.0.1:8095/'))throw Error('Wrong page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),20000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const click=async(text)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button,summary')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('missing '+${JSON.stringify(text)});b.click()})()`);
const wait=async(selector)=>evaluate(`new Promise((resolve,reject)=>{if(document.querySelector(${JSON.stringify(selector)}))return resolve(true);const o=new MutationObserver(()=>{if(document.querySelector(${JSON.stringify(selector)})){o.disconnect();resolve(true)}});o.observe(document.body,{subtree:true,childList:true,attributes:true});setTimeout(()=>{o.disconnect();reject(Error('wait timeout'))},10000)})`);
const fill=async(suffix,text)=>{await evaluate(`(()=>{const e=document.querySelector('input[id$="'+${JSON.stringify(suffix)}+'"]');if(!e)throw Error('missing field');e.focus();e.select()})()`);await call('Input.insertText',{text})};
const snapshot=async()=>evaluate(`({at:new Date().toISOString(),text:document.querySelector('.industry-draft-host').innerText,save:document.querySelector('.industry-draft-host').dataset.draftSave,inputs:[...document.querySelectorAll('.industry-form input')].map(e=>({id:e.id,value:e.value,checked:e.checked})),result:document.querySelector('.industry-result')?.innerText})`);
try {
const before=await evaluate(`(async()=>JSON.parse(JSON.stringify((await import('/src/studio/store.ts')).useStudio.getState().job)))()`);await writeFile(base+'-project-before.json',JSON.stringify(before));
await evaluate(`(()=>{const e=[...document.querySelectorAll('.industry-form label')].find(e=>e.textContent.includes('Include external insulation wrap')).querySelector('input');if(!e.checked)e.click()})()`);
await fill('-insulationThicknessM','.025');await fill('-insulationThicknessM-ref','Synthetic wrap thickness explicitly supplied');await fill('-longitudinalOverlapM','.05');await fill('-longitudinalOverlapM-ref','Synthetic longitudinal lap explicitly supplied');
await click('Calculate duct draft');await wait('[aria-label="External wrap draft result"]');
let state=await snapshot();if(!state.result.includes('18.5 m')||!state.result.includes('16 m')||!state.result.includes('64 kg'))throw Error('Wrong initial result');
await writeFile(base+'-initial.json',JSON.stringify(state,null,2));
await fill('-longitudinalOverlapM','.1');if(await evaluate(`!!document.querySelector('.industry-result')`))throw Error('Stale output');
await click('Calculate duct draft');if(!(await snapshot()).result.includes('19 m'))throw Error('Wrong edited result');
for(const [field,value] of [['-insulationThicknessM','0'],['-insulationThicknessM','']]){await fill(field,value);await click('Calculate duct draft');await wait('[role="alert"]');if(await evaluate(`!!document.querySelector('.industry-result')`))throw Error('Invalid input kept result')}
await fill('-insulationThicknessM','.025');await fill('-longitudinalOverlapM-ref','');await click('Calculate duct draft');await wait('[role="alert"]');
const error=await evaluate(`document.querySelector('[role="alert"]').textContent`);if(!error.includes('source reference'))throw Error('Missing reference not rejected');
await fill('-longitudinalOverlapM-ref','Synthetic longitudinal lap explicitly supplied');await fill('-longitudinalOverlapM','.05');await click('Calculate duct draft');await wait('[data-draft-save="saved"]');
await evaluate(`document.querySelector('[aria-label="External wrap draft result"]').scrollIntoView({block:'center'})`);
await writeFile(base+'-desktop.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await call('Emulation.setDeviceMetricsOverride',{width:1000,height:900,deviceScaleFactor:1,mobile:false});
const layout=await evaluate(`({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,result:document.querySelector('[aria-label="External wrap draft result"]').getBoundingClientRect().toJSON()})`);
await writeFile(base+'-tablet.json',JSON.stringify(layout));await writeFile(base+'-tablet.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));await call('Emulation.clearDeviceMetricsOverride');
await call('Page.reload');await wait('[data-workspace-hydration="ready"]');
console.log('Reloaded; manual checks pass');
}catch(e){await writeFile(base+'-failure.txt',String(e));throw e}finally{ws.close()}