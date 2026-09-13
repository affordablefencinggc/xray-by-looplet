import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/retry';
await mkdir(dir,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9343/json/list')).json();
const page=pages.find(p=>p.id==='E3CFBAA17EA003603A29822C2EA9F368'&&p.url.includes(':8095'));
if(!page)throw Error('Wrong target');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id;const timer=setTimeout(()=>no(Error('deadline '+method)),15000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
try{
 await call('Runtime.enable');
 await call('Runtime.evaluate',{expression:`(()=>{const heading=[...document.querySelectorAll('.assistant-chat-entry.is-assistant h1,.assistant-chat-entry.is-assistant h2,.assistant-chat-entry.is-assistant h3,.assistant-chat-entry.is-assistant h4')].find(x=>x.textContent.trim()==='Developer review');if(!heading)throw Error('Missing review heading');heading.scrollIntoView({block:'start'});return heading.textContent})()`,returnByValue:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/developer-review.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({host:hostname(),target:page.id,at:new Date().toISOString(),screenshot:'developer-review.png'}));
}finally{ws.close()}
