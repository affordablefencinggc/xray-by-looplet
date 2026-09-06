import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const url=process.argv[2]??'http://127.0.0.1:8080/';
const mode=url.includes('8081')?'built':'dev';
const dir=path.resolve('screenshots/crown-wharf-3d',mode);fs.mkdirSync(dir,{recursive:true});
const model=JSON.parse(fs.readFileSync('public/models/crown-wharf/source-building.json'));
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1600,height:1400}});page.setDefaultTimeout(60000);
const report={url,model:'Crown Wharf A4 — approximate structural reconstruction',checks:[],errors:[],exports:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
const button=name=>page.getByRole('button',{name,exact:true});
const canvas=page.getByRole('img',{name:'Interactive source building model',exact:true});
const data=()=>canvas.evaluate(e=>({...e.dataset}));
async function state(key,value){await page.waitForFunction(({key,value})=>document.querySelector('[aria-label="Interactive source building model"]')?.dataset[key]===value,{key,value});}
async function shot(name){await page.screenshot({path:path.join(dir,name+'.png')});}
async function png(name){const download=page.waitForEvent('download');await button('Download model PNG').click();const p=path.join(dir,name+'.png');await(await download).saveAs(p);const bytes=fs.readFileSync(p);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>300);report.exports.push({path:p,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),state:await data()});}
async function check(name,fn){await fn();report.checks.push({name,result:'pass',state:await data()});}
async function preset(value){await button('Visual settings').click();await page.getByLabel('Visual preset',{exact:true}).selectOption(value);await button('Close visual settings').click();}
try{
 await page.goto(url+'?pane=model',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.querySelector('.workbench-loading'));
 await button('Open Crown Wharf A4 tower plan in 3D').click();await canvas.waitFor();await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Interactive source building model"]')?.dataset.renderCalls)>0);
 await check('Source SHA and full tower render',async()=>{assert.equal((await data()).sourceSha256,model.source.sha256);assert.equal(Number((await data()).meshCount),model.objects.length);await preset('ivory');await button('Fit').click();await png('01-crown-wharf-tower');await shot('01-tower-app');});
 await check('All 33 storey selections show exactly their own meshes',async()=>{
   for(const floor of model.storeys){await page.getByLabel('Building floor',{exact:true}).selectOption(floor.id);await state('level',floor.id);const expected=model.objects.filter(p=>p.storey===floor.id).length;assert.equal(Number((await data()).visibleMeshCount),expected,floor.id);}
   await png('02-roof-structure');
 });
 await check('Level 18 plan and part evidence refer to page 34',async()=>{
   await page.getByLabel('Building floor',{exact:true}).selectOption('L18');await button('Plan').click();await state('projection','orthographic-plan');
   await page.getByLabel('Building part',{exact:true}).selectOption('L18-slab');await state('selectedPart','L18-slab');
   await page.getByRole('complementary',{name:'Building source evidence'}).getByText('Page 34',{exact:true}).waitFor();
   assert.match(await page.getByRole('complementary',{name:'Building source evidence'}).innerText(),/inferred/);
   await png('03-level18-plan');await shot('03-floor-evidence');
 });
 await check('Storey cutaway and floor change clear hidden selection',async()=>{
   await button('Clear part selection').click();await button('Orbit').click();await button('Wall cutaway').click();await state('cutaway','true');await state('level','L18');await button('Fit').click();await png('04-level18-cutaway');
   await page.getByLabel('Building part',{exact:true}).selectOption('L18-column-0');await page.getByLabel('Building floor',{exact:true}).selectOption('L19');await state('selectedPart','');
   await page.getByLabel('Building floor',{exact:true}).selectOption('all');await state('cutaway','false');
 });
 await check('Wireframe and exploded tower export different real pixels',async()=>{
   await preset('gold');await button('Wireframe').click();await state('displayMode','wireframe');await button('Fit').click();await png('05-crown-wharf-wireframe');
   await button('Explode').click();await state('explode','true');await png('06-crown-wharf-exploded');assert.notEqual(report.exports.at(-1).sha256,report.exports.at(-2).sha256);await button('Explode').click();await button('Solid').click();await preset('ivory');
 });
 await check('Orbit, zoom, fit and roof toggle',async()=>{
   await button('Fit').click();const before=await data(),box=await canvas.boundingBox();const x=box.x+box.width*.52,y=box.y+box.height*.48;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+220,y-25,{steps:12});await page.mouse.up();await page.waitForFunction(v=>document.querySelector('[aria-label="Interactive source building model"]')?.dataset.cameraPosition!==v,before.cameraPosition);await png('07-crown-wharf-alternate');
   const orbited=await data();await page.mouse.wheel(0,-160);await page.waitForFunction(v=>document.querySelector('[aria-label="Interactive source building model"]')?.dataset.cameraPosition!==v,orbited.cameraPosition);
   await button('Roof on').click();await state('roof','false');assert.ok(Number((await data()).visibleMeshCount)<model.objects.length);await button('Roof off').click();await state('roof','true');await button('Fit').click();
 });
 await check('Reload restores the original source and rebuilds the matching model',async()=>{
   await page.reload({waitUntil:'domcontentloaded'});await canvas.waitFor();await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Interactive source building model"]')?.dataset.renderCalls)>0);assert.equal((await data()).sourceSha256,model.source.sha256);await state('level','all');
 });
 await check('Mobile controls, whole tower and floor isolation',async()=>{
   await page.setViewportSize({width:390,height:844});await button('Fit').click();await canvas.scrollIntoViewIfNeeded();await shot('08-mobile-tower');await png('08-mobile-tower-export');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByLabel('Building floor',{exact:true}).selectOption('L31');await state('level','L31');await button('Plan').click();await state('projection','orthographic-plan');await canvas.scrollIntoViewIfNeeded();await shot('09-mobile-floor');
   const box=await canvas.boundingBox();assert.ok(box.width>=300&&box.height>=300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 });
 await check('Caroline model retains legacy floor controls after switching source',async()=>{
   await page.setViewportSize({width:1600,height:1100});await button('Caroline').click();await button('Open Caroline plan in 3D').click();await canvas.waitFor();await state('sourceSha256','f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb');
   await state('level','all');const all=Number((await data()).visibleMeshCount);
   for(const level of ['ground','upper']){await page.getByLabel('Building floor',{exact:true}).selectOption(level);await state('level',level);assert.ok(Number((await data()).visibleMeshCount)<all);}
   await button('Wall cutaway').click();await state('cutaway','true');await button('Fit').click();await shot('10-caroline-regression');
 });
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(e){report.ok=false;report.failure=String(e.stack);await shot('failure');process.exitCode=1;}
finally{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({mode,ok:report.ok,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
