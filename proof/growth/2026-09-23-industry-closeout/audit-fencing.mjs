// Local receipt/hash audit; actual product execution was on DANS1.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='proof/growth/2026-09-23-industry-closeout',privateBase='C:/Users/danie/XRayPrivateProof/v1-boundaries';
const read=p=>{const b=fs.readFileSync(p);return JSON.parse(b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,''));};
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const campaigns=[];
for(const [name,operations] of [['closeout-fencing-stock-c56ad63e9ee7',157],['closeout-quote-issue-c56ad63e9ee7',58],['closeout-gate-hardware-reviewed-c56ad63e9ee7',79]]){
 const p=base+'/'+name,r=read(p+'/browser-results.json'),launcher=read(p+'/launcher-results.json');
 if(r.host!=='dans1'||r.verdict!=='PASS'||r.completedOperations!==operations||r.browserErrors.length||r.cleanup.errors.length||launcher.verdict!=='PASS')throw Error('Campaign failed '+name);
 for(const s of r.screenshots)if(hash(p+'/'+s.file)!==s.sha256)throw Error('Screenshot changed '+s.file);
 campaigns.push({name,operations,verdict:r.verdict,screenshots:r.screenshots.map(s=>({file:s.file,sha256:s.sha256}))});
}
const hardware=read(base+'/closeout-gate-hardware-reviewed-c56ad63e9ee7/browser-results.json').receipts.find(r=>r.value?.quote).value.quote;
if(hardware.totals[0].amount!=='108.84'||hardware.lines.length!==3||hardware.materialCoverage.lines.filter(l=>l.status==='no-rate').length!==7)throw Error('Hardware receipt differs');
const exports=read(base+'/built-stock-exports/export-verdict.json');if(exports.verdict!=='PASS'||exports.host.toLowerCase()!=='dans1')throw Error('Export verification absent');
for(const f of exports.files)if(hash(base+'/built-stock-exports/'+f.name)!==f.sha256)throw Error('Export changed '+f.name);
const preparation=read(privateBase+'/draft02/preparation.json'),ui=read(privateBase+'/draft02-ui/browser-results.json'),launcher=read(privateBase+'/draft02-ui/launcher-results.json');
if(preparation.sourceHash!==hash(privateBase+'/boundaries-readonly-plan.json')||preparation.scriptSha256!==hash(base+'/prepare-boundaries-draft.mjs')||!preparation.sourceUnchanged||preparation.bomAccepted||preparation.issues.length!==30||ui.verdict!=='PASS'||ui.completedOperations!==19||ui.browserErrors.length||launcher.verdict!=='PASS')throw Error('Private source proof differs');
for(const s of ui.screenshots)if(hash(privateBase+'/draft02-ui/'+s.file)!==s.sha256)throw Error('Private screenshot changed');
const privateReceipt={kind:'metadata-only index; raw address, coordinates and draft stay outside Git',host:preparation.host,sourceHash:preparation.sourceHash,sourceUnchanged:true,runs:6,gates:2,approximateGrossMapMetres:preparation.runs.reduce((s,r)=>s+r.metres,0),missingColorbondHeights:3,groundFall:'not supplied',calibration:'unverified',bomAccepted:false,compilerIssues:30,browserOperations:19,verdict:'PASS for isolated draft/withholding/reload only',privateEvidenceRoot:privateBase,screenshots:ui.screenshots.map(s=>({file:s.file,sha256:s.sha256})),cleanup:launcher.verdict};
fs.writeFileSync(base+'/private-plan-receipt.json',JSON.stringify(privateReceipt,null,2)+'\n');
const manifest=read(base+'/transfer/source-manifest.json');
const drift=manifest.entries.filter(e=>hash(e.path)!==e.sha256).map(e=>e.path);
if(drift.some(p=>!['scripts/verify-bom-cross-language.mjs','src/studio/assistant/useAssistantChat.ts'].includes(p)))throw Error('Undocumented source drift '+drift.join(', '));
for(const name of ['SC-07-stock-built','SC-09-hardware-built','SC-10-issue-built','SC-11-rates-built','SC-12-boundaries-readonly']){
 const file=base+'/steps/'+name+'.md';for(const m of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){const p=path.resolve(path.dirname(file),m[1]);if(p!==path.resolve(base,'fencing-audit.json')&&!fs.existsSync(p))throw Error('Broken evidence link '+m[1]);}
}
const result={kind:'local evidence integrity audit; not product execution',at:new Date().toISOString(),ok:true,build:'c56ad63e9ee7',productSource:'281f2479',currentDrift:drift,additionalCurrentSource:'src/studio/assistant/worksheetExplanationGuidance.ts (not in this build)',campaigns,exports:exports.files,privateReceipt:'private-plan-receipt.json',limits:'Native and real-job quote acceptance remain open'};
fs.writeFileSync(base+'/fencing-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,campaigns:campaigns.length,privateDraftOperations:19,exportFiles:exports.files.length,drift}));
