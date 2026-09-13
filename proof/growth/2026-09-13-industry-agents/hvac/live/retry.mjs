import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-retry';
const pages=await(await fetch('http://127.0.0.1:9342/json/list')).json();
const page=pages.find(p=>p.id==='C881A561953E464791A17AF4579C59F6');
if(!page||!page.url.startsWith('http://127.0.0.1:8095/'))throw Error('Wrong page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),20000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try {
const win=await call('Browser.getWindowForTarget',{targetId:page.id});await call('Browser.setWindowBounds',{windowId:win.windowId,bounds:{width:1280,height:900}});
const before=await evaluate(`(async()=>({at:new Date().toISOString(),job:JSON.parse(JSON.stringify((await import('/src/studio/store.ts')).useStudio.getState().job)),text:document.body.innerText,choices:[...document.querySelectorAll('label')].filter(e=>e.textContent.includes('Read only')).map(e=>e.outerHTML)}))()`);
await writeFile(base+'-before.json',JSON.stringify(before,null,2));console.log(JSON.stringify({choices:before.choices,jobId:before.job.id}));
await evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.textContent==='Read only'));if(!s)throw Error('No permission select');const option=[...s.options].find(o=>o.textContent==='Read only');s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));return s.value})()`);
await evaluate(`(()=>{const t=document.querySelector('textarea');if(!t)throw Error('No composer');t.focus()})()`);
await call('Input.insertText',{text:'Read-only HVAC QA. Inspect this actual project and the tools available now. Can you perform source-backed straight duct takeoff here today? Use an actual project/evidence read tool if available, then state the current source/calibration state and exactly which actions you executed. Do not create, import, draw, measure, save, or invent a source. Distinguish live executable capabilities from unconnected draft helpers and engineering sizing. End with Developer review: outcome, friction, improvement, grounded in the tool receipts from this turn.'});
await evaluate(`(()=>{const b=document.querySelector('button[aria-label="Send assistant message"]');if(!b||b.disabled)throw Error('Send disabled');b.click()})()`);
console.log('SENT');
}finally{ws.close()}
