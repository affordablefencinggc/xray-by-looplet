import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readLedger,validate,validatePng,render} from '../../../scripts/industry-ledger.mjs';
const base='proof/audit/IW-FULL-FEATURES',hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),d=readLedger(),audit=d.fullFeatureAudit,batchPath='proof/audit/IW-UI-AUDIT/batch01.json',batch=JSON.parse(readFileSync(batchPath,'utf8'));
mkdirSync(`${base}/ui-batch01`,{recursive:true});
for(const c of batch.cases){
 const capture=batch.captures.find(s=>s.path===c.screenshot);if(!capture)continue;
 const imagePath=`${base}/ui-batch01/${c.screenshot.split('/').at(-1)}`;copyFileSync(c.screenshot,imagePath);
 const detail=c.error??JSON.stringify(c.details??c.scope??'Narrow executed case only');
 for(const id of c.ids){const f=audit.features.find(f=>f.id===id);if(!f)continue;
  (f.cases??=[]).push({id:`UI01-${c.name}`,scenario:c.name,status:c.status==='pass'?'author-pass':c.status,detail,at:c.at,scope:'Narrow author test; not whole feature acceptance',sourceReport:batchPath});
  if(c.status==='fail')f.status='fail';else if(f.status==='untested')f.status='running';
  if(c.status==='superseded-or-intentional-off'){f.status='notimplemented';f.disposition='Removed/replaced or intentionally off; no automatic rebuild planned.';f.scenario='Inspect the actual desktop shell and assert the former preset selector, four-step replacement and dead Help control are absent; identify the active workbench replacement. Authentication remains explicitly off.';}
  f.result=(f.cases??[]).map(x=>`${x.scenario}: ${x.status}. ${x.detail}`).join(' ');f.scenarioTemplate=true;
  if(!f.evidence.some(e=>e.path===batchPath))f.evidence.push({kind:'executed',path:batchPath,sha256:hash(batchPath)});
  f.evidence.push({kind:'desktop-case',path:imagePath,sha256:hash(imagePath),screenshot:{url:capture.url,time:capture.capturedAt,timeLabel:'captured at',viewport:capture.viewport,captureDimensions:validatePng(readFileSync(imagePath)),scenario:c.name,result:`${c.status}: ${detail}. Narrow author case only; independent feature review pending.`,classification:'actual desktop UI case · fresh audit',sourceIdentity:`Source manifest in batch01.json SHA-256 ${hash(batchPath)}; original screenshot ${c.screenshot}`,reportPath:batchPath,reportSha256:hash(batchPath),featured:false}});
 }
}
const wire=audit.features.find(f=>f.id==='ENG-033');wire.result='Fresh PDF baseline failed: the residential project (24 pages, 1,616 entities, 7 quantities), shed project (5 pages, 229 entities, 13 quantities), and small electrical schedule fixture (1 page, 23 entities, 13 quantities) each produced zero scene elements. These are two complex real projects plus one small fixture. DXF symbol-positive coverage is still pending; PDF linework alone is not semantic 3D reconstruction.';
const mcp=audit.features.find(f=>f.id==='MCP-007');mcp.status='blocked';mcp.result='Underlying shared wireframe pipeline failed on the PDF baseline. Propagation to this MCP tool is a code-path inference; actual MCP stdio invocation has not yet been executed. Protocol and positive DXF tests remain pending.';
const aliasBefore=`${base}/cross-sheet-before.txt`;copyFileSync('proof/audit/IW005/cross-sheet-before.txt',aliasBefore);
for(const id of ['TRACE-016','DATA-001']){const f=audit.features.find(f=>f.id===id);f.evidence.push({kind:'initial-failure',path:aliasBefore,sha256:hash(aliasBefore)});f.result+=' Historical fresh failure: four cross-sheet move/remove/undo/redo reproductions. Root independently reran seven targeted legacy/target/cross/history tests: all passed; v2 built desktop evidence reviewed. Author reports 261 tests; whole feature acceptance remains pending and original failure is retained.';}
d.updatedAt=new Date().toISOString();const v=validate(d);if(!v.ok)throw Error(JSON.stringify(v));writeFileSync('planning/control/ledger.json',JSON.stringify(d,null,2)+'\n');writeFileSync(`${base}/inventory.json`,JSON.stringify(audit,null,2)+'\n');writeFileSync('planning/control/index.html',render(d));writeFileSync('planning/control/dashboard.html',render(d));console.log(JSON.stringify({cases:batch.cases.length,states:Object.fromEntries([...new Set(audit.features.map(f=>f.status))].map(s=>[s,audit.features.filter(f=>f.status===s).length]))},null,2));
