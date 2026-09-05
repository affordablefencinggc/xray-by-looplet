import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {CURRENT_INPUTS, currentPacketDigest, validateCurrentPacket, readCurrentProof} from './current-work-proof.mjs';

const parent = realpathSync(tmpdir()), root = mkdtempSync(join(parent, 'xray-current-proof-'));
const hash = b => createHash('sha256').update(b).digest('hex');
function save(path, value) {const b = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)); mkdirSync(dirname(join(root,path)),{recursive:true}); writeFileSync(join(root,path),b); return {path,bytes:b.length,sha256:hash(b)};}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
let serial = 0;
function fixture() {
 const prefix = 'proof/audit/IW-CURRENT-WORK/fixture-' + serial++ + '/';
 const inputs = CURRENT_INPUTS.map(path => save(path, 'Synthetic unit fixture: ' + path));
 const packet = {schema:'xray.current-proof/v1',id:'IW-WIREFRAME',workIds:['IW-WIREFRAME'],author:'viewer-agent',status:'verified',inputs,diff:save(prefix+'code.patch','diff --git a/viewer b/viewer\n+proof fixture'),executions:[]};
 for (const environment of ['dev','built']) {
  const images = ['before','after'].map(phase=>save(prefix+environment+'-'+phase+'.png',png));
  const captures = images.map((e,i)=>({...e,phase:i?'after':'before',kind:'application-ui',scenario:'Synthetic unit fixture',capturedAt:'2026-09-05T09:00:00Z',url:'http://127.0.0.1:8080/?pane=model',viewport:{width:1,height:1},sourceFiles:inputs}));
  packet.executions.push({environment,report:save(prefix+environment+'.json',{environment,target:'caroline',origin:'http://127.0.0.1:8080',completedAt:'2026-09-05T09:01:00Z',inputs,results:[{status:'pass'}],errors:[],captures}),screenshots:images});
 }
 packet.review = save(prefix+'review.json',{schema:'xray.current-proof-review/v1',reviewer:'root',decision:'approved',reviewedAt:'2026-09-05T09:02:00Z',packetDigest:currentPacketDigest(packet),scenarios:['Synthetic unit fixture approval']});
 return packet;
}
function changeReport(packet, change) {const e=packet.executions[0],r=JSON.parse(readFileSync(join(root,e.report.path)));change(r);e.report=save(e.report.path,r);}
function additionalReport(packet) {
 packet.status='awaiting independent review';delete packet.review;
 const execution=packet.executions[0],report=JSON.parse(readFileSync(join(root,execution.report.path)));
 report.captures=report.captures.map(c=>({...c,...save(c.path.replace('.png','-additional.png'),png)}));
 const entry=save(execution.report.path.replace('.json','-additional.json'),report);
 execution.additionalReports=[entry];execution.screenshots.push(...report.captures.map(({path,bytes,sha256})=>({path,bytes,sha256})));
 return {execution,report,entry};
}

