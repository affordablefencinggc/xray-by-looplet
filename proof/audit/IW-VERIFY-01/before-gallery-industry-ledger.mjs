import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
export function validate(data, root = ROOT) {
  const errors = [];
  const fail = s => errors.push(s);
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
    if(task.status !== 'verified') continue;
    if(!(task.inputs?.length)) fail(`${task.id}: verified requires input files`);
    let digest; try{digest=inputDigest(task,root);}catch{fail(`${task.id}: inputs missing`);}
    for(const path of [task.startupHandover,task.completionHandover])try{const info=statSync(safePath(root,path));if(!info.isFile() || !info.size)fail(`${task.id}: empty or non-file handover`);}catch{fail(`${task.id}: handover missing`);}
    const required = task.visual ? ['patch','executed','before','before-mobile','after-desktop','after-mobile'] : ['patch','executed'];
    for(const kind of required) if(!task.evidence?.some(e=>e.kind===kind)) fail(`${task.id}: missing ${kind} evidence`);
    for(const evidence of task.evidence ?? []) {
      try {const p=safePath(root,evidence.path); if(!statSync(p).isFile() || !statSync(p).size || hash(readFileSync(p))!==evidence.sha256 || evidence.revision!==task.revision || evidence.inputDigest!==digest) fail(`${task.id}: stale evidence ${evidence.kind}`);}catch{fail(`${task.id}: evidence missing`);}
    }
    const review=task.review;
    if(!review || review.reviewer===task.owner || !review.reviewer || review.decision!=='approved' || review.revision!==task.revision || review.inputDigest!==digest || !review.reviewedAt || !Number.isFinite(Date.parse(review.reviewedAt))) fail(`${task.id}: fresh independent approval required`);
    else {try{const path=safePath(root,review.path);const info=statSync(path);if(!info.isFile() || !info.size || hash(readFileSync(path))!==review.sha256) fail(`${task.id}: empty, non-file or stale review attachment`);}catch{fail(`${task.id}: review attachment missing`);}}
  }
  for(const slice of data.slices) {if(slice.status!==sliceStatus(data.tasks.filter(t=>t.slice===slice.id)))fail(`${slice.id}: slice status must derive from tasks`);if(slice.status==='verified' && (!data.tasks.some(t=>t.slice===slice.id) || data.tasks.some(t=>t.slice===slice.id && !['verified','intentional-off','superseded'].includes(t.status)))) fail(`${slice.id}: unfinished tasks`);}
  if(data.slices.find(s=>s.id==='IW-SC10')?.status==='verified' && [...data.inventory.features,...data.inventory.acceptance].some(r=>r.mapping!=='reconciled')) fail('Release requires complete historical reconciliation');
  return {ok:errors.length===0,errors,counts:{slices:data.slices.length,tasks:data.tasks.length,features:data.inventory.features.length,acceptance:data.inventory.acceptance.length,verified:data.tasks.filter(t=>t.status==='verified').length}};
}
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (path,label) => `<a href="/artifact?path=${encodeURIComponent(path)}">${esc(label)}</a>`;
export function startupPacket(data, task) {return `Task ${task.id}: ${task.title}\nAuthorization: "${data.approval.quote}"\nBranch: ${data.baseline.branch}\nBaseline: ${data.baseline.commit}\nLatest recorded workspace observation: ${JSON.stringify(data.workspaceObservation)}\nRe-run git branch --show-current, git rev-parse HEAD and git status --short; recorded dirty files are observations, not a clean-tree claim.\nOwner: ${task.owner}\nScope: ${task.scope.join(', ')}\nDependencies: ${task.dependsOn.join(', ') || 'none'}\nCurrent state: ${task.status}\nStartup handover: ${task.startupHandover}\nCompletion handover: ${task.completionHandover}\nMachine exit: ${task.acceptance.machine}\nHuman exit: ${task.acceptance.human}\nRead AGENTS.md, any AGENTS.project.md, .agents/skills/ledger/SKILL.md, planning/control/ledger.json and planning/control/README.md. Check branch and dirty state. Write your startup handover before changes. Preserve unknown files. No self-verification, commits, migrations, autopilot or sweeper. Only the assigned ledger writer updates canonical state. Deliver patch, input hashes, executed output, before/after screenshots where meaningful, and completion handover for independent review.\nScope: all construction trades; universal count/length/area/volume; AUD; local-first browser and Windows x64; no auth/database; fencing optional.`;}
export function render(data) {
 const taskRows=data.tasks.map(t=>`<article class="task searchable" data-status="${esc(t.status)}" data-search="${esc([t.id,t.title,t.slice,t.owner,t.status].join(' ').toLowerCase())}" id="${esc(t.id)}"><div class="task-heading"><div><span class="eyebrow">${esc(t.id)} / ${esc(t.slice)}</span><h3>${esc(t.title)}</h3></div><span class="status">${esc(t.status)}</span></div><p>${esc(t.summary)}</p><details><summary>Acceptance, dependencies & proof</summary><dl><dt>Owner / revision</dt><dd>${esc(t.owner)} / ${t.revision}</dd><dt>Depends on</dt><dd>${t.dependsOn.map(d=>`<a href="#${esc(d)}">${esc(d)}</a>`).join(', ') || 'None'}</dd><dt>Machine acceptance</dt><dd>${esc(t.acceptance.machine)}</dd><dt>Human acceptance</dt><dd>${esc(t.acceptance.human)}</dd><dt>Proof</dt><dd>${t.evidence.length?t.evidence.map(e=>link(e.path,e.kind)).join(' · '):'No submitted evidence. Independent verification pending.'}</dd></dl><label for="packet-${esc(t.id)}">Startup packet</label><textarea id="packet-${esc(t.id)}" readonly rows="7">${esc(startupPacket(data,t))}</textarea><button data-copy="packet-${esc(t.id)}">Copy startup packet</button></details></article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Industry-wide delivery ledger · Xray</title><link rel="stylesheet" href="/dashboard.css"><script src="/dashboard.js" defer></script></head><body><a class="skip" href="#main">Skip to ledger</a><header><a class="brand" href="/">XRAY <span>DELIVERY CONTROL</span></a><span class="local">Local · read only</span></header><main id="main"><div class="intro"><p class="eyebrow">INDUSTRY-WIDE / SOURCE TO VERIFIED ESTIMATE</p><h1>Industry-wide delivery</h1><p>Universal count, length, area and volume. Proven trade packs extend the core. Fencing is optional.</p></div><div class="stats"><div><strong>${data.slices.length}</strong><span>Delivery slices</span></div><div><strong>${data.inventory.features.length}</strong><span>Preserved features</span></div><div><strong>${data.inventory.acceptance.length}</strong><span>Acceptance rows</span></div><div><strong>${data.tasks.filter(t=>t.status==='verified').length} / ${data.tasks.length}</strong><span>Verified tasks</span></div></div><p class="notice">Historical mapping is provisional. Imported completion claims are not verification. Canonical state lives in repository files; this dashboard cannot change it.</p><nav aria-label="Ledger views">${['tasks','dependencies','decisions','inventory','external','handover'].map((n,i)=>`<button data-view="${n}" aria-pressed="${!i}">${n[0].toUpperCase()+n.slice(1)}</button>`).join('')}</nav><div class="filters"><label>Search ledger<input id="search" type="search" placeholder="Task, trade, source or decision"></label><label>Task status<select id="status"><option value="all">All statuses</option>${STATES.map(s=>`<option>${s}</option>`).join('')}</select></label></div><p id="result-count" role="status" aria-live="polite"></p><section data-panel="tasks" aria-label="Tasks">${taskRows}</section><section data-panel="dependencies" aria-label="Dependencies" hidden><h2>Delivery sequence</h2>${data.slices.map(s=>`<article class="searchable" data-search="${esc((s.id+' '+s.title).toLowerCase())}" id="${s.id}"><span class="eyebrow">${s.id} · ${s.status}</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><p>Depends on: ${s.dependsOn.join(', ')||'None'}</p><p>Machine: ${esc(s.acceptance.machine)}</p><p>Human: ${esc(s.acceptance.human)}</p></article>`).join('')}</section><section data-panel="decisions" aria-label="Decisions" hidden><h2>Recorded decisions</h2>${data.decisions.map(d=>`<article class="searchable" data-search="${esc((d.id+' '+d.title+' '+d.detail).toLowerCase())}"><span class="eyebrow">${esc(d.id)} · ${esc(d.status)}</span><h3>${esc(d.title)}</h3><p>${esc(d.detail)}</p></article>`).join('')}</section><section data-panel="inventory" aria-label="Historical inventory" hidden><h2>Nothing silently dropped</h2><p>Every original row remains attached to its exact source line. Reconciliation is a separate open task.</p>${[...data.inventory.features,...data.inventory.acceptance].map(r=>`<article class="inventory-row searchable" data-search="${esc((r.id+' '+r.text+' '+r.slice).toLowerCase())}"><strong>${esc(r.id)}</strong><span>${esc(r.text.split('|')[2].trim())}</span><small>${r.slice} · ${r.mapping} · ${link(r.source,`source line ${r.line}`)}</small></article>`).join('')}</section><section data-panel="external" aria-label="External queue" hidden><h2>External dependencies</h2>${data.externalQueue.map(q=>`<article class="searchable" data-search="${esc((q.id+' '+q.title+' '+q.reason).toLowerCase())}"><span class="eyebrow">${esc(q.id)} · ${esc(q.status)}</span><h3>${esc(q.title)}</h3><p>${esc(q.reason)}</p><p>Owner: ${esc(q.owner)} · Blocks: ${esc(q.blocks.join(', '))}</p></article>`).join('')}</section><section data-panel="handover" aria-label="Handover" hidden><h2>Resume with the files</h2><p>Single ledger writer: ${esc(data.writer)}. Updates require a reviewable file diff and validation. Reload this page after file updates.</p><p>${link('planning/control/README.md','Operating contract')} · ${link('planning/handovers/IW-SC01/startup.md','SC01 startup handover')} · ${link('INDUSTRY-WIDE-TODO.md','Live to-do')} · <a href="/historical">Historical baseline</a> · <a href="/ledger.json">Canonical JSON</a></p><p>Authorization recorded verbatim: “${esc(data.approval.quote)}”</p><p>Baseline: ${esc(data.baseline.branch)} @ ${esc(data.baseline.commit)}</p><p>Default decisions: AUD · existing visual system · local-first browser / Windows x64 · auth/database off.</p></section><p id="copy-result" role="status" aria-live="polite"></p></main><footer>Generated from planning/control/ledger.json · ${esc(data.updatedAt)} · Not part of the deployed application</footer></body></html>`;
}
export function artifactAllowed(path,data) {
 const explicit=new Set([...HISTORICAL,MINDMAP,'planning/control/README.md','planning/handovers/IW-SC01/startup.md','INDUSTRY-WIDE-TODO.md','INDUSTRY-WIDE-LEDGER.md']);
 for(const t of data.tasks) {for(const e of t.evidence ?? []) if(/^(proof\/audit\/IW-[A-Z0-9-]+\/|screenshots\/industry-ledger\/|planning\/handovers\/IW-[A-Z0-9-]+\/)/.test(e.path)) explicit.add(e.path); if(t.review?.path?.startsWith('planning/handovers/'))explicit.add(t.review.path);}
 return explicit.has(path) && /\.(md|json|txt|log|patch|png)$/.test(path);
}
export function serve(root=ROOT,port=8097) {
 const server=createServer((req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
  const send=(code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{...headers,'Content-Type':type});res.end(body);};
  if(req.method!=='GET' && req.method!=='HEAD') return send(405,'Read only');
  if(req.headers.host!==`127.0.0.1:${server.address().port}` && req.headers.host!==`localhost:${server.address().port}`) return send(403,'Invalid host');
  if(req.headers.origin && ![`http://127.0.0.1:${server.address().port}`,`http://localhost:${server.address().port}`].includes(req.headers.origin))return send(403,'Invalid origin');
  try {
   const url=new URL(req.url,'http://127.0.0.1'); const data=readLedger(root); const verdict=validate(data,root);
   if(!verdict.ok) return send(503,JSON.stringify(verdict));
   if(url.pathname==='/favicon.ico')return send(204,'');
   if(url.pathname==='/')return send(200,render(data),'text/html; charset=utf-8');
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
 const command=process.argv[2];
 if(command==='validate'){const result=validate(readLedger());console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;}
 else if(command==='render'){const data=readLedger();const result=validate(data);if(!result.ok){console.error(JSON.stringify(result));process.exitCode=1;}else{const out=safePath(ROOT,'planning/control/index.html');mkdirSync(dirname(out),{recursive:true});const html=render(data);writeFileSync(out,html);writeFileSync(safePath(ROOT,'planning/control/dashboard.html'),html);console.log('Rendered planning/control/index.html and dashboard.html alias');}}
 else if(command==='serve'){const port=Number(process.argv[3]??8097);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be 1024–65535');serve(ROOT,port);}
 else {console.error('Usage: node scripts/industry-ledger.mjs validate|render|serve [port]');process.exitCode=1;}
}
