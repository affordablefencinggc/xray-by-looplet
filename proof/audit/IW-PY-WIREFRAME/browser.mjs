import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='proof/audit/IW-PY-WIREFRAME', screenshots='screenshots/industry-wireframe';mkdirSync(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}), page=await browser.newPage({viewport:{width:1440,height:1000}});
const captures=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
async function shot(name,label,scenario){name+='-attempt-02';const path=`${screenshots}/${name}.png`;await page.screenshot({path});const bytes=readFileSync(path);copyFileSync(path,`${root}/${name}.png`);captures.push({imagePath:`${root}/${name}.png`,originalImagePath:path,label,scenario,url:page.url(),capturedAt:new Date().toISOString(),viewport:page.viewportSize(),captureDimensions:{width:1440,height:1000},sha256:createHash('sha256').update(bytes).digest('hex'),result:'Rendered and inspected in real Edge browser; see raw browser checks.'})}
const comparisons=[];
for(const source of JSON.parse(readFileSync(`${root}/view-sources.json`))){
  await page.goto(`http://127.0.0.1:8098/${source.key}-source.html`);await page.locator('img').evaluate(i=>i.decode());await shot(`${source.key}-before`,'Original PDF source',`${source.key} actual PDF page${source.selectedPage} before extraction view`);
  await page.goto(`http://127.0.0.1:8098/${source.key}-final/index.html`);await page.locator('#drawing').evaluate(i=>i.decode());await shot(`${source.key}-after`,'Generated PDF source linework',`${source.key} page${source.selectedPage}: extracted paths, partial omissions explicit`);
  const selected=await page.locator('#page').inputValue();if(Number(selected)!==source.selectedPage)throw Error('Selected richest page mismatch');
  await page.click('#zoomIn');if(await page.locator('#drawing').evaluate(i=>i.style.width)!=='125%')throw Error('Zoom did not act');await page.click('#fit');
  await page.click('#previous');await page.locator('#drawing').evaluate(i=>i.decode());await page.click('#next');await page.locator('#drawing').evaluate(i=>i.decode());if(await page.locator('#page').inputValue()!==selected)throw Error('Page navigation changed selection');
  const alignment=await page.evaluate(async key=>{
    const original=new Image();original.src=`/${key}-source.png`;await original.decode();
    const vector=document.getElementById('drawing'),w=original.naturalWidth,h=original.naturalHeight;
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(original,0,0,w,h);const a=ctx.getImageData(0,0,w,h).data;
    ctx.clearRect(0,0,w,h);ctx.drawImage(vector,0,0,w,h);const b=ctx.getImageData(0,0,w,h).data;let tested=0,matched=0;
    for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){if(b[(y*w+x)*4+3]<128)continue;tested++;let hit=false;for(let dy=-2;dy<=2&&!hit;dy++)for(let dx=-2;dx<=2;dx++){let i=((y+dy)*w+x+dx)*4;if(a[i]+a[i+1]+a[i+2]<500){hit=true;break}}if(hit)matched++}
    return {width:w,height:h,vectorPixels:tested,sourceAlignedPixels:matched,ratio:matched/tested,tolerancePixels:2};
  },source.key);comparisons.push({source:source.key,...alignment});if(alignment.vectorPixels<1000||alignment.ratio<.85)throw Error('Source pixel alignment failed '+JSON.stringify(alignment));
}
await page.goto('http://127.0.0.1:8098/cli-attempt-01/synthetic-nested-plan/synthetic-nested-plan.wireframe.html');await page.waitForTimeout(250);await shot('cad-before','Synthetic CAD before adapter repair','480 source placements; 192 positions independently known wrong before cumulative transform fix');
await page.goto('http://127.0.0.1:8098/cli-attempt-02/synthetic-nested-plan/synthetic-nested-plan.wireframe.html');await page.waitForTimeout(250);await shot('cad-after','Synthetic CAD after adapter repair','480 placement identities; zero coordinate mismatches; assumed viewing height8, no structural recognition');
const before=await page.screenshot();await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(810,550,{steps:8});await page.mouse.up();await page.waitForTimeout(250);const after=await page.screenshot();if(before.equals(after))throw Error('Orbit did not change scene');
await page.getByRole('button',{name:'Plan',exact:true}).click();await page.waitForTimeout(250);await shot('cad-plan','Synthetic CAD plan view','Source-derived placements visible in plan preset');
await page.setViewportSize({width:1440,height:800});await page.waitForTimeout(150);const resize=await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,clientHeight:c.clientHeight}));if(resize.height!==resize.clientHeight)throw Error('Height-only resize failed');await page.setViewportSize({width:1440,height:1000});
await page.goto('http://127.0.0.1:8098/hostile-viewer.html');await page.waitForTimeout(100);if(await page.evaluate(()=>globalThis.injected!==undefined))throw Error('Injected script executed');await page.getByRole('button',{name:'__proto__',exact:false}).click();const protoOff=await page.getByRole('button',{name:'__proto__',exact:false}).evaluate(b=>!b.classList.contains('on'));if(!protoOff)throw Error('Prototype name did not toggle');
const report={status:errors.length?'failed':'passed',browser:'installed Playwright + Microsoft Edge; CUA package unavailable',desktopOnly:true,errors,comparisons,resize,scriptInjectionPrevented:true,prototypeNameToggled:true,captures};writeFileSync(`${root}/browser-results-attempt-02.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
