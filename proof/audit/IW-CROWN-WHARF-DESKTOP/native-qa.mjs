import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=path.resolve('proof/audit/IW-CROWN-WHARF-DESKTOP');
const shots=path.resolve('screenshots/crown-wharf-desktop');fs.mkdirSync(shots,{recursive:true});
const exe=path.resolve(process.argv[2] ?? 'src-tauri/target/release/xray-by-looplet.exe');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected='32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a';
const env={...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9238 --remote-debugging-address=127.0.0.1',WEBVIEW2_USER_DATA_FOLDER:path.join(dir,'isolated-webview-'+Date.now())};
const app=spawn(exe,[],{cwd:process.cwd(),env,stdio:'ignore',windowsHide:true});
const report={exe,sha256:hash(exe),pid:app.pid,checks:[],errors:[]};
let browser,page;
const check=async(name,fn)=>{await fn();report.checks.push(name);};
try {
  for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9238');break;}catch{await new Promise(r=>setTimeout(r,500));}}
  assert.ok(browser,'Native WebView2 did not start');page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
  await check('Actual packaged Tauri WebView, no dev server',async()=>{
    await page.locator('[data-hydration-status="ready"]').waitFor();
    assert.equal(await page.evaluate(()=>Boolean(window.__TAURI_INTERNALS__)),true);report.url=page.url();
    assert.ok(!/127\.0\.0\.1:808[01]/.test(page.url()));
  });
  await page.locator('nav[aria-label="Panes"]').getByRole('button',{name:'Model',exact:true}).click();
  await page.getByRole('button',{name:'Open Crown Wharf A4 tower plan in 3D',exact:true}).click();
  const canvas=page.locator('canvas[data-source-sha256]');
  await check('Bundled Crown Wharf PDF and 2,180-mesh tower render',async()=>{
    await page.locator('[data-model-status="ready"]').waitFor();
    await page.waitForFunction(()=>Number(document.querySelector('canvas[data-source-sha256]')?.dataset.renderCalls)>0);
    assert.equal(await canvas.getAttribute('data-source-sha256'),expected);assert.equal(await canvas.getAttribute('data-mesh-count'),'2180');
    await page.screenshot({path:path.join(shots,'01-packaged-tower.png')});
  });
  await check('Native floor isolation and source evidence',async()=>{
    await page.getByLabel('Building floor',{exact:true}).selectOption('L18');
    await page.getByLabel('Building part',{exact:true}).selectOption('L18-slab');
    await page.getByRole('button',{name:'Plan',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('canvas[data-source-sha256]')?.dataset.level==='L18');
    assert.equal(await canvas.getAttribute('data-visible-mesh-count'),'68');
    await page.getByRole('complementary',{name:'Building source evidence'}).getByText('Page 34',{exact:true}).waitFor();
    await page.screenshot({path:path.join(shots,'02-packaged-floor-evidence.png')});
  });
  await check('Native reload keeps original source and tower available',async()=>{
    await page.reload();await page.locator('[data-hydration-status="ready"]').waitFor();
    await page.locator('nav[aria-label="Panes"]').getByRole('button',{name:'Model',exact:true}).click();
    await page.locator('[data-model-status="ready"]').waitFor();assert.equal(await canvas.getAttribute('data-source-sha256'),expected);
    await page.screenshot({path:path.join(shots,'03-packaged-reload.png')});
  });
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=String(error.stack);if(page)await page.screenshot({path:path.join(shots,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally {fs.writeFileSync(path.join(dir,process.argv[2] ? 'installed-qa.json' : 'native-qa.json'),JSON.stringify(report,null,2));if(browser)await browser.close();app.kill();console.log(JSON.stringify(report));}
