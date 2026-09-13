import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-reporting';
const pages=await(await fetch('http://127.0.0.1:9342/json/list')).json();
const page=pages.find(p=>p.id==='C881A561953E464791A17AF4579C59F6');
if(!page||!page.url.startsWith('http://127.0.0.1:8095/'))throw Error('Wrong page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),55000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try {
await evaluate(`new Promise((resolve,reject)=>{const ready=()=>!document.querySelector('button[aria-label="Stop assistant response"]');if(ready())return resolve(true);const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();clearTimeout(timer);resolve(true)}});const timer=setTimeout(()=>{observer.disconnect();reject(Error('Still running'))},45000);observer.observe(document.body,{subtree:true,childList:true,attributes:true})})`);
const after=await evaluate(`(async()=>{if(document.querySelector('button[aria-label="Stop assistant response"]'))throw Error('Still running');const job=JSON.parse(JSON.stringify((await import('/src/studio/store.ts')).useStudio.getState().job));const archive=await(await import('/src/studio/assistant/chatHistory.ts')).readChatArchive(job.id);const thread=archive?.threads.find(t=>t.id===archive.activeId);const entries=thread?.entries||[];const start=entries.findLastIndex(e=>e.kind==='user'&&e.text.startsWith('Concurrent read-only QA for hvac.'));if(start<0)throw Error('No requested turn');return {at:new Date().toISOString(),job,entries:entries.slice(start),busy:thread.busy,error:thread.error,text:document.body.innerText}})()`);
await writeFile(base+'-after.json',JSON.stringify(after,null,2));
await evaluate(`(()=>{const h=[...document.querySelectorAll('h3,h4')].filter(e=>e.textContent==='Developer review').at(-1);h?.scrollIntoView({block:'start'})})()`);
const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(base+'-result.png',Buffer.from(shot.data,'base64'));
console.log(JSON.stringify({at:after.at,entries:after.entries,error:after.error,busy:after.busy}));
}finally{ws.close()}
