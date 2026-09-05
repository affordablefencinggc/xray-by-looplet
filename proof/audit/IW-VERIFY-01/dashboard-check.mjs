import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const screenshotRoot=resolve('screenshots/industry-verification');
await mkdir(screenshotRoot,{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const viewport of [{name:'desktop',width:1280,height:800},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const record={viewport,consoleErrors:[],pageErrors:[],requestErrors:[],checks:[]};
  results.push(record);
  page.on('console',m=>{if(m.type()==='error')record.consoleErrors.push(m.text())});
  page.on('pageerror',e=>record.pageErrors.push(e.message));
  page.on('requestfailed',r=>record.requestErrors.push({url:r.url(),error:r.failure()?.errorText}));
  const response=await page.goto('http://127.0.0.1:8097/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.screenshot({path:resolve(screenshotRoot,`${viewport.name}-tracker-before.png`),fullPage:true});
  const total=await page.locator('[data-panel=tasks] .task:visible').count();assert.ok(total>0);record.checks.push({name:'initial-task-count',total});
  await page.locator('#search').fill('IW-001');assert.equal(await page.locator('[data-panel=tasks] .task:visible').count(),1);
  await page.locator('#search').fill('no-such-task-independent');assert.equal(await page.locator('[data-panel=tasks] .task:visible').count(),0);assert.match(await page.locator('#result-count').innerText(),/0 tasks/);
  await page.locator('#search').fill('');await page.locator('#status').selectOption('verified');assert.equal(await page.locator('[data-panel=tasks] .task:visible').count(),0);
  await page.locator('#status').selectOption('all');
  const task=page.locator('#IW-001');await task.locator('summary').click();
  await task.getByRole('button',{name:'Copy startup packet'}).click();
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());assert.match(clipboard,/Task IW-001/);assert.match(clipboard,/all construction trades/);
  record.checks.push({name:'search-filter-copy',pass:true,copiedCharacters:clipboard.length});
  await page.locator('[data-view=inventory]').click();assert.equal(await page.locator('[data-panel=inventory] .inventory-row:visible').count(),498);
  await page.locator('#search').fill('BR-013');assert.ok(await page.locator('[data-panel=inventory] .inventory-row:visible').count()>=1);
  const exactRow=page.locator('[data-panel=inventory] .inventory-row:visible').filter({has:page.locator('strong').filter({hasText:/^BR-013$/})});assert.equal(await exactRow.count(),1);
  await page.screenshot({path:resolve(screenshotRoot,`${viewport.name}-tracker-after.png`),fullPage:true});
  const artifact=exactRow.locator('a').first();
  const href=await artifact.getAttribute('href');const artifactResponse=await page.request.get('http://127.0.0.1:8097'+href);assert.equal(artifactResponse.status(),200);assert.match(await artifactResponse.text(),/BR-013/);
  await page.locator('#search').fill('');await page.locator('[data-view=handover]').click();await page.getByRole('link',{name:'Operating contract'}).click();assert.match(await page.locator('body').innerText(),/Industry-wide delivery control/);
  record.checks.push({name:'inventory-link-handover-navigation',pass:true});
  await page.goBack({waitUntil:'networkidle'});
  record.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(record.horizontalOverflow,false);
  assert.deepEqual(record.consoleErrors,[]);assert.deepEqual(record.pageErrors,[]);assert.deepEqual(record.requestErrors,[]);
  await context.close();
 }
}finally{
 await writeFile('proof/audit/IW-VERIFY-01/dashboard-result.json',JSON.stringify({reviewer:'/root/audit_engine_release',capturedAt:new Date().toISOString(),browser:'Playwright/installed Edge fallback after supported tool initialization failure',results},null,2));
 await browser.close();
}
console.log(JSON.stringify(results,null,2));
