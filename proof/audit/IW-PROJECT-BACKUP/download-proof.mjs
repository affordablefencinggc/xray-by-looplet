// CDP only sets the download destination. The export is triggered through the real UI.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseProjectBackup, backupDigest } from '../../../src/studio/projectBackup.ts';
const cli='.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js';
const endpoint=spawnSync(process.execPath,[cli,'--session','xray-catalogue','get','cdp-url'],{encoding:'utf8',windowsHide:true}).stdout.trim();
const ws=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let serial=0; const pending=new Map(),events=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p[1](Error(JSON.stringify(m.error))):p[0](m.result);}}else events.push(m);};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}));});
try {
  const dir=path.resolve('proof/audit/IW-PROJECT-BACKUP/downloads');fs.mkdirSync(dir,{recursive:true});
  const {targetInfos}=await call('Target.getTargets'),{browserContextIds}=await call('Target.getBrowserContexts');
  const target=targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://localhost:8080/'));
  const context=browserContextIds.includes(target?.browserContextId)?target.browserContextId:undefined;
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir,eventsEnabled:true,...(context?{browserContextId:context}:{})});
  const child=spawn(process.execPath,[cli,'--session','xray-catalogue','batch','--bail'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.stdin.end(JSON.stringify([['tab','t1'],['open','http://localhost:8080/'],['wait','--fn',"!!document.querySelector('[data-hydration-status=ready]')"],['find','role','button','click','--name','Backups','--exact'],['wait','--fn',"document.querySelectorAll('.backup-item').length===1"],['find','role','button','click','--name','Download','--exact']]));
  let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  const code=await new Promise(resolve=>child.on('close',resolve));if(code!==0)throw Error(output);
  for(let n=0;n<150&&!events.some(e=>e.method==='Browser.downloadProgress'&&e.params.state==='completed');n++)await new Promise(resolve=>setTimeout(resolve,100));
  const completed=events.find(e=>e.method==='Browser.downloadProgress'&&e.params.state==='completed');
  if(!completed?.params.filePath)throw Error('Download did not complete.');
  const bytes=fs.readFileSync(completed.params.filePath),value=await parseProjectBackup(bytes.toString('utf8'));
  if(value.assets.length!==1||JSON.parse(value.records.architecture).walls.length!==5)throw Error('Downloaded data differs from saved QA project.');
  fs.writeFileSync('proof/audit/IW-PROJECT-BACKUP/downloaded.xray-backup.json',bytes);
  const result={pass:true,events,output,bytes:bytes.length,sha256:await backupDigest(bytes.toString('utf8')),plans:1,walls:5};
  fs.writeFileSync('proof/audit/IW-PROJECT-BACKUP/download-proof.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally { ws.close(); }
