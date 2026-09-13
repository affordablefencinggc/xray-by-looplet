import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying';
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
 const result=await call('Runtime.evaluate',{expression:`({title:document.title,text:document.body.innerText,inputs:[...document.querySelectorAll('textarea,input,select')].map(b=>({tag:b.tagName,type:b.type,placeholder:b.getAttribute('placeholder'),label:b.getAttribute('aria-label'),value:b.type==='password'?'[redacted]':b.value})),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText,label:b.getAttribute('aria-label'),disabled:b.disabled}))})`,returnByValue:true});
 const evidence={host:hostname(),target:page.id,at:new Date().toISOString(),...result.result.value};
 await writeFile(dir+'/before.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{ws.close()}
