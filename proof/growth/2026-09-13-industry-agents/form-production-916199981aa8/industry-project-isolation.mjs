import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {hostname} from 'node:os';
import {FastCdpBatch} from './fast-cdp.mjs';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const [runId,origin]=process.argv.slice(2);
if(!/^[a-f0-9]{12}$/.test(runId)||!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Bad campaign arguments');
const root=`C:/Users/danie/XRayBuilds/runs/${runId}`;
const output=root+'/industry-project-isolation';await mkdir(output,{recursive:true});
const version=await(await fetch('http://127.0.0.1:9341/json/version')).json();
const ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const pending=new Map(),errors=[];
ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.no(Error(m.error.message)):p.yes(m.result)}else if(m.method==='Runtime.exceptionThrown'||(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'))errors.push(m)};
const socket={call(method,params={},sessionId){return new Promise((yes,no)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);no(Error(method+' deadline'))},20000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));})},async evaluate(expression,sessionId){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}};
const batch=new FastCdpBatch(socket,output);
const commands=[];let error;
const run=async ops=>{commands.push(...ops);await batch.run(ops)};
try{
 const launch=await socket.call('Browser.getBrowserCommandLine');
 if(launch.arguments.some(x=>/^--(no-sandbox|disable-gpu-sandbox|single-process)/.test(x)))throw Error('Unsafe launch');
 await run([['context','production'],['viewport','production',1280,900]]);
 const s=batch.contexts.get('production').sessionId;await socket.call('Runtime.enable',{},s);
 await run([['navigate','production',origin],['wait','production',`document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready'`],['eval','production',`(()=>{if(document.querySelector('.rail-assistant-toggle'))throw Error('Orphan rail button on closed Drawings');return true})()`],['screenshot','production','desktop-drawings.png']]);
 for(const label of ['Takeoff','Design','Visualise','Estimate','Drawings']){
  await run([['eval','production',`(()=>{const b=[...document.querySelectorAll('.workflow-main-tabs button')].find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw Error('Missingtab');b.click()})()`],['wait','production',`[...document.querySelectorAll('.workflow-main-tabs button')].some(b=>b.textContent===${JSON.stringify(label)}&&b.getAttribute('aria-current')==='page')`]]);
 }
 await run([['viewport','production',1024,768],['eval','production',`(()=>{if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');return {text:document.body.innerText.slice(0,1600),width:innerWidth,height:innerHeight}})()`],['screenshot','production','tablet-drawings.png']]);

 const ev=expression=>['eval','production',expression], wait=expression=>['wait','production',expression];
 const fill=(selector,value)=>ev(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});if(!i)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const openRoof=async()=>run([ev(`[...document.querySelectorAll('.workflow-main-tabs button')].find(b=>b.textContent==='Estimate').click()`),wait(`!!document.querySelector('.industry-workbench')`),ev(`(()=>{const d=document.querySelector('.industry-workbench');if(!d.open)d.querySelector('summary').click()})()`),wait(`document.querySelector('[data-draft-industry="roofing"]')?.dataset.draftSave==='saved'`)]);
 const openLibrary=async()=>run([ev(`document.querySelector('.project-menu-trigger').click()`),wait(`!!document.querySelector('.project-library-trigger')`),ev(`document.querySelector('.project-library-trigger').click()`),wait(`!!document.querySelector('.project-library-new input')`)]);
 const closeLibrary=async()=>run([ev(`document.querySelector('[aria-label="Close Project library"]').click()`),ev(`document.querySelector('[aria-label="Close Project"]').click()`)]);
 await openRoof();
 await run([fill('input[id$="plane-0-name"]','QA project A plane'),wait(`document.querySelector('[data-draft-save]')?.dataset.draftSave==='saved' && document.querySelector('input[id$="plane-0-name"]')?.value==='QA project A plane'`)]);
 await openLibrary();
 await run([fill('[aria-label="New project name"]','QA isolated worksheet B'),ev(`[...document.querySelectorAll('.project-library-new button')].find(b=>b.textContent==='Create project').click()`),wait(`document.querySelector('.project-identity button')?.textContent==='QA isolated worksheet B' && document.querySelector('.project-library')?.getAttribute('aria-busy')==='false'`)]);
 await closeLibrary();await openRoof();
 await run([ev(`(()=>{const i=document.querySelector('input[id$="plane-0-name"]');if(i.value!=='')throw Error('Another project inherited roof inputs');return {project:document.querySelector('.project-identity button').textContent,blank:true}})()`),fill('input[id$="plane-0-name"]','QA project B independent plane'),wait(`document.querySelector('[data-draft-save]')?.dataset.draftSave==='saved'`)]);
 await openLibrary();
 await run([ev(`(()=>{const row=[...document.querySelectorAll('.project-library-list li')].find(r=>r.querySelector('strong').textContent==='New project');if(!row)throw Error('Original QA project missing');[...row.querySelectorAll('button')].find(b=>b.textContent==='Open').click()})()`),wait(`document.querySelector('.project-identity button')?.textContent==='New project' && document.querySelector('.project-library')?.getAttribute('aria-busy')==='false'`)]);
 await closeLibrary();await openRoof();
 await run([ev(`(()=>{const i=document.querySelector('input[id$="plane-0-name"]');if(i.value!=='QA project A plane')throw Error('Original project draft was replaced');document.querySelector('.industry-workbench').scrollIntoView({block:'start'});return {project:document.querySelector('.project-identity button').textContent,plane:i.value}})()`),['screenshot','production','project-a-retained.png']]);
 if(errors.length)throw Error('Browser errors observed: '+errors.length);
}catch(e){error=e;try{await run([['screenshot','production','failure.png']])}catch{}}
finally{let cleanup=true;try{await batch.cleanup()}catch(e){cleanup=false;error ||= e}ws.close();await writeFile(output+'/result.json',JSON.stringify({host:hostname(),runId,version,source:JSON.parse((await readFile(root+'/completion.json','utf8')).replace(/^\uFEFF/,'')),verdict:error?'FAIL':'PASS',error:error?.message,cleanup,errors,commands,receipts:batch.receipts},null,2));console.log(JSON.stringify({runId,verdict:error?'FAIL':'PASS',error:error?.message,cleanup,operations:batch.receipts.length}));}
if(error)process.exitCode=1;

