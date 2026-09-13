import { readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
if(hostname().toLowerCase()!=='dans1') throw Error('Wrong host');
const root='C:/Users/danie/XRayBuilds/industry-visible-20260913/roofing/';
const pages=await(await fetch('http://127.0.0.1:9341/json/list')).json();
const page=pages.find(p=>p.id==='5109CD8477EBCCE9F4120D7C41B7DA12'&&p.url.includes(':8095'));
if(!page) throw Error('Expected roofing target missing');
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0; const pending=new Map(), errors=[];
ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id); if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),55000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
try {
 await call('Runtime.enable'); await call('Log.enable');
 const ops=JSON.parse(await readFile(root+process.argv[2],'utf8')); const receipts=[];
 for(const op of ops){const start=Date.now(); if(op.kind==='eval'){const r=await call('Runtime.evaluate',{expression:op.expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));receipts.push({name:op.name,ms:Date.now()-start,value:r.result.value});}
 else if(op.kind==='reload'){await call('Page.reload');receipts.push({name:op.name,ms:Date.now()-start});}
 else if(op.kind==='viewport'){await call('Emulation.setDeviceMetricsOverride',{width:op.width,height:op.height,deviceScaleFactor:1,mobile:false});receipts.push({name:op.name,width:op.width,height:op.height});}
 else if(op.kind==='clearViewport'){await call('Emulation.clearDeviceMetricsOverride');receipts.push({name:op.name});}
 else if(op.kind==='desktop'){const w=await call('Browser.getWindowForTarget',{targetId:page.id});await call('Browser.setWindowBounds',{windowId:w.windowId,bounds:{width:1280,height:900,windowState:'normal'}});receipts.push({name:op.name,ms:Date.now()-start,windowId:w.windowId});}
 else if(op.kind==='screenshot'){const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(root+op.name+'.png',Buffer.from(r.data,'base64'));receipts.push({name:op.name,ms:Date.now()-start});} else throw Error('Unknown opcode');}
 const result={host:hostname(),timestamp:new Date().toISOString(),target:page.id,errors,receipts}; await writeFile(root+process.argv[2]+'.result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {ws.close();}
