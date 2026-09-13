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
const win=await call('Browser.getWindowForTarget',{targetId:page.id});await call('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});await call('Browser.setWindowBounds',{windowId:win.windowId,bounds:{left:0,top:0,width:1280,height:900}});
await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
await evaluate(`(()=>{const h=[...document.querySelectorAll('h3,h4')].find(e=>e.textContent==='Developer review');h?.scrollIntoView({block:'start'});return !!h})()`);
const viewport=await evaluate(`({width:innerWidth,height:innerHeight,at:new Date().toISOString()})`);console.log(JSON.stringify(viewport));
const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(base+'-developer.png',Buffer.from(shot.data,'base64'));
}finally{ws.close()}
