import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDefaultJob, createRunSpecification, createGateSpecification } from '../../../src/studio/domain.ts';
import { createTwoPointCalibrationCandidate, lockCalibration } from '../../../src/studio/calibration.ts';
import { createCandidateFencingRecipeSet, computeRecipeSetDigest } from '../../../src/studio/fencingRecipes.ts';
import { compileBomRequest } from '../../../src/studio/bomCompiler.ts';
import { buildBom } from '../../../src/studio/bomRules.ts';
import { createBomState, beginBomBuild, completeBomBuild } from '../../../src/studio/bomState.ts';

if (process.env.COMPUTERNAME?.toLowerCase() !== 'dans1') throw Error('DANS1 only');
const base='proof/growth/2026-09-23-industry-closeout/', now='2026-09-23T10:00:00.000Z';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400"><rect width="900" height="400" fill="white"/><text x="80" y="80" font-size="20">SYNTHETIC GATE HARDWARE CHECK - 5m RUN / 2m GATE</text><path d="M100 200H600" stroke="black" stroke-width="3"/><text x="80" y="330" font-size="14">Level timber, 2m double gate. Test geometry only; Bunnings hardware budget.</text></svg>';
const sha=createHash('sha256').update(svg).digest('hex'), docId='doc-stock-proof';
const job=createDefaultJob(now); Object.assign(job,{id:'job-hardware-proof',name:'Synthetic gate hardware allowance proof',trade:'fencing',activeDocumentId:docId,activeSheet:0});
job.documents=[{id:docId,name:'Synthetic stock 5m.svg',kind:'svg',importedAt:now,pageCount:1,sha256:sha,source:'web'}];
const points=[{x:100,y:200},{x:600,y:200}];
const candidate=createTwoPointCalibrationCandidate({id:'stock-cal',source:'manual',points,distance:{value:5,unit:'m'},transform:job.calibrations[0].transform,confidence:1,provenance:{method:'two-point',evidence:'Synthetic 5.000m reference',documentId:docId}});
job.calibrations=[lockCalibration({...job.calibrations[0],coordinateSpace:'source-page-v1',candidates:[candidate]})];
job.runs=[{id:'stock-run',revision:1,sheet:0,label:'Synthetic 5m run',points,lengthM:3,grossLengthM:5,gateDeductionM:2,netLengthM:3,
  specification:{...createRunSpecification(),system:'timber-paling',profile:'Standard paling',heightM:1.8,bayWidthM:2.4,ground:'soil',slope:'level',access:'clear',sleepers:'none',retainingType:'none',notes:'Synthetic geometry; no site or supplier approval.'},
  photoIds:[],review:{status:'approved',decidedBy:'QA fixture',decidedAt:now,note:'Synthetic test operands'}}];
