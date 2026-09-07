// CDP configures the download destination; agent-browser clicks the real export control.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const cli='.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js';
const endpoint=spawnSync(process.execPath,[cli,'--session','xray-sheet-growth','--cdp','50580','get','cdp-url'],{encoding:'utf8',windowsHide:true}).stdout.trim();
const ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let serial=0;const pending=new Map(),events=[];let resolveDownload;
const completion=new Promise(resolve=>{resolveDownload=resolve;});
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p[1](Error(JSON.stringify(m.error))):p[0](m.result);}}else{events.push(m);if(m.method==='Browser.downloadProgress'&&m.params.state==='completed')resolveDownload(m.params);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}));});
try{
 const dir=path.resolve('proof/growth/2026-09-07-sheets/downloads');fs.mkdirSync(dir,{recursive:true});
 const {targetInfos}=await call('Target.getTargets'),{browserContextIds}=await call('Target.getBrowserContexts');
 const target=targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:8080/'));
 const context=browserContextIds.includes(target?.browserContextId)?target.browserContextId:undefined;
 await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir,eventsEnabled:true,...(context?{browserContextId:context}:{})});
 const result=spawnSync(process.execPath,[cli,'--session','xray-sheet-growth','--cdp','50580','batch','--bail'],{input:JSON.stringify([['find','role','button','click','--name','Export sheet register','--exact']]),encoding:'utf8',windowsHide:true,timeout:15000});
 if(result.status!==0||result.error)throw Error(result.stderr||String(result.error));
 let deadline;const done=await Promise.race([completion,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Export did not complete')),15000);})]);clearTimeout(deadline);
 const bytes=fs.readFileSync(done.filePath),value=JSON.parse(bytes.toString('utf8'));
 if(value.sheets.length!==13||value.sheets.slice(0,3).map(p=>p.originalPage).join()!=='3,2,1'||value.sheets.slice(0,3).map(p=>p.discipline).join()!=='Architecture,Civil,Structural')throw Error('Ordered export mismatch');
 if(value.sheets.find(p=>p.originalPage===2)?.bookmarks[0]?.name!=='Drainage junction')throw Error('Saved view missing from register export');
 fs.writeFileSync('proof/growth/2026-09-07-sheets/ordered-register.json',bytes);
 const proof={pass:true,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),events,sourceSha:value.source.sha256,order:value.sheets.map(p=>p.originalPage)};
 fs.writeFileSync('proof/growth/2026-09-07-sheets/download-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{ws.close();}
