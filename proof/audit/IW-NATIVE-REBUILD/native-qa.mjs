import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import net from 'node:net';
import assert from 'node:assert/strict';

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const out = `proof/audit/IW-NATIVE-REBUILD/run-${stamp}`;
const shots = `screenshots/industry-native-rebuild/run-${stamp}`;
mkdirSync(out, {recursive:true}); mkdirSync(shots,{recursive:true});
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const buildPath='proof/audit/IW-NATIVE-REBUILD/build-2026-09-05T12-53-14-813Z/build-result.json';
const manifestPath=buildPath.replace('build-result','source-manifest');
const build=JSON.parse(readFileSync(buildPath,'utf8').replace(/^\uFEFF/,''));
const manifest=JSON.parse(readFileSync(manifestPath,'utf8').replace(/^\uFEFF/,''));
assert.equal(hash(manifestPath),build.sourceManifestSha256);
for(const input of manifest.inputs) assert.equal(hash(input.path),input.sha256, input.path);
for(const artifact of build.artifacts) assert.equal(hash(artifact.path),artifact.sha256,artifact.path);
const source='C:/Users/danie/Downloads/Caroline - Blueprints and Renderings - 2025-08-08.pdf';
const sourceSha='f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb';
assert.equal(hash(source),sourceSha);
const port=9237;
await new Promise((ok,fail)=>{const server=net.createServer();server.once('error',fail);server.listen(port,'127.0.0.1',()=>server.close(ok));});
const profile=resolve(out,'webview-profile');
const env={...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,WEBVIEW2_USER_DATA_FOLDER:profile};
delete env.DATABASE_URL;
const app=spawn(build.artifacts[0].path,[],{cwd:process.cwd(),env,detached:true,stdio:'ignore',windowsHide:false});app.unref();
const session={pid:app.pid,exe:build.artifacts[0],startedUtc:new Date().toISOString(),port,profile,out,shots};
writeFileSync(`${out}/session.json`,JSON.stringify(session,null,2));
writeFileSync('proof/audit/IW-NATIVE-REBUILD/current-session.json',JSON.stringify(session,null,2));
let browser,page;const errors=[],logs=[],requests=[],captures=[],results=[],matrix=[];
const record=(name,detail)=>{results.push({name,status:'pass',detail}); console.log(name);};
async function snap(name,scenario){const path=`${shots}/${name}.png`;await page.screenshot({path});captures.push({path,sha256:hash(path),url:page.url(),capturedUtc:new Date().toISOString(),scenario,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),artifactSha:build.artifacts[0].sha256,sourceSha});}
async function nav(name){await page.locator('nav[aria-label="Panes"]').getByRole('button',{name,exact:true}).click();await page.waitForFunction(n=>document.querySelector('.pane-tab.active')?.textContent===n,name);await page.waitForTimeout(450);}
try{
 for(let n=0;n<60;n++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 assert.ok(browser,'Fresh native WebView2 CDP did not become available');
 page=browser.contexts()[0].pages()[0];assert.ok(page);
 page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
 page.on('console',m=>{logs.push({type:m.type(),text:m.text()});if(m.type()==='error')errors.push({type:'console',message:m.text()});});
 page.on('request',r=>requests.push(r.url()));
 await page.locator('[data-hydration-status="ready"]').waitFor({timeout:30000});
 const identity=await page.evaluate(()=>({url:location.href,tauri:typeof window.__TAURI_INTERNALS__?.invoke==='function',globalTauri:!!window.__TAURI__,title:document.title}));
 assert.match(identity.url,/^https?:\/\/tauri\.localhost\//); assert.equal(identity.tauri,true);
 record('Fresh actual native EXE/WebView2 identity',identity);
 await snap('00-native-before-import','Fresh packaged native Studio before import');
 await page.locator('.studio-header').getByRole('button',{name:'Open plan',exact:true}).click({noWaitAfter:true});
 const picker=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','proof/audit/IW-NATIVE-REBUILD/native-picker.ps1','-OwnedProcessId',String(app.pid),'-SourcePath',source],{encoding:'utf8',timeout:30000,windowsHide:true});
 writeFileSync(`${out}/native-picker.json`,picker);record('Native OS filename read-back and Open submission attempted',JSON.parse(picker));
 await page.locator('.document-preview-hash').filter({hasText:sourceSha}).waitFor({state:'attached',timeout:45000});
 assert.equal(await page.getByRole('button',{name:'Open source page 19',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Open source page 20',exact:true}).count(),0);
 record('Native import verified actual 19-page original SHA',{source,sourceSha});
 for(const name of ['Overview','Sheets','Measure','Sketch','Components','Model','Render','Review','Cost','Proof']){
  await nav(name);
  if(name==='Model')await page.locator('[data-model-status="ready"]').waitFor({timeout:30000});
  if(['Overview','Sheets','Measure','Sketch'].includes(name))await page.locator('.document-preview[data-source-ready="true"]').waitFor({timeout:20000});
  await snap(`01-${name.toLowerCase()}`,`Actual native ${name} page render`);
  const text=await page.locator('.studio-main').innerText();assert.ok(text.length>20,name);
  matrix.push({name,text,scope:'Native page renders; not full feature acceptance'});
 }
 record('All ten current native pages render',matrix.map(x=>x.name));
 await nav('Model');await page.locator('[data-model-status="ready"]').waitFor();
 const canvas=page.locator('canvas[data-source-sha256]');assert.equal(await canvas.getAttribute('data-source-sha256'),sourceSha);
 await page.getByRole('button',{name:'Solid',exact:true}).click();assert.equal(await canvas.getAttribute('data-display-mode'),'solid');await snap('02-model-solid','Native Caroline solid source-linked model');
 await page.getByRole('button',{name:'Wireframe',exact:true}).click();assert.equal(await canvas.getAttribute('data-display-mode'),'wireframe');await snap('03-model-wireframe','Native chrome Wireframe toggle beside Solid');
 record('Native Solid and Wireframe change actual renderer mode',{sourceSha});
 await page.getByRole('button',{name:'Scope zoom',exact:true}).click();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);const scope=page.locator('[data-model-scope]');await scope.waitFor({state:'visible'});
 const before=await canvas.evaluate(e=>({...e.dataset}));const zoomBefore=await scope.getAttribute('data-zoom');assert.equal(await canvas.evaluate(e=>getComputedStyle(e).cursor),'none');
 await page.mouse.wheel(0,-240);await page.waitForTimeout(300);const after=await canvas.evaluate(e=>({...e.dataset}));const zoomAfter=await scope.getAttribute('data-zoom');
 assert.notEqual(zoomAfter,zoomBefore);assert.equal(after.cameraPosition,before.cameraPosition);assert.equal(after.cameraTarget,before.cameraTarget);assert.equal(after.cameraZoom,before.cameraZoom);assert.equal(await scope.getAttribute('data-reticle'),'three-post');
 await snap('04-model-scope','Actual native three-post scope; wheel zooms only lens and cursor hidden');record('Native scope wheel isolation and hidden pointer',{zoomBefore,zoomAfter,cameraBefore:before,cameraAfter:after});
 await page.mouse.move(10,10);assert.notEqual(await canvas.evaluate(e=>getComputedStyle(e).cursor),'none');
 await page.getByRole('button',{name:'Scope zoom',exact:true}).click();
 await page.reload();await page.locator('[data-hydration-status="ready"]').waitFor();await nav('Sheets');await page.locator('.document-preview-hash').filter({hasText:sourceSha}).waitFor({state:'attached'});assert.equal(await page.getByRole('button',{name:'Open source page 19',exact:true}).count(),1);await snap('05-native-reload','Native original source restored after packaged WebView reload');record('Native persisted source restores after reload',{sourceSha,pages:19});
 await nav('Model');await page.locator('[data-model-status="ready"]').waitFor();await snap('06-native-final','Final actual rebuilt native application');
 assert.deepEqual(errors,[]);record('Native page/console error capture',{errors:0});
 assert.deepEqual(manifest.inputs.filter(i=>hash(i.path)!==i.sha256),[]);record('All 300 build source inputs unchanged during native QA',{count:manifest.inputs.length});
}catch(error){results.push({name:'Native QA failure',status:'fail',detail:error.stack});console.error(error);try{await snap('failure','Preserved actual native failure');}catch{}process.exitCode=1;}
finally{writeFileSync(`${out}/results.json`,JSON.stringify({session,buildPath,build,manifestPath,sourceSha,completedUtc:new Date().toISOString(),results,matrix,captures,errors,logs,requests},null,2));console.log(JSON.stringify({out,shots,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail'),errors}));if(browser)await browser.close();}
