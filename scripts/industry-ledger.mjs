import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const pngCache=new Map();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
export function validatePng(bytes,digest=hash(bytes)) {
 if(pngCache.has(digest))return pngCache.get(digest);
 if(bytes.length<57||bytes.length>32*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG signature/size');
 let offset=8,width,height,channels,ended=false;const idat=[];
 while(offset<bytes.length){if(offset+12>bytes.length)throw Error('Truncated PNG');const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)throw Error('Truncated PNG chunk');const type=bytes.toString('ascii',offset+4,offset+8),body=bytes.subarray(offset+8,offset+8+length);if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('Invalid PNG CRC');
  if(offset===8&&type!=='IHDR')throw Error('Missing IHDR');
  if(type==='IHDR'){if(width||length!==13)throw Error('Invalid IHDR');width=body.readUInt32BE(0);height=body.readUInt32BE(4);channels=({0:1,2:3,4:2,6:4})[body[9]];if(!width||!height||width>10000||height>100000||!channels||body[8]!==8||body[10]!==0||body[11]!==0||body[12]!==0)throw Error('Unsupported PNG dimensions/encoding');}
  if(type==='IDAT')idat.push(body);
  if(type==='IEND'){if(length||end!==bytes.length)throw Error('Invalid PNG ending');ended=true;}
  offset=end;
 }
 const expected=height*(1+width*channels);if(!ended||!idat.length||expected>256*1024*1024)throw Error('PNG missing image or oversized decoded data');
 const decoded=inflateSync(Buffer.concat(idat),{maxOutputLength:expected});if(decoded.length!==expected)throw Error('Invalid PNG image length');for(let row=0;row<height;row++)if(decoded[row*(1+width*channels)]>4)throw Error('Invalid PNG filter');
 const dimensions={width,height};if(pngCache.size>=128)pngCache.clear();pngCache.set(digest,dimensions);return dimensions;
}

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LEDGER = 'planning/control/ledger.json';
export const STATES = ['queued','ready','running','blocked','awaiting-verification','verified','superseded','intentional-off'];
export const HISTORICAL = ['XRAY-MASTER-LEDGER.md','SC07-BRIDGE-ACCEPTANCE.md','SC08-REVIEW-PROOF-ACCEPTANCE.md','SC09-PRICING-ACCEPTANCE.md','SC10-SC13-SC16-INTEGRATION-RELEASE-ACCEPTANCE.md','SC11-SC12-DESKTOP-CONTINUITY-ACCEPTANCE.md','planning/residual-acceptance-product.md','planning/residual-acceptance-engine.md','planning/residual-acceptance-release.md'];
const MINDMAP='XRAY-TOPDOWN-MINDMAP-TODO.md';
export const hash = value => createHash('sha256').update(value).digest('hex');
export function safePath(root, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes(':') || path.includes('%') || path.split('/').some(p => !p || p === '.' || p === '..') || isAbsolute(path)) throw Error('Unsafe relative path');
  const result = resolve(root, path);
  const rel = relative(realpathSync(root), existsSync(result) ? realpathSync(result) : result);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw Error('Path escapes repository');
  return result;
}
export const readLedger = (root = ROOT) => JSON.parse(readFileSync(safePath(root, LEDGER), 'utf8'));
export function sliceStatus(tasks) {
 if(tasks.length && tasks.every(t=>['verified','superseded','intentional-off'].includes(t.status))) return tasks.some(t=>t.status==='verified')?'verified':'intentional-off';
 for(const status of ['blocked','running','awaiting-verification','ready'])if(tasks.some(t=>t.status===status))return status;
 return 'queued';
}
export function inputDigest(task, root = ROOT) {
  return hash(JSON.stringify((task.inputs ?? []).map(p => [p, hash(readFileSync(safePath(root, p)))])));
}
const HISTORICAL_MANIFEST = 'proof/audit/IW-HISTORICAL-SOURCE/manifest.json';
const HISTORICAL_MANIFEST_SHA256 = 'd137cd94a394ce431c0de0383fae5407558d43df316c1d78306a2c9a22dedbf2';
export function historicalInputRoot(data, root = ROOT) {
 const bytes=readFileSync(safePath(root,HISTORICAL_MANIFEST));
 if(hash(bytes)!==HISTORICAL_MANIFEST_SHA256)throw Error('Historical manifest integrity mismatch');
 const manifest=JSON.parse(bytes);
 if(manifest.schema!=='xray.historical-audit-inputs/v1'||manifest.scope!=='historical-only'||manifest.auditRunId!==data.fullFeatureAudit?.runId||hash(JSON.stringify(data))!==manifest.canonicalDataSha256||hash(readFileSync(safePath(root,LEDGER)))!==manifest.canonicalSha256)throw Error('Historical assessment identity mismatch');
 const expected=[...new Set([...data.tasks.filter(t=>t.status==='verified').flatMap(t=>t.inputs),...data.fullFeatureAudit.features.filter(f=>['pass','awaiting-review'].includes(f.status)).flatMap(f=>f.inputs??[])])].sort();
 if(JSON.stringify(manifest.files.map(f=>f.path).sort())!==JSON.stringify(expected))throw Error('Historical input manifest is incomplete');
 const inputRoot=safePath(root,'proof/audit/IW-HISTORICAL-SOURCE/inputs');
 for(const f of manifest.files){
  if(f.snapshotPath!==`proof/audit/IW-HISTORICAL-SOURCE/inputs/${f.path}`||f.sourceCommit!==manifest.sourceCommit)throw Error('Historical source binding mismatch');
  const p=safePath(inputRoot,f.path),info=statSync(p);
  if(!info.isFile()||info.size!==f.bytes||hash(readFileSync(p))!==f.sha256)throw Error('Historical input is missing or tampered');
 }
 return inputRoot;
}
export function validateScreenshotEvidence(evidence,data,root=ROOT) {
 const s=evidence.screenshot,url=new URL(s.url);
 if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('not local');
 const imageBytes=readFileSync(safePath(root,evidence.path));
 if(!evidence.path.endsWith('.png')||!artifactAllowed(evidence.path,data)||hash(imageBytes)!==evidence.sha256)throw Error('stale image');
 const dimensions=validatePng(imageBytes,evidence.sha256);
 if(dimensions.width!==s.captureDimensions?.width||dimensions.height!==s.captureDimensions?.height||dimensions.width!==s.viewport?.width||dimensions.height<s.viewport?.height)throw Error('Capture dimensions do not match image/viewport');
 if(!Number.isFinite(Date.parse(s.time))||!['capture report time','captured at','artifact written at'].includes(s.timeLabel)||!Number.isInteger(s.viewport?.width)||s.viewport.width<1||!Number.isInteger(s.viewport?.height)||s.viewport.height<1||!s.scenario||!s.result||!s.classification||!s.sourceIdentity)throw Error('metadata missing');
 if(!s.reportPath||!artifactAllowed(s.reportPath,data)||!statSync(safePath(root,s.reportPath)).isFile()||hash(readFileSync(safePath(root,s.reportPath)))!==s.reportSha256)throw Error('inaccessible or stale source report');
 return dimensions;
}
function validateFeatureAudit(data,root,fail,inputRoot=root) {
 const audit=data.fullFeatureAudit;if(!audit)return;
 if(!Array.isArray(audit.features)||!audit.runId||!Number.isFinite(Date.parse(audit.startedAt))){fail('Feature audit requires run identity/time and rows');return;}
 const ids=audit.features.map(f=>f.id),baseline=data.inventory.features.map(f=>f.id),extra=ids.filter(id=>!baseline.includes(id));
 if(new Set(ids).size!==ids.length||baseline.some(id=>!ids.includes(id))||extra.some(id=>!/^NEW-\d{3}$/.test(id))||audit.total!==ids.length||audit.baselineFeatures!==baseline.length||audit.newExplicitSubfeatures!==extra.length)fail('Feature audit must preserve exact baseline IDs, unique new IDs and exact counts');
 for(const f of audit.features){
  if(!['untested','running','awaiting-review','pass','fail','blocked','notimplemented'].includes(f.status)||!f.title||!f.owner||typeof f.scenario!=='string'||f.scenario.length<20||!f.result||!Array.isArray(f.evidence)){fail(`${f.id}: feature status/scenario/result/evidence required`);continue;}
  for(const e of f.evidence){try{const p=safePath(root,e.path),info=statSync(p);if(!info.isFile()||!info.size||hash(readFileSync(p))!==e.sha256||!artifactAllowed(e.path,data))throw Error('stale artifact');if(e.screenshot)validateScreenshotEvidence(e,data,root);}catch{fail(`${f.id}: stale/inaccessible feature artifact or invalid screenshot`);}}
  if(!['pass','awaiting-review'].includes(f.status))continue;
  if(f.scenarioTemplate!==false||!Array.isArray(f.inputs)||!f.inputs.length||!Number.isInteger(f.revision)||f.revision<1||!Number.isFinite(Date.parse(f.testedAt))||Date.parse(f.testedAt)<Date.parse(audit.startedAt)){fail(`${f.id}: fresh concrete execution/input contract required`);continue;}
  let digest;try{digest=inputDigest(f,inputRoot);}catch{fail(`${f.id}: selected feature inputs missing`);continue;}
  if(!f.evidence.some(e=>(e.kind==='patch'&&e.path.endsWith('.patch'))||(e.kind==='tested-baseline'&&/\.(json|md|txt)$/.test(e.path))))fail(`${f.id}: code diff or truthful tested baseline artifact required`);
  if(f.proofClass==='ui'){
   for(const kind of ['before','after-desktop'])if(!f.evidence.some(e=>e.kind===kind&&e.screenshot?.proofType==='app-ui'&&e.screenshot.viewport.width>=1024&&Date.parse(e.screenshot.time)>=Date.parse(audit.startedAt)))fail(`${f.id}: actual before/after desktop app UI evidence required`);
  }else if(f.proofClass==='non-ui'){
   if(!f.evidence.some(e=>e.kind==='execution-capture'&&e.screenshot?.proofType==='execution-report'))fail(`${f.id}: explicit backend execution report screenshot required`);
  }else fail(`${f.id}: explicit UI or non-UI proof classification required`);
  if(!f.evidence.some(e=>e.kind==='executed'&&/\.(log|txt|json)$/.test(e.path))||!f.evidence.some(e=>e.screenshot&&e.screenshot.viewport.width>=1024&&Date.parse(e.screenshot.time)>=Date.parse(audit.startedAt)))fail(`${f.id}: executed output and fresh desktop screenshot required`);
  for(const e of f.evidence)if(e.inputDigest!==digest||e.runId!==audit.runId||e.revision!==f.revision)fail(`${f.id}: stale feature input/run/revision binding`);
  if(f.status==='pass'){
   if(!Array.isArray(f.requiredCaseIds)||!f.requiredCaseIds.length||new Set(f.requiredCaseIds).size!==f.requiredCaseIds.length||!Array.isArray(f.cases)||f.requiredCaseIds.some(id=>!f.cases.some(c=>c.id===id&&c.status==='pass')))fail(`${f.id}: all declared concrete cases must pass`);
   const r=f.review,actor=s=>String(s??'').replace(/^\/root\//,'');
   if(!r||!r.reviewer||actor(r.reviewer)===actor(f.owner)||r.decision!=='approved'||r.inputDigest!==digest||r.runId!==audit.runId||r.revision!==f.revision||!Number.isFinite(Date.parse(r.reviewedAt))||Date.parse(r.reviewedAt)<Date.parse(f.testedAt))fail(`${f.id}: fresh independent feature review required`);
   else try{const p=safePath(root,r.path),info=statSync(p);if(!info.isFile()||!info.size||hash(readFileSync(p))!==r.sha256||!artifactAllowed(r.path,data))throw Error('stale review');}catch{fail(`${f.id}: missing/stale independent feature review file`);}
  }
 }
}
export function validate(data, root = ROOT, options = {}) {
  const errors = [];
  const fail = s => errors.push(s);
  let inputRoot=root;
  if(options.scope==='historical') {try{inputRoot=historicalInputRoot(data,root);}catch(error){return {ok:false,errors:[String(error.message)]};}}
  else if(options.scope!==undefined&&options.scope!=='current')return {ok:false,errors:['Unknown verification scope']};
  if (data.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (data.approval?.quote !== 'Implement the plan.') fail('Missing exact approval');
  if (!Array.isArray(data.slices) || !Array.isArray(data.tasks) || !Array.isArray(data.inventory?.features) || !Array.isArray(data.inventory?.acceptance)) return {ok:false,errors:[...errors,'Missing required collections']};
  const sliceIds = data.slices.map(x => x.id);
  if (JSON.stringify(sliceIds) !== JSON.stringify(Array.from({length:10},(_,i)=>`IW-SC${String(i+1).padStart(2,'0')}`))) fail('Expected IW-SC01 through IW-SC10');
  const taskMap = new Map(data.tasks.map(t => [t.id,t]));
  if(taskMap.size !== data.tasks.length) fail('Duplicate task ID');
  if(!Array.isArray(data.coverage) || !Array.isArray(data.decisions) || !Array.isArray(data.externalQueue))fail('Coverage, decisions and externalQueue arrays required');
  for(const task of data.tasks) if(!Array.isArray(task.scope) || !task.scope.length || !Array.isArray(task.evidence) || !Array.isArray(task.inputs) || !task.startupHandover || !task.completionHandover)fail(`${task.id}: scope, evidence, inputs and handover paths required`);
  if(errors.length)return {ok:false,errors};
  if(new Set(data.coverage.map(c=>c.id)).size!==data.coverage.length)fail('Duplicate industry acceptance ID');
  for(const row of data.coverage)if(!row.id || !taskMap.has(row.task) || !row.machine || !row.human)fail('Industry coverage requires ID, task and machine/human acceptance');
  const expectedInventory={features:new Map(),acceptance:new Map()};
  for(const source of HISTORICAL) {
    try {readFileSync(safePath(root,source),'utf8').split(/\r?\n/).forEach((text,index)=>{
      const match=text.match(/^\| ([A-Z]+-\d{3}) \|/);
      if(match)expectedInventory[source===HISTORICAL[0]?'features':'acceptance'].set(match[1],{source,line:index+1});
    });}catch{fail(`Missing historical inventory source: ${source}`);}
  }
  for(const [name,rows,count] of [['features',data.inventory.features,139],['acceptance',data.inventory.acceptance,359]]) {
    if(rows.length !== count || new Set(rows.map(r=>r.id)).size !== count) fail(`Expected ${count} unique ${name}`);
    if(JSON.stringify(rows.map(r=>r.id).sort())!==JSON.stringify([...expectedInventory[name].keys()].sort()))fail(`${name}: exact source-derived ID set required`);
    for(const row of rows) {
      const expected=expectedInventory[name].get(row.id);
      if(!expected || expected.source!==row.source || expected.line!==row.line)fail(`${row.id}: wrong inventory category or source binding`);
      if(!sliceIds.includes(row.slice) || !['provisional','reconciled'].includes(row.mapping)) fail(`${row.id}: invalid mapping`);
      try { const lines=readFileSync(safePath(root,row.source),'utf8').split(/\r?\n/); if(!HISTORICAL.includes(row.source) || lines[row.line-1] !== row.text || !row.text.startsWith(`| ${row.id} |`)) fail(`${row.id}: stale source row`); } catch {fail(`${row.id}: missing source`);}
    }
  }
  for(const source of data.inventory.sources ?? []) {
    try {if(!HISTORICAL.includes(source.path) || hash(readFileSync(safePath(root,source.path)))!==source.sha256) fail(`Stale inventory source: ${source.path}`);} catch {fail('Missing inventory source');}
  }
  if(JSON.stringify((data.inventory.sources ?? []).map(s=>s.path).sort())!==JSON.stringify([...HISTORICAL].sort())) fail('Inventory source manifest must contain each exact source path once');
  const entities = [...data.slices,...data.tasks];
  const all = new Map(entities.map(t=>[t.id,t]));
  for(const entity of entities) {
    if(!STATES.includes(entity.status)) fail(`${entity.id}: invalid status`);
    if(!entity.title || !Array.isArray(entity.dependsOn)) { fail(`${entity.id}: missing title/dependencies`); continue; }
    for(const dep of entity.dependsOn) {
      if(!all.has(dep) || dep===entity.id) fail(`${entity.id}: unknown/self dependency ${dep}`);
      if((entity.status==='verified' || (taskMap.has(entity.id) && ['ready','running'].includes(entity.status))) && all.get(dep)?.status !== 'verified') fail(`${entity.id}: dependency not verified: ${dep}`);
    }
    if(entity.status==='blocked' && !entity.blocker) fail(`${entity.id}: blocked requires reason`);
    if(['superseded','intentional-off'].includes(entity.status) && !entity.disposition) fail(`${entity.id}: disposition required`);
    if(entity.status==='superseded' && !all.has(entity.replacedBy)) fail(`${entity.id}: replacement required`);
  }
  function visit(id, stack=new Set()) {if(stack.has(id)){fail(`Dependency cycle: ${id}`);return;} const next=new Set(stack).add(id); for(const dep of all.get(id)?.dependsOn ?? []) if(all.has(dep)) visit(dep,next);}
  for(const id of all.keys()) visit(id);
  for(const task of data.tasks) {
    if(!sliceIds.includes(task.slice) || !task.owner || !task.acceptance?.machine || !task.acceptance?.human || !Number.isInteger(task.revision) || task.revision<1) fail(`${task.id}: incomplete task contract`);
    for(const path of [...task.inputs,...task.evidence.map(x=>x.path),task.startupHandover,task.completionHandover]) {try{safePath(root,path);}catch{fail(`${task.id}: unsafe path`);}}
    for(const evidence of task.evidence.filter(e=>e.screenshot)) {
      try {
        validateScreenshotEvidence(evidence,data,root);
      }catch{fail(`${task.id}: screenshot requires local URL, fresh image/report hashes and complete capture metadata`);}
    }
    if(task.status !== 'verified') continue;
    if(!(task.inputs?.length)) fail(`${task.id}: verified requires input files`);
    let digest; try{digest=inputDigest(task,inputRoot);}catch{fail(`${task.id}: inputs missing`);}
    for(const path of [task.startupHandover,task.completionHandover])try{const info=statSync(safePath(root,path));if(!info.isFile() || !info.size)fail(`${task.id}: empty or non-file handover`);}catch{fail(`${task.id}: handover missing`);}
    const required = task.visual ? ['patch','executed','before','after-desktop'] : ['patch','executed','execution-capture'];
    for(const kind of required) if(!task.evidence?.some(e=>e.kind===kind)) fail(`${task.id}: missing ${kind} evidence`);
    for(const kind of task.visual?['before','after-desktop']:['execution-capture'])if(!task.evidence.some(e=>e.kind===kind&&e.screenshot))fail(`${task.id}: ${kind} requires visible screenshot metadata`);
    for(const evidence of task.evidence ?? []) {
      try {const p=safePath(root,evidence.path); if(!statSync(p).isFile() || !statSync(p).size || hash(readFileSync(p))!==evidence.sha256 || evidence.revision!==task.revision || evidence.inputDigest!==digest) fail(`${task.id}: stale evidence ${evidence.kind}`);}catch{fail(`${task.id}: evidence missing`);}
    }
    const review=task.review;
    if(!review || review.reviewer===task.owner || !review.reviewer || review.decision!=='approved' || review.revision!==task.revision || review.inputDigest!==digest || !review.reviewedAt || !Number.isFinite(Date.parse(review.reviewedAt))) fail(`${task.id}: fresh independent approval required`);
    else {try{const path=safePath(root,review.path);const info=statSync(path);if(!info.isFile() || !info.size || hash(readFileSync(path))!==review.sha256) fail(`${task.id}: empty, non-file or stale review attachment`);}catch{fail(`${task.id}: review attachment missing`);}}
  }
  for(const slice of data.slices) {if(slice.status!==sliceStatus(data.tasks.filter(t=>t.slice===slice.id)))fail(`${slice.id}: slice status must derive from tasks`);if(slice.status==='verified' && (!data.tasks.some(t=>t.slice===slice.id) || data.tasks.some(t=>t.slice===slice.id && !['verified','intentional-off','superseded'].includes(t.status)))) fail(`${slice.id}: unfinished tasks`);}
  if(data.slices.find(s=>s.id==='IW-SC10')?.status==='verified' && [...data.inventory.features,...data.inventory.acceptance].some(r=>r.mapping!=='reconciled')) fail('Release requires complete historical reconciliation');
  validateFeatureAudit(data,root,fail,inputRoot);
  return {ok:errors.length===0,errors,counts:{slices:data.slices.length,tasks:data.tasks.length,features:data.inventory.features.length,acceptance:data.inventory.acceptance.length,verified:data.tasks.filter(t=>t.status==='verified').length}};
}
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (path,label) => `<a href="/artifact?path=${encodeURIComponent(path)}">${esc(label)}</a>`;
export function screenshotGallery(data,taskId=null) {
 const shots=data.tasks.flatMap(t=>t.evidence.filter(e=>e.screenshot&&artifactAllowed(e.path,data)).map(e=>({task:t,e})));
 const selected=taskId?shots.filter(x=>x.task.id===taskId):shots.filter(x=>x.e.screenshot.featured);
 if(!selected.length)return '';
 return `<section class="proof-gallery" aria-label="${taskId?'Screenshot proof '+esc(taskId):'Latest local proof'}"><h2>${taskId?'Screenshot proof':'Latest local proof'}</h2>${taskId?'':'<p>Actual local captures. Baseline defects remain open. Select an image to inspect the full screenshot; capture metadata and raw reports stay attached.</p>'}<div class="proof-grid">${selected.map(({task,e})=>{const s=e.screenshot;return `<figure class="proof-shot"><a class="proof-image" href="/artifact?path=${encodeURIComponent(e.path)}"><img src="/artifact?path=${encodeURIComponent(e.path)}" alt="${esc(task.id+' '+s.scenario+' — '+s.result)}" loading="lazy" width="${s.viewport.width}" height="${s.viewport.height}"></a><figcaption><span class="eyebrow">${esc(task.id+' · '+s.classification)}</span><h3>${esc(s.scenario)}</h3><p class="proof-result">${esc(s.result)}</p><p class="proof-meta">${esc(s.url)}<br>${esc(s.viewport.width+' × '+s.viewport.height+' · '+s.timeLabel+': '+s.time)}<br>${esc(s.sourceIdentity)}</p><p>${link(s.reportPath,'Source report')} · ${link(e.path,'Full screenshot')}</p><details><summary>Integrity</summary><code>Image SHA-256 ${esc(e.sha256)}<br>Report SHA-256 ${esc(s.reportSha256)}</code></details></figcaption></figure>`;}).join('')}</div></section>`;
}
export function featureAuditView(data,options={}) {
 const audit=data.fullFeatureAudit;if(!audit)return '';
 return `<section data-panel="features" aria-label="Fresh feature audit" id="feature-audit"><h2>Feature assessment and product readiness</h2><p><strong>${audit.features.filter(f=>f.auditStatus==="concluded").length} / ${audit.total} assessments concluded; ${audit.features.filter(f=>f.status==="pass").length} scoped capabilities fully verified.</strong> Assessing a blocked, absent or partially tested feature does not make it complete.</p><p>${esc(audit.total)} entries: ${esc(audit.baselineFeatures)} preserved features plus ${esc(audit.newExplicitSubfeatures)} newly explicit subfeatures. Prior milestones remain historical; this run requires fresh scenario evidence. Desktop only.</p>${audit.features.map(f=>`<article class="feature-audit-row searchable" data-status="${esc(f.status)}" data-search="${esc([f.id,f.title,f.group,f.owner,f.status,f.scenario].join(' ').toLowerCase())}" id="audit-${esc(f.id)}"><div class="task-heading"><div><span class="eyebrow">${esc(f.id+' · '+f.group+' · '+f.kind)}</span><h3>${esc(f.title)}</h3></div><strong class="status">${esc(f.status)}</strong></div><p><strong>Test scenario:</strong> ${esc(f.scenario)}</p><p><strong>${options.scope==='historical'?'Recorded result':'Current result'}:</strong> ${esc(f.result)}</p><p><small>Owner: ${esc(f.owner)} · Source: ${esc(f.implementationSource)}${f.parentId?' · Parent '+esc(f.parentId):''}</small></p><p>${f.evidence.length?f.evidence.filter(e=>!e.screenshot).map(e=>link(e.path,'Fresh execution evidence')).join(' · '):'No fresh accepted proof.'}</p>${screenshotGallery({...data,tasks:[{id:f.id,evidence:f.evidence}]},f.id)}</article>`).join('')}</section>`;
}
export function startupPacket(data, task) {return `Task ${task.id}: ${task.title}\nAuthorization: "${data.approval.quote}"\nBranch: ${data.baseline.branch}\nBaseline: ${data.baseline.commit}\nLatest recorded workspace observation: ${JSON.stringify(data.workspaceObservation)}\nRe-run git branch --show-current, git rev-parse HEAD and git status --short; recorded dirty files are observations, not a clean-tree claim.\nOwner: ${task.owner}\nScope: ${task.scope.join(', ')}\nDependencies: ${task.dependsOn.join(', ') || 'none'}\nCurrent state: ${task.status}\nStartup handover: ${task.startupHandover}\nCompletion handover: ${task.completionHandover}\nMachine exit: ${task.acceptance.machine}\nHuman exit: ${task.acceptance.human}\nRead AGENTS.md, any AGENTS.project.md, .agents/skills/ledger/SKILL.md, planning/control/ledger.json and planning/control/README.md. Check branch and dirty state. Write your startup handover before changes. Preserve unknown files. No self-verification, commits, migrations, autopilot or sweeper. Only the assigned ledger writer updates canonical state. Deliver patch, input hashes, executed output, before/after screenshots where meaningful, and completion handover for independent review.\nScope: all construction trades; universal count/length/area/volume; AUD; local-first browser and Windows x64; no auth/database; fencing optional.`;}
export function readCurrentWork(root=ROOT) {
 const p=safePath(root,'planning/control/current-work.json'),info=statSync(p);
 if(!info.isFile()||info.size>65536)throw Error('Invalid current-work document');
 const data=JSON.parse(readFileSync(p,'utf8'));
 if(data.schema!=='xray.current-work/v1'||!Number.isFinite(Date.parse(data.updatedAt))||!Array.isArray(data.stages)||!Array.isArray(data.work)||data.stages.some(s=>!/^([a-f0-9]{40})$/.test(s.sha)||!s.title||!s.status)||data.work.some(w=>!w.id||!w.title||!['in progress','awaiting independent review','blocked'].includes(w.status)||!w.detail))throw Error('Invalid current-work metadata');
 if(data.requirements){const p='planning/handovers/IW-PUBLIC-REQUIREMENTS/crosswalk.md';if(data.requirements.path!==p||hash(readFileSync(safePath(root,p)))!==data.requirements.sha256)throw Error('Current requirements link is missing or stale');}
 return data;
}
export function currentWorkView(data) {
 if(!data)return '';
 return `<section class="notice current-work" aria-label="Current work"><p class="eyebrow">CURRENT WORK - UPDATED ${esc(data.updatedAt)}</p><h2>Building reconstruction and staged delivery</h2><p>${esc(data.deliveryStatus)}</p>${data.requirements?`<p>${link(data.requirements.path,'Public requirements crosswalk - queued work')}</p>`:''}<table><thead><tr><th>Commit</th><th>Reviewed delivery stage</th><th>Delivery state</th></tr></thead><tbody>${data.stages.map(s=>`<tr><td><code>${esc(s.sha.slice(0,7))}</code></td><td>${esc(s.title)}</td><td>${esc(s.status)}</td></tr>`).join('')}</tbody></table>${data.work.map(w=>`<article><h3>${esc(w.title)} - ${esc(w.status)}</h3><p>${esc(w.detail)}</p><small>Owner: ${esc(w.owner)}</small></article>`).join('')}<p><strong>${esc(data.historicalNotice)}</strong></p></section>`;
}
export function render(data, options={}) {
 const taskRows=data.tasks.map(t=>`<article class="task searchable" data-status="${esc(t.status)}" data-search="${esc([t.id,t.title,t.slice,t.owner,t.status].join(' ').toLowerCase())}" id="${esc(t.id)}"><div class="task-heading"><div><span class="eyebrow">${esc(t.id)} / ${esc(t.slice)}</span><h3>${esc(t.title)}</h3></div><span class="status">${esc(t.status)}</span></div><p>${esc(t.summary)}</p>${screenshotGallery(data,t.id)}<details><summary>Acceptance, dependencies & proof</summary><dl><dt>Owner / revision</dt><dd>${esc(t.owner)} / ${t.revision}</dd><dt>Depends on</dt><dd>${t.dependsOn.map(d=>`<a href="#${esc(d)}">${esc(d)}</a>`).join(', ') || 'None'}</dd><dt>Machine acceptance</dt><dd>${esc(t.acceptance.machine)}</dd><dt>Human acceptance</dt><dd>${esc(t.acceptance.human)}</dd><dt>Proof</dt><dd>${t.evidence.length?t.evidence.map(e=>link(e.path,e.kind)).join(' · '):'No submitted evidence. Independent verification pending.'}</dd></dl><label for="packet-${esc(t.id)}">Startup packet</label><textarea id="packet-${esc(t.id)}" readonly rows="7">${esc(startupPacket(data,t))}</textarea><button data-copy="packet-${esc(t.id)}">Copy startup packet</button></details></article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Industry-wide delivery ledger · Xray</title><link rel="stylesheet" href="/dashboard.css"><script src="/dashboard.js" defer></script></head><body><a class="skip" href="#main">Skip to ledger</a><header><a class="brand" href="/">XRAY <span>DELIVERY CONTROL</span></a><span class="local">Local · read only</span></header><main id="main">${currentWorkView(options.currentWork)}${options.scope==='historical'?'<p class="notice"><strong>HISTORICAL ASSESSMENT SNAPSHOT - 5 September 2026.</strong> Archived source inputs and original proof are validated. These outcomes do not approve changes made after the snapshot.</p>':''}<div class="intro"><p class="eyebrow">INDUSTRY-WIDE / SOURCE TO VERIFIED ESTIMATE</p><h1>Industry-wide delivery</h1><p>Universal count, length, area and volume. Proven trade packs extend the core. Fencing is optional.</p></div><div class="stats"><div><strong>${data.slices.length}</strong><span>Delivery slices</span></div><div><strong>${data.inventory.features.length}</strong><span>Preserved features</span></div><div><strong>${data.inventory.acceptance.length}</strong><span>Acceptance rows</span></div><div><strong>${data.tasks.filter(t=>t.status==='verified').length} / ${data.tasks.length}</strong><span>Verified tasks</span></div></div><p class="notice">Historical mapping is provisional. Imported completion claims are not verification. Canonical state lives in repository files; this dashboard cannot change it.</p>${data.fullFeatureAudit?`<p class="notice"><strong>${options.scope==='historical'?'Snapshot feature audit':'Fresh feature audit'}: ${data.fullFeatureAudit.features.filter(f=>f.status==='untested').length} untested · ${data.fullFeatureAudit.features.filter(f=>f.status==='fail').length} failed · ${data.fullFeatureAudit.features.filter(f=>f.status==='pass').length} passed.</strong> <a href="#feature-audit">See every feature and its test scenario</a>. Real-PDF wireframe baseline failed; no successful process exit is treated as usable geometry.</p>`:''}${screenshotGallery(data)}<nav aria-label="Ledger views">${['features','tasks','dependencies','decisions','inventory','external','handover'].map((n,i)=>`<button data-view="${n}" aria-pressed="${!i}">${n[0].toUpperCase()+n.slice(1)}</button>`).join('')}</nav><div class="filters"><label>Search ledger<input id="search" type="search" placeholder="Task, trade, source or decision"></label><label>Task status<select id="status"><option value="all">All statuses</option>${STATES.map(s=>`<option>${s}</option>`).join('')}</select></label></div><p id="result-count" role="status" aria-live="polite"></p>${featureAuditView(data,options)}<section data-panel="tasks" aria-label="Tasks" hidden>${taskRows}</section><section data-panel="dependencies" aria-label="Dependencies" hidden><h2>Delivery sequence</h2>${data.slices.map(s=>`<article class="searchable" data-search="${esc((s.id+' '+s.title).toLowerCase())}" id="${s.id}"><span class="eyebrow">${s.id} · ${s.status}</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><p>Depends on: ${s.dependsOn.join(', ')||'None'}</p><p>Machine: ${esc(s.acceptance.machine)}</p><p>Human: ${esc(s.acceptance.human)}</p></article>`).join('')}</section><section data-panel="decisions" aria-label="Decisions" hidden><h2>Recorded decisions</h2>${data.decisions.map(d=>`<article class="searchable" data-search="${esc((d.id+' '+d.title+' '+d.detail).toLowerCase())}"><span class="eyebrow">${esc(d.id)} · ${esc(d.status)}</span><h3>${esc(d.title)}</h3><p>${esc(d.detail)}</p></article>`).join('')}</section><section data-panel="inventory" aria-label="Historical inventory" hidden><h2>Nothing silently dropped</h2><p>Every original row remains attached to its exact source line. Reconciliation is a separate open task.</p>${[...data.inventory.features,...data.inventory.acceptance].map(r=>`<article class="inventory-row searchable" data-search="${esc((r.id+' '+r.text+' '+r.slice).toLowerCase())}"><strong>${esc(r.id)}</strong><span>${esc(r.text.split('|')[2].trim())}</span><small>${r.slice} · ${r.mapping} · ${link(r.source,`source line ${r.line}`)}</small></article>`).join('')}</section><section data-panel="external" aria-label="External queue" hidden><h2>External dependencies</h2>${data.externalQueue.map(q=>`<article class="searchable" data-search="${esc((q.id+' '+q.title+' '+q.reason).toLowerCase())}"><span class="eyebrow">${esc(q.id)} · ${esc(q.status)}</span><h3>${esc(q.title)}</h3><p>${esc(q.reason)}</p><p>Owner: ${esc(q.owner)} · Blocks: ${esc(q.blocks.join(', '))}</p></article>`).join('')}</section><section data-panel="handover" aria-label="Handover" hidden><h2>Resume with the files</h2><p>Single ledger writer: ${esc(data.writer)}. Updates require a reviewable file diff and validation. Reload this page after file updates.</p><p>${link('planning/control/README.md','Operating contract')} · ${link('planning/handovers/IW-SC01/startup.md','SC01 startup handover')} · ${link('INDUSTRY-WIDE-TODO.md','Live to-do')} · <a href="/historical">Historical baseline</a> · <a href="/ledger.json">Canonical JSON</a></p><p>Authorization recorded verbatim: “${esc(data.approval.quote)}”</p><p>Baseline: ${esc(data.baseline.branch)} @ ${esc(data.baseline.commit)}</p><p>Default decisions: AUD · existing visual system · local-first browser / Windows x64 · auth/database off.</p></section><p id="copy-result" role="status" aria-live="polite"></p></main><footer>Generated from planning/control/ledger.json · ${esc(data.updatedAt)} · Not part of the deployed application</footer></body></html>`;
}
export function artifactAllowed(path,data) {
 const explicit=new Set(['planning/handovers/IW-PUBLIC-REQUIREMENTS/crosswalk.md',...(data.fullFeatureAudit?.features??[]).flatMap(f=>f.evidence??[]).map(e=>e.path).filter(p=>/^proof\/audit\/IW-[A-Z0-9-]+\//.test(p)),...HISTORICAL,MINDMAP,'planning/control/README.md','planning/handovers/IW-SC01/startup.md','INDUSTRY-WIDE-TODO.md','INDUSTRY-WIDE-LEDGER.md']);
 for(const t of data.tasks) {for(const e of t.evidence ?? []) {if(e.screenshot?.reportPath?.startsWith("proof/audit/"))explicit.add(e.screenshot.reportPath);} for(const e of t.evidence ?? []) if(/^(proof\/audit\/IW-[A-Z0-9-]+\/|screenshots\/industry-(?:ledger|baseline|verification)\/|planning\/handovers\/IW-[A-Z0-9-]+\/)/.test(e.path)) explicit.add(e.path); if(t.review?.path?.startsWith('planning/handovers/'))explicit.add(t.review.path);}
 return explicit.has(path) && /\.(md|json|txt|log|patch|png)$/.test(path);
}
export function serve(root=ROOT,port=8097,options={}) {
 const server=createServer((req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
  const send=(code,body,type='text/plain; charset=utf-8')=>{const responseHeaders={...headers,'Content-Type':type};if(type==='image/png')responseHeaders['Content-Security-Policy']=headers['Content-Security-Policy'].replace("style-src 'self'","style-src 'unsafe-inline'");res.writeHead(code,responseHeaders);res.end(body);};
  if(req.method!=='GET' && req.method!=='HEAD') return send(405,'Read only');
  if(req.headers.host!==`127.0.0.1:${server.address().port}` && req.headers.host!==`localhost:${server.address().port}`) return send(403,'Invalid host');
  if(req.headers.origin && ![`http://127.0.0.1:${server.address().port}`,`http://localhost:${server.address().port}`].includes(req.headers.origin))return send(403,'Invalid origin');
  try {
   const url=new URL(req.url,'http://127.0.0.1'); const data=readLedger(root); const verdict=validate(data,root,options);
   if(!verdict.ok) return send(503,JSON.stringify(verdict));
   if(url.pathname==='/favicon.ico')return send(204,'');
   if(url.pathname==='/')return send(200,render(data,{...options,currentWork:options.scope==='historical'?readCurrentWork(root):null}),'text/html; charset=utf-8');
   if(url.pathname==='/ledger.json')return send(200,JSON.stringify(data),'application/json');
   if(url.pathname==='/dashboard.css' || url.pathname==='/dashboard.js')return send(200,readFileSync(safePath(root,'planning/control'+url.pathname)),url.pathname.endsWith('.css')?'text/css':'text/javascript');
   if(url.pathname==='/historical') return send(200,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historical baseline · Xray</title><link rel="stylesheet" href="/dashboard.css"><main><p class="eyebrow">HISTORICAL BASELINE / READ ONLY</p><h1>Before the industry-wide tracker</h1><p>The existing mindmap below is preserved verbatim, including inherited checked items. This historical view is rendered for comparison; it is not a screenshot of a previously existing dashboard.</p><p>Baseline ${esc(data.baseline.commit)}. Historical checked claims require independent re-verification.</p><h2>Historical mindmap and completion claims</h2><pre id="historical-mindmap">${esc(readFileSync(safePath(root,MINDMAP),'utf8'))}</pre></main></html>`,'text/html; charset=utf-8');
   if(url.pathname==='/artifact') {const path=url.searchParams.get('path');const p=safePath(root,path);if(!artifactAllowed(path,data))return send(404,'Artifact not allowlisted');return send(200,readFileSync(p),path.endsWith('.png')?'image/png':'text/plain; charset=utf-8');}
   return send(404,'Not found');
  } catch {return send(400,'Invalid request or unavailable file');}
 });
 server.listen(port,'127.0.0.1',()=>console.log(`Industry ledger: http://127.0.0.1:${server.address().port}`));return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const command=process.argv[2],options=process.argv.includes('--historical')?{scope:'historical'}:{};
 if(command==='validate'){const result=validate(readLedger(),ROOT,options);console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;}
 else if(command==='render'){const data=readLedger();const result=validate(data,ROOT,options);if(!result.ok){console.error(JSON.stringify(result));process.exitCode=1;}else{const out=safePath(ROOT,'planning/control/index.html');mkdirSync(dirname(out),{recursive:true});const html=render(data,{...options,currentWork:options.scope==='historical'?readCurrentWork():null});writeFileSync(out,html);writeFileSync(safePath(ROOT,'planning/control/dashboard.html'),html);console.log('Rendered planning/control/index.html and dashboard.html alias');}}
 else if(command==='serve'){const port=Number(process.argv[3]??8097);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be 1024–65535');serve(ROOT,port,options);}
 else {console.error('Usage: node scripts/industry-ledger.mjs validate|render|serve [port]');process.exitCode=1;}
}

