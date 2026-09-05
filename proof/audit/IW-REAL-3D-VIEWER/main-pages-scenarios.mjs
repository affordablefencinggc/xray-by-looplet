import {paneReady} from './qa-readiness.mjs';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export async function checkShell({page,nav,snap,record,sourceSha}) {
 for(const width of [1440,2560]) {
  await page.setViewportSize({width,height:1000});
  for(const pane of ['Model','Sheets','Measure']) {
   await nav(pane);
   if(pane==='Model')await page.locator('[data-model-status="ready"]').waitFor();
   else await page.locator('.document-preview[data-source-ready="true"]').waitFor();
   await page.waitForTimeout(500);
   const bounds=await page.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};return {diagnostics:r(document.querySelector('.workspace-diagnostics')),central:r(document.querySelector('.studio-main')),stage:r(document.querySelector('.building-stage')||document.querySelector('.measure-document-preview')||document.querySelector('.studio-main')),nav:[...document.querySelectorAll('.pane-tab')].map(e=>({text:e.textContent,...r(e)})),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.equal(bounds.overflow,false);assert.equal(bounds.nav.length,10);
   assert.ok(bounds.nav.every(b=>b.width>0&&b.x>=0&&b.x+b.width<=width));
   assert.ok(Math.abs(bounds.diagnostics.x-bounds.stage.x)<15);
   assert.ok(Math.abs(bounds.diagnostics.width-bounds.stage.width)<25);
   record(`${pane}: central diagnostics and ten tabs at ${width}`,bounds);
   await paneReady(page,pane);await snap(`shell-${width}-${pane.toLowerCase()}`,`${pane} central diagnostics and centered desktop navigation at ${width}`);
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('tab',{name:/^Logs/}).click();assert.match(await page.locator('#workspace-diagnostics-content').innerText(),/Pane:/);
 await page.evaluate(()=>console.info('QA diagnostics actual console message'));
 await page.getByRole('tab',{name:/^Console/}).click();await page.getByText('QA diagnostics actual console message',{exact:true}).waitFor();
 await snap('shell-console','Actual console.info captured by in-app Console');record('Console captures real browser console message');
 const chooser=page.waitForEvent('filechooser');await page.locator('.studio-header').getByRole('button',{name:'Open plan',exact:true}).click();
 await(await chooser).setFiles({name:'qa-malformed.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 9 0 R >> endobj\n%%EOF')});
 await page.getByRole('tab',{name:/^Errors/}).click();await page.locator('.workspace-diagnostic-events [data-level="error"]').first().waitFor();
 await snap('shell-import-error','Malformed PDF rejection appears in actual Errors panel');
 await page.getByRole('button',{name:'Clear session log',exact:true}).click();assert.match(await page.locator('#workspace-diagnostics-content').innerText(),/No errors recorded/);
 await page.getByRole('tab',{name:'Status',exact:true}).click();assert.ok((await page.locator('#workspace-diagnostics-content').innerText()).includes(sourceSha));assert.ok(await page.locator('.workspace-current-error').count()>0);
 record('Clear session log preserves verified source and current import error');
 await page.getByRole('button',{name:'Collapse workspace diagnostics',exact:true}).click();
}

export async function checkAgentation({page,nav,snap,record,out,environment,requests}) {
 const launcher=page.locator('[title="Start feedback mode"]');
 if(environment==='built') {assert.equal(await launcher.count(),0);assert.equal(requests.filter(url=>/agentation/i.test(url)).length,0);record('Production has no Agentation launcher or module request');return;}
 const edit=async()=>{await page.mouse.move(500,500);await page.locator('[data-annotation-marker]').last().hover();await page.waitForTimeout(300);await page.locator('[data-annotation-marker]').last().click({delay:120});await page.getByPlaceholder('Edit your feedback...').waitFor();};
 const settled=async()=>{await page.waitForFunction(()=>{const e=document.querySelector('[data-annotation-popup]');return e&&getComputedStyle(e).opacity==='1';});};
 await nav('Model');await page.locator('[data-model-status="ready"]').waitFor();await launcher.click();await page.getByRole('button',{name:'Wireframe',exact:true}).click();
 await page.getByPlaceholder('What should change?').fill('Isolated QA verifies annotation component');await page.getByRole('button',{name:'Add',exact:true}).click();await page.waitForTimeout(700);
 await edit();await page.getByPlaceholder('Edit your feedback...').fill('Isolated QA verifies edited annotation survives reload');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.locator('[data-agentation-toolbar] button').nth(3).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.match(copied,/Isolated QA verifies edited annotation survives reload/);writeFileSync(`${out}/agentation-copied.md`,copied);
 await snap('agentation-added','Actual annotation added edited and copied');await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});await page.locator('[data-hydration-status="ready"]').waitFor();
 await nav('Model');await page.locator('[data-model-status="ready"]').waitFor();await launcher.click();await page.locator('[data-agentation-toolbar] button').nth(3).click();const restored=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(restored,copied);writeFileSync(`${out}/agentation-restored.md`,restored);
 await edit();assert.equal(await page.getByPlaceholder('Edit your feedback...').inputValue(),'Isolated QA verifies edited annotation survives reload');await settled();
 await snap('agentation-restored','Reload restores exact edited annotation; editor opacity settled at1');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Wireframe',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Wireframe',exact:true}).getAttribute('aria-pressed'),'true');
 await snap('agentation-normal-controls','Feedback closed and actual model controls restored');
 record('Agentation add edit copy reload and normal controls',{clipboardByteIdentical:true,editorOpacity:1});
}

