import {readFileSync,writeFileSync} from 'node:fs';
const old=JSON.parse(readFileSync('proof/growth/2026-09-23-assistant-repair/verify-03.json'));
const imp=old.find(o=>o[0]==='eval'&&o[1].includes('const {inspectPlanBytes}'));
const ops=[['open','http://127.0.0.1:8082/'],['set','viewport','1440','900'],['wait','--fn',"!!document.querySelector('.studio-header')"],imp,['wait','--fn',"document.querySelector('img.document-source-page')?.complete"],
 ['eval',`(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const url=String(args[0]);if(url.includes('/api/minimax-ai')&&args[1]?.method==='POST'){const payload=JSON.parse(args[1].body);const parts=payload.contents.flatMap(c=>c.parts);window.__screenRequest={images:parts.filter(p=>p.inlineData).length,text:parts.filter(p=>p.text).map(p=>p.text).join('\\n').slice(-16000)};const response=await original(...args);const data=await response.clone().json();window.__screenResponse={status:response.status,text:data.content?.parts?.map(p=>p.text||'').join('\\n')||data.error};return response;}return original(...args)};document.querySelector('.live-assistant-launcher').click();return true})()`],
 ['wait','--fn',"!!document.querySelector('#live-assistant-prompt') && !document.querySelector('#live-assistant-prompt').disabled"],
 ['eval',`(()=>{const input=document.querySelector('#live-assistant-prompt');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Look at the attached current-screen images and tell me the PDF page number and printed scale visible. Keep the answer brief and do not change the project.');input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`],
 ['wait','--fn',"!document.querySelector('[aria-label=\"Send assistant message\"]').disabled"],
 ['eval',"document.querySelector('[aria-label=\"Send assistant message\"]').click()"],
 ['wait','--fn',"!!window.__screenRequest",30000],
 ['eval',"(()=>{if(window.__screenRequest.images<1||!window.__screenRequest.text.includes('screen observation'))throw Error('Automatic screenshot not sent');return window.__screenRequest})()"],
 ['wait','--fn',"!!window.__screenResponse",60000],
 ['eval',"window.__screenResponse"],
 ['screenshot','live-screen-response.png'],['errors']];
writeFileSync('proof/growth/2026-09-23-assistant-repair/live-screen.json',JSON.stringify(ops,null,2));
