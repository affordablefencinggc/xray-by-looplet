import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
const base='proof/growth/2026-09-23-industry-closeout';
const [name,input,build='c56ad63e9ee7',provider,mode='built']=process.argv.slice(2);
if(provider&&provider!=='minimax')throw Error('Only explicit existing MiniMax configuration is supported');
if(!['dev','built'].includes(mode))throw Error('Invalid preview mode');
if(!/^[a-z0-9-]+$/.test(name)||!/^[a-f0-9]{12}$/.test(build)||!input)throw Error('name input build required');
const id=`closeout-${name}-${mode==='dev'?'dev-':''}${build}`;
const scenario=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));
const serialized=JSON.stringify(scenario,null,2).replaceAll('http://127.0.0.1:8080','http://127.0.0.1:8081')+'\n';
const local=`${base}/scenarios/${id}.json`;
fs.writeFileSync(local,serialized,{flag:'wx'});
const sha=createHash('sha256').update(serialized).digest('hex');
const remote=`C:/Users/danie/XRayFastCdp/${id}.json`;
const output=`C:/Users/danie/XRayFastCdp/runs/${id}`;
const workspace=mode==='dev'?'C:/Users/danie/XRayBuilds/v1-industry-fencing-20260923':`C:/Users/danie/XRayBuilds/runs/${build}/source`;
function run(cmd,args,input){const r=spawnSync(cmd,args,{input,encoding:'utf8',windowsHide:true,maxBuffer:8e6});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');return r.status;}
if(run('scp',['-q',local,`tonys-test-pc:${remote}`])!==0)throw Error('scenario transfer failed');
let secretInput;
if(provider){const env=parseEnv(fs.readFileSync('.env.local','utf8'));if(!env.MINIMAX_API_KEY)throw Error('Existing project MiniMax configuration is absent');secretInput=JSON.stringify({key:env.MINIMAX_API_KEY,model:env.MINIMAX_MODEL||'MiniMax-M3'})+'\n';}
// Secrets travel only in SSH stdin and the temporary process environment, never argv, files or proof.
const credentialSetup=provider?`$configuration=[Console]::In.ReadLine() | ConvertFrom-Json;$env:MINIMAX_API_KEY=$configuration.key;$env:MINIMAX_MODEL=$configuration.model;$env:XRAY_AI_WEB_ENABLED='true';$configuration=$null;`:'';
const code=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong worker'};$env:PATH='C:/Users/danie/XRayBuilds/runs/8a6226fc93a6/runtime;'+$env:PATH;${credentialSetup}if((Get-FileHash -LiteralPath '${remote}').Hash.ToLowerInvariant() -ne '${sha}'){throw 'Scenario hash differs'};& '${workspace}/scripts/run-fast-cdp.ps1' -Scenario '${remote}' -Output '${output}' -Workspace '${workspace}' -RunId '${id}' -PreviewMode '${mode}' -PreviewPort 8081 -CdpPort 9351 -Chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe'`;
const status=run('ssh',['tonys-test-pc','powershell','-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],secretInput);
const copied=run('scp',['-q','-r',`tonys-test-pc:${output}`,`${base}/`]);
if(status||copied)throw Error(`journey=${status}, evidence-copy=${copied}; failures retained`);
