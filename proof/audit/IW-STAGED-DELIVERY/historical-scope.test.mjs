import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,unlinkSync,rmSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {readLedger,validate,render,readCurrentWork} from '../../../scripts/industry-ledger.mjs';
const source=process.cwd(),temporaryParent=realpathSync(tmpdir()),root=mkdtempSync(join(temporaryParent,'xray-historical-scope-'));
const closure=JSON.parse(readFileSync('planning/handovers/IW-STAGED-DELIVERY/06-canonical-closure.json','utf8'));
const manifestPath='proof/audit/IW-HISTORICAL-SOURCE/manifest.json',manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const paths=new Set([...closure.references.filter(r=>r.exists).map(r=>r.path),...closure.verifiedInputPaths,manifestPath,...manifest.files.map(f=>f.snapshotPath),'planning/control/current-work.json','planning/handovers/IW-PUBLIC-REQUIREMENTS/crosswalk.md']);
for(const work of readCurrentWork(source).work){if(work.proofValidation?.ok){paths.add(work.proof.path);for(const input of work.proofValidation.packet.inputs)paths.add(input.path);for(const artifact of work.proofValidation.artifacts)paths.add(artifact.path);}}
for(const p of paths){mkdirSync(dirname(join(root,p)),{recursive:true});copyFileSync(join(source,p),join(root,p));}
// Deliberately model a new, unverified edit phase. Historical acceptance must
// remain available without turning this phase into a current approval.
const currentPath=join(root,'planning/control/current-work.json');
const currentFixture=JSON.parse(readFileSync(currentPath,'utf8'));
currentFixture.work=[{id:'IW-REVALIDATION-FIXTURE',title:'Synthetic pending edit phase',status:'in progress',detail:'PRIOR ACCEPTED COMMIT 1a10a3b; new edits require independent current proof.'}];
writeFileSync(currentPath,JSON.stringify(currentFixture));
const data=readLedger(root),historical={scope:'historical'};
function changed(path,content,check){const full=join(root,path),old=readFileSync(full);try{writeFileSync(full,content);check();}finally{writeFileSync(full,old);}}
function rejects(options=historical,value=data){assert.equal(validate(value,root,options).ok,false);}
test('historical mode validates exact archived inputs and current source mode never falls back',()=>{changed('package-lock.json','current dependency edit',()=>{assert.equal(validate(data,root,historical).ok,true);rejects({scope:'current'});rejects({});});});
test('unknown verification scope rejects',()=>rejects({scope:'fallback'}));
test('historical manifest byte mutation rejects',()=>changed(manifestPath,readFileSync(join(root,manifestPath),'utf8')+' ',()=>rejects()));
test('historical input byte mutation rejects',()=>changed(manifest.files[0].snapshotPath,'tampered input',()=>rejects()));
test('missing historical input rejects',()=>{const p=join(root,manifest.files[0].snapshotPath),old=readFileSync(p);try{unlinkSync(p);rejects();}finally{writeFileSync(p,old);}});
test('historical assessment cannot promote a new result',()=>{const altered=structuredClone(data);altered.fullFeatureAudit.features.find(f=>f.id==='NEW-006').result='New building geometry is now accepted';rejects(historical,altered);});
test('historical assessment cannot add a new accepted feature',()=>{const altered=structuredClone(data);altered.fullFeatureAudit.features.push({...altered.fullFeatureAudit.features[0],id:'NEW-012',status:'pass'});rejects(historical,altered);});
test('existing artifact hash validation remains enforced for historical mode',()=>{const e=data.fullFeatureAudit.features.find(f=>f.id==='NEW-006').evidence.find(e=>!e.path.endsWith('.png'));changed(e.path,'tampered raw proof',()=>rejects());});
test('current unverified work and historical acceptance are rendered separately',()=>{const work=readCurrentWork(root),html=render(data,{...historical,currentWork:work});assert.match(html,/CURRENT WORK/);assert.match(html,/HISTORICAL ASSESSMENT SNAPSHOT/);assert.match(html,/archived source inputs/i);assert.match(html,/push pending/);assert.match(html,/Synthetic pending edit phase - in progress/);assert.doesNotMatch(html,/Independently reviewed current execution/);assert.equal(data.fullFeatureAudit.features.length,150);});
test('current work cannot claim completion without a separate reviewed proof gate',()=>{const p='planning/control/current-work.json',work=JSON.parse(readFileSync(join(root,p),'utf8'));delete work.work[0].proof;for(const status of ['complete','verified','done']){work.work[0].status=status;changed(p,JSON.stringify(work),()=>assert.throws(()=>readCurrentWork(root),/Invalid current-work metadata/));}});
test('current requirements link rejects changed or missing content',()=>{const p='planning/handovers/IW-PUBLIC-REQUIREMENTS/crosswalk.md';changed(p,'tampered requirements',()=>assert.throws(()=>readCurrentWork(root),/missing or stale/));const full=join(root,p),old=readFileSync(full);try{unlinkSync(full);assert.throws(()=>readCurrentWork(root));}finally{writeFileSync(full,old);}});
test('untrusted current metadata cannot inject a verified proof verdict',()=>{const p='planning/control/current-work.json',work=JSON.parse(readFileSync(join(root,p),'utf8'));delete work.work[0].proof;work.work[0].status='verified';work.work[0].proofValidation={ok:true,verified:true};changed(p,JSON.stringify(work),()=>assert.throws(()=>readCurrentWork(root),/requires matching current proof/));});
after(()=>{const absolute=resolve(root);assert.equal(dirname(absolute),temporaryParent);assert.ok(absolute.startsWith(join(temporaryParent,'xray-historical-scope-')));rmSync(absolute,{recursive:true});});
