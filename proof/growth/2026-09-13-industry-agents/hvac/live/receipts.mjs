import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-retry';
const pages=await(await fetch('http://127.0.0.1:9342/json/list')).json();
const page=pages.find(p=>p.id==='C881A561953E464791A17AF4579C59F6');
if(!page||!page.url.startsWith('http://127.0.0.1:8095/'))throw Error('Wrong page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),55000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try {
const receipts=await evaluate(`(async()=>{const jobId=(await import('/src/studio/store.ts')).useStudio.getState().job.id;const archive=await(await import('/src/studio/assistant/chatHistory.ts')).readChatArchive(jobId);return {at:new Date().toISOString(),jobId,activeId:archive?.activeId,entries:archive?.threads.find(t=>t.id===archive.activeId)?.entries,raw:[...document.querySelectorAll('.assistant-receipt-raw')].map(e=>e.textContent),permissions:[...document.querySelectorAll('select')].map(e=>({value:e.value,text:e.selectedOptions[0]?.textContent}))}})()`);
await writeFile(base+'-receipts.json',JSON.stringify(receipts,null,2));console.log(JSON.stringify({at:receipts.at,tools:receipts.entries?.filter(e=>e.kind==='tool').map(e=>({name:e.toolName,text:e.text})),permissions:receipts.permissions}));
}finally{ws.close()}
