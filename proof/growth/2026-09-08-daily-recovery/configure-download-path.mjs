// Harness-only configuration; journeys remain agent-browser JSON opcodes.
// Endpoint discovered through `get cdp-url` in isolated growth-daily-recovery.
import fs from 'node:fs';
const endpoint='ws://127.0.0.1:51633/devtools/browser/13b23cf2-05c9-426a-9151-71a036cef5c4';
const directory='C:/Users/danie/repo/xray-by-looplet/proof/growth/2026-09-08-daily-recovery/downloads';
fs.mkdirSync(directory,{recursive:true});
const ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
try {const {browserContextIds}=await call('Target.getBrowserContexts');if(browserContextIds.length>1)throw Error('Ambiguous isolated browser context');const params={behavior:'allow',downloadPath:directory,eventsEnabled:true,...(browserContextIds[0]?{browserContextId:browserContextIds[0]}:{})};await call('Browser.setDownloadBehavior',params);fs.writeFileSync('proof/growth/2026-09-08-daily-recovery/download-path-configuration.json',JSON.stringify({endpoint,method:'Browser.setDownloadBehavior',params,success:true},null,2));console.log('Configured isolated browser download path without extended Windows prefix.');}finally{ws.close()}
