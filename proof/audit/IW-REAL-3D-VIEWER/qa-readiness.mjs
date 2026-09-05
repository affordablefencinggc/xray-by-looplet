import assert from 'node:assert/strict';

export async function installTrace(page, events) {
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())events.push({at:new Date().toISOString(),kind:'navigation',url:frame.url()});});
 page.on('console',m=>{if(m.text().includes('[vite]'))events.push({at:new Date().toISOString(),kind:'vite',text:m.text()});});
 await page.exposeFunction('__qaTrace',event=>events.push(event));
 await page.addInitScript(()=>{
  const ids=new WeakMap();let seq=0,last='';
  const state=()=>{const c=document.querySelector('canvas[data-source-sha256]'),s=document.querySelector('[data-model-scope]');if(c&&!ids.has(c))ids.set(c,++seq);return {pane:document.querySelector('.pane-tab.active')?.textContent,canvasId:c?ids.get(c):null,canvas:c?{...c.dataset}:null,scope:s?{...s.dataset,display:getComputedStyle(s).display}:null};};
  const emit=(kind,extra={})=>window.__qaTrace({at:new Date().toISOString(),kind,...extra,state:state()});
  addEventListener('DOMContentLoaded',()=>{new MutationObserver(()=>{const s=state(),key=JSON.stringify({pane:s.pane,canvasId:s.canvasId,display:s.canvas?.displayMode,projection:s.canvas?.projection,scope:s.scope?.display,zoom:s.scope?.zoom});if(key!==last){last=key;emit('state');}}).observe(document.documentElement,{subtree:true,attributes:true,childList:true});});
  for(const type of ['wheel','click','keydown'])addEventListener(type,e=>emit(type,{target:e.target?.tagName,text:e.target?.textContent?.slice(0,80),x:e.clientX,y:e.clientY,deltaY:e.deltaY,key:e.key}),{capture:true});
 });
}

export async function paneReady(page,name) {
 await page.waitForFunction(expected=>document.querySelector('.pane-tab.active')?.textContent===expected,name,{timeout:10000});
 if(name==='Model')await page.waitForFunction(()=>{const c=document.querySelector('canvas[data-source-sha256]');return document.querySelector('[data-model-status="ready"]')&&c&&Number(c.dataset.frameCount)>0;},null,{timeout:20000});
 if(['Overview','Sheets','Measure','Sketch'].includes(name))await page.waitForFunction(()=>{const e=document.querySelector('.document-source-page');return document.querySelector('.document-preview[data-source-ready="true"]')&&e instanceof HTMLImageElement&&e.complete&&e.naturalWidth>0;},null,{timeout:20000});
 await page.waitForTimeout(500);
 assert.equal(await page.locator('.pane-tab.active').innerText(),name,`Pane changed after ${name} readiness`);
}
