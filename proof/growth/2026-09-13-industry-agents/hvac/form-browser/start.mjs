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
try {
await click('Estimate');await wait('.industry-workbench');
await evaluate(`document.querySelector('.industry-workbench summary').click()`);
await evaluate(`(()=>{const e=document.querySelector('.industry-picker select');e.value='hvac';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await wait('[data-draft-industry="hvac"][data-draft-save="saved"]');
await writeFile(base+'-empty.json',JSON.stringify(await evaluate(`({text:document.querySelector('.industry-draft-host').innerText,inputs:[...document.querySelectorAll('.industry-form input')].map(e=>e.value)})`),null,2));
await click('Add straight section');
console.log(await evaluate(`[...document.querySelectorAll('.industry-form input')].map(e=>({id:e.id,type:e.type,label:e.closest('label')?.textContent}))`));
}finally{ws.close()}
