import fs from 'node:fs';
const endpoint='ws://127.0.0.1:55983/devtools/browser/6be5c45e-179d-476d-a3cb-667617787080';
const base='proof/growth/2026-09-08-production-pencil/2026-09-08-8095-pencil-final-01';
const downloadPath='C:/Users/danie/repo/xray-by-looplet/'+base+'/downloads';
const ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;const pending=new Map(),events=[];
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method?.startsWith('Browser.download')){events.push(m);fs.writeFileSync(base+'/download-events.json',JSON.stringify(events,null,2));}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const contexts=await call('Target.getBrowserContexts');if(contexts.browserContextIds.length>1)throw Error('Ambiguous isolated browser context');
const configurations=[];
for(const browserContextId of [undefined,...contexts.browserContextIds]){const params={behavior:'allow',downloadPath,eventsEnabled:true,...(browserContextId?{browserContextId}:{})};await call('Browser.setDownloadBehavior',params);configurations.push(params);}
fs.writeFileSync(base+'/download-configuration.json',JSON.stringify({endpoint,configurations,at:new Date().toISOString()},null,2));
console.log('Configured owned browser normal Windows download paths.');ws.close();
