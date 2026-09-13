import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { createHash } from 'node:crypto';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/report-upgrade-live/download-retry';
await mkdir(dir+'/downloads',{recursive:true});
const version=await(await fetch('http://127.0.0.1:9343/json/version')).json();
const pages=await(await fetch('http://127.0.0.1:9343/json/list')).json();
const target=pages.find(p=>p.id==='E3CFBAA17EA003603A29822C2EA9F368'&&p.url.includes(':8095'));if(!target)throw Error('Wrong target');
const ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((y,n)=>{ws.onopen=y;ws.onerror=n});
let id=0;const pending=new Map();let begun,complete;
ws.onmessage=({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.n(Error(m.error.message)):p.y(m.result)}else if(m.method==='Browser.downloadWillBegin'){begun=m.params;log.push(m);}else if(m.method==='Browser.downloadProgress'&&m.params.state==='completed')complete?.(m.params);};
const call=(method,params={},sessionId)=>new Promise((y,n)=>{const i=++id,timer=setTimeout(()=>n(Error(method+' timeout')),15000);pending.set(i,{y,n,timer});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
const receipts=[];let sessionId; const log=[];
try{
 sessionId=(await call('Target.attachToTarget',{targetId:target.id,flatten:true})).sessionId;
 await call('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:dir+'/downloads',eventsEnabled:true});
 for(const filter of ['all','unassigned']){
  const expression=`(async()=>{const r=document.querySelector('[aria-label="Quantity classification report"]');const s=[...r.querySelectorAll('label')].find(x=>x.textContent.startsWith('Show quantities')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(filter)});s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=[...r.querySelectorAll('button')].find(x=>x.textContent==='Download shown item rows (CSV)');if(!b||b.disabled)throw Error('Download disabled');b.click();return r.innerText})()`;
  begun=null;let timer;const done=new Promise((y,n)=>{timer=setTimeout(()=>y({error:'Download completion timeout'}),15000);complete=y;});
  const click=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true},sessionId);if(click.exceptionDetails)throw Error(JSON.stringify(click.exceptionDetails));
  log.push({click}); const end=await done;clearTimeout(timer);if(end.error)throw Error(end.error);if(!begun||end.guid!==begun.guid||begun.suggestedFilename!=='quantity-draft-items.csv')throw Error('Wrong download receipt');
  const bytes=await readFile(dir+'/downloads/'+end.guid);const text=bytes.toString('utf8');
  if(!text.startsWith('\uFEFF"Hierarchy"'))throw Error('Expected UTF8 CSV');
  const count=text.trim().split('\r\n').length-1;if(count!==(filter==='all'?4:1))throw Error('Item row count mismatch');
  if(filter==='all'&&(!text.includes('"\'=1+1"')||!text.includes('"quoted,""item"""')))throw Error('CSV safety/quoting missing');
  if(filter==='unassigned'&&!text.includes('"b","0.2","m2","unverified","Unassigned"'))throw Error('Filtered item mismatch');
  await writeFile(dir+'/'+filter+'-download.csv',bytes);
  receipts.push({filter,begin:begun,end,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,actualItemRows:count,formulaProtected:filter==='all'?true:null});
 }
 await writeFile(dir+'/download-verdict.json',JSON.stringify({host:hostname(),target:target.id,receipts,pass:true},null,2));
 console.log(JSON.stringify({pass:true,receipts}));
}catch(e){await writeFile(dir+'/failure.json',JSON.stringify({message:String(e),stack:e.stack,log,receipts},null,2));console.error(String(e));process.exitCode=1;}finally{await call('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:false});if(sessionId)await call('Target.detachFromTarget',{sessionId});ws.close();}
