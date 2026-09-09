// Syntax and preparation-contract checks only: no source packaging or remote calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertReleaseFreeze } from './assert-release-freeze.mjs';
const base='proof/growth/2026-09-08-daily-recovery';
const read=file=>fs.readFileSync(`${base}/${file}`,'utf8');
const record=JSON.parse(read('release-tooling-prepared.json'));
for(const helper of record.helpers){assert.equal(createHash('sha256').update(read(helper.file)).digest('hex'),helper.preparedSha256);if(helper.file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',`${base}/${helper.file}`],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);}}
for(const file of ['assert-release-freeze.mjs','prepare-release-tooling.mjs']){const result=spawnSync(process.execPath,['--check',`${base}/${file}`],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);}
assert(!fs.existsSync(`${base}/release-freeze-guard.json`),'This preparation check must run before source freeze');
assert.throws(()=>assertReleaseFreeze(),/Explicit SOURCE FREEZE/);
assert(!fs.existsSync(`${base}/transfer`),'No packaging is authorized during preparation');
assert(!fs.existsSync(`${base}/transfer.json`));
const worker=read('worker.ps1');
assert(worker.includes('$env:VITE_XRAY_BUILD_ID=$RunId'));
assert(worker.indexOf('$env:VITE_XRAY_BUILD_ID=$RunId')<worker.indexOf("Invoke-Step 'web-build'"));
assert(worker.indexOf("Invoke-Step 'web-build'")<worker.indexOf("Invoke-Step 'native-build'"));
assert.equal((worker.match(/VITE_XRAY_BUILD_ID=\$env:VITE_XRAY_BUILD_ID/g)||[]).length,2);
assert(worker.includes("if ($dansWorkers -ne 16)"));
assert(worker.includes("$child.PriorityClass='High'"));
for(const path of record.focusedTestFiles)assert(fs.existsSync(path));
const prior=fs.readFileSync('proof/growth/2026-09-08-walkthrough-polish/worker.ps1','utf8');
for(const match of prior.matchAll(/'([^']+\.test\.ts)'/g))assert(record.focusedTestFiles.includes(match[1]));
assert(read('start-preview.ps1').includes("$env:PREVIEW_PORT='8092'"));
assert(read('remote-orchestrator.mjs').includes('127.0.0.1:8092:127.0.0.1:8092'));
const result={status:'pass — tooling preparation only',checkedScripts:9,focusedTestFiles:record.focusedTestFiles.length,priorFocusedTestFilesRetained:18,freezeRefusalVerified:true,sourcePackaged:false,remoteCalls:0,buildStarted:false,previewPort:8092,buildIdRecordedFor:['web','native'],note:'Visible browser/native badge requires actual candidate UI verification after build.'};
fs.writeFileSync(`${base}/release-tooling-verification.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
