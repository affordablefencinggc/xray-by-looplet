import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const mode=process.argv[2]||'dev', dir='proof/audit/IW-ARCHITECT-SKETCH', shots='screenshots/architect';
const report={ok:false,mode,checks:[],errors:[]}; let browser,child,p;
try {
 if(['native','installed'].includes(mode)) {
  const exe=mode==='native'?'src-tauri/target/release/xray-by-looplet.exe':path.join(process.env.LOCALAPPDATA,'X-Ray by Looplet','xray-by-looplet.exe');
  report.sha256=crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
  child=spawn(exe,[],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9239',WEBVIEW2_USER_DATA_FOLDER:path.resolve(dir,'qa-navigation-'+Date.now())}});
  for(let i=0;i<100;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9239');break;}catch{await new Promise(r=>setTimeout(r,300));}}
  if(!browser) throw Error('Native debug connection failed');
  p=browser.contexts()[0].pages()[0];
 } else {browser=await chromium.launch({channel:'msedge',headless:true});p=await browser.newPage();await p.goto('http://127.0.0.1:'+(mode==='web'?8081:8080));}
 await p.setViewportSize({width:1600,height:1000});p.setDefaultTimeout(20000);
 p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')report.errors.push(e.text())});
 const b=name=>p.getByRole('button',{name,exact:true});
 await p.locator('[data-hydration-status=ready]').waitFor();await b('Model').click();
 await b('Redburn BR250157').first().click();await b('Open Redburn BR250157 plan in 3D').click();
 await p.locator('[data-model-status=ready]').waitFor();
 async function verify(name,label) {
  const canvas=p.getByRole('img',{name:label,exact:true});
  const data=()=>canvas.evaluate(e=>({...e.dataset}));
  const state=async(k,v)=>p.waitForFunction(({label,k,v})=>document.querySelector('canvas[aria-label="'+label+'"]')?.dataset[k]===v,{label,k,v});
  const vector=s=>s.split(',').map(Number),dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  await b('Fly').click();await state('navigation','fly');await p.waitForFunction(label=>{const d=document.querySelector('canvas[aria-label="'+label+'"]')?.dataset;return d?.navigationDirection&&d?.cameraPosition&&d?.navigationYaw;},label);
  assert.equal(await p.evaluate(()=>document.pointerLockElement?.tagName),'CANVAS');
  async function held(key) {const before=vector((await data()).cameraPosition);await p.keyboard.down(key);await p.waitForTimeout(550);await p.keyboard.up(key);const after=vector((await data()).cameraPosition);await p.waitForTimeout(650);return after.map((v,i)=>v-before[i]);}
  let d=await data(),yaw=Number(d.navigationYaw),right=[Math.cos(yaw),0,-Math.sin(yaw)],forward=vector(d.navigationDirection);
  assert.ok(dot(await held('a'),right)<-.4,'A left');assert.ok(dot(await held('d'),right)>.4,'D right');
  assert.ok(dot(await held('w'),forward)>.4,'W forward');assert.ok(dot(await held('s'),forward)<-.4,'S back');
  assert.ok((await held('Space'))[1]>.4,'Fly rises');assert.ok((await held('Control'))[1]<-.4,'Fly descends');
  const yawBefore=Number((await data()).navigationYaw);await p.mouse.move(720,420);await p.mouse.move(850,440,{steps:4});await p.waitForTimeout(100);assert.notEqual(Number((await data()).navigationYaw),yawBefore);
  await p.screenshot({path:`${shots}/${mode}-${name}-fly.png`});
  const beforeResize=vector((await data()).cameraPosition);await p.setViewportSize({width:1500,height:950});await p.waitForTimeout(150);const afterResize=vector((await data()).cameraPosition);assert.ok(Math.hypot(...afterResize.map((v,i)=>v-beforeResize[i]))<.1,'Resize preserves position');
  await p.keyboard.press('Escape');await state('navigation','orbit');assert.equal(await p.evaluate(()=>document.pointerLockElement),null);
  report.checks.push(name+': real pointer capture, WASD signs, altitude, mouse look, resize and Escape');
  await b('Walk-through').click();assert.equal(await b('Start walking here').isEnabled(),false);
  await p.getByRole('button',{name:'Choose walking start on floor plan',exact:true}).press('Enter');
  for(let i=0;i<(name==='source'?4:20);i++)await p.getByRole('button',{name:'Choose walking start on floor plan',exact:true}).press('ArrowLeft');for(let i=0;i<(name==='source'?4:15);i++)await p.getByRole('button',{name:'Choose walking start on floor plan',exact:true}).press('ArrowDown');await p.screenshot({path:`${shots}/${mode}-${name}-walk-picker.png`});
  await b('Start walking here').click();await state('navigation','walk');await state('navigationTransition','idle');
  await p.waitForFunction(label=>Math.abs(Number(document.querySelector('canvas[aria-label="'+label+'"]')?.dataset.navigationDirection?.split(',')[1]))<.001,label,{timeout:5000});const beforeWalk=vector((await data()).cameraPosition);assert.ok(Math.abs(beforeWalk[1]-1.65)<.01,'Floor plus eye height');
  await p.keyboard.down('w');await p.keyboard.down('Space');await p.waitForTimeout(650);await p.keyboard.up('w');await p.keyboard.up('Space');
  const afterWalk=vector((await data()).cameraPosition);assert.ok(Math.abs(afterWalk[1]-beforeWalk[1])<.001);assert.ok(Math.hypot(afterWalk[0]-beforeWalk[0],afterWalk[2]-beforeWalk[2])>.2);
  await p.screenshot({path:`${shots}/${mode}-${name}-walk.png`});await p.keyboard.press('Escape');await state('navigation','orbit');
  await p.emulateMedia({reducedMotion:'reduce'});await b('Walk-through').click();await p.getByRole('button',{name:'Choose walking start on floor plan',exact:true}).press('Enter');await b('Start walking here').click();await state('navigation','walk');assert.equal((await data()).navigationTransition,'idle');await p.keyboard.press('Escape');await state('navigation','orbit');await p.emulateMedia({reducedMotion:'no-preference'});
  report.checks.push(name+': chosen walking start, fixed eye height, forward travel, reduced motion');
 }
 await verify('source','Interactive source building model');
 await b('Plan').click();await b('Fly').click();await p.waitForFunction(()=>document.querySelector('canvas[data-navigation=fly]'));await p.keyboard.press('Escape');report.checks.push('Plan switches to perspective flight');
 await b('Sketch').click();await b('Architectural workspace').click();await b('Load demonstration').click();await b('Fit').click();
 await verify('architect','Live architectural 3D model');
 await p.setViewportSize({width:390,height:844});await p.locator('.architect-3d').scrollIntoViewIfNeeded();await p.screenshot({path:`${shots}/${mode}-navigation-mobile.png`});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 report.checks.push('Mobile controls visible without horizontal overflow');assert.deepEqual(report.errors,[]);report.ok=true;
} catch(e){report.failure=String(e.stack);if(p)await p.screenshot({path:`${shots}/${mode}-navigation-failure.png`}).catch(()=>{});process.exitCode=1;}
finally {fs.writeFileSync(`${dir}/${mode}-navigation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();child?.kill();}
