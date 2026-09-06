import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve('screenshots/3d-building');
mkdirSync(dir, {recursive:true});
const browser = await chromium.launch({headless:true, channel:'msedge'});
const page = await browser.newPage({viewport:{width:1920,height:1200},deviceScaleFactor:2});
const report = {model:'Caroline', classification:'Existing curated, approximate reconstruction; not the Altitude tower', errors:[], captures:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
try {
  await page.goto('http://127.0.0.1:8080/?pane=model',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('.workbench-loading'));
  await page.getByRole('button',{name:'Open Caroline plan in 3D',exact:true}).click({timeout:60000});
  const canvas=page.getByRole('img',{name:'Interactive source building model',exact:true});
  await canvas.waitFor({timeout:60000});
  await page.waitForTimeout(2000);
  console.log('Canvas state', await canvas.evaluate(e=>({...e.dataset})));
  async function preset(id){
    await page.getByRole('button',{name:'Visual settings',exact:true}).click();
    await page.getByLabel('Visual preset',{exact:true}).selectOption(id);
    await page.getByRole('button',{name:'Close visual settings',exact:true}).click();
  }
  async function shot(name){
    await page.waitForTimeout(800);
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download model PNG',exact:true}).click();
    const path=resolve(dir,name+'.png');
    await (await download).saveAs(path);
    await page.screenshot({path:resolve(dir,name+'-app.png')});
    report.captures.push({name,path,state:await canvas.evaluate(e=>({...e.dataset}))});
  }
  await preset('ivory');
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await shot('01-caroline-solid');
  await page.getByRole('button',{name:'Wall cutaway',exact:true}).click();
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await shot('02-caroline-cutaway');
  await page.getByLabel('Building floor',{exact:true}).selectOption('all');
  await page.getByRole('button',{name:'Wireframe',exact:true}).click();
  await preset('gold');
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await shot('03-caroline-gold-wireframe');
  console.log(JSON.stringify(report,null,2));
} finally {
  await page.screenshot({path:resolve(dir,'last-app-state.png')});
  writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
