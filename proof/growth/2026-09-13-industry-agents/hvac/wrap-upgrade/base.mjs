import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-form';
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
await evaluate(`(()=>{const b=[...document.querySelectorAll(".industry-form button")].find(e=>e.textContent==="Remove section 2");if(b)b.click()})()`);
for(const [key,value]of Object.entries({'-name':'HVAC-UI-1','-lengthM':'10','-lengthM-ref':'Synthetic UI length supplied by user','-widthM':'.5','-widthM-ref':'Synthetic UI width supplied by user','-heightM':'.3','-heightM-ref':'Synthetic UI height supplied by user'}))await fill(key,value);
await evaluate(`(()=>{const e=document.querySelector('.industry-form input[type="checkbox"]');if(!e.checked)e.click()})()`);
await fill('-sheetMassKgPerM2','4');await fill('-sheetMassKgPerM2-ref','Synthetic supplier sheet mass supplied by user');
await click('Calculate duct draft');await wait('.industry-result');
const first=await snapshot();if(!first.result.includes('16 m')||!first.result.includes('64 kg'))throw Error('wrong totals');
await writeFile(base+'-calculated.json',JSON.stringify(first,null,2));
await fill('-lengthM','20');if(await evaluate(`Boolean(document.querySelector('.industry-result'))`))throw Error('stale result remains');
await writeFile(base+'-invalidated.json',JSON.stringify(await snapshot(),null,2));
await click('Calculate duct draft');await wait('.industry-result');const edited=await snapshot();if(!edited.result.includes('32 m')||!edited.result.includes('128 kg'))throw Error('edited totals wrong');
await fill('-lengthM','10');await click('Calculate duct draft');await wait('[data-draft-save="saved"]');
await evaluate(`document.querySelector('.industry-result').scrollIntoView({block:'center'})`);
await writeFile(base+'-result.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await writeFile(base+'-final.json',JSON.stringify({edited,final:await snapshot()},null,2));console.log('PASS 16/64, edit invalidation, 32/128, restored16/64 and saved');
}finally{ws.close()}


