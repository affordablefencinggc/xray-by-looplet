import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/persistence-retest';
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
 const state=await call('Runtime.evaluate',{expression:`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const job=useStudio.getState().job;const runtime=window[Symbol.for('xray.assistant-chat-runtime.v1')];const record=runtime?.useChats.getState().records[job.id];if(!record||record.busy)throw Error('Missing or busy conversation');const h=runtime.histories.get(job.id);await h.queue;const {readChatArchive}=await import('/src/studio/assistant/chatHistory.ts');const archive=await readChatArchive(job.id);return {job,record,archive,memoryArchive:h.archive}})()`,awaitPromise:true,returnByValue:true});
 if(state.exceptionDetails)throw Error(JSON.stringify(state.exceptionDetails));
 await writeFile(dir+'/preserved-memory.json',JSON.stringify(state.result.value,null,2));
 const recovery=await call('Runtime.evaluate',{expression:`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const jobId=useStudio.getState().job.id;const runtime=window[Symbol.for('xray.assistant-chat-runtime.v1')];const record=runtime.useChats.getState().records[jobId];const h=runtime.histories.get(jobId);const {readChatArchive,putChat,saveChatArchive}=await import('/src/studio/assistant/chatHistory.ts');const disk=await readChatArchive(jobId);const saved={id:record.id,startedAt:record.startedAt,updatedAt:new Date().toISOString(),entries:record.entries,contents:record.contents,busy:false,error:null,...(record.workPacket?{workPacket:record.workPacket}:{})};const archive=putChat(h.archive,saved);const revision=await saveChatArchive(archive,disk?.revision??0);const result=await readChatArchive(jobId);return {revision,archive:result,entriesPreserved:JSON.stringify(result.threads.find(t=>t.id===saved.id).entries)===JSON.stringify(record.entries)}})()`,awaitPromise:true,returnByValue:true});
 if(recovery.exceptionDetails)throw Error(JSON.stringify(recovery.exceptionDetails));
 await writeFile(dir+'/recovery.json',JSON.stringify(recovery.result.value,null,2));
 await call('Page.reload',{ignoreCache:false});
 console.log(JSON.stringify({host:hostname(),at:new Date().toISOString(),recovery:recovery.result.value.entriesPreserved,reloaded:true}));
}finally{ws.close()}
