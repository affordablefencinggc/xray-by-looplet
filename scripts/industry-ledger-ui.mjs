// Documented browser-qa fallback: CUA and agent-browser unavailable in this session.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ROOT, hash, safePath } from './industry-ledger.mjs';
const base='http://127.0.0.1:8097';
const revision=process.argv[2] || 'v3';
if(!/^[a-z0-9-]+$/.test(revision))throw Error('Safe proof revision required');
mkdirSync(safePath(ROOT,'screenshots/industry-ledger'),{recursive:true});
mkdirSync(safePath(ROOT,'proof/audit/IW-SC01'),{recursive:true});
const report={at:new Date().toISOString(),tool:'installed Playwright fallback',limitation:'BROWSER-TOOL-01: CUA trusted Node process exited twice; agent-browser unavailable',historicalMindmapSha256:hash(readFileSync(safePath(ROOT,'XRAY-TOPDOWN-MINDMAP-TODO.md'))),viewports:{},interactions:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const [name,width,height] of [['desktop',1280,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/historical');await page.locator('#historical-mindmap').waitFor();
  // Scroll the source's preserved checked completion claims into the capture.
  await page.evaluate(()=>window.scrollTo(0,760));
  await page.screenshot({path:safePath(ROOT,`screenshots/industry-ledger/before-${revision}-${name}.png`)});
  await page.goto(base);await page.getByRole('heading',{name:'Industry-wide delivery'}).waitFor();
  await page.screenshot({path:safePath(ROOT,`screenshots/industry-ledger/after-${revision}-${name}.png`)});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error(name+' horizontal overflow');
  const search=page.getByRole('searchbox');
  await search.fill('corrupt recipe');
  if(await page.locator('[data-panel="tasks"] .task:visible').count()!==1)throw Error('Task search failed');
  await search.fill('no-such-task');await page.getByText('0 tasks shown — try a different search or status.').waitFor();
  await search.fill('');await page.getByLabel('Task status').selectOption('verified');
  if(await page.locator('[data-panel="tasks"] .task:visible').count()!==0)throw Error('Initial tasks incorrectly verified');
  await page.getByLabel('Task status').selectOption('all');
  await page.getByRole('button',{name:'Dependencies',exact:true}).click();await page.getByRole('heading',{name:'Delivery sequence'}).waitFor();
  await page.getByRole('button',{name:'Decisions',exact:true}).click();await page.getByRole('heading',{name:'All construction trades',exact:true}).waitFor();
  await page.getByRole('button',{name:'Inventory',exact:true}).click();await search.fill('BR-001');
  if(await page.locator('[data-panel="inventory"] .inventory-row:visible').count()<1)throw Error('Inventory search failed');
  await search.fill('');await page.getByRole('button',{name:'External',exact:true}).click();await page.getByRole('heading',{name:'Independent verification of tracker'}).waitFor();
  await page.getByRole('button',{name:'Handover',exact:true}).click();await page.getByRole('link',{name:'Operating contract'}).click();await page.waitForURL('**/artifact?path=planning%2Fcontrol%2FREADME.md');
  if(!(await page.locator('body').innerText()).includes('Industry-wide delivery control'))throw Error('Proof/handbook navigation failed');
  await page.goto(base);await page.locator('#IW-001 summary').click();await page.locator('#IW-001 button[data-copy]').click();
  await page.getByText('Startup packet copied.',{exact:true}).waitFor();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());if(!copied.includes('Task IW-001') || !copied.includes('Startup handover:'))throw Error('Clipboard packet mismatch');
  await page.locator('#IW-001').scrollIntoViewIfNeeded();await page.screenshot({path:safePath(ROOT,`screenshots/industry-ledger/task-${revision}-${name}.png`)});
  if(errors.length)throw Error(name+' browser errors: '+errors.join('; '));
  report.viewports[name]={width,height,visibleContent:true,horizontalOverflow:overflow,consoleErrors:errors,screenshots:[`before-${revision}-${name}.png`,`after-${revision}-${name}.png`,`task-${revision}-${name}.png`]};
  report.interactions.push(`${name}: task search, empty state, status filtering, dependencies, decisions, inventory, external queue, handover link, packet copy passed`);
  await context.close();
 }
 report.ok=true;
}catch(error){report.ok=false;report.error=String(error);process.exitCode=1;}
finally{await browser.close();writeFileSync(safePath(ROOT,`proof/audit/IW-SC01/browser-${revision}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
