// Read-only syntax and contract verification; never execute release helpers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertReleaseFreeze} from './assert-release-freeze.mjs';
const base='proof/growth/2026-09-08-assistant-mcp',read=p=>fs.readFileSync(`${base}/${p}`,'utf8');
const record=JSON.parse(read('release-tooling-prepared.json'));
for(const helper of record.helpers){assert.equal(createHash('sha256').update(read(helper.file)).digest('hex'),helper.preparedSha256);if(helper.file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',`${base}/${helper.file}`],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);}}
assert.throws(()=>assertReleaseFreeze(),/Explicit SOURCE FREEZE/);
for(const path of ['transfer','transfer.json','native-transfer.json','release-freeze-guard.json'])assert(!fs.existsSync(`${base}/${path}`));
const worker=read('worker.ps1');
assert(!worker.includes('$cacheRecord.nativeSourceSha256 -ne $NativeHash'));
assert(worker.includes("$cacheRecord.nativeSourceSha256 -ne '9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7'"));
assert(worker.includes("$child.PriorityClass='High'"));assert(worker.includes('if ($dansWorkers -ne 16)'));
for(const step of ['native-assistant-tests','native-material-tests'])assert(worker.indexOf(`Invoke-Step '${step}'`)>worker.indexOf("Invoke-Step 'native-build'"));
assert(worker.indexOf("Invoke-Step 'web-build'")<worker.indexOf("Invoke-Step 'native-build'"));
assert(worker.includes('$env:VITE_XRAY_BUILD_ID=$RunId'));assert.equal((worker.match(/VITE_XRAY_BUILD_ID=\$env:VITE_XRAY_BUILD_ID/g)||[]).length,2);
assert(read('package-web.mjs').includes("'package-lock.json'"));
assert(read('start-preview.ps1').includes("$env:PREVIEW_PORT='8093'"));
assert(read('remote-orchestrator.mjs').includes('127.0.0.1:8093:127.0.0.1:8093'));
for(const m of fs.readFileSync('proof/growth/2026-09-08-daily-recovery/worker.ps1','utf8').matchAll(/'([^']+\.test\.ts)'/g))assert(record.focusedTestFiles.includes(m[1]));
const result={status:'pass - preparation checks only',helpers:record.helpers.length,focusedTestFiles:24,pendingTestFiles:record.focusedTestFiles.filter(p=>!fs.existsSync(p)),nativeTestFilters:record.nativeTestFilters,freezeRefusalVerified:true,sourcePackaged:false,remoteCalls:0,buildStarted:false,previewPort:8093};
fs.writeFileSync(`${base}/release-tooling-verification.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
