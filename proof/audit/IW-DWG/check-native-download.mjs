// Configure WebView2's download destination via CDP. All UI actions still use
// agent-browser; its `download` command cancels downloads in this WebView2 session.
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const catalogue=process.argv.includes('--catalogue');
const cli='.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js';
const endpoint=catalogue
 ? spawnSync(process.execPath,[cli,'--session','xray-catalogue','get','cdp-url'],{encoding:'utf8',windowsHide:true}).stdout.trim()
 : (await (await fetch('http://127.0.0.1:9248/json/version')).json()).webSocketDebuggerUrl;
const ws=new WebSocket(endpoint);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let serial=0;const pending=new Map();const events=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p[1](Error(JSON.stringify(m.error))):p[0](m.result);}}else{events.push(m);}};
const call=(method,params={})=>new Promise((r,j)=>{const id=++serial;pending.set(id,[r,j]);ws.send(JSON.stringify({id,method,params}));});
const downloadPath=path.resolve('proof/audit/IW-DWG/downloads');fs.mkdirSync(downloadPath,{recursive:true});
try{
 const {targetInfos}=await call('Target.getTargets');
 const target=targetInfos.find(t=>t.type==='page' && (catalogue?t.url.includes('/industry-coverage/'):t.url.startsWith('http://tauri.localhost')));
 const {browserContextIds}=await call('Target.getBrowserContexts');
 const context=browserContextIds.includes(target?.browserContextId)?target.browserContextId:undefined;
 await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath,eventsEnabled:true,...(context?{browserContextId:context}:{})});
 const child=spawn(process.execPath,[cli,'--session',catalogue?'xray-catalogue':'xray-dwg-native',...(catalogue?[]:['--cdp','9248']),'batch','--bail'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdin.end(JSON.stringify(catalogue?[['tab','t1'],['click','a[href="requirements.csv"]']]:[['tab','t1'],['find','role','button','click','--name','Export DWG','--exact']]));
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 await new Promise(r=>child.on('close',r));
 for(let n=0;n<100&&!events.some(e=>e.method==='Browser.downloadProgress'&&e.params.state!=='inProgress');n++)await new Promise(r=>setTimeout(r,100));
 const completed=events.find(e=>e.method==='Browser.downloadProgress'&&e.params.state==='completed');
 if(!completed?.params.filePath)throw Error('No successful file download');
 const bytes=fs.readFileSync(completed.params.filePath);
 if(catalogue?!bytes.equals(fs.readFileSync('public/industry-coverage/requirements.csv')):bytes.subarray(0,6).toString()!=='AC1027')throw Error('Unexpected downloaded content');
 const name=catalogue?'catalogue-ui-requirements.csv':'native-ui-export.dwg';
 fs.writeFileSync(path.resolve('proof/audit/IW-DWG',name),bytes);
 const result={pass:true,output,events,savedAs:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 fs.writeFileSync(`proof/audit/IW-DWG/${catalogue?'catalogue':'native'}-download-events.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally{ws.close();}
