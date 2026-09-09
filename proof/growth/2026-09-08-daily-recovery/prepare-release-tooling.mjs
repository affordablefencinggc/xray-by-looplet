// Preparation only. Copies/adapts scripts; never packages, transfers or builds.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const previous = 'proof/growth/2026-09-08-walkthrough-polish';
const base = 'proof/growth/2026-09-08-daily-recovery';
const files = ['package-web.mjs','package-native.mjs','remote-orchestrator.mjs','worker.ps1','start-preview.ps1','remote-collect-artifacts.ps1','release-verify-artifacts.mjs','release-build-identity.mjs','release-freeze-guard.mjs'];
const additionalTests = ['src/studio/projectRecoveryStore.test.ts','src/studio/architect/authoredSheetSet.test.ts'];
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of files) if (fs.existsSync(`${base}/${file}`)) throw Error(`Preserve existing helper: ${file}`);
const result = [];
for (const file of files) {
  const old = fs.readFileSync(`${previous}/${file}`, 'utf8');
  let next = old.replaceAll(previous, base).replaceAll('8091', '8092');
  if (file === 'package-web.mjs' || file === 'package-native.mjs' || file === 'remote-orchestrator.mjs')
    next = "import { assertReleaseFreeze } from './assert-release-freeze.mjs';\nassertReleaseFreeze();\n" + next;
  if (file === 'worker.ps1') {
    next = next.replace("$env:VITE_AUTH_ENABLED='false'", "$env:VITE_AUTH_ENABLED='false'\n$env:VITE_XRAY_BUILD_ID=$RunId");
    next = next.replace("Invoke-Step 'focused-tests' @('--experimental-strip-types','--test',", "Invoke-Step 'focused-tests' @('--experimental-strip-types','--test',\n  '" + additionalTests.join("','") + "',");
    next = next.replaceAll('runs\\049d8ae830ee', 'runs\\38a64f0b8c2b').replaceAll('d108fd57a447e90b5478add9661f51e594be6fbaad471e156b269db6506194a2', '14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca');
    next = next.replace('buildEnvironment=@{VITE_AUTH_ENABLED=', 'buildEnvironment=@{VITE_XRAY_BUILD_ID=$env:VITE_XRAY_BUILD_ID;VITE_AUTH_ENABLED=');
    next = next.replace('$nativeResult=@{computer=', '$nativeResult=@{buildEnvironment=@{VITE_XRAY_BUILD_ID=$env:VITE_XRAY_BUILD_ID;RAYON_NUM_THREADS=$env:RAYON_NUM_THREADS;CARGO_BUILD_JOBS=$env:CARGO_BUILD_JOBS};computer=');
    next = next.replace(". 'C:\\Users\\danie\\XRayBuilds\\dans1-resource-policy.ps1'", ". 'C:\\Users\\danie\\XRayBuilds\\dans1-resource-policy.ps1'\nif ($dansWorkers -ne 16) { throw 'This release requires the approved 16-worker policy.' }");
  }
  if (file === 'start-preview.ps1') next = next.replace("$env:VITE_AUTH_ENABLED='false'", "$env:VITE_AUTH_ENABLED='false'\n$env:VITE_XRAY_BUILD_ID=$RunId");
  if (file === 'release-build-identity.mjs') {
    next = next.replace("const expected=['dependencies'", "assert.equal(web.buildEnvironment.VITE_XRAY_BUILD_ID,id);assert.equal(native.buildEnvironment.VITE_XRAY_BUILD_ID,id);\nconst expected=['dependencies'");
    const start = next.indexOf('const runtimeAssets=');
    const end = next.indexOf('const result=', start);
    if (start < 0 || end < start) throw Error('Unknown prior runtime asset verification helper');
    next = next.slice(0, start) + `const sourceManifest=JSON.parse(fs.readFileSync('${base}/transfer/source-manifest.json','utf8'));
const runtimeAssets=sourceManifest.entries.filter(entry=>entry.path.startsWith('public/assets/walkthrough/'));
assert(runtimeAssets.length>=2,'Missing walkthrough runtime assets in current source manifest');
for(const entry of runtimeAssets){const target=path.join(base,'web-artifacts','.vercel/output/static',entry.path.slice('public/'.length));assert.equal(hash(target),entry.sha256,'Runtime arm asset differs from frozen source');}
const buildIdAssets=web.artifacts.filter(entry=>entry.name.endsWith('.js')&&fs.readFileSync(path.join(base,'web-artifacts','.vercel/output/static/assets',entry.name),'utf8').includes(id));
assert(buildIdAssets.length>0,'Frozen build ID absent from production JavaScript; visible badge still needs UI verification');
` + next.slice(end);
    next = next.replace("runId:id,status:'pass'", "runId:id,status:'pass',buildIdInjected:id,buildIdPresentInWebAssets:buildIdAssets.map(entry=>entry.name)");
  }
  fs.writeFileSync(`${base}/${file}`, next.replace(/\r\n/g,'\n'), {flag:'wx'});
  result.push({file, copiedFrom:`${previous}/${file}`, previousSha256:hash(old), preparedSha256:hash(fs.readFileSync(`${base}/${file}`))});
}
const worker = fs.readFileSync(`${base}/worker.ps1`,'utf8');
const tests = [...worker.matchAll(/'([^']+\.test\.ts)'/g)].map(match=>match[1]);
if (new Set(tests).size !== tests.length || tests.length !== 20) throw Error('Unexpected or duplicated focused test paths');
for(const test of tests) if(!fs.existsSync(test)) throw Error(`Missing test ${test}`);
fs.writeFileSync(`${base}/release-tooling-prepared.json`, JSON.stringify({status:'prepared only — source freeze required',previewPort:8092,packaged:false,transferred:false,built:false,sourceEdited:false,buildIdEnvironment:'VITE_XRAY_BUILD_ID=$RunId',priorFocusedTestFiles:18,addedTestFiles:additionalTests,focusedTestFiles:tests,helpers:result},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:files.length,focusedTestFiles:tests.length,previewPort:8092,packaged:false,built:false}));
