import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { categories, sources, researchedAt } from './catalogue.mjs';
import { industries, initialFindings as originalFindings, workingDay } from './industries.mjs';
import { readAssessment } from './assessment.mjs';

const root=resolve(import.meta.dirname,'../..');
const out=resolve(root,'public/industry-coverage');
const checklistPath=resolve(root,'PROFESSIONAL-A-Z-CHECKLIST.md');
const reviewed=existsSync(checklistPath) ? readAssessment(readFileSync(checklistPath,'utf8'), categories.flatMap(c=>c.items.map(i=>i.id))) : null;
if(reviewed)for(const category of categories)for(const item of category.items)Object.assign(item,reviewed.rows.get(item.id));
const initialFindings=reviewed?.findings.length ? reviewed.findings : originalFindings;
mkdirSync(out,{recursive:true});
const items=categories.flatMap(c=>c.items.map(i=>({...i,category:c.id,categoryName:c.title,benchmarks:c.benchmarks})));
const ids=new Set(items.map(i=>i.id));
if(ids.size!==items.length || categories.length!==26 || items.some(i=>!i.name||!i.acceptance)) throw Error('Incomplete catalogue');
if(industries.some(i=>i.categories.some(c=>!categories.some(x=>x.id===c)))) throw Error('Unknown industry category');
const sourceIds=new Set(sources.map(s=>s[0]));
if(categories.some(c=>c.benchmarks.some(s=>!sourceIds.has(s))))throw Error('Unknown benchmark');
// No manual ticking in the generated report. Acceptance is an evidence-bearing source change.
// Preserve older recorded states without inventing checkmarks. Every actual tick requires paths.
for(const i of items) if(i.checked) {
  if(!i.code.length||!i.evidence.length)throw Error(`${i.id}: missing code or proof`);
  for(const p of [...i.code,...i.evidence])if(!existsSync(resolve(root,p)))throw Error(`${i.id}: missing ${p}`);
}
const data={schema:'xray-professional-coverage/v1',researchedAt,scope:'Living requirements catalogue, not a parity or readiness claim',categories,industries,workingDay,initialFindings,sources};
writeFileSync(resolve(out,'catalogue.json'),JSON.stringify(data,null,2)+'\n');
const cell=s=>'"'+String(s).replaceAll('"','""')+'"';
writeFileSync(resolve(out,'requirements.csv'),'\ufeff'+[
  ['ID','Category','Requirement','Acceptance test','State','Code','Proof','Benchmarks','Checked','Assessment'],
  ...items.map(i=>[i.id,i.categoryName,i.name,i.acceptance,i.state,i.code.join('; '),i.evidence.join('; '),i.benchmarks.join('; '),i.checked ? 'yes' : 'no',i.assessmentText || ''])
].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n');
writeFileSync(resolve(out,'industries.csv'),'\ufeff'+[
  ['ID','Industry/profile','Roles','Scenario','Inputs','Required outputs','Categories','State'],
  ...industries.map(i=>[i.id,i.name,i.roles,i.scenario,i.inputs,i.outputs,i.categories.join(', '),i.state])
].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n');

const intro=`# Professional workspace: A–Z requirements and proof checklist

Research checked ${researchedAt}. ${items.length} requirements, ${categories.length} categories, ${industries.length} industry/professional profiles and ${sources.length} primary-source references.

User authorization: “smoke testing as you go with screenshots of proof means ticked off a list” and an extensive A–Z across relevant industries and use cases. Work continues on feat/architect-cad-engine, baseline 3e422f0084de607a775c2ede8dfecdf0b032c75e, preserving prior work and user data.

This is the expanded scope register. It does not replace the historical 150-feature ledger or promote prior evidence to current acceptance. Vendor documentation establishes benchmark coverage, not an independently ranked market-share survey or proof of X-Ray capabilities. Requirements and tests below are our synthesis. No finite catalogue guarantees every specialist use case; new disciplines, format variants and jurisdiction requirements must enter this register with explicit acceptance before a readiness claim.

**Tick rule:** a requirement remains unchecked until its complete stated behavior has a matching code diff, executed test/log, inspected screenshot where visual, source/fixture identity, tested platform/build and reviewer/date. A screenshot alone cannot prove persistence, arithmetic, access control or delivery. Historical evidence and partial implementations do not count as current full passes. Changes affecting a dependency reopen its acceptance. Industry readiness additionally requires all applicable rows and its full working-day scenario to pass.

Delivery states: not-assessed → gap / partial / in-progress / failed / dependency-blocked → verified. No implied completion from a vendor feature, an installed package, a visible button or a green build.

Read-only searchable report: public/industry-coverage/index.html. Portable CSV/JSON are beside it. Source: planning/professional-coverage/. Regenerate with node planning/professional-coverage/generate.mjs.

## Current concrete findings

| User concern | Current assessment | Evidence boundary / next acceptance |
|---|---|---|
${initialFindings.map(([name,state,detail,code,refs])=>`| ${name} | ${state} | ${detail} Relevant rows: ${refs}. Code: ${code}. |`).join('\n')}

## Delivery sequence and dependencies

1. Finish current roof/DWG fixes and their native, installed and web proof. An undo crash discovered in the new import scenario must pass regression before closure.
2. Establish one project lifecycle: stable project/document/sheet IDs, full backup asset manifest, save feedback, reopen, archive/restore and concurrent-edit protection (B, D, V).
3. Add complete named sheet sets and safe sheet removal/recovery; maintain source hashes and dependent takeoff links (D, T).
4. Build rate books, worksheet/column mapping and reviewed application with units/currency/tax/date provenance (E). Costs must not reinterpret measured quantities.
5. Integrate bounded Firecrawl search using native/server credentials; gather candidates and source evidence, then require review before applying a rate (P, X). Live provider test requires an actual configured credential; mocked responses only prove error/control paths.
6. Complete portable staff handoff, then authenticated team storage, permissions, invitations and durable delivery receipts (A, B, V). Preparing a package is distinct from sending it; external sending requires an explicit instruction naming the recipient.
7. Deliver discipline scenarios against the shared primitives. Specialist solvers, standards content, hardware formats and proprietary integrations need separately validated engines or licensed adapters (G–O, S, W, Y).
8. Run complete working-day and disaster-recovery scenarios, reopen impacted checks after changes, then close only the matching platform-specific release rows (Q, Z).

These are implementation waves, not a narrowing of the catalogue. All categories remain in scope; dependencies determine delivery order. Credentials, commercial licenses, specialist validation and live recipient access are recorded when encountered rather than represented as working features.

## Universal working-day acceptance

Every industry profile below inherits these steps. Run with a representative source fixture, two named staff roles where applicable, a supplier sheet with mixed units, a controlled revision and a fresh recovery profile. Retain before/after screenshots, assertions, outputs and hashes.

| ID | Stage | Scenario | Categories |
|---|---|---|---|
${workingDay.map(r=>`| ${r.join(' | ')} |`).join('\n')}

## A–Z requirements
`;
let md=intro;
for(const c of categories){
  md+=`\n### ${c.id} — ${c.title}\n\nBenchmark references: ${c.benchmarks.map(id=>{const s=sources.find(s=>s[0]===id);return `[${s[1]}](${s[2]})`;}).join(', ')}. These references inform the category; each acceptance requirement is X-Ray's own target.\n\n`;
  md+=c.items.map(i=>`- [ ] **${i.id} ${i.name}** — ${i.acceptance}. State: ${i.state}. Code/proof: pending.`).join('\n')+'\n';
}
md+='\n## Industry and professional scenarios\n\nAll profiles inherit A/B/D/E/I/J/Q/U/V/Z plus the listed discipline categories. Each starts untested. Building geometry alone does not qualify a professional solver or establish regulatory approval.\n\n';
md+='| ID | Industry and roles | Day-to-day use case | Inputs → required output | Categories | Status |\n|---|---|---|---|---|---|\n';
md+=industries.map(i=>`| ${i.id} | ${i.name}; ${i.roles} | ${i.scenario} | ${i.inputs} → ${i.outputs} | ${i.categories.join(', ')} | ${i.state} |`).join('\n');
md+='\n\n## Benchmark source register\n\nPrimary product documentation reviewed on the date above. Vendor performance and superiority claims are not adopted. Feature availability can vary by version, tier, module, platform and license.\n\n';
md+=sources.map(([id,name,url,note])=>`- **${id}** [${name}](${url}) — ${note}`).join('\n');
md+='\n\n## Evidence packet template\n\nFor every accepted row: requirement ID; declared platform/scope; base SHA and exact patch; fixture paths and SHA-256; executed action sequence; expected and actual assertions; screenshot paths and visual-review notes; build/test logs; artifact hashes; reviewer/date; residual limits; related industry profiles. Backend-only rows require executed proof; visual rows also require inspected screenshots.\n';
// Never replace reviewed assessments, history or evidence with the initial scaffold.
if(!existsSync(checklistPath))writeFileSync(checklistPath,md);

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const proofSources=[
  ['screenshots/redburn-roof/dev-exterior.png','roof-development.png','Roof repair — development view','Actual rendered repair. Final installed verification remains open.'],
  ['screenshots/dwg/native-import-review.png','dwg-review.png','DWG — import review','Actual desktop import confirmation before changing the design.'],
  ['screenshots/dwg/native-imported.png','dwg-imported.png','DWG — imported reference geometry','Imported fixture: 474 lines, 9 circles and 3 arcs. This screenshot does not prove undo or delivery.'],
];
mkdirSync(resolve(out,'proof'),{recursive:true});
const gallery=proofSources.filter(([p])=>existsSync(resolve(root,p))).map(([p,name,title,note])=>{
  copyFileSync(resolve(root,p),resolve(out,'proof',name));
  return `<figure><a href="proof/${name}"><img loading="lazy" src="proof/${name}" alt="${esc(title)}"></a><figcaption><strong>${esc(title)}</strong><p>${esc(note)}</p></figcaption></figure>`;
}).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>X-Ray — Professional coverage and proof</title><style>
:root{font-family:system-ui,sans-serif;color:#203432;background:#f3f2ed;font-size:15px;line-height:1.55}*{box-sizing:border-box}body{margin:0}header{background:#1f3834;color:#fff;padding:44px max(24px,calc((100vw - 1280px)/2))}h1{font-size:clamp(28px,4vw,44px);font-weight:550;letter-spacing:-1px;margin:8px 0}h2{font-weight:600;margin:0 0 12px}h3{margin:0}p{max-width:95ch}a{color:#136957;text-underline-offset:3px}header a{color:#d1ecde}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase}.counts{display:flex;gap:36px;flex-wrap:wrap;margin-top:24px}.counts strong{display:block;font-size:30px;font-weight:500}.counts span{font-size:13px;color:#d2ddd8}main{max-width:1328px;padding:28px 24px 60px;margin:auto}section{margin:0 0 36px}.note{border-left:4px solid #aa7638;background:#fffbf0;padding:14px 18px}.toolbar{position:sticky;top:0;background:#f3f2edf5;border-block:1px solid #d0d7d0;padding:14px 0;display:flex;gap:12px;flex-wrap:wrap;z-index:2}.toolbar label{display:grid;font-size:12px;gap:3px;flex:1;min-width:170px}.toolbar label:first-child{flex:2}input,select{font:inherit;padding:10px;background:white;border:1px solid #96aaa1;border-radius:4px;width:100%;color:#203432}button{font:inherit;cursor:pointer;padding:9px 14px;border:1px solid #96aaa1;background:white;border-radius:4px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b0752e;outline-offset:2px}nav{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}nav a{padding:3px 8px;border:1px solid #c5d2c9;border-radius:3px;text-decoration:none}.category{scroll-margin-top:145px;background:#fffefa;border:1px solid #d4dbd2;border-radius:5px;margin:16px 0}.cathead{padding:20px 22px;border-bottom:1px solid #e0e4dc}.benchmarks{font-size:12px;margin:5px 0 0;color:#5a6b63}.requirement{display:grid;grid-template-columns:85px 1fr 130px;gap:16px;padding:16px 22px;border-bottom:1px solid #e8ebe3}.requirement:last-child{border:0}.reqid{font-variant-numeric:tabular-nums;font-size:13px;color:#5e7067}.check{display:inline-block;border:1px solid #84968b;width:15px;height:15px;vertical-align:-2px;margin-right:6px}.acceptance{color:#4b6055;font-size:13px;margin:4px 0}.state{font-size:11px;align-self:start;border:1px solid #c9cfbf;border-radius:3px;padding:4px 7px;white-space:nowrap;text-align:center;background:#f3f2e9}.tablewrap{overflow:auto}table{border-collapse:collapse;width:100%;background:#fffefa;font-size:13px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #dbe1d6}th{background:#e4e9df}td{min-width:120px}details{border:1px solid #d4dbd2;background:#fffefa;margin-bottom:12px;padding:14px}summary{cursor:pointer;font-weight:600}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}figure{margin:0;background:#fffefa;border:1px solid #d4dbd2}img{display:block;width:100%;height:200px;object-fit:contain;background:#e2e2d8}figcaption{padding:14px;font-size:13px}figcaption p{margin-bottom:0}.source{margin:10px 0}.muted{color:#607167}.hidden{display:none!important}footer{font-size:12px;border-top:1px solid #ccd4c8;padding-top:18px}@media(max-width:650px){header{padding:28px 20px}main{padding:20px 14px}.toolbar{position:static}.requirement{grid-template-columns:65px 1fr;padding:14px;gap:10px}.state{grid-column:2;justify-self:start}.counts{gap:20px}.cathead{padding:16px}.category{scroll-margin-top:15px}}@media print{.toolbar,nav,button{display:none}.category{break-inside:avoid}header{background:white;color:black}.counts span{color:black}body{background:white}a{color:inherit}main{padding:0}details{display:block}}
</style></head><body><header><div class="eyebrow">X-Ray by Looplet · Scope & delivery evidence</div><h1>The professional workspace, A–Z.</h1><p>A working-day checklist across design, engineering, construction, fabrication and operations. Every tick requires a matching change and inspected proof.</p><div class="counts"><div><strong>${items.length}</strong><span>Testable requirements</span></div><div><strong>${industries.length}</strong><span>Industry & role profiles</span></div><div><strong>${sources.length}</strong><span>Primary references</span></div><div><strong>${items.filter(i=>i.state==='verified').length}</strong><span>Full requirements verified in this register</span></div></div><p><a href="requirements.csv" download>Requirements CSV</a> · <a href="industries.csv" download>Industry CSV</a> · <a href="catalogue.json" download>Full catalogue JSON</a></p></header><main>
<section class="note"><strong>Coverage is a delivery commitment, not a completion claim.</strong><p>Research checked ${researchedAt}. Existing work and historical passes remain in their original ledgers. This report preserves the states and evidence recorded in the reviewed Markdown checklist; a partial feature or screenshot cannot certify a whole requirement. Specialist calculations require their own validated engine, applicable criteria and professional review.</p></section>
<section><h2>What the current audit has found</h2><div class="tablewrap"><table><thead><tr><th>Daily need</th><th>Current assessment</th><th>What remains</th></tr></thead><tbody>${initialFindings.map(([n,s,d])=>`<tr><td>${esc(n)}</td><td>${esc(s)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div></section>
<section><h2>Actual work in progress</h2><p class="muted">Captured from the running app. These are scoped observations; the requirement stays open until its complete acceptance passes.</p><div class="gallery">${gallery}</div></section>
<section><h2>Find a requirement</h2><div class="toolbar"><label>Search requirements and acceptance<input id="search" type="search" placeholder="Try pricing, rename, roof, archive…"></label><label>Industry / professional profile<select id="industry"><option value="">All profiles</option>${industries.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label><label>Category<select id="category"><option value="">All A–Z categories</option>${categories.map(c=>`<option value="${c.id}">${c.id} — ${esc(c.title)}</option>`).join('')}</select></label><button id="reset" type="button">Reset</button></div><p id="results" role="status" aria-live="polite"></p><nav aria-label="A to Z category index">${categories.map(c=>`<a href="#category-${c.id}">${c.id}</a>`).join('')}</nav><div id="requirements">${categories.map(c=>`<section class="category" id="category-${c.id}" data-category="${c.id}"><div class="cathead"><h2>${c.id} — ${esc(c.title)}</h2><p class="benchmarks">Benchmarks: ${c.benchmarks.map(id=>{const s=sources.find(s=>s[0]===id);return `<a href="${esc(s[2])}" target="_blank" rel="noopener noreferrer">${esc(s[1])}</a>`;}).join(' · ')}. Requirements below are X-Ray targets.</p></div>${c.items.map(i=>`<article class="requirement" data-search="${esc((i.id+' '+i.name+' '+i.acceptance).toLowerCase())}"><div class="reqid"><span class="check" aria-label="${i.checked ? 'Checked' : 'Unchecked'}">${i.checked ? '✓' : ''}</span>${i.id}</div><div><strong>${esc(i.name)}</strong><p class="acceptance">Pass when: ${esc(i.acceptance)}.</p><small class="muted">${esc(i.assessmentText || 'Code diff + executed proof + visual review: pending')}</small></div><span class="state">${esc(i.state)}</span></article>`).join('')}</section>`).join('')}</div></section>
<section><h2>One complete working day</h2><p>Each industry profile must complete all eight stages using its own representative fixture and outputs. Include restart, cancellation, permission boundaries, a source revision and clean-profile recovery.</p>${workingDay.map(([id,n,t])=>`<details><summary>${id} · ${esc(n)}</summary><p>${esc(t)}</p></details>`).join('')}</section>
<section><h2>${industries.length} industry and professional scenarios</h2><p>The industry filter above selects applicable requirement categories. Profiles share project, document, cost, access, exchange, collaboration and release foundations.</p><div class="tablewrap"><table><thead><tr><th>Profile</th><th>Daily scenario</th><th>Input</th><th>Required output</th><th>State</th></tr></thead><tbody>${industries.map(i=>`<tr data-profile="${i.id}"><td><strong>${esc(i.name)}</strong><br>${esc(i.roles)}</td><td>${esc(i.scenario)}</td><td>${esc(i.inputs)}</td><td>${esc(i.outputs)}</td><td>Not tested</td></tr>`).join('')}</tbody></table></div></section>
<section><h2>Benchmark source register</h2><p>Established vendor suites and specialist tools provide comparison coverage. This is not a market-share ranking. Version, license and platform limits must be checked when implementing an adapter.</p>${sources.map(([id,n,url,note])=>`<p class="source"><strong>${id}</strong> · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(n)}</a> — ${esc(note)}</p>`).join('')}</section><footer>Scope remains expandable. New specialist use cases require explicit acceptance and evidence before an industry-readiness claim. Generated from the versioned catalogue; checklist marks cannot be changed by clicking this report.</footer></main><script>
const profiles=${JSON.stringify(industries.map(i=>({id:i.id,categories:i.categories})))};
const search=document.getElementById('search'),industry=document.getElementById('industry'),category=document.getElementById('category');
function filter(){const query=search.value.trim().toLowerCase();const selected=profiles.find(p=>p.id===industry.value);let count=0;document.querySelectorAll('.category').forEach(section=>{const allowed=(!category.value||section.dataset.category===category.value)&&(!selected||selected.categories.includes(section.dataset.category));let matches=0;section.querySelectorAll('.requirement').forEach(row=>{const show=allowed&&row.dataset.search.includes(query);row.classList.toggle('hidden',!show);if(show){matches++;count++;}});section.classList.toggle('hidden',!matches);});document.getElementById('results').textContent=count+' of ${items.length} requirements shown. Unchecked items remain open.';document.querySelectorAll('[data-profile]').forEach(row=>row.classList.toggle('hidden',!!industry.value&&row.dataset.profile!==industry.value));}
search.addEventListener('input',filter);industry.addEventListener('change',filter);category.addEventListener('change',filter);document.getElementById('reset').addEventListener('click',()=>{search.value='';industry.value='';category.value='';filter();});filter();
</script></body></html>`;
writeFileSync(resolve(out,'index.html'),html);
writeFileSync(resolve(root,'planning/professional-coverage/validation.json'),JSON.stringify({researchedAt,categories:categories.length,requirements:items.length,profiles:industries.length,sources:sources.length,uniqueIds:ids.size,allAcceptancePresent:true,allCategoryReferencesValid:true,verifiedRequirements:items.filter(i=>i.state==='verified').length},null,2)+'\n');
console.log(JSON.stringify({categories:categories.length,requirements:items.length,profiles:industries.length,sources:sources.length,out}));
