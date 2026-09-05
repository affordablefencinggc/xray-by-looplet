import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const evidence='proof/audit/IW-GALLERY-REVIEW', screenshots='screenshots/industry-gallery-review';
const attempt='attempt-02';
mkdirSync(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}), results=[];
try {
 for(const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]) {
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8097/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
  const images=page.locator('.proof-gallery img');
  for(const image of await images.all()){await image.scrollIntoViewIfNeeded();await image.evaluate(el=>el.loading='eager');await image.evaluate(el=>el.decode());}
  const state=await images.evaluateAll(items=>items.map(i=>({src:i.getAttribute('src'),alt:i.alt,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,complete:i.complete})));
  assert.ok(state.length>=19);assert.ok(state.every(i=>i.complete&&i.naturalWidth>0));
  const gallery=page.locator('section[aria-label="Latest local proof"]');
  await gallery.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:`${screenshots}/${viewport.name}-gallery-${attempt}.png`,fullPage:false});
  await gallery.screenshot({path:`${screenshots}/${viewport.name}-gallery-section-${attempt}.png`});
  const reports=await page.locator('.proof-shot a').evaluateAll(items=>items.filter(i=>i.textContent==='Source report').map(i=>i.getAttribute('href')));
  const links=[];for(const href of new Set([...state.map(i=>i.src),...reports])){const r=await page.request.get('http://127.0.0.1:8097'+href);links.push({href,status:r.status(),type:r.headers()['content-type']});assert.equal(r.status(),200);}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.deepEqual(errors,[]);
  results.push({viewport,url:page.url(),capturedAt:new Date().toISOString(),images:state,links,overflow,errors});await page.close();
 }
} finally {await browser.close();writeFileSync(`${evidence}/browser-results-${attempt}.json`,JSON.stringify(results,null,2));}
const paths=['scripts/industry-ledger.mjs','scripts/industry-ledger.test.mjs','planning/control/dashboard.css','planning/control/dashboard.js','planning/control/ledger.json'];
writeFileSync(`${evidence}/reviewed-source-hashes-${attempt}.json`,JSON.stringify(paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),null,2));
console.log(JSON.stringify(results.map(r=>({viewport:r.viewport.name,images:r.images.length,links:r.links.length,overflow:r.overflow,errors:r.errors}))));
