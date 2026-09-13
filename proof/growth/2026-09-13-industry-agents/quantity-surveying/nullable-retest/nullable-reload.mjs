import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/nullable-retest';
await mkdir(dir,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9343/json/list')).json();
const page=pages.find(p=>p.id==='E3CFBAA17EA003603A29822C2EA9F368'&&p.url.includes(':8095'));
if(!page)throw Error('Wrong target');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id;const timer=setTimeout(()=>no(Error('deadline '+method)),60000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const mode=process.argv[2]??'inspect';
try {
 await call('Page.reload');
 let ready=false; for(let attempt=0;attempt<30;attempt++){try{const r=await call('Runtime.evaluate',{expression:"!!document.querySelector('.studio-shell, .app-shell') || !![...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Estimate')",returnByValue:true});if(r.result?.value){ready=true;break}}catch{} await new Promise(r=>setTimeout(r,250))}if(!ready)throw Error('Reload not ready');
 const result=await call('Runtime.evaluate',{expression: await (await import('node:fs/promises')).readFile(process.argv[3],'utf8'),awaitPromise:true,returnByValue:true});
 await writeFile(dir+'/'+mode+'.json',JSON.stringify(result,null,2));
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/'+mode+'.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify(result));
}finally{ws.close()}


