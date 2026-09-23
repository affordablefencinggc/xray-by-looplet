// Evidence integrity audit only; product execution occurred on DANS1.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='proof/growth/2026-09-23-industry-closeout';
const read=p=>{const bytes=fs.readFileSync(p);return JSON.parse(bytes.toString(bytes[0]===255&&bytes[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,''));};
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const descriptions=[
 ['closeout-explanations-c56ad63e9ee7','FAIL: QS unassigned parent inclusion and mixed evidence subtotal'],
 ['closeout-explanations-reviewed-dev-ac5b412f3d0a','FAIL: roofing deducts end lap from first course'],
 ['closeout-explanations-formula-dev-8924a2a40537','FAIL: QS still displays a mixed evidence subtotal'],
 ['closeout-explanations-subtotals-dev-f63b95e8b802','NOT ACCEPTED: stopped on one-POST harness assumption; request reasons not captured'],
 ['closeout-explanations-corrections-dev-f63b95e8b802','PASS: root reviewed actual roofing/QS replies independently of model self-review'],
 ['closeout-dashboard-60454ec3','FAIL: readiness predicate accessed body before it existed'],
 ['closeout-dashboard-60454ec3-02','PASS: dashboard visible 18 of 20']
];
const campaigns=descriptions.map(([name,review])=>{
 const r=read(`${base}/${name}/browser-results.json`),launcher=read(`${base}/${name}/launcher-results.json`);
 if(r.host!=='dans1'||r.cleanup.errors.length||r.browserErrors.length)throw Error('Host/cleanup/browser errors: '+name);
 const captures=r.screenshots.map(s=>{const actual=hash(`${base}/${name}/${s.file}`);if(actual!==s.sha256)throw Error('Screenshot hash: '+name+'/'+s.file);return {path:s.file,sha256:actual};});
 return {name,host:r.host,operations:`${r.completedOperations}/${r.plannedOperations}`,runnerVerdict:r.verdict,review,launcherVerdict:launcher.verdict,captures};
});
const source=read(base+'/explanation-source03.json');for(const row of source)if(hash(row.path)!==row.sha256)throw Error('Source drift '+row.path);
const remote=read(base+'/explanation-checks03/result.json');if(remote.sha256!==source.find(s=>s.path.endsWith('worksheetExplanationGuidance.ts')).sha256)throw Error('Remote source differs');
const parity=read(base+'/bom-parity-current/convergence.json');if(!parity.ok||parity.fixtures.length!==4||parity.fixtures.some(f=>!f.typescriptMatchesExpected||!f.pythonMatchesExpected||!f.crossLanguageByteEquivalent))throw Error('Parity mismatch');
for(const file of ['SC-05-explanations-dev.md','SC-05-roofing-citation.md','SC-06-bay-native-backfill.md','SC-06-parity-snapshot.md','SC-00-dashboard.md']){
 const p=`${base}/steps/${file}`;for(const m of fs.readFileSync(p,'utf8').matchAll(/\]\(([^)]+)\)/g)){const target=path.resolve(path.dirname(p),m[1]);if(target!==path.resolve(base,'discussion-audit.json')&&!fs.existsSync(target))throw Error('Broken proof link '+file+': '+m[1]);}
}
const result={at:new Date().toISOString(),kind:'local evidence integrity audit; not a product test',ok:true,source,parityFixtures:4,campaigns};
fs.writeFileSync(base+'/discussion-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,campaigns:campaigns.length,parityFixtures:4}));