job.gates=[{...createGateSpecification(),id:'hardware-gate',revision:1,sheet:0,label:'Synthetic 2m double gate',point:{x:350,y:200},runId:'stock-run',segmentIndex:0,segmentT:0.5,widthM:2,heightM:1.8,type:'double',openingDirection:'inward',hingeSide:'double',hardware:'Synthetic recipe counts only; generic Bunnings allowances are not suitability approval.',latch:'Allowance only',postSize:'QA 100mm',finish:'QA',clearanceM:0.05,photoIds:[],review:{status:'approved',decidedBy:'QA fixture',decidedAt:now,note:'Synthetic gate test only'}}];
const recipes=await createCandidateFencingRecipeSet();
for(const recipe of recipes.recipes) for(const a of recipe.assumptions)Object.assign(a,{status:'accepted',acceptedBy:'QA fixture only',acceptedAt:now});
recipes.digest=await computeRecipeSetDigest(recipes);
const compiled=await compileBomRequest({job,recipeSet:recipes,runtimeAssets:{document:{state:'ready',message:null},photos:{}},hydrationSettled:true,requestId:'stock-proof'});
if(!compiled.ok)throw Error(JSON.stringify(compiled.issues));
const response=await buildBom(compiled.request);if(!response.ok)throw Error(JSON.stringify(response));
const completed=completeBomBuild(beginBomBuild(createBomState(job.id),compiled.request,now),{expectedRequestId:'stock-proof',expectedJobRevision:job.revision,completedAt:now,response});
if(!completed.ok||!completed.state.snapshot)throw Error('Could not bind fixture BOM');
writeFileSync(base+'synthetic-hardware-fixture.json',JSON.stringify({job,recipes,request:compiled.request,bom:completed.state,sourceSha256:sha},null,2));
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
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof'))?.books.length===${count}`);
}
await importBook(readFileSync('proof/growth/2026-09-23-fencing-cutting/bunnings-gate-allowances-2026-09-23.csv','utf8'),'Bunnings generic gate allowances','Bunnings Australia','Bunnings AU retail 2026-09-23. AUD incl GST 10%. Hardware allowance only; no load, fixing, finish or fit approval. 2 x 900mm gate pair does not fit this synthetic 2000mm opening.',1);
click('Priced worksheet (0)');
for(const [key,code]of [['TP-GATE-HINGE-SET','0131443'],['TP-GATE-LATCH','0131450'],['TP-GATE-DROP-BOLT','0131457']]){
 ev(`(()=>{const e=document.querySelector('[aria-label="Rate for '+${JSON.stringify(key)}+'"]');const o=[...e.options].find(o=>o.text.includes(${JSON.stringify(code)}));if(!o)throw Error('Missing Bunnings allowance');window.__set('Rate for '+${JSON.stringify(key)},o.value);return true})()`);
 ev(`(()=>{const r=document.querySelector('[data-bom-key="'+${JSON.stringify(key)}+'"]');r.querySelector('button').click();return true})()`);
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof')).worksheet.some(l=>l.bom?.key===${JSON.stringify(key)})`);
}
for(const line of response.bom.lines.filter(l=>!['TP-GATE-HINGE-SET','TP-GATE-LATCH','TP-GATE-DROP-BOLT'].includes(l.itemCode))){
 const reason=['TP-GATE-OPENING','TP-GATE-LEAF'].includes(line.itemCode)?'Custom gate price unknown: two nominal 900mm Bunnings leaves do not fit this 2000mm test opening. Excluded; do not charge opening and leaves twice.':'Excluded from this hardware-only allowance test; supplier material and installation quote required.';
 set('No-rate reason for '+line.itemCode,reason);
 ev(`(()=>{document.querySelector('[data-bom-key="'+${JSON.stringify(line.itemCode)}+'"]').querySelector('button').click();return true})()`);
 wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof')).bomNoRates?.some(n=>n.key===${JSON.stringify(line.itemCode)})`);
}
ev(`document.querySelector('details[aria-label="Draft quote"]').open=true;true`);
for(const [label,value]of Object.entries({'Quote from':'QA allowance proof','Quote customer':'Synthetic geometry only','Quote reference':'GATE-HARDWARE-QA','Quote notes':'Hardware budget only. Bunnings prices inclusive of GST; fit and load suitability unreviewed. This is not a real job quote.'}))set(label,value);
click('Review quote for issue');ev(`document.querySelector('[aria-label="Quote issue review"]').scrollIntoView();true`);shot('gate-hardware-review');click('Mark quote as issued');
wait(`JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof')).issuedQuotes?.length===1`);
ev(`(()=>{const l=JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof')),q=l.issuedQuotes[0];if(q.totals[0].amount!=='108.84'||q.lines.length!==3||q.materialCoverage.lines.some(x=>x.status==='unreviewed'))throw Error('Hardware totals/coverage');sessionStorage.setItem('hardware-issued',JSON.stringify(q));document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView();return {quote:q}})()`);shot('gate-hardware-issued-desktop');
ops.push(['set','viewport','768','1024']);ev(`document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView();true`);shot('gate-hardware-issued-portrait');
ops.push(['open','{{ORIGIN}}/']);wait(`document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready'`);click('Estimate');click('Priced worksheet (3)');wait(`!!document.querySelector('[aria-label="Frozen issued quote"]')`);
ev(`(()=>{const q=JSON.parse(localStorage.getItem('xray:price-books:v1:job-hardware-proof')).issuedQuotes[0];if(JSON.stringify(q)!==sessionStorage.getItem('hardware-issued'))throw Error('Issue changed');document.querySelector('[aria-label="Frozen issued quote"]').scrollIntoView();return {unchanged:true}})()`);shot('gate-hardware-reloaded');ops.push(['errors']);
writeFileSync(base+'scenarios/hardware-reviewed.json',JSON.stringify(ops,null,2));console.log(JSON.stringify({host:process.env.COMPUTERNAME,operations:ops.length,bomLines:response.bom.lines.length}));
