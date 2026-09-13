import {writeFile, mkdir} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const dir='C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/focused-retest';
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
 const window = await call('Browser.getWindowForTarget',{targetId:page.id});
 await call('Browser.setWindowBounds',{windowId:window.windowId,bounds:{width:1280,height:900}});
 const before=await call('Runtime.evaluate',{expression:`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const s=useStudio.getState();return {job:s.job, workspace:s.workspace, savedProjectRevision:s.savedProjectRevision,saveError:s.saveError}})()`,awaitPromise:true,returnByValue:true});
 await writeFile(dir+'/project-before.json',JSON.stringify(before,null,2));
 const prompt="Independently cross-check these explicit manual inputs from the Quantity classification worksheet by actually executing classify_draft_quantities. You have no worksheet-read tool; do not claim to have read the form. Current project ID is job-1f3f51c1-4210-4d76-820b-4508cdf59918. Fixture: {\"hierarchyId\":\"QA manual hierarchy\",\"hierarchyRevision\":\"1\",\"nodes\":[{\"id\":\"walls\",\"label\":\"Walls\",\"parentId\":null}],\"items\":[{\"id\":\"a\",\"quantity\":\"0.1\",\"unit\":\"m2\",\"evidence\":\"unverified\",\"source\":null},{\"id\":\"b\",\"quantity\":\"0.2\",\"unit\":\"m2\",\"evidence\":\"unverified\",\"source\":null}],\"assignments\":[{\"itemId\":\"a\",\"nodeId\":\"walls\"},{\"itemId\":\"b\",\"nodeId\":\"walls\"}]}. Use this project as expectedJobId, leave all project data unchanged. State actual receipt totals, classified/unclassified amounts, quote eligibility and a concise Developer review of this current execution. No mental-arithmetic substitute.";
 const sent=await call('Runtime.evaluate',{expression:`(()=>{if(window.__qsFocusedRetestSent)throw Error('Already sent');const select=document.querySelector('select[aria-label="Assistant permissions"]');if(!select)throw Error('Permissions absent');const option=[...select.options].find(x=>x.textContent.trim()==='Read only');if(!option)throw Error('Read only absent');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,option.value);select.dispatchEvent(new Event('change',{bubbles:true}));const area=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,${JSON.stringify(prompt)});area.dispatchEvent(new Event('input',{bubbles:true}));window.__qsFocusedRetestSent=true;return {permission:select.value,prompt:area.value}})()`,returnByValue:true});
 await writeFile(dir+'/sent-input.json',JSON.stringify(sent,null,2));
 if(sent.exceptionDetails)throw Error(JSON.stringify(sent.exceptionDetails));
 await call('Runtime.evaluate',{expression:`document.querySelector('button[aria-label="Send assistant message"]').click()`,returnByValue:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/sent.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({host:hostname(),target:page.id,at:new Date().toISOString(),sent:sent.result.value}));
}finally{ws.close()}


