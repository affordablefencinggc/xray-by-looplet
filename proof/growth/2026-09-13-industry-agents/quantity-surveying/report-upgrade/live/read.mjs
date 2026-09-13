import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/report-upgrade-live';
await mkdir(dir,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9343/json/list')).json();
const page=pages.find(p=>p.id==='E3CFBAA17EA003603A29822C2EA9F368'&&p.url.includes(':8095'));
if(!page)throw Error('Wrong target');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id;const timer=setTimeout(()=>no(Error('deadline '+method)),60000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
try{
 await call('Runtime.enable');
 const wait=await call('Runtime.evaluate',{expression:`new Promise(resolve=>{const ready=()=>!document.querySelector('.assistant-working')&&(document.querySelector('.assistant-chat-entry.is-assistant')||document.querySelector('.assistant-chat-error'));if(ready())return resolve('settled');const observer=new MutationObserver(()=>{if(ready()){clearTimeout(timer);observer.disconnect();resolve('settled')}});const timer=setTimeout(()=>{observer.disconnect();resolve('deadline')},45000);observer.observe(document.body,{subtree:true,childList:true,characterData:true})})`,awaitPromise:true,returnByValue:true});
 const read=await call('Runtime.evaluate',{expression:`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const s=useStudio.getState();const {readChatArchive}=await import('/src/studio/assistant/chatHistory.ts');return {storage:Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes('industry')).map(k=>[k,localStorage.getItem(k)])),archive:await readChatArchive(s.job.id),job:s.job, workspace:s.workspace, savedProjectRevision:s.savedProjectRevision,saveError:s.saveError,busy:!!document.querySelector('.assistant-working'),errors:[...document.querySelectorAll('.assistant-chat-error')].map(x=>x.innerText),text:document.body.innerText,entries:[...document.querySelectorAll('.assistant-chat-entry')].map(x=>({class:x.className,tool:x.getAttribute('data-tool'),failed:x.getAttribute('data-failed'),text:x.textContent})),details:[...document.querySelectorAll('details')].map(x=>({text:x.innerText,open:x.open})),buttons:[...document.querySelectorAll('button')].map(x=>({text:x.innerText,label:x.getAttribute('aria-label')}))}})()`,awaitPromise:true,returnByValue:true});
 const evidence={host:hostname(),target:page.id,at:new Date().toISOString(),...read.result.value};
 await writeFile(dir+'/'+(process.argv[2]||'after')+'.json',JSON.stringify(evidence,null,2));
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/'+(process.argv[2]||'after')+'.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({at:evidence.at,busy:evidence.busy,errors:evidence.errors,job:evidence.job?.id,archiveRevision:evidence.archive?.revision,entries:evidence.entries.slice(-3)}));
}finally{ws.close()}


