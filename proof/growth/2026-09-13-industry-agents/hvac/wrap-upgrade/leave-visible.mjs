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
await click('Estimate');
await wait('.industry-draft-host');
await evaluate(`(()=>{const d=document.querySelector('.industry-draft-host');d.closest('details').open=true; const s=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.value==='hvac'));if(s){s.value='hvac';s.dispatchEvent(new Event('change',{bubbles:true}))}})()`);
await click('Calculate duct draft');await wait('[aria-label="External wrap draft result"]');
const result=await snapshot();if(!result.result.includes('18.5 m'))throw Error('Final manual result mismatch');
await evaluate(`document.querySelector('[aria-label="External wrap draft result"]').scrollIntoView({block:'center'})`);
await writeFile(base+'-corrected-final-visible.json',JSON.stringify(result,null,2));
await writeFile(base+'-corrected-final-visible.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('Final worksheet18.5 visible; assistant idle');
}finally{ws.close()}