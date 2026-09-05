import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const built=process.argv.includes('--built'),run=process.argv.find(a=>a.startsWith('--run='))?.slice(6)||'attempt01';
if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run name');
const url=`http://127.0.0.1:${built?8081:8080}/`,out=`screenshots/industry-transform/${built?'built':'dev'}/${run}`;
mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),url,built,injection:false,tool:'installed Playwright / Edge; documented unavailable CUA fallback',scenarios:[],captures:[],ok:false};
const browser=await chromium.launch({headless:true,channel:'msedge'});
async function capture(page,name,viewport,scenario){const path=`${out}/${viewport.name}-${name}.png`;await page.screenshot({path,fullPage:true});report.captures.push({path,url,capturedAt:new Date().toISOString(),viewport:{...viewport,...page.viewportSize()},scenario,verdict:'pass'});}
try{
 for(const viewport of [{name:'desktop',width:1280,height:800}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.name==='mobile'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url);await page.locator('[data-hydration-status="ready"]').waitFor();
  const importFile=async path=>{const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open plan',exact:true}).first().click();await(await chooser).setFiles(resolve(path));};
  await importFile('engine/fixtures/svg/sample-plan.svg');await page.locator('.document-preview[data-source-ready="true"]').waitFor();
  await page.getByRole('button',{name:'Measure',exact:true}).click();await page.locator('.measure-document-preview[data-source-ready="true"]').waitFor();
  await page.getByTitle('Zoom Out',{exact:true}).click(); // keep top-row physical landmarks visible through the next 1.25x zoom
  const overlay=page.locator('.measure-document-preview canvas'),source=page.locator('.measure-document-preview img');
  async function landmark(x,y){const image=await source.boundingBox(),box=await overlay.boundingBox();return{x:image.x+x/12000*image.width-box.x,y:image.y+y/8000*image.height-box.y};}
  await page.getByLabel('Known distance',{exact:true}).fill('11600');await page.locator('.calibration-distance-row select').selectOption('mm');
  await page.getByRole('button',{name:'Pick two points',exact:true}).click();await overlay.scrollIntoViewIfNeeded();
  await overlay.click({position:await landmark(200,200)});await overlay.click({position:await landmark(11800,200)});
  await page.getByRole('button',{name:'Lock scale',exact:true}).click();await page.getByText('Scale is locked for measurements on this sheet.',{exact:true}).waitFor();
  await page.getByRole('button',{name:/^Run L$/}).click();await overlay.click({position:await landmark(200,200)});await overlay.click({position:await landmark(11800,200)});await page.getByRole('button',{name:'Finish trace',exact:true}).click();
  await page.getByText('11.60 m',{exact:false}).first().waitFor();
  async function assertAligned(step){
   await overlay.scrollIntoViewIfNeeded();const p=await landmark(6000,200),image=await source.boundingBox();
   const hit=await overlay.evaluate((c,p)=>{const d=c.width/c.clientWidth,ctx=c.getContext('2d');const x=Math.round(p.x*d),y=Math.round(p.y*d);for(let a=-5;a<=5;a++)for(let b=-5;b<=5;b++){if(x+a<0||y+b<0||x+a>=c.width||y+b>=c.height)continue;const q=ctx.getImageData(x+a,y+b,1,1).data;if(q[0]>140 && q[1]>65 && q[2]<150 && q[3]>80)return true;}return false;},p);
   if(!hit)throw Error(`${viewport.name} ${step}: trace pixels do not cross actual source landmark`);
   await page.getByText('11.60 m',{exact:false}).first().waitFor();
   report.scenarios.push({viewport:viewport.name,step,imageBounds:image,traceAtSourceLandmark:true,lengthM:11.6,unitInput:'11600 mm',ok:true});
   await capture(page,step,viewport,`Actual SVG column centres (200,200) to (11800,200), 11600 mm; source/overlay coincidence and 11.60 m`);
  }
  await assertAligned('trace');const before=await source.boundingBox();await page.getByTitle('Zoom In',{exact:true}).click();await assertAligned('zoom');const zoomed=await source.boundingBox();if(Math.abs(zoomed.width/before.width-1.25)>.01)throw Error('Source did not zoom with trace');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();const box=await overlay.boundingBox();
  if(viewport.name==='mobile'){
    const cdp=await context.newCDPSession(page);const x=box.x+box.width*.5,y=box.y+box.height*.5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*5,y:y+i*3}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:'middle'});await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:5});await page.mouse.up({button:'middle'});}
  const panned=await source.boundingBox();if(Math.abs(panned.x-zoomed.x)<10)throw Error('Source did not pan');await assertAligned(viewport.name==='mobile'?'touch-pan':'mouse-pan');
  await page.setViewportSize({width:viewport.name==='mobile'?430:1100,height:viewport.height});await assertAligned('resize');await page.setViewportSize(viewport);
  await page.getByRole('button',{name:'Proof',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export current manifest',exact:true}).click();const downloaded=await download;const exportPath=`proof/audit/IW005/${built?'built':'dev'}-${run}-${viewport.name}-manifest.json`;await downloaded.saveAs(exportPath);const manifest=JSON.parse(readFileSync(exportPath));
  if(manifest.job.calibrations[0].coordinateSpace!=='source-page-v1'||Math.abs(manifest.job.runs[0].lengthM-11.6)>.01)throw Error('Exported source coordinates/length mismatch');
  report.scenarios.push({viewport:viewport.name,step:'actual-export',path:exportPath,coordinateSpace:'source-page-v1',lengthM:manifest.job.runs[0].lengthM,ok:true});
  await page.reload();await page.locator('[data-hydration-status="ready"]').waitFor();await page.getByRole('button',{name:'Measure',exact:true}).click();await page.locator('.measure-document-preview[data-source-ready="true"]').waitFor();await page.getByText('11.60 m',{exact:false}).first().waitFor();await capture(page,'reopened',viewport,'Actual reload preserves source-page coordinates and 11.60 m');
  if(errors.length)throw Error(errors.join('; '));if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
  await context.close();
 }
 report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{await browser.close();writeFileSync(`proof/audit/IW005/${built?'built':'dev'}-${run}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