export async function checkRender({page,nav,snap,record,download,sourceSha}) {
 const canvas=page.locator('canvas[data-source-sha256]');
 await nav('Model');await page.locator('[data-model-status="ready"]').waitFor();await page.waitForTimeout(1000);
 const first=await canvas.evaluate(e=>({...e.dataset,qaAspect:e.clientWidth/e.clientHeight}));
 await nav('Render');await page.getByLabel('Additional direction',{exact:true}).fill('QA original Caroline south elevation');await page.getByRole('button',{name:'Record camera',exact:true}).click();const a=await download('Download local brief','render-before.json');
 await page.getByRole('button',{name:'Adjust Model camera',exact:true}).click();await page.locator('[data-model-status="ready"]').waitFor();const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.6,{steps:20});await page.mouse.up();await page.waitForTimeout(1200);
 await page.getByRole('button',{name:'Wireframe',exact:true}).click();await page.getByLabel('Building floor',{exact:true}).selectOption('ground');await page.getByRole('button',{name:'Wall cutaway',exact:true}).click();await page.waitForTimeout(500);const second=await canvas.evaluate(e=>({...e.dataset,qaAspect:e.clientWidth/e.clientHeight}));assert.notEqual(first.cameraPosition,second.cameraPosition);await snap('render-actual-orbit','Real Model camera after mouse orbit before recording');
 await nav('Render');await page.getByRole('button',{name:'Record camera',exact:true}).click();const b=await download('Download local brief','render-after.json');
 const sceneBytes=readFileSync('public/models/caroline/source-building.json'),scene=JSON.parse(sceneBytes),sceneHash=createHash('sha256').update(sceneBytes).digest('hex');for(const [brief,data]of[[a,first],[b,second]]){assert.equal(brief.sourceSha256,sourceSha);assert.deepEqual(brief.camera.position,data.cameraPosition.split(',').map(Number));assert.deepEqual(brief.camera.target,data.cameraTarget.split(',').map(Number));assert.equal(brief.camera.zoom,Number(data.cameraZoom));assert.equal(brief.modelView.sourceSha256,sourceSha);assert.equal(brief.modelView.sceneSha256,sceneHash);assert.equal(brief.sourceDocumentId,await page.getByLabel('Current plan',{exact:true}).inputValue());assert.equal(brief.modelView.documentId,brief.sourceDocumentId);assert.equal(brief.camera.projection,data.projection==='orthographic-plan'?'orthographic':data.projection);assert.deepEqual(brief.modelView.view,{wireframe:data.displayMode==='wireframe',roof:data.roof==='true',cutaway:data.cutaway==='true',explode:data.explode==='true',plan:data.projection==='orthographic-plan',level:data.level});
 const near=.05,far=Math.max(scene.bounds.max[0]-scene.bounds.min[0],scene.bounds.max[2]-scene.bounds.min[2])*12,f=1/Math.tan(36*Math.PI/360),expectedMatrix=[f/data.qaAspect,0,0,0,0,f,0,0,0,0,-(far+near)/(far-near),-1,0,0,-2*far*near/(far-near),0];assert.equal(brief.camera.near,near);assert.equal(brief.camera.far,far);brief.camera.projectionMatrix.forEach((v,i)=>assert.ok(Math.abs(v-expectedMatrix[i])<1e-10));assert.deepEqual(brief.modelView.camera,brief.camera);assert.equal(brief.renderStatus,'unavailable');}
 assert.notDeepEqual(a.camera.position,b.camera.position);record('Render brief captures actual source-bound camera after orbit',{first:a,second:b});
 await snap('render-actual-brief','Exact current model camera in structured local JSON brief; image renderer unavailable');
}
