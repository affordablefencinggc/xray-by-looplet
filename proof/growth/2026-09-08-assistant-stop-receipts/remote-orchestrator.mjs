

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='proof/growth/2026-09-08-assistant-stop-receipts';
const [stage,id]=process.argv.slice(2);
if(!['transfer','build','collect','preview','verify-source'].includes(stage)||!/^[a-f0-9]{12}$/.test(id??''))throw Error('Usage: remote-orchestrator.mjs transfer|build|collect|preview|verify-source <12 hex run ID>. Packaging must already be explicitly frozen.');
const release=path.join(base,`release-${id}`), incoming=`C:/Users/danie/XRayBuilds/incoming/${id}`,run=`C:/Users/danie/XRayBuilds/runs/${id}`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function exec(program,args,inherit=false){const result=spawnSync(program,args,{encoding:'utf8',windowsHide:true,stdio:inherit?'inherit':'pipe'});if(!inherit){process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');}if(result.status!==0)throw Error(`${program} failed (${result.status}): ${result.error?.message??''}`);return result.stdout;}
function ssh(code,inherit=false,forward=false){return exec('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10',...(forward?['-o','ExitOnForwardFailure=yes','-L','127.0.0.1:8095:127.0.0.1:8095']:[]),'tonys-test-pc','powershell','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],inherit);}
function verifySource(){const web=read(`${base}/transfer/source-manifest.json`),native=read(`${base}/transfer/native-manifest.json`);const drift=[...web.entries,...native.entries].filter(e=>!fs.existsSync(e.path)||hash(e.path)!==e.sha256).map(e=>e.path);const result={at:new Date().toISOString(),runId:id,webFiles:web.entries.length,nativeFiles:native.entries.length,status:drift.length?'failed':'pass',drift};fs.mkdirSync(release,{recursive:true});fs.writeFileSync(path.join(release,`source-drift-${Date.now()}.json`),JSON.stringify(result,null,2));if(drift.length)throw Error('Source changed after snapshot: '+drift.join(', '));return result;}
if(stage==='verify-source'){console.log(JSON.stringify(verifySource()));process.exit(0);}
const transfer=read(`${base}/transfer.json`),native=read(`${base}/transfer/native-manifest.json`);
if(transfer.source.sha256.slice(0,12)!==id)throw Error('Run ID must match source archive hash prefix');
if(stage==='transfer'){
 verifySource();
 for(const [file,expected] of [['source.tar',transfer.source.sha256],['node-runtime.tar',transfer.runtime.sha256],['native-source.tar',native.archiveSha256]])if(hash(`${base}/transfer/${file}`)!==expected)throw Error('Transfer hash mismatch '+file);
 ssh(`$ErrorActionPreference='Stop';if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong worker'};$p='${incoming}';if(Test-Path -LiteralPath $p){throw 'Incoming run already exists; preserved'};New-Item -ItemType Directory -Path $p | Out-Null;Get-Content -LiteralPath 'C:/Users/danie/XRayBuilds/dans1-resource-policy.ps1'`);
 const files=['source.tar','node-runtime.tar','native-source.tar','source-manifest.json','native-manifest.json'].map(f=>`${base}/transfer/${f}`);
 files.push(`${base}/worker.ps1`,`${base}/start-preview.ps1`,`${base}/remote-collect-artifacts.ps1`);
 exec('scp',['-o','BatchMode=yes',...files,`tonys-test-pc:${incoming}/`]);
 const remoteChecks=files.map(file=>`if((Get-FileHash -LiteralPath '${incoming}/${path.basename(file)}' -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${hash(file)}'){throw 'Transferred file hash mismatch: ${path.basename(file)}'}`).join(';');
 ssh(`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';${remoteChecks};Write-Output 'All transferred archives, manifests, and worker scripts verified'`);
 const record={at:new Date().toISOString(),runId:id,incoming,sourceSha256:transfer.source.sha256,runtimeSha256:transfer.runtime.sha256,nativeSourceSha256:native.archiveSha256,workerSha256:hash(`${base}/worker.ps1`),files:files.map(file=>({path:file,sha256:hash(file),bytes:fs.statSync(file).size}))};
 fs.writeFileSync(path.join(release,'transfer-record.json'),JSON.stringify(record,null,2),{flag:'wx'});console.log(JSON.stringify(record));
}else if(stage==='build'){
 verifySource();
 ssh(`& '${incoming}/worker.ps1' -RunId '${id}' -SourceHash '${transfer.source.sha256}' -RuntimeHash '${transfer.runtime.sha256}' -NativeHash '${native.archiveSha256}'`,true);
}else if(stage==='preview'){
 ssh(`& '${incoming}/start-preview.ps1' -RunId '${id}'`,true,true);
}else if(stage==='collect'){
 ssh(`& '${incoming}/remote-collect-artifacts.ps1' -RunId '${id}'`);
 exec('scp',['-o','BatchMode=yes',`tonys-test-pc:${run}/*.json`,`tonys-test-pc:${run}/*.log`,`tonys-test-pc:${run}/native-artifacts.tar`,`tonys-test-pc:${run}/web-artifacts.tar`,release+'/']);
 const finalDrift=verifySource();
 fs.writeFileSync(path.join(release,'source-drift.json'),JSON.stringify(finalDrift,null,2),{flag:'wx'});
}
