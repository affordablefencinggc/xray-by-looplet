import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDefaultJob, createRunSpecification } from '../../../src/studio/domain.ts';
import { createTwoPointCalibrationCandidate, lockCalibration } from '../../../src/studio/calibration.ts';
import { createCandidateFencingRecipeSet, computeRecipeSetDigest } from '../../../src/studio/fencingRecipes.ts';
import { compileBomRequest } from '../../../src/studio/bomCompiler.ts';
import { buildBom } from '../../../src/studio/bomRules.ts';
import { createBomState, beginBomBuild, completeBomBuild } from '../../../src/studio/bomState.ts';

if (process.env.COMPUTERNAME?.toLowerCase() !== 'dans1') throw Error('DANS1 only');
const base='proof/growth/2026-09-23-fencing-cutting/', now='2026-09-23T10:00:00.000Z';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400"><rect width="900" height="400" fill="white"/><text x="80" y="80" font-size="20">SYNTHETIC STOCK CUTTING CHECK - 5.000 m</text><path d="M100 200H600" stroke="black" stroke-width="3"/><text x="80" y="330" font-size="14">Level, 2.4m full bays, no gates. Test quantities only.</text></svg>';
const sha=createHash('sha256').update(svg).digest('hex'), docId='doc-stock-proof';
const job=createDefaultJob(now); Object.assign(job,{id:'job-stock-proof',name:'Synthetic fencing cutting proof',trade:'fencing',activeDocumentId:docId,activeSheet:0});
job.documents=[{id:docId,name:'Synthetic stock 5m.svg',kind:'svg',importedAt:now,pageCount:1,sha256:sha,source:'web'}];
const points=[{x:100,y:200},{x:600,y:200}];
const candidate=createTwoPointCalibrationCandidate({id:'stock-cal',source:'manual',points,distance:{value:5,unit:'m'},transform:job.calibrations[0].transform,confidence:1,provenance:{method:'two-point',evidence:'Synthetic 5.000m reference',documentId:docId}});
job.calibrations=[lockCalibration({...job.calibrations[0],coordinateSpace:'source-page-v1',candidates:[candidate]})];
job.runs=[{id:'stock-run',revision:1,sheet:0,label:'Synthetic 5m run',points,lengthM:5,grossLengthM:5,gateDeductionM:0,netLengthM:5,
  specification:{...createRunSpecification(),system:'colorbond',profile:'Good Neighbour',heightM:1.8,bayWidthM:2.4,ground:'soil',slope:'level',access:'clear',sleepers:'none',retainingType:'none',notes:'Synthetic geometry; no site or supplier approval.'},
  photoIds:[],review:{status:'approved',decidedBy:'QA fixture',decidedAt:now,note:'Synthetic test operands'}}];
const recipes=await createCandidateFencingRecipeSet();
for(const recipe of recipes.recipes) for(const a of recipe.assumptions)Object.assign(a,{status:'accepted',acceptedBy:'QA fixture only',acceptedAt:now});
recipes.digest=await computeRecipeSetDigest(recipes);
const compiled=await compileBomRequest({job,recipeSet:recipes,runtimeAssets:{document:{state:'ready',message:null},photos:{}},hydrationSettled:true,requestId:'stock-proof'});
if(!compiled.ok)throw Error(JSON.stringify(compiled.issues));
const response=await buildBom(compiled.request);if(!response.ok)throw Error(JSON.stringify(response));
const completed=completeBomBuild(beginBomBuild(createBomState(job.id),compiled.request,now),{expectedRequestId:'stock-proof',expectedJobRevision:job.revision,completedAt:now,response});
if(!completed.ok||!completed.state.snapshot)throw Error('Could not bind fixture BOM');
writeFileSync(base+'synthetic-stock-fixture.json',JSON.stringify({job,recipes,request:compiled.request,bom:completed.state,sourceSha256:sha},null,2));
const ops=[['context','default'],['init-script','default',`(()=>{const blobs=new Map();window.__fileProof=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);blobs.set(url,blob);return url};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(...args){const blob=blobs.get(this.href),name=this.download;if(blob&&name)void blob.arrayBuffer().then(async bytes=>{const arr=new Uint8Array(bytes),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',arr))].map(b=>b.toString(16).padStart(2,'0')).join('');let binary='';for(const b of arr)binary+=String.fromCharCode(b);window.__fileProof.push({name,mime:blob.type,bytes:arr.length,sha256,base64:btoa(binary)})});return click.apply(this,args)}})()`]], ev=s=>ops.push(['eval',s]), wait=s=>ops.push(['wait','--fn',s,20000]);
const click=name=>ops.push(['find','role','button','click','--name',name,'--exact']);
const shot=name=>ops.push(['screenshot','captures/'+name+'.png']);
const set=(label,value)=>ev(`window.__set(${JSON.stringify(label)},${JSON.stringify(String(value))})`);
ops.push(['expect-cancelled-fetch','{{ORIGIN}}/api/pricing-research',10,'Pane unmount aborts its provider-status fetch; no asset failures exempted.'],['set','viewport','1440','1000'],['open','{{ORIGIN}}/industry-coverage/index.html']);
wait(`location.pathname.endsWith('/industry-coverage/index.html') && document.readyState==='complete'`);
ev(`(async()=>{if(document.querySelector('script[type="module"]')||localStorage.getItem('xray:fencing-job:v2'))throw Error('Fresh pre-mount fixture only');
 const source=${JSON.stringify(svg)},bytes=new TextEncoder().encode(source);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==${JSON.stringify(sha)})throw Error('Source hash');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('xray-plan-content-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'documentId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').add({documentId:${JSON.stringify(docId)},name:'Synthetic stock 5m.svg',kind:'svg',mimeType:'image/svg+xml',sizeBytes:bytes.length,sha256:hash,bytes:bytes.buffer});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 for(const [key,value]of ${JSON.stringify([['xray:fencing-job:v2',job],['xray:fencing-recipe-state:v1:'+job.id,{schema:'xray.fencing-recipe-state/v1',jobId:job.id,recipeSet:recipes}],['xray:bom-state:v1:'+job.id,completed.state]])})localStorage.setItem(key,JSON.stringify(value));return {sourceSha256:hash,synthetic:true};})()`);
