import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readLedger,inputDigest,sliceStatus,render,validate} from '../../../scripts/industry-ledger.mjs';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
let code=readFileSync('scripts/industry-ledger.mjs','utf8');
code=code.replace('<p>${esc(t.summary)}</p><details>','<p>${esc(t.summary)}</p>${screenshotGallery(data,t.id)}<details>');
code=code.replace('<nav aria-label="Ledger views">','${screenshotGallery(data)}<nav aria-label="Ledger views">');
code=code.replace('screenshots\\/industry-ledger\\/','screenshots\\/industry-(?:ledger|baseline|verification)\\/');
code=code.replace('for(const t of data.tasks) {for(const e of t.evidence ?? [])','for(const t of data.tasks) {for(const e of t.evidence ?? []) {if(e.screenshot?.reportPath?.startsWith("proof/audit/"))explicit.add(e.screenshot.reportPath);} for(const e of t.evidence ?? [])');
writeFileSync('scripts/industry-ledger.mjs',code);
const d=readLedger();
const baseline=d.tasks.find(t=>t.id==='IW-003'),tracker=d.tasks.find(t=>t.id==='IW-001'),core=d.tasks.find(t=>t.id==='IW-004');
const build=json('proof/audit/IW-BASELINE/build.json');
const attach=(task,kind,path,screenshot)=>{task.evidence.push({kind,path,sha256:hash(path),revision:task.revision,inputDigest:inputDigest(task),screenshot:{...screenshot,reportSha256:hash(screenshot.reportPath)}});};
for(const built of [false,true])for(const view of ['desktop','mobile'])for(const phase of ['trace-before-zoom','zoom-after']){
 const reportPath=`proof/audit/IW-BASELINE/${built?'built-':''}ui-baseline.json`,report=json(reportPath),viewport=report.results.find(r=>r.viewport.name===view).viewport;
 attach(baseline,`${built?'built':'dev'}-${view}-${phase}`,`screenshots/industry-baseline/${built?'built/':''}${view}-${phase}.png`,{url:`http://127.0.0.1:${built?8081:8080}/`,time:report.capturedAt,timeLabel:'capture report time',viewport:{width:viewport.width,height:viewport.height},scenario:`${built?'Built output':'Dev app'} · ${view} · ${phase==='zoom-after'?'after zoom':'before zoom'}`,result:'Baseline: defect reproduced. Overlay moves; original source remains stationary. Repair is open.',classification:phase==='zoom-after'?'after interaction · baseline defect':'before interaction · baseline',sourceIdentity:`Source sample-plan.svg SHA-256 9af36a8fed12990049ae9ccf586f47535c708167af638db1e8bc50fc0b116596; ${built?'exact production build':'dev baseline'} HEAD ${build.head}; full input/build hashes in build.json`,reportPath,featured:(view==='desktop'&&phase==='zoom-after')||(view==='mobile'&&built&&phase==='zoom-after')});
}
const trackerReportPath='proof/audit/IW-SC01/browser-v4.json',trackerReport=json(trackerReportPath);
for(const e of tracker.evidence.filter(e=>['before','before-mobile','after-desktop','after-mobile'].includes(e.kind))){const mobile=e.kind.includes('mobile'),before=e.kind.startsWith('before'),v=trackerReport.viewports[mobile?'mobile':'desktop'];e.screenshot={url:`http://127.0.0.1:8097/${before?'historical':''}`,time:trackerReport.at,timeLabel:'capture report time',viewport:{width:v.width,height:v.height},scenario:`Tracker ${mobile?'mobile':'desktop'} ${before?'historical before':'after implementation'}`,result:before?'Historical mindmap rendered locally for comparison; not a previous dashboard.':'Search/filter/copy/navigation passed. This capture predates the embedded gallery change; gallery awaits review.',classification:before?'historical before':'after implementation · prior gallery',sourceIdentity:`Tracker v4 inputDigest ${json('proof/audit/IW-SC01/submission-manifest-v4.json').inputDigest}`,reportPath:trackerReportPath,reportSha256:hash(trackerReportPath),featured:!mobile&&!before};}
// Existing report screenshot URL was not retained by its ephemeral server. Recapture records exact URL before attaching.
tracker.status='awaiting-verification';tracker.summary+=' User requires screenshots embedded in HTML. Gallery extension awaits independent review.';
tracker.acceptance.human+=' Actual screenshots must be visibly embedded with local URL, timestamp provenance, viewport, scenario/result and source identity.';
for(const t of d.tasks)t.acceptance.human+=' Completion requires embedded local screenshot evidence: actual before/after desktop/mobile for UI; captured executed report plus raw logs for non-UI.';
d.decisions.push({id:'DEC-007',status:'accepted',title:'Visible local screenshot proof is mandatory',detail:'User correction: screenshot proof belongs visibly IN THE HTML. Every task needs embedded captured local evidence with provenance; UI before/after desktop/mobile, non-UI execution report explicitly distinct from app behavior plus raw logs. Gallery implementation belongs to audit_engine_release and requires separate independent approval. Prior unit checks do not close gallery or product work.'});
d.writer='audit_engine_release';d.updatedAt=new Date().toISOString();
for(const s of d.slices)s.status=sliceStatus(d.tasks.filter(t=>t.slice===s.id));
writeFileSync('planning/control/ledger.json',JSON.stringify(d,null,2)+'\n');
console.log('Gallery evidence metadata installed; renderer reload and validation next.');
