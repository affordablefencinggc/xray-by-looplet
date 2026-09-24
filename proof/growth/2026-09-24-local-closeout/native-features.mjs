import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// The preceding native workload creates/calibrates the test geometry and runs
// the default bundled engine. All feature changes below use mounted controls.
export async function runNativeFeatures({ call, evaluate, root }) {
  const receipts = [];
  async function step(name, action) {
    const start = performance.now();
    try { const result = await action(); receipts.push({ name, result, ms: performance.now() - start }); return result; }
    catch (error) { receipts.push({ name, error: error.message }); throw error; }
    finally { fs.writeFileSync(path.join(root, 'features.json'), JSON.stringify(receipts, null, 2)); }
  }
  const ev = (name, expression) => step(name, () => evaluate(expression));
  const wait = (name, condition) => ev(name, `new Promise((resolve,reject)=>{const start=performance.now();const check=()=>{try{if(${condition})return resolve(true)}catch{};if(performance.now()-start>20000)return reject(Error(${JSON.stringify(name)}));requestAnimationFrame(check)};check()})`);
  const click = name => ev('Click ' + name, `(()=>{const es=[...document.querySelectorAll('button')].filter(e=>e.offsetParent&&e.textContent.trim()===${JSON.stringify(name)});if(es.length!==1||es[0].disabled)throw Error('Unavailable button '+${JSON.stringify(name)});es[0].click();return true})()`);
  const set = (name, value) => ev('Set ' + name, `__set(${JSON.stringify(name)},${JSON.stringify(value)})`);
  const screenshot = (name, selector) => step('Screenshot ' + name, async () => {
    if (selector) await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'});true`);
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const bytes = Buffer.from(shot.data, 'base64'); fs.writeFileSync(path.join(root, name + '.png'), bytes);
    return { file: name + '.png', sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  const worksheet = () => ev('Open priced worksheet', `(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/^Priced worksheet/.test(e.textContent.trim()));if(!b)throw Error('Worksheet button missing');b.click();return true})()`);
  const libraryHelpers = `window.__libraryKey=Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:'));if(!__libraryKey)throw Error('No price library');window.__lib=()=>JSON.parse(localStorage.getItem(__libraryKey));window.__set=(label,value)=>{const el=[...document.querySelectorAll('input,select,textarea')].find(e=>e.offsetParent&&e.getAttribute('aria-label')===label)||[...document.querySelectorAll('label')].find(e=>e.textContent.trim().startsWith(label))?.querySelector('input,select,textarea');if(!el)throw Error('Missing field '+label);const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));return {label,value:el.value}};true`;
  await ev('Read library identity and install UI helpers', libraryHelpers);
  const initial = await ev('Current real engine material register', `(()=>{const r=document.querySelector('[aria-label="Price from material register"]');if(r.dataset.bomCurrent!=='true')throw Error('Materials stale');return {key:__libraryKey,commit:r.dataset.bomCommit,rows:[...r.querySelectorAll('tr[data-bom-key]')].map(e=>({key:e.dataset.bomKey,text:e.innerText}))}})()`);
  fs.writeFileSync(path.join(root, 'native-materials.json'), JSON.stringify(initial, null, 2));
  await ev('Capture actual download bytes without suppressing downloads', `(()=>{window.__exports=[];const create=URL.createObjectURL.bind(URL),blobs=new Map();URL.createObjectURL=b=>{const u=create(b);blobs.set(u,b);return u};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){const b=blobs.get(this.href),name=this.download;if(b&&name)b.arrayBuffer().then(ab=>{const bytes=new Uint8Array(ab);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));__exports.push({name,bytes:bytes.length,base64:btoa(s)})});return click.call(this)};return true})()`);
  // Reuse the reviewed retail CSV entry controls and the explicitly synthetic
  // stock-rate import from the existing browser scenario. No fixture seeding.
  const stock = JSON.parse(fs.readFileSync('proof/growth/2026-09-23-industry-closeout/closeout-fencing-stock-c56ad63e9ee7/scenario.json'));
  for (const i of [12,13,14,15,16,17,18,19,20,21,23,25,26,27,28,29,30,31,32,33,34,36]) {
    const [op, ...args] = stock[i];
    if (op === 'find') await click(args[4]);
    else if (op === 'wait') await wait('Import ready ' + i, args[1]);
    else await ev('Reviewed import control ' + i, args[0]);
  }
  await wait('Three saved price books', '__lib().books.length===3');
  await worksheet();
  await ev('Open stock rules', `document.querySelector('details[aria-label="Fencing stock cutting"]').open=true;true`);
  await wait('Stock controls ready', `!!document.querySelector('[aria-label="Stock component"]')`);
  for (const [item, profile, post] of [['TP-RAIL-CUT','QA native rail',false],['TP-POST-END','QA native end post',true]]) {
    await ev('Choose stock component ' + item, `(()=>{const s=document.querySelector('[aria-label="Stock component"]'),o=[...s.options].find(o=>o.text.startsWith(${JSON.stringify(item)}));if(!o)throw Error('Stock component unavailable');return __set('Stock component',o.value)})()`);
    for (const [label, value] of [['Stock profile',profile],['Available stock lengths mm','2400, 4800'],['Stock kerf mm','5'],['Reusable offcut mm','1200'],[post?'Finished post length mm':'Rail cut adjustment mm',post?'2400':'0'],['Stock reviewed by','QA estimator - synthetic test'],['Stock schedule reference','Synthetic level cutting trial only: 2400/4800 stock, 5mm kerf, zero rail joint adjustment; 2400mm posts include declared 600mm embedment. Not supplier/site approval.']]) await set(label,value);
    await click('Save reviewed stock rule');
    await wait('Saved stock ' + item, `__lib().fencingStockRules?.some(r=>r.profile===${JSON.stringify(profile)})`);
  }
  await wait('Stock calculations current', `document.querySelector('[aria-label="Fencing cutting result"]')?.querySelectorAll('.price-book-card').length===2`);
  await ev('Read native cutting totals', `(()=>{const e=document.querySelector('[aria-label="Fencing cutting result"]');e.querySelectorAll('details').forEach(d=>d.open=true);return e.innerText})()`);
  await screenshot('native-stock-cuts-desktop','[aria-label="Fencing cutting result"]');
  await click('Download fencing cut list CSV');
  const map = async (key, code, factor = '1') => {
    await ev('Map ' + key, `(()=>{const s=[...document.querySelectorAll('select')].find(e=>e.getAttribute('aria-label')===${JSON.stringify('Rate for ' + key)}),o=[...s.options].find(o=>o.text.startsWith(${JSON.stringify(code)}));if(!o)throw Error('Rate missing');return __set(${JSON.stringify('Rate for ' + key)},o.value)})()`);
    await set('Factor for ' + key,factor);
    await ev('Save mapping ' + key, `(()=>{const r=[...document.querySelectorAll('tr[data-bom-key]')].find(e=>e.dataset.bomKey===${JSON.stringify(key)});const b=[...r.querySelectorAll('button')].find(e=>e.textContent==='Save');if(!b||b.disabled)throw Error('Mapping unavailable');b.click();return true})()`);
    await wait('Mapping persisted ' + key, `__lib().worksheet.some(l=>l.bom?.key===${JSON.stringify(key)}&&l.bom.factor===${JSON.stringify(factor)})`);
  };
  const purchases = await ev('Read purchasing keys', `__lib().fencingStockRules.length===2 ? [...document.querySelectorAll('tr[data-bom-key]')].map(e=>e.dataset.bomKey).filter(k=>k.startsWith('STOCK:')) : []`);
  if (!purchases.length) throw Error('No stock purchase rows');
  for (const key of purchases) await map(key,key.includes('TP-RAIL')?'QA-RAIL':'QA-POST',String(Number(key.split(':').at(-1))/2400));
  for (const [key,code] of [['TP-GATE-HINGE-SET','0131443'],['TP-GATE-LATCH','0131450'],['TP-GATE-DROP-BOLT','0131457']]) await map(key,code);
  // Clear the baseline training leaf mapping: the generic Bunnings leaves do
  // not establish a fit for this opening. Keep both exclusions explicit.
  for (const key of ['TP-GATE-LEAF','TP-GATE-OPENING']) {
    await set('Rate for '+key,'');
    await wait('No-rate field '+key, `!![...document.querySelectorAll('input')].find(e=>e.getAttribute('aria-label')===${JSON.stringify('No-rate reason for '+key)})`);
    await set('No-rate reason for '+key,'No reviewed fit: two nominal 900mm Bunnings leaves do not establish this 2000mm double opening. Excluded pending a matching gate schedule/rate.');
    await ev('Save explicit gate exclusion '+key, `document.querySelector('tr[data-bom-key="${key}"] button').click();true`);
    await wait('Gate exclusion persisted '+key, `__lib().bomNoRates?.some(n=>n.key===${JSON.stringify(key)})&&!__lib().worksheet.some(l=>l.bom?.key===${JSON.stringify(key)})`);
  }
  await ev('Read mapped pricing and prevent duplicate rail/post price', `(()=>{const l=__lib();if(l.worksheet.some(x=>['TP-RAIL-CUT','TP-RAIL-LM','TP-POST-END'].includes(x.bom?.key)))throw Error('Stock double charged');return {books:l.books,worksheet:l.worksheet,noRates:l.bomNoRates}})()`);
  await screenshot('native-mapped-hardware-desktop','[aria-label="Price from material register"]');
  await ev('Open draft quote', `document.querySelector('details[aria-label="Draft quote"]').open=true;true`);
  for (const [label,value] of [['Quote from','QA native fencing trial'],['Quote customer','Synthetic acceptance only'],['Quote reference','NATIVE-LEVEL-Q1'],['Quote site address','Redburn sample drawing - synthetic fence, not a customer job'],['Quote notes','Training estimate. Generic Bunnings hardware allowances; synthetic stock rates. Gate leaves/opening excluded until fit is reviewed. No construction approval.']]) await set(label,value);
  await click('Review quote for issue');
  await wait('Issue review ready', `!!document.querySelector('[aria-label="Quote issue review"]')`);
  await screenshot('native-quote-review','[aria-label="Quote issue review"]');
  await click('Mark quote as issued');
  await wait('First issue saved', '__lib().issuedQuotes?.length===1');
  const first = await ev('Frozen quote and material coverage', `(()=>{const q=__lib().issuedQuotes[0];if(q.materialCoverage.lines.some(l=>l.status==='unreviewed'))throw Error('Unreviewed issue');const amounts=q.lines.filter(l=>['0131443','0131450','0131457'].includes(l.itemCode)).map(l=>Number(l.amount));return q})()`);
  fs.writeFileSync(path.join(root,'first-issued.json'),JSON.stringify(first,null,2));
  await screenshot('native-issued-desktop','[aria-label="Frozen issued quote"]');
  await click('Download issued quote PDF');
  await wait('First PDF captured', `__exports.some(e=>e.name==='NATIVE-LEVEL-Q1-issued-quote.pdf')`);
  await click('Download issued handover (ZIP)');
  await wait('First ZIP captured', `__exports.some(e=>e.name==='NATIVE-LEVEL-Q1-issued-quote-handover.zip')`);
  // A UI mapping-factor revision intentionally changes the next quotation.
  // It is a synthetic persistence test, not a claimed geometric job revision.
  const changed = purchases.find(k=>k.includes('TP-RAIL'));
  await map(changed,'QA-RAIL',String(2*Number(changed.split(':').at(-1))/2400));
  await ev('First quote unchanged by mapping revision', `(()=>{if(JSON.stringify(__lib().issuedQuotes[0])!==${JSON.stringify(JSON.stringify(first))})throw Error('Frozen quote mutated');return true})()`);
  await set('Quote reference','NATIVE-LEVEL-Q1-R2');
  await click('Review quote for issue');
  await wait('Revision review ready', `document.querySelector('[aria-label="Quote issue review"]')?.textContent.includes('NATIVE-LEVEL-Q1-R2')`);
  await click('Mark quote as issued');
  await wait('Second issue saved', '__lib().issuedQuotes?.length===2');
  const second = await ev('Revised issue retained alongside original', `(()=>{const qs=__lib().issuedQuotes;if(JSON.stringify(qs[0])!==${JSON.stringify(JSON.stringify(first))})throw Error('Original mutated');if(JSON.stringify(qs[0].totals)===JSON.stringify(qs[1].totals))throw Error('Revision did not change price');return qs[1]})()`);
  fs.writeFileSync(path.join(root,'second-issued.json'),JSON.stringify(second,null,2));
  await click('Download issued quote PDF');
  await wait('Revision PDF captured', `__exports.some(e=>e.name==='NATIVE-LEVEL-Q1-R2-issued-quote.pdf')`);
  await click('Download issued handover (ZIP)');
  await wait('Revision ZIP captured', `__exports.some(e=>e.name==='NATIVE-LEVEL-Q1-R2-issued-quote-handover.zip')`);
  const exported = await evaluate('__exports');
  const manifest = [];
  for (const f of exported) {
    if (path.basename(f.name)!==f.name) throw Error('Export filename escaped');
    const bytes=Buffer.from(f.base64,'base64');if(bytes.length!==f.bytes)throw Error('Export truncated');
    fs.writeFileSync(path.join(root,f.name),bytes);manifest.push({file:f.name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  fs.writeFileSync(path.join(root,'exports.json'),JSON.stringify(manifest,null,2));
  await step('Native landscape viewport',()=>call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false}));
  await screenshot('native-issued-landscape','[aria-label="Issued quotes"]');
  await step('Reload native app',()=>call('Page.reload'));
  await wait('Native hydration restored',`document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready'`);
  await click('Estimate');await worksheet();
  await ev('Restore read-only library helpers',libraryHelpers);
  await wait('Reload restored both issues', '__lib().issuedQuotes?.length===2');
  await ev('Exact reload persistence',`(()=>{const l=__lib();if(JSON.stringify(l.issuedQuotes)!==${JSON.stringify(JSON.stringify([first,second]))}||l.fencingStockRules.length!==2)throw Error('Reload changed saved data');return {issued:2,stockRules:2,originalFrozen:true}})()`);
  await step('Native portrait viewport',()=>call('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false}));
  await wait('Tablet issued history visible',`!!document.querySelector('[aria-label="Issued quotes"]')`);
  await screenshot('native-issued-reloaded-portrait','[aria-label="Issued quotes"]');
  await set('Saved quote issue',first.issue.id);
  await wait('Original issue selected',`document.querySelector('[aria-label="Frozen issued quote"]')?.textContent.includes('Issued NATIVE-LEVEL-Q1')&&!document.querySelector('[aria-label="Frozen issued quote"]')?.textContent.includes('Issued NATIVE-LEVEL-Q1-R2')`);
  await screenshot('native-original-issue-after-revision','[aria-label="Frozen issued quote"]');
  fs.writeFileSync(path.join(root,'features-result.json'),JSON.stringify({verdict:'PASS',operations:receipts.length,exports:manifest.length,host:'DANIEL',scope:'Synthetic native level stock, generic hardware allowances, issue/mapping revision/reload; not real-job acceptance'},null,2));
}