ops.push(['open','{{ORIGIN}}/']);wait(`document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready'`);click('Estimate');
wait(`!!document.querySelector('[aria-label="Project price books"]')`);
ev(`window.__set=(label,value)=>{let el=document.querySelector('[aria-label="'+label+'"]');if(!el)el=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(label))?.querySelector('input,select,textarea');if(!el)throw Error('Missing field '+label);for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;}`);
async function importBook(csv,name,supplier,reference,count){
 click('Import price sheet');ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(csv)}],${JSON.stringify(name+'.csv')},{type:'text/csv'}));const e=document.querySelector('[aria-label="Project price books"] input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
 wait(`document.querySelector('[aria-label="Project price books"]')?.dataset.priceImportState==='ready'`);
 for(const [label,v]of Object.entries({'Price book name':name,'Supplier':supplier,'Tax basis':'inclusive','Tax percent (optional)':'10','Effective date':'2026-09-23','Source reference':reference}))set(label,v);
 click('Review import');shot(name.includes('Bunnings')?'bunnings-import-review':'qa-stock-import-review');click('Save reviewed price book');
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof'))?.books.length===${count}`);
}
await importBook(readFileSync(base+'bunnings-gate-allowances-2026-09-23.csv','utf8'),'Bunnings generic gate allowances','Bunnings Australia','Bunnings AU retail 2026-09-23; SKUs 0131443/0131450/0131457/8500233. AUD incl GST 10%. Pair allowance = two nominal 900mm leaves, not a fitted 2m or 3m gate; hardware extra.',1);
await importBook('Code,Description,Unit,Rate\nQA-RAIL,QA rail 2400mm,ea,10\nQA-POST,QA post 2400mm,ea,18.5\n','Synthetic stock rates','QA supplier','Synthetic arithmetic test rates only, not Bunnings prices.',2);
click('Priced worksheet (0)');ev(`document.querySelector('details[aria-label="Fencing stock cutting"]').open=true;true`);
wait(`!!document.querySelector('[aria-label="Stock component"]')`);
set('Stock component','recipe-colorbond-good-neighbour:cb-rail-cut');
for(const [label,v]of Object.entries({'Stock profile':'QA rail profile','Available stock lengths mm':'2400, 4800','Stock kerf mm':'5','Reusable offcut mm':'1200','Rail cut adjustment mm':'0','Stock reviewed by':'QA estimator','Stock schedule reference':'Synthetic 2400/4800 cutting schedule; zero joint adjustment declared for this test'}))set(label,v);
click('Save reviewed stock rule');wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')).fencingStockRules?.length===1`);
wait(`document.querySelector('[aria-label="Fencing cutting result"]')?.textContent.includes('1.9900 m reusable')`);
set('Stock component','recipe-colorbond-good-neighbour:cb-post-end');
for(const [label,v]of Object.entries({'Stock profile':'QA end post','Available stock lengths mm':'2400, 4800','Stock kerf mm':'5','Reusable offcut mm':'1200','Finished post length mm':'2400','Stock reviewed by':'QA estimator','Stock schedule reference':'Synthetic finished length includes 600mm embedment'}))set(label,v);
click('Save reviewed stock rule');wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')).fencingStockRules?.length===2`);
ev(`(()=>{const e=document.querySelector('[aria-label="Fencing cutting result"]');e.querySelectorAll('details').forEach(d=>d.open=true);e.scrollIntoView();if(!e.textContent.includes('10.000 m cuts'))throw Error('Missing rail quantity');return true})()`);shot('stock-cuts-desktop');
click('Download fencing cut list CSV');
for(const [key,rateCode]of [['STOCK:CB-RAIL-CUT:QA rail profile:2400','QA-RAIL'],['STOCK:CB-POST-END:QA end post:2400','QA-POST']]){
 ev(`(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify('Rate for '+key)});const option=[...e.options].find(o=>o.text.includes(${JSON.stringify(rateCode)}));window.__set(${JSON.stringify('Rate for '+key)},option.value);return true})()`);
 ev(`(()=>{const row=[...document.querySelectorAll('[data-bom-key]')].find(e=>e.dataset.bomKey===${JSON.stringify(key)});row.querySelector('button').click();return true})()`);
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')).worksheet.some(l=>l.bom?.key===${JSON.stringify(key)})`);
}
ev(`document.querySelector('details[aria-label="Draft quote"]').open=true;true`);
for(const [label,v]of Object.entries({'Quote from':'QA stock proof','Quote customer':'Synthetic test','Quote reference':'STOCK-Q1','Quote notes':'Synthetic fixture. No construction, supplier fit or site approval.'}))set(label,v);
click('Review quote for issue');click('Mark quote as issued');wait(`document.querySelector('.price-notice[role=status]')?.textContent.includes('Review every material')`);shot('unreviewed-issue-blocked');
for(const line of response.bom.lines.filter(l=>!['CB-RAIL-CUT','CB-RAIL-LM','CB-POST-END'].includes(l.itemCode))){
 set('No-rate reason for '+line.itemCode,`Supplier specification and rate still required for ${line.description}; excluded from this synthetic quote.`);
 ev(`(()=>{const row=document.querySelector('[data-bom-key=${JSON.stringify(line.itemCode)}]');row.querySelector('button').click();return true})()`);
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')).bomNoRates?.some(n=>n.key===${JSON.stringify(line.itemCode)})`);
}
click('Review quote for issue');ev(`document.querySelector('[aria-label="Quote issue review"]').scrollIntoView();true`);shot('stock-quote-coverage-review');click('Mark quote as issued');
wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')).issuedQuotes?.length===1`);
ev(`(()=>{const l=JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof')),q=l.issuedQuotes[0];if(q.totals[0].amount!=='87.00'||l.worksheet.length!==2||q.materialCoverage.lines.some(x=>x.status==='unreviewed'))throw Error('Coverage or cents');sessionStorage.setItem('stock-issued-proof',JSON.stringify(q));return {total:q.totals[0],noRates:q.materialCoverage.lines.filter(x=>x.status==='no-rate').length}})()`);
click('Download issued quote PDF');click('Download issued handover (ZIP)');
wait(`window.__fileProof.some(f=>f.name==='STOCK-Q1-issued-quote-handover.zip')`);
ev(`({exportMetadata:window.__fileProof.map(({base64,...metadata})=>metadata)})`);
for(const name of ['STOCK-Q1-issued-quote.pdf','STOCK-Q1-issued-quote-handover.zip','fencing-cuts-register-1.csv'])for(let part=0;part<16;part++)ev(`(()=>{const file=window.__fileProof.find(f=>f.name===${JSON.stringify(name)});if(!file)throw Error('Missing exported file');const base64=file.base64.slice(${part*6500},${(part+1)*6500});return base64?{exportChunk:{name:file.name,part:${part},base64}}:null})()`);
for(const [w,h,label]of [[1024,768,'landscape'],[768,1024,'portrait']]){
 ops.push(['set','viewport',String(w),String(h)]);ev(`(()=>{document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView();if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Page overflow');return true})()`);shot('stock-issued-tablet-'+label);
}
ops.push(['open','{{ORIGIN}}/']);wait(`document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready'`);click('Estimate');click('Priced worksheet (2)');
wait(`!!document.querySelector('[aria-label="Stock component"]')`);
ev(`(()=>{const l=JSON.parse(localStorage.getItem('xray:price-books:v1:job-stock-proof'));if(JSON.stringify(l.issuedQuotes[0])!==sessionStorage.getItem('stock-issued-proof'))throw Error('Issue changed');if(l.fencingStockRules.length!==2||l.worksheet.length!==2)throw Error('Stock restore');document.querySelector('details[aria-label="Fencing stock cutting"]').open=true;document.querySelector('[aria-label="Fencing cutting result"]').scrollIntoView();return true})()`);shot('stock-restored-after-reload');
writeFileSync(base+'stock-dev.json',JSON.stringify(ops,null,2));
console.log(JSON.stringify({host:process.env.COMPUTERNAME,sourceSha256:sha,operations:ops.length,bomLines:response.bom.lines.length,fixture:'synthetic',requestDigest:compiled.request.inputDigest}));
