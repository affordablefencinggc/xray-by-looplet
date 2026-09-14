import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { FastCdpBatch } from 'file:///C:/Users/danie/Documents/AtomicLedgerQualification/2026-09-08/qualification/scripts/fast-cdp.mjs';
if(hostname().toLowerCase()!=='dans1') throw Error('Wrong host');
const campaign=process.argv[2];
if(campaign!=='production') throw Error('Unknown campaign');
const output='live-'+campaign+'-'+new Date().toISOString().replace(/[:.]/g,'-'); await mkdir(output);
const [port,path]=(await readFile(process.argv[3]+'/DevToolsActivePort','utf8')).trim().split(/\r?\n/);
const ws=new WebSocket('ws://127.0.0.1:'+port+path);
await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const pending=new Map(),errors=[],loaded=new Set(),loadWaiters=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Page.lifecycleEvent'&&m.params.name==='DOMContentLoaded'){loaded.add(m.params.loaderId);for(const f of loadWaiters.splice(0))f()}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.no(Error(m.error.message)):p.yes(m.result)}};
const socket={call:(method,params={},sessionId)=>new Promise((yes,no)=>{const next=++id,timer=setTimeout(()=>{pending.delete(next);no(Error(method+' deadline'))},330000);pending.set(next,{yes,no,timer});ws.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}))})};
socket.evaluate=async(expression,sessionId)=>{const r=await socket.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));if(m.method==='Network.loadingFailed'&&!m.params.canceled)errors.push(m.params.errorText)});
const batch=new FastCdpBatch(socket,output),commands=[];
async function run(ops){for(const op of ops){commands.push(op);await batch.run([op]);if(op[0]==='navigate'){const loader=batch.receipts.at(-1).value.loaderId;if(!loaded.has(loader))await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('DOM navigation deadline')),15000);const check=()=>{if(loaded.has(loader)){clearTimeout(timer);yes()}else loadWaiters.push(check)};loadWaiters.push(check)})}}}
const ready="document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'";
let error,session;const version=await socket.call('Browser.getVersion');
try{
 await run([['context','app']]);session=batch.contexts.get('app').sessionId;
 for(const method of ['Runtime.enable','Network.enable'])await socket.call(method,{},session);
 await socket.call('Page.setLifecycleEventsEnabled',{enabled:true},session);
 await socket.call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},session);
 await run([['navigate','app','http://127.0.0.1:8081/'],['wait','app',ready],['eval','app',`(()=>{if(!document.body.innerText.includes('Open a drawing'))throw Error('Root content absent');return {title:document.title,text:document.body.innerText.slice(0,600)}})()`],['screenshot','app','desktop-production-root.png'],['eval','app',`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Design').click();true`],['wait','app',`[...document.querySelectorAll('button,a')].some(b=>b.textContent.includes('Architectural workspace'))`],['eval','app',`[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Architectural workspace')).click();true`],['wait','app',`!!document.querySelector('.alteration-panel')`],['eval','app',`document.querySelector('.alteration-panel').open=true;document.querySelector('.alteration-panel').scrollIntoView({block:'center'});true`],['screenshot','app','desktop-production-editor.png']]);
 await socket.call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false},session);
 await run([['eval','app',`(()=>{const p=document.querySelector('.alteration-panel');p.scrollIntoView({block:'center'});const r=p.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1)throw Error('Editor outside viewport');return {panel:r.toJSON(),viewport:innerWidth}})()`],['screenshot','app','tablet-production-editor.png']]);
 if(errors.length)throw Error('Production console or network failure');
}catch(e){error=e;await run([['screenshot','app','failure.png']]).catch(()=>{})}
finally{try{await batch.cleanup()}catch(e){error??=e}await socket.call('Browser.close').catch(()=>{});ws.close();const report={host:hostname(),version,campaign,verdict:error?'FAIL':'PASS',error:error?.message,errors,cleanup:batch.contexts.size===0,build:'09c014abc002',sourceHash:'01ba3ae5b2312f46d45bde08ac3b36d7d3d6ad0c8a9b6d722ee3d61d65af2080',receipts:batch.receipts};await writeFile(output+'/scenario.json',JSON.stringify(commands,null,2));await writeFile(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,receipts:undefined}));}
if(error)process.exitCode=1;