test('verified current packet requires exact sources, dev+built captures and independent review',()=>{const p=fixture(),v=validateCurrentPacket(p,root);assert.equal(v.verified,true);assert.equal(v.screenshots.length,4);assert.deepEqual(v.blockers,[]);});
test('pending packet cannot promote missing production execution or review',()=>{const p=fixture();p.status='in progress';p.executions.pop();delete p.review;assert.deepEqual(validateCurrentPacket(p,root).blockers,['Missing built execution','Independent review pending']);p.status='verified';assert.throws(()=>validateCurrentPacket(p,root),/requires dev, built/);});
test('missing development execution rejects verification',()=>{const p=fixture();p.executions.shift();delete p.review;assert.throws(()=>validateCurrentPacket(p,root),/requires dev, built/);});
test('source mutation rejects even when historical proof exists elsewhere',()=>{const p=fixture();save(p.inputs[0].path,'tampered');assert.throws(()=>validateCurrentPacket(p,root),/Stale current proof/);});
test('PNG mutation rejects',()=>{const p=fixture();save(p.executions[0].screenshots[0].path,'tampered');assert.throws(()=>validateCurrentPacket(p,root),/Stale current proof/);});
test('raw report mutation rejects',()=>{const p=fixture();save(p.executions[0].report.path,'{}');assert.throws(()=>validateCurrentPacket(p,root),/Stale current proof/);});
test('rebinding report metadata does not bypass independent review binding',()=>{const p=fixture();changeReport(p,r=>r.results.push({status:'pass'}));assert.throws(()=>validateCurrentPacket(p,root),/review is stale/);});
test('review file mutation rejects',()=>{const p=fixture();save(p.review.path,'{}');assert.throws(()=>validateCurrentPacket(p,root),/Stale current proof/);});
test('self review rejects despite recomputed review file hash',()=>{const p=fixture(),r=JSON.parse(readFileSync(join(root,p.review.path)));r.reviewer=p.author;p.review=save(p.review.path,r);assert.throws(()=>validateCurrentPacket(p,root),/independent approval/);});
test('before screenshot cannot be relabelled as after without raw execution capture',()=>{const p=fixture();changeReport(p,r=>r.captures.forEach(c=>c.phase='before'));assert.throws(()=>validateCurrentPacket(p,root),/before\/after pair/);});
test('capture source mismatch rejects even with rewritten report hash',()=>{const p=fixture();changeReport(p,r=>r.captures[0].sourceFiles[0].sha256='0'.repeat(64));assert.throws(()=>validateCurrentPacket(p,root),/input hashes differ/);});
test('report environment mismatch rejects',()=>{const p=fixture();changeReport(p,r=>r.environment='built');assert.throws(()=>validateCurrentPacket(p,root),/environment or identity/);});
test('failed browser result rejects',()=>{const p=fixture();changeReport(p,r=>r.results[0].status='fail');assert.throws(()=>validateCurrentPacket(p,root),/failed or missing results/);});
test('missing required Python/source trace input rejects',()=>{const p=fixture();p.inputs.pop();assert.throws(()=>validateCurrentPacket(p,root),/Missing required/);});
test('path traversal and duplicate source bindings reject',()=>{const p=fixture();p.diff.path='proof/audit/IW-CURRENT-WORK/../outside.patch';assert.throws(()=>validateCurrentPacket(p,root),/Unsafe/);const p2=fixture();p2.inputs.push(p2.inputs[0]);assert.throws(()=>validateCurrentPacket(p2,root),/duplicate current inputs/);});
test('packet itself is hash-bound before loading',()=>{const p=fixture(),ref=save('proof/audit/IW-CURRENT-WORK/packet.json',p);assert.equal(readCurrentProof(root,ref).verified,true);save(ref.path,{...p,status:'in progress'});assert.throws(()=>readCurrentProof(root,ref),/Stale current proof/);});
test('additional raw report captures retain exact ownership with identical inputs',()=>{const p=fixture(),extra=additionalReport(p),v=validateCurrentPacket(p,root);assert.equal(v.screenshots.length,6);assert.equal(v.screenshots.find(c=>c.path===extra.report.captures[0].path).reportPath,extra.entry.path);});
test('additional raw report source mismatch rejects',()=>{const p=fixture(),e=additionalReport(p);e.report.inputs[0].sha256='0'.repeat(64);e.execution.additionalReports=[save(e.entry.path,e.report)];assert.throws(()=>validateCurrentPacket(p,root),/input hashes differ/);});
test('additional raw report browser error rejects',()=>{const p=fixture(),e=additionalReport(p);e.report.errors.push('actual failure');e.execution.additionalReports=[save(e.entry.path,e.report)];assert.throws(()=>validateCurrentPacket(p,root),/browser errors/);});
test('a second raw report cannot claim another report capture',()=>{const p=fixture(),e=additionalReport(p),original=JSON.parse(readFileSync(join(root,e.execution.report.path)));e.report.captures[0]=original.captures[0];e.execution.additionalReports=[save(e.entry.path,e.report)];assert.throws(()=>validateCurrentPacket(p,root),/capture ownership/);});

test('current artifact HTTP route serves only recomputed intact proof and withholds tampered captures',async()=>{
 const {serve,readCurrentWork} = await import('./industry-ledger.mjs');
 const closure=JSON.parse(readFileSync('planning/handovers/IW-STAGED-DELIVERY/06-canonical-closure.json'));
 const manifestPath='proof/audit/IW-HISTORICAL-SOURCE/manifest.json',manifest=JSON.parse(readFileSync(manifestPath));
 const paths=new Set([...closure.references.filter(r=>r.exists).map(r=>r.path),...closure.verifiedInputPaths,manifestPath,...manifest.files.map(f=>f.snapshotPath),'planning/control/current-work.json','planning/handovers/IW-PUBLIC-REQUIREMENTS/crosswalk.md']);
 for(const path of paths){mkdirSync(dirname(join(root,path)),{recursive:true});copyFileSync(path,join(root,path));}
 const packet=fixture();packet.status='awaiting independent review';delete packet.review;
 const ref=save('proof/audit/IW-CURRENT-WORK/http-packet.json',packet),work=JSON.parse(readFileSync(join(root,'planning/control/current-work.json')));
 work.work=[{id:'IW-WIREFRAME',title:'Synthetic HTTP gate fixture',status:'in progress',detail:'Synthetic unit proof only, not product acceptance.',proof:ref}];save('planning/control/current-work.json',work);
 assert.equal(readCurrentWork(root).work[0].proofValidation.ok,true);
 const server=serve(root,0,{scope:'historical'});await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port,route=path=>origin+'/current-artifact?path='+encodeURIComponent(path);
 try{
  const image=packet.executions[0].screenshots[0];let response=await fetch(route(image.path));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(hash(Buffer.from(await response.arrayBuffer())),image.sha256);
  assert.equal((await fetch(route('package.json'))).status,404);
  let html=await(await fetch(origin)).text();assert.match(html,/Author-tested snapshot - independent acceptance pending/);
  save(image.path,'tampered image');assert.equal((await fetch(route(image.path))).status,404);
  html=await(await fetch(origin)).text();assert.match(html,/captures are withheld/);assert.doesNotMatch(html,/src="\/current-artifact/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

after(()=>{const path=resolve(root);assert.equal(dirname(path),parent);assert.ok(path.startsWith(join(parent,'xray-current-proof-')));rmSync(path,{recursive:true});});
