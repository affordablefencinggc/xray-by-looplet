import {writeFile} from 'node:fs/promises';
import {hostname} from 'node:os';
if(hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-form';
const pages=await(await fetch('http://127.0.0.1:9342/json/list')).json();
const page=pages.find(p=>p.id==='C881A561953E464791A17AF4579C59F6');
if(!page||!page.url.startsWith('http://127.0.0.1:8095/'))throw Error('Wrong page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('deadline '+method)),20000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const click=async(text)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button,summary')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('missing '+${JSON.stringify(text)});b.click()})()`);
const wait=async(selector)=>evaluate(`new Promise((resolve,reject)=>{if(document.querySelector(${JSON.stringify(selector)}))return resolve(true);const o=new MutationObserver(()=>{if(document.querySelector(${JSON.stringify(selector)})){o.disconnect();resolve(true)}});o.observe(document.body,{subtree:true,childList:true,attributes:true});setTimeout(()=>{o.disconnect();reject(Error('wait timeout'))},10000)})`);
const fill=async(suffix,text)=>{await evaluate(`(()=>{const e=document.querySelector('input[id$="'+${JSON.stringify(suffix)}+'"]');if(!e)throw Error('missing field');e.focus();e.select()})()`);await call('Input.insertText',{text})};
const snapshot=async()=>evaluate(`({at:new Date().toISOString(),text:document.querySelector('.industry-draft-host').innerText,save:document.querySelector('.industry-draft-host').dataset.draftSave,inputs:[...document.querySelectorAll('.industry-form input')].map(e=>({id:e.id,value:e.value,checked:e.checked})),result:document.querySelector('.industry-result')?.innerText})`);
try {
await call('Page.reload');await wait('textarea');await click('Estimate');await wait('.industry-workbench');await evaluate(`document.querySelector('.industry-workbench summary').click()`);
const choose=async(value)=>{await evaluate(`(()=>{const e=document.querySelector('.industry-picker select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await wait('[data-draft-industry="'+value+'"][data-draft-save="saved"]')};
await choose('hvac');const reloaded=await snapshot();if(!reloaded.inputs.some(e=>e.value==='HVAC-UI-1'))throw Error('form missing after reload');await choose('roofing');await choose('hvac');const returned=await snapshot();if(JSON.stringify(reloaded.inputs.map(({value,checked})=>({value,checked})))!==JSON.stringify(returned.inputs.map(({value,checked})=>({value,checked}))))throw Error('worksheet switch changed draft');
await click('Calculate duct draft');await wait('.industry-result');
const win=await call('Browser.getWindowForTarget',{targetId:page.id});await call('Browser.setWindowBounds',{windowId:win.windowId,bounds:{width:1024,height:900}});
await evaluate(`document.querySelector('.industry-result').scrollIntoView({block:'center'})`);
const tablet=await evaluate(`({innerWidth,scrollWidth:document.documentElement.scrollWidth,formWidth:document.querySelector('.industry-form').getBoundingClientRect().width,overflow:[...document.querySelectorAll('.industry-form input,.industry-form select,.industry-result')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>e.outerHTML)})`);
await writeFile(base+'-tablet.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await call('Browser.setWindowBounds',{windowId:win.windowId,bounds:{width:1280,height:900}});
await evaluate(`document.querySelector('.industry-result').scrollIntoView({block:'center'})`);
await writeFile(base+'-reload.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await writeFile(base+'-persistence.json',JSON.stringify({at:new Date().toISOString(),reloaded,returned,tablet,final:await snapshot()},null,2));console.log(JSON.stringify({persisted:true,worksheetSwitch:true,tablet}));
}finally{ws.close()}

