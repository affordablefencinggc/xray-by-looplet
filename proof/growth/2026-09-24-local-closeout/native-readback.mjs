import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function runNativeReadback({call,evaluate,root}) {
  const records=[];
  const ev=async(name,expression)=>{const value=await evaluate(expression);records.push({name,value});return value};
  const wait=(name,condition)=>ev(name,`new Promise((resolve,reject)=>{const t=performance.now();const f=()=>{if(${condition})return resolve(true);if(performance.now()-t>15000)return reject(Error(${JSON.stringify(name)}));requestAnimationFrame(f)};f()})`);
  const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,name+'.png'),Buffer.from(r.data,'base64'));records.push({screenshot:name+'.png'})};
  await ev('Open Estimate',`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&e.textContent.trim()==='Estimate');b.click();return true})()`);
  await wait('Price library mounted',`!!document.querySelector('[aria-label="Project price books"]')`);
  await ev('Open worksheet',`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/^Priced worksheet/.test(e.textContent.trim()));b.click();return true})()`);
  await wait('Issued history mounted',`!!document.querySelector('[aria-label="Issued quotes"]')`);
  const saved=await ev('Read saved issues',`JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:')))).issuedQuotes`);
  const prior=path.join(root,'../native-features01');
  assert.deepEqual(saved,[JSON.parse(fs.readFileSync(path.join(prior,'first-issued.json'))),JSON.parse(fs.readFileSync(path.join(prior,'second-issued.json')))]);
  await call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
  await wait('Responsive collapse control mounted',`!!document.querySelector('button[aria-label="Collapse assistant rail"]')`);
  await ev('Collapse assistant using its control',`document.querySelector('button[aria-label="Collapse assistant rail"]').click();true`);
  await wait('Quote has readable landscape width',`document.querySelector('[aria-label="Frozen issued quote"]').getBoundingClientRect().width>850`);
  await ev('Scroll to issued table',`document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView({block:'start'});true`);
  await shot('native-issued-readable-landscape');
  await ev('Stock rule view',`document.querySelector('details[aria-label="Fencing stock cutting"]').open=true;document.querySelector('[aria-label="Fencing cutting result"]').scrollIntoView({block:'start'});true`);
  await shot('native-stock-readable-landscape');
  await call('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
  await ev('Portrait quote view',`document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView({block:'start'});true`);
  await shot('native-issued-readable-portrait');
  fs.writeFileSync(path.join(root,'readback-result.json'),JSON.stringify({host:'DANIEL',verdict:'PASS',unchangedIssuedQuotes:true,records},null,2));
}
