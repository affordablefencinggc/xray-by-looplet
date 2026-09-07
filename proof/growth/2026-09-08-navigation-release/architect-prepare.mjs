import fs from 'node:fs';
import { navigationMovementSegment, ARCHITECT_CANVAS } from './navigation-movement-scenarios.mjs';
const base='proof/growth/2026-09-08-navigation-release/';
const button=name=>['find','role','button','click','--name',name,'--exact'];
fs.writeFileSync(base+'architect-dev-fly.json',JSON.stringify([
 ['snapshot','-i'],['screenshot','screenshots/growth/2026-09-08-architect-before.png'],button('Fly'),
 ...navigationMovementSegment({canvasSelector:ARCHITECT_CANVAS,mode:'fly',tag:'architect-dev-fly',screenshotPrefix:'screenshots/growth/2026-09-08-architect-fly'})
],null,2));
fs.writeFileSync(base+'architect-dev-walk.json',JSON.stringify([
 button('Walk-through'),['wait','--fn',"!!document.querySelector('.arch-walk-plan')"],
 ['find','role','button','click','--name','Choose walking start on floor plan','--exact'],
 ['screenshot','screenshots/growth/2026-09-08-architect-walk-placement.png'],button('Start walking here'),
 ...navigationMovementSegment({canvasSelector:ARCHITECT_CANVAS,mode:'walk',tag:'architect-dev-walk',expectedEyeHeight:1.65,screenshotPrefix:'screenshots/growth/2026-09-08-architect-walk'})
],null,2));
const force=['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)});window.__architectRealPointerLock=c.requestPointerLock;window.__architectCaptureRequests=0;c.requestPointerLock=()=>{window.__architectCaptureRequests++;return Promise.reject(new DOMException('QA forced capture refusal','NotAllowedError'));};})()`];
fs.writeFileSync(base+'architect-dev-denied.json',JSON.stringify([
 ['scroll','down','300','--selector','.workspace-central-content'],force,button('Fly'),['wait','--fn',`document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)})?.dataset.navigationCapture==='drag'`],
 ['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)}),b=c.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;window.__architectYawBeforeDrag=Number(c.dataset.navigationYaw);c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:92,pointerType:'mouse',button:0,buttons:1,clientX:x,clientY:y,bubbles:true,cancelable:true}));document.dispatchEvent(new PointerEvent('pointermove',{pointerId:92,pointerType:'mouse',buttons:1,clientX:x-150,clientY:y,bubbles:true,cancelable:true}));document.dispatchEvent(new PointerEvent('pointerup',{pointerId:92,pointerType:'mouse',button:0,buttons:0,clientX:x-150,clientY:y,bubbles:true}));})()`],
 ['wait','--fn',`Number(document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)}).dataset.navigationYaw)-window.__architectYawBeforeDrag>.25`],
 ['eval',"(()=>{const b=[...document.querySelectorAll('.arch-navigation button')].find(b=>b.textContent==='Capture mouse');if(!b||b.getBoundingClientRect().height<=0||!document.querySelector('.architect-3d-caption')?.textContent.includes('drag to look'))throw Error('Missing visible fallback controls');return {fallback:b.textContent,caption:document.querySelector('.architect-3d-caption').textContent};})()"],
 ['screenshot','screenshots/growth/2026-09-08-architect-capture-refused.png'],button('Capture mouse'),
 ['wait','--fn',"window.__architectCaptureRequests===2"],
 ...navigationMovementSegment({canvasSelector:ARCHITECT_CANVAS,mode:'fly',tag:'architect-dev-denied',screenshotPrefix:'screenshots/growth/2026-09-08-architect-denied'}),
 ['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)});c.requestPointerLock=window.__architectRealPointerLock;delete window.__architectRealPointerLock;return 'Real pointer lock restored';})()`]
],null,2));
fs.writeFileSync(base+'architect-dev-denied-walk.json',JSON.stringify([
 force,button('Walk-through'),['wait','--fn',"!!document.querySelector('.arch-walk-plan')"],
 ['find','role','button','click','--name','Choose walking start on floor plan','--exact'],button('Start walking here'),
 ['wait','--fn',`document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)})?.dataset.navigationCapture==='drag'`],
 ...navigationMovementSegment({canvasSelector:ARCHITECT_CANVAS,mode:'walk',tag:'architect-dev-denied-walk',expectedEyeHeight:1.65,screenshotPrefix:'screenshots/growth/2026-09-08-architect-denied-walk'}),
 ['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)});c.requestPointerLock=window.__architectRealPointerLock;delete window.__architectRealPointerLock;})()`],button('Fly'),
 ['wait','--fn',`document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)}).dataset.navigation==='fly'`],
 ['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)});c.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true,cancelable:true}));if(c.dataset.navigation!=='orbit')throw Error('Rapid Escape failed');})()`],button('Fly'),
 ['wait','--fn',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)});return c.dataset.navigation==='fly'&&['locked','drag'].includes(c.dataset.navigationCapture)})()`],
 ['screenshot','screenshots/growth/2026-09-08-architect-rapid-reentry.png'],
 ['eval',`(()=>{const c=document.querySelector(${JSON.stringify(ARCHITECT_CANVAS)}),capture=c.dataset.navigationCapture;c.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true,cancelable:true}));return {rapidReentry:capture,exit:c.dataset.navigation};})()`],['errors']
],null,2));
