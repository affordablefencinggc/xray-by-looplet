import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { constructionJobSchema, calculateQuantity, parseQuantityResult, validateQuantityAgainstJob, priceLineSchema, validateJobTransition } from '../../../src/studio/construction/index.ts';
import { readLedger, validate, inputDigest, hash, sliceStatus } from '../../../scripts/industry-ledger.mjs';

const time='2026-09-05T00:00:00.000Z';
function fixture(kind='count') {
 const locator={kind:'page',sourceRevisionId:'source-1',sha256:'a'.repeat(64),pageIndex:0};
 const base={id:'m1',revision:1,workPackageId:'p1',label:'Measured item',locator,evidenceIds:['e1'],review:{status:'approved',measurementRevision:1,decidedBy:'reviewer',decidedAt:time,note:'Reviewed'},deductions:[]};
 const measurements=[kind==='count'?{...base,kind,items:[{id:'socket-1',evidenceIds:['e1']}]}:{...base,kind,calibrationId:'c1',points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]}];
 return structuredClone({schema:'xray.construction-job/v1',id:'job',revision:1,name:'Industry independent test',createdAt:time,updatedAt:time,workPackages:[{id:'p1',revision:1,trade:'electrical',name:'Services',pack:null}],sources:[{id:'source-1',documentId:'d1',revision:1,sha256:'a'.repeat(64),name:'Drawing',kind:'pdf',importedAt:time,assetId:'a1',pageCount:1}],evidence:[{id:'e1',locator,note:'Source evidence'}],calibrations:kind==='count'?[]:[{id:'c1',revision:1,locator,metresPerCoordinateUnit:1,method:'two-point',inputDistance:{value:1,unit:'m'},coordinateDistance:1,referencePoints:[{x:0,y:0},{x:1,y:0}],evidenceIds:['e1'],verifiedBy:'reviewer',verifiedAt:time}],measurements,extensions:{}});
}
test('independent: source hash mismatch and unknown geometry fields fail closed',()=>{
 const job=fixture();job.evidence[0].locator.sha256='b'.repeat(64);assert.throws(()=>calculateQuantity(job,'m1','r1'));
 const other=fixture();other.measurements[0].hiddenQuantity=999;assert.throws(()=>constructionJobSchema.parse(other));
});
test('independent: duplicate count across measurements and current-job tampering rejected',()=>{
 const job=fixture();job.measurements.push({...structuredClone(job.measurements[0]),id:'m2'});assert.throws(()=>calculateQuantity(job,'m1','r1'));
 const current=fixture();const result=calculateQuantity(current,'m1','r1');const fake=structuredClone(result);fake.gross=2;fake.net=2;assert.throws(()=>parseQuantityResult(fake));
 current.revision++;assert.throws(()=>validateQuantityAgainstJob(result,current));
});
test('independent: geometry modification cannot retain approval',()=>{
 const before=fixture('area'),after=structuredClone(before);after.revision++;after.measurements[0].points[1].x=2;assert.throws(()=>validateJobTransition(before,after));
});
test('independent: price rejects float rate, noncanonical decimal, fractional or unsafe minor units',()=>{
 const price={id:'price',purchaseRequirementId:'purchase',currency:'AUD',unitRateDecimal:'12.5',amountMinorUnits:1250,priceSource:'catalog',effectiveAt:time};
 assert.equal(priceLineSchema.safeParse(price).success,true);
 for(const value of [12.5,'1e3','012.5','12.50','-1','Infinity'])assert.equal(priceLineSchema.safeParse({...price,unitRateDecimal:value}).success,false);
 for(const value of [0.1,-1,Number.MAX_SAFE_INTEGER+1])assert.equal(priceLineSchema.safeParse({...price,amountMinorUnits:value}).success,false);
});
test('FINDING CORE-01: native volume requires evidence for the exact named model property',()=>{
 const job=fixture();const model={kind:'model',sourceRevisionId:'source-1',sha256:'a'.repeat(64),elementId:'slab-1',property:'NetVolume'};
 job.sources[0].kind='ifc';job.sources[0].pageCount=null;job.evidence[0].locator=model;
 const m=job.measurements[0];delete m.items;m.kind='volume';m.locator=model;m.basis={method:'native-volume',value:30,unit:'m3',locator:{...model,property:'GrossVolume'},evidenceIds:['e1'],verifiedBy:'reviewer',verifiedAt:time};
 const accepted=constructionJobSchema.safeParse(job).success;
 console.log(JSON.stringify({case:'CORE-01',accepted,evidenceProperty:'NetVolume',claimedProperty:'GrossVolume',net:accepted?calculateQuantity(job,'m1','r1').net:null}));
 assert.equal(accepted,false,'GrossVolume result must not borrow NetVolume-only evidence');
});
test('FINDING CORE-02: positive measured area cannot silently underflow to verified zero',()=>{
 const job=fixture('area');job.calibrations[0].metresPerCoordinateUnit=1e-200;job.calibrations[0].inputDistance.value=1e-200;
 let result=null;try {result=calculateQuantity(job,'m1','r1');}catch{return;}
 console.log(JSON.stringify({case:'CORE-02',scale:1e-200,nonzeroPolygon:true,verifiedGross:result.gross}));
 assert.notEqual(result.gross,0,'Positive geometry underflow must reject, not return verified zero');
});
test('FINDING LEDGER-01: exact historical feature IDs cannot be swapped for acceptance IDs',()=>{
 const data=structuredClone(readLedger());const removed=data.inventory.features[0];const replacement=data.inventory.acceptance.find(row=>!data.inventory.features.some(feature=>feature.id===row.id));
 data.inventory.features[0]=structuredClone(replacement);const result=validate(data);
 console.log(JSON.stringify({case:'LEDGER-01',removed:removed.id,replacedWith:replacement.id,accepted:result.ok,errors:result.errors}));
 assert.equal(result.ok,false,'Category counts alone cannot prove preservation of every original feature ID');
});
test('FINDING LEDGER-02: historical source manifest cannot repeat one source instead of covering all sources',()=>{
 const data=structuredClone(readLedger());data.inventory.sources[data.inventory.sources.length-1]=structuredClone(data.inventory.sources[0]);const result=validate(data);
 console.log(JSON.stringify({case:'LEDGER-02',accepted:result.ok,distinctSources:new Set(data.inventory.sources.map(row=>row.path)).size,total:data.inventory.sources.length,errors:result.errors}));
 assert.equal(result.ok,false,'Source manifest must cover each distinct historical source exactly once');
});
test('FINDING LEDGER-03: empty independent-review attachment cannot approve completion',()=>{
 const data=structuredClone(readLedger()),task=data.tasks[0];
 const file='scripts/industry-ledger.mjs',empty='proof/audit/IW-VERIFY-01/empty-review.txt';
 writeFileSync(empty,'');task.visual=false;task.status='verified';task.inputs=[file];task.startupHandover=file;task.completionHandover=file;
 const digest=inputDigest(task),sha256=hash(readFileSync(file));
 task.evidence=['patch','executed'].map(kind=>({kind,path:file,sha256,revision:task.revision,inputDigest:digest}));
 task.review={reviewer:'independent-reviewer',decision:'approved',reviewedAt:time,path:empty,sha256:hash(''),revision:task.revision,inputDigest:digest};
 for(const slice of data.slices)slice.status=sliceStatus(data.tasks.filter(t=>t.slice===slice.id));
 const result=validate(data);console.log(JSON.stringify({case:'LEDGER-03',accepted:result.ok,reviewAttachmentBytes:0,errors:result.errors}));
 assert.equal(result.ok,false,'An empty file contains no independent review');
});
