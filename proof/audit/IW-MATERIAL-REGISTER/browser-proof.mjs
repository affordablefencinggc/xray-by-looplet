import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const url=process.argv[2]??'http://127.0.0.1:8080/';
const mode=url.includes('8081')?'built':'dev',dir=resolve('screenshots/material-register',mode);mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage();page.setDefaultTimeout(30000);
const report={url,fixture:'All material quantities/weights in this test are synthetic QA data, not Altitude specifications.',checks:[],errors:[],screenshots:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
async function shot(name){await page.locator('.source-takeoff').evaluate(e=>e.closest('.studio-center')?.scrollTo(0,0));const path=resolve(dir,name+'.png');await page.screenshot({path});report.screenshots.push(path);}
async function ready(){await page.waitForFunction(()=>!document.querySelector('.workbench-loading'));}
async function components(){await page.getByRole('button',{name:'Components',exact:true}).click();await page.getByRole('region',{name:'Altitude source takeoff'}).waitFor();}
async function materials(){await page.getByRole('button',{name:'Materials & storage',exact:true}).click();}
async function saved(){return page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('xray:source-takeoff:'));return {key,raw:localStorage.getItem(key)};});}
async function named(code,name){await page.getByRole('button',{name:'Add material',exact:true}).click();await page.getByLabel('Stock code / order line',{exact:true}).fill(code);await page.getByLabel('Material description',{exact:true}).fill(name);await page.getByLabel('Schedule / order / supplier reference',{exact:true}).fill('QA TEST ONLY - fictional supplier order, not a project specification');}
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open plan',exact:true}).first().click();
 await(await picker).setFiles(resolve('downloads/high_rise_plans/03_Seattle_Altitude_Hotel_and_Residences_50Story_Tower.pdf'));
 await page.locator('.document-preview[data-source-ready="true"]').waitFor({timeout:60000});await components();await page.getByRole('button',{name:'Save inventory',exact:true}).click();
 const initial=await saved(),current=JSON.parse(initial.raw),{materials:_materials,...old}=current;
 old.schema='xray.source-takeoff/v1';old.rows[0].note='QA existing reviewed count';old.rows[0].review='reviewed';old.rows[0].revision=2;
 const legacy=JSON.stringify(old);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:initial.key,raw:legacy});
 await page.reload({waitUntil:'domcontentloaded'});await ready();await components();assert.equal((await saved()).raw,legacy);
 await materials();assert.ok((await page.getByRole('region',{name:'Material register'}).innerText()).includes('No stock list entered yet'));await shot('01-empty-register');
 await named('QA-A01','QA ONLY - packaged assemblies');
 for(const [label,value] of [['Stock quantity','23'],['Quantity per package (each)','10'],['Outer package length (m)','2'],['Outer package width (m)','1'],['Outer package height (m)','.5'],['Specified weight (kg)','50']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Weight applies to',{exact:true}).selectOption('package');
 await page.getByRole('button',{name:'Save material',exact:true}).click();
 let value=JSON.parse((await saved()).raw);assert.equal(value.schema,'xray.source-takeoff/v2');assert.deepEqual(value.rows,old.rows);assert.equal(value.materials.length,1);
 assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('3 m³'));assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('150 kg'));
 report.checks.push('v1 restore leaves original bytes untouched; first material save upgrades to v2 preserving rows, notes and review. Full-package rounding produces 3 m3 / 150 kg for synthetic QA stock.');
 await named(' qa-a01 ','QA duplicate');await page.getByRole('button',{name:'Save material',exact:true}).click();
 assert.ok((await page.getByRole('alert').last().innerText()).includes('Duplicate'));assert.equal(JSON.parse((await saved()).raw).materials.length,1);
 await page.getByRole('button',{name:'Cancel changes',exact:true}).click();
 await named('QA-UNKNOWN','QA ONLY - quantity pending');await page.getByRole('button',{name:'Save material',exact:true}).click();
 await named('QA-BULK','QA ONLY - bulk stock');await page.getByLabel('Quantity unit',{exact:true}).selectOption('m3');
 await page.getByLabel('Stock quantity',{exact:true}).fill('.28');await page.getByRole('spinbutton',{name:/^Quantity per package/}).fill('.01');
 for(const [label,value] of [['Outer package length (m)','.1'],['Outer package width (m)','.2'],['Outer package height (m)','.3'],['Specified weight (kg)','2']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Save material',exact:true}).click();
 assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('3.168 m³'));
 assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('150.56 kg'));
 assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('2 / 3'));
 await shot('02-synthetic-stock-totals');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export materials CSV',exact:true}).click();const csvPath=resolve(dir,'qa-material-export.csv');await(await download).saveAs(csvPath);
 const csv=readFileSync(csvPath,'utf8');assert.ok(csv.includes('"3","30","3","50","package","150"'));assert.ok(csv.includes(current.sourceSha256));
 await page.reload({waitUntil:'domcontentloaded'});await ready();await components();await materials();
 assert.equal(await page.locator('.material-line').count(),3);await page.locator('.material-line').first().click();
 await page.getByLabel('Weight applies to',{exact:true}).selectOption('unit');await page.getByLabel('Specified weight (kg)',{exact:true}).fill('4');await page.getByRole('button',{name:'Save material',exact:true}).click();
 assert.equal(JSON.parse((await saved()).raw).materials[0].revision,2);
 assert.ok((await page.locator('.material-register .takeoff-summary').innerText()).includes('92.56 kg'));
 report.checks.push('Case/whitespace duplicates rejected; unknown lines keep coverage partial; decimal bulk packages round correctly; CSV has source identity and matching per-line results; reload retains three lines and unit-weight edit produces 92.56 kg.');
 await page.locator('.material-line').first().click();await page.getByLabel('Stock quantity',{exact:true}).fill('24');const beforeWrite=await saved();
 await page.evaluate(()=>{window.__qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('xray:source-takeoff:'))throw Error('QA quota failure');return window.__qaSetItem.call(this,k,v);};});
 await page.getByRole('button',{name:'Save material',exact:true}).click();assert.equal((await saved()).raw,beforeWrite.raw);assert.equal(await page.getByLabel('Stock quantity',{exact:true}).inputValue(),'24');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__qaSetItem;delete window.__qaSetItem;});
 await page.getByRole('button',{name:'Save material',exact:true}).click();assert.equal(JSON.parse((await saved()).raw).materials[0].quantity,24);
 await page.setViewportSize({width:390,height:844});await shot('03-mobile-register');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('.material-line').first().click();await page.getByLabel('Stock code / order line',{exact:true}).scrollIntoViewIfNeeded();await shot('04-mobile-editor');
 assert.equal(await page.getByRole('button',{name:'Drawing allowances',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Cancel changes',exact:true}).click();
 const valid=await saved(),future=JSON.stringify({...JSON.parse(valid.raw),schema:'xray.source-takeoff/v99'});await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:valid.key,raw:future});
 await page.reload({waitUntil:'domcontentloaded'});await ready();await components();await materials();
 assert.equal(await page.getByRole('button',{name:'Add material',exact:true}).isDisabled(),true);assert.equal((await saved()).raw,future);
 await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),valid);await page.getByRole('button',{name:'Retry restore',exact:true}).click();assert.equal(await page.locator('.material-line').count(),3);
 report.checks.push('Rejected write preserves previous bytes and unsaved form; retry works. Mobile register/editor render without overflow; editing blocks view switch; future schema blocks materials and valid recovery restores all lines.');
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify(report,null,2));
}catch(e){report.failure=String(e);await shot('failure');throw e;}
finally{writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2));await browser.close();}
