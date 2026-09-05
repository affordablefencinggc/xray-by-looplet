import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {serve,ROOT,readLedger,validate} from '../../../scripts/industry-ledger.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-'),out='proof/audit/IW-STAGED-DELIVERY/browser-'+stamp;
mkdirSync(out,{recursive:true});const before=hash(readFileSync('planning/control/ledger.json'));
const server=serve(ROOT,0,{scope:'historical'});await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/',viewport={width:1440,height:1000};
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport}),errors=[],captures=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const capture=async name=>{const path=out+'/'+name+'.png';await page.screenshot({path,fullPage:false});captures.push({path,url:page.url(),capturedAt:new Date().toISOString(),viewport,sha256:hash(readFileSync(path))});};
try{
 await page.goto(url,{waitUntil:'networkidle'});assert.match(await page.locator('.current-work').innerText(),/Caroline/);assert.equal(await page.locator('.current-work tbody tr').count(),6);assert.match(await page.locator('.current-work').innerText(),/push pending/);assert.match(await page.locator('body').innerText(),/HISTORICAL ASSESSMENT SNAPSHOT/);assert.equal(await page.locator('.feature-audit-row:visible').count(),150);await capture('current-work');
 await page.locator('#search').fill('NEW-010');const row=page.locator('#audit-NEW-010');await row.scrollIntoViewIfNeeded();assert.match(await row.innerText(),/Recorded result/);const imgs=row.locator('img');assert.ok(await imgs.count()>0);for(const img of await imgs.all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}await row.scrollIntoViewIfNeeded();await capture('historical-pdf-evidence');
 const link=row.locator('a').first(),href=await link.getAttribute('href');assert.equal((await page.request.get(new URL(href,url).href)).status(),200);
 await page.locator('#search').fill('');await page.locator('#status').selectOption('fail');assert.equal(await page.locator('.feature-audit-row:visible').count(),15);assert.deepEqual(errors,[]);assert.equal(hash(readFileSync('planning/control/ledger.json')),before);assert.equal(validate(readLedger(),ROOT,{scope:'historical'}).ok,true);
 writeFileSync(out+'/results.json',JSON.stringify({at:new Date().toISOString(),url,viewport,captures,canonicalSha256:before,rows:150,failFilter:15,currentStages:6,sourceTarget:'Caroline',artifactLinkPassed:true,errors,desktopOnly:true,method:'Actual Edge browser capture; established Playwright fallback, no injected product state.',limitation:'Historical proof only. Current Caroline geometry and viewer remain in progress; no push has succeeded.'},null,2));console.log(out);
}finally{await browser.close();await new Promise(r=>server.close(r));}
