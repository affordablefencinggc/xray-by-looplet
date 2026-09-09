// Preparation only: no application edits, snapshot, packaging, SSH or builds.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const previous='proof/growth/2026-09-08-daily-recovery';
const base='proof/growth/2026-09-08-assistant-mcp';
const files=['assert-release-freeze.mjs','package-web.mjs','package-native.mjs','remote-orchestrator.mjs','worker.ps1','start-preview.ps1','remote-collect-artifacts.ps1','release-verify-artifacts.mjs','release-build-identity.mjs','release-freeze-guard.mjs'];
const additionalTests=['src/studio/assistant/mcp.test.ts','src/studio/assistant/conversation.test.ts','src/lib/assistantAi.server.test.ts','src/studio/assistant/appTools.test.ts'];
const oldNativeHash='9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7';
const hash=data=>createHash('sha256').update(data).digest('hex');
const replace=(source,before,after)=>{assert(source.includes(before),`Missing expected helper anchor: ${before}`);return source.replace(before,after);};
for(const file of files)assert(!fs.existsSync(`${base}/${file}`),`Preserve existing ${file}`);
const helpers=[];
for(const file of files){
  const old=fs.readFileSync(`${previous}/${file}`,'utf8');
  let next=old.replaceAll(previous,base).replaceAll('8092','8093');
  if(file==='worker.ps1'){
    next=replace(next,"Invoke-Step 'focused-tests' @('--experimental-strip-types','--test',","Invoke-Step 'focused-tests' @('--experimental-strip-types','--test',\n  '"+additionalTests.join("','")+"',");
    next=replace(next,'function Invoke-Step([string]$Name,[string[]]$Arguments) {','function Invoke-Step([string]$Name,[string[]]$Arguments,[string]$Executable=$node) {');
    next=replace(next,'Start-Process -FilePath $node -ArgumentList $Arguments','Start-Process -FilePath $Executable -ArgumentList $Arguments');
    next=replace(next,'$cacheRecord.nativeSourceSha256 -ne $NativeHash',`$cacheRecord.nativeSourceSha256 -ne '${oldNativeHash}'`);
    next=replace(next,"throw 'Prior compiled cache has a different native source identity.'","throw 'Known original cache identity was not verified; no cache copied.'");
    next=replace(next,'@{source=$cacheSource;destination=$cacheTarget;nativeSourceSha256=$NativeHash;',`@{source=$cacheSource;destination=$cacheTarget;cacheNativeSourceSha256='${oldNativeHash}';nativeSourceSha256=$NativeHash;`);
    const nativeBuild="Invoke-Step 'native-build' @($npmCli,'run','tauri:build','--','--bundles','nsis')";
    next=replace(next,nativeBuild,nativeBuild+`
Verify-Sources
# Tests run after generated native dist/resources exist. No provider calls occur.
# Completion is written only after these selected Rust test gates pass.
$cargo=Join-Path $env:CARGO_HOME 'bin\\cargo.exe'
Invoke-Step 'native-assistant-tests' @('test','--locked','--release','--manifest-path','src-tauri/Cargo.toml','--lib','assistant_ai::tests') $cargo
Invoke-Step 'native-material-tests' @('test','--locked','--release','--manifest-path','src-tauri/Cargo.toml','--lib','material_ai::tests') $cargo
Verify-Sources`);
  }
  if(file==='release-build-identity.mjs')next=replace(next,"'web-build','native-build']","'web-build','native-build','native-assistant-tests','native-material-tests']");
  if(file==='assert-release-freeze.mjs'){
    next=replace(next,'return guard;',`const paths=new Set(manifest.entries.map(entry=>entry.path.replaceAll('\\\\','/')));
  for(const required of ['package.json','package-lock.json','src-tauri/src/assistant_ai.rs','src-tauri/src/material_ai.rs','src-tauri/src/lib.rs']) assert(paths.has(required),'Assistant release freeze must include '+required);
  for(const test of ${JSON.stringify(additionalTests)}) assert(fs.existsSync(test),'Assistant release test is not ready: '+test);
  const pkg=read('package.json'),lock=read('package-lock.json');
  assert(pkg.dependencies['@modelcontextprotocol/sdk'],'MCP SDK is required');
  assert.equal(lock.packages[''].dependencies['@modelcontextprotocol/sdk'],pkg.dependencies['@modelcontextprotocol/sdk'],'MCP SDK lockfile mismatch');
  assert(lock.packages['node_modules/@modelcontextprotocol/sdk']?.version,'MCP SDK missing from frozen lockfile');
  return guard;`);
  }
  fs.writeFileSync(`${base}/${file}`,next.replace(/\r\n/g,'\n'),{flag:'wx'});
  helpers.push({file,copiedFrom:`${previous}/${file}`,previousSha256:hash(old),preparedSha256:hash(fs.readFileSync(`${base}/${file}`))});
}
const worker=fs.readFileSync(`${base}/worker.ps1`,'utf8');
const focusedTestFiles=[...worker.matchAll(/'([^']+\.test\.ts)'/g)].map(m=>m[1]);
assert.equal(focusedTestFiles.length,24);assert.equal(new Set(focusedTestFiles).size,24);
const result={status:'prepared only; explicit source freeze required',previewPort:8093,packaged:false,transferred:false,built:false,sourceEdited:false,helpers,focusedTestFiles,missingTestsAtPreparation:focusedTestFiles.filter(p=>!fs.existsSync(p)),nativeTestFilters:['assistant_ai::tests','material_ai::tests'],nativeCache:{runId:'38a64f0b8c2b',originalSourceSha256:oldNativeHash,originalExecutableSha256:'14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca',newNativeSourceMustEqualOriginal:false,mode:'verified independent cache copy; Cargo rebuilds changed Rust'},buildIdEnvironment:'VITE_XRAY_BUILD_ID=$RunId'};
fs.writeFileSync(`${base}/release-tooling-prepared.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:helpers.length,previewPort:8093,focusedTestFiles:24,missingTests:result.missingTestsAtPreparation,packaged:false,built:false}));
