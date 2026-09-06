import {chromium} from 'playwright';import fs from 'node:fs';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9238'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(20000);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const say=async text=>{await page.evaluate(text=>{let e=document.getElementById('sketch-film-caption');if(!e){e=document.createElement('div');e.id='sketch-film-caption';e.style.cssText='position:fixed;left:50%;top:62px;transform:translateX(-50%);z-index:99;padding:12px 24px;border:1px solid #a7afb8;border-radius:10px;background:#e2e6eb;color:#28303a;font:600 16px Arial;box-shadow:0 5px 20px #0002;pointer-events:none';document.body.append(e);}e.textContent='GUIDED DEMO / '+text;},text);await pause(1700);};
const button=name=>page.getByRole('button',{name,exact:true});
if(await button('Close settings').isVisible())await button('Close settings').click();
await say('1. Measure: set a known distance of 6 metres');await button('Measure').click();await page.getByLabel('Known distance',{exact:true}).fill('6');await page.locator('.calibration-panel select').selectOption('m');await pause(1800);await button('Pick two points').click();
const canvas=page.getByRole('img',{name:'unused'});const target=page.locator('canvas[aria-label="Select calibration points on plan"]');await target.waitFor();const box=await target.boundingBox(),scale=Math.min((box.width-32)/900,(box.height-32)/680);const point=(x,y)=>({x:box.x+box.width/2+(x-450)*scale,y:box.y+box.height/2+(y-340)*scale});
await say('2. Click A, then B - these points are 6 metres apart');
for(const [x,y] of [[210,180],[690,180]]){const p=point(x,y);await page.mouse.move(p.x,p.y,{steps:40});await pause(600);await page.mouse.click(p.x,p.y);await pause(1600);}
await button('Lock scale').waitFor({state:'visible'});await say('3. Lock the scale before drawing');await button('Lock scale').click();await page.getByText('Scale is locked for measurements on this sheet.',{exact:true}).waitFor();await pause(2000);await page.screenshot({path:'screenshots/sketch-example/02-scale-locked.png'});fs.writeFileSync('proof/audit/IW-SKETCH-SILVER/calibrated-job.json',await page.evaluate(()=>localStorage.getItem('xray:fencing-job:v2')));console.log('Scale calibrated and locked through visible UI.');await browser.close();

