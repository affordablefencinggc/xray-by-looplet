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
 const read=await call('Runtime.evaluate',{expression:`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const s=useStudio.getState();return {job:s.job, workspace:s.workspace, savedProjectRevision:s.savedProjectRevision,saveError:s.saveError,text:document.body.innerText,details:[...document.querySelectorAll('details')].map(x=>({text:x.innerText,open:x.open})),buttons:[...document.querySelectorAll('button')].map(x=>({text:x.innerText,label:x.getAttribute('aria-label')}))}})()`,awaitPromise:true,returnByValue:true});
 const evidence={host:hostname(),target:page.id,at:new Date().toISOString(),...read.result.value};
 await writeFile(dir+'/after.json',JSON.stringify(evidence,null,2));
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/after.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify(evidence));
}finally{ws.close()}
