import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
if(os.hostname().toLowerCase()!=='dans1')throw Error('DANS1 only');
const [launchPath,scenarioPath]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const launch=read(launchPath),ops=read(scenarioPath);
if(launch.host!=='DANS1'||launch.sessionId!==1||launch.port!==9351)throw Error('Unexpected launch');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(hash(launch.exe)!==launch.exeSha256.toLowerCase()||(!launch.negativeCase&&hash(launch.engine)!==launch.engineSha256.toLowerCase()))throw Error('Artifact changed');
const ps=`$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(launch.pid)}';if(!$p){throw 'Native process missing'};$listeners=@(Get-NetTCPConnection -LocalPort 9351 -State Listen);if(!$listeners.Count -or @($listeners|Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count){throw 'Unexpected CDP binding'};foreach($l in $listeners){$id=$l.OwningProcess;$found=$false;for($i=0;$i -lt 16;$i++){if($id -eq $p.ProcessId){$found=$true;break};$parent=Get-CimInstance Win32_Process -Filter "ProcessId=$id";if(!$parent){break};$id=$parent.ParentProcessId};if(!$found){throw 'CDP listener is not native descendant'}};@{exe=$p.ExecutablePath;createdAt=$p.CreationDate.ToUniversalTime().ToString('o');pid=$p.ProcessId;sessionId=$p.SessionId;commandLine=$p.CommandLine;listeners=$listeners|Select-Object LocalAddress,LocalPort,OwningProcess}|ConvertTo-Json -Depth 4`;
const processProof=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true}));
if(processProof.exe.toLowerCase()!==launch.exe.toLowerCase()||Math.abs(Date.parse(processProof.createdAt)-Date.parse(launch.createdAt))>1000||processProof.sessionId!==1)throw Error('Native PID identity mismatch');
const pages=await(await fetch('http://127.0.0.1:9351/json/list')).json();
const page=pages.find(p=>p.type==='page'&&/^(https?:\/\/tauri\.localhost|tauri:\/\/localhost)/.test(p.url));
if(!page)throw Error('Packaged Tauri page missing; never substitute web preview');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((y,n)=>{ws.onopen=y;ws.onerror=n});
let id=0;const pending=new Map(),errors=[],receipts=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(JSON.stringify(m.error))):p.yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id,timer=setTimeout(()=>no(Error('CDP deadline '+method)),55000);pending.set(n,{yes,no,timer});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const safeFile=name=>{if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid proof name');return path.join(launch.proof,name)};
let failure=null;
try{
 await call('Runtime.enable');await call('Log.enable');
 receipts.push({name:'native-status',value:await evaluate(process.argv.includes('--skip-status')?"(()=>{if(!window.__TAURI_INTERNALS__)throw Error('Not native');return {native:true,statusSkipped:true,url:location.href}})()":"(async()=>{if(!window.__TAURI_INTERNALS__)throw Error('Not native');const status=await window.__TAURI_INTERNALS__.invoke('xray_bom_status');return {native:true,status,url:location.href,width:innerWidth,height:innerHeight}})()")});
 if(ops.some(op=>op.requiresEngine)&&receipts[0].value.status?.available!==true)throw Error('Configured native BOM engine unavailable; stop before generation');
 for(const op of ops){const t=Date.now();let value;
  if(op.kind==='read'){if(/setState|useStudio|localStorage\.set|indexedDB|import\(/.test(op.expression))throw Error('Direct state access forbidden');value=await evaluate(op.expression)}
  else if(op.kind==='click')value=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(op.selector)});if(!n||n.disabled)throw Error('Control unavailable');n.click();return true})()`);
  else if(op.kind==='input'||op.kind==='select')value=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(op.selector)});if(!n||n.disabled)throw Error('Field unavailable');Object.getOwnPropertyDescriptor(${op.kind==='select'?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(n,${JSON.stringify(op.value)});n.dispatchEvent(new Event('${op.kind==='select'?'change':'input'}',{bubbles:true}));return true})()`);
  else if(op.kind==='mouse')value=await call('Input.dispatchMouseEvent',op.params);
  else if(op.kind==='upload'){const {root}=await call('DOM.getDocument');const {nodeId}=await call('DOM.querySelector',{nodeId:root.nodeId,selector:op.selector});if(!nodeId)throw Error('File input missing');if(hash(op.file)!==op.sha256)throw Error('Fixture hash mismatch');value=await call('DOM.setFileInputFiles',{nodeId,files:[op.file]})}
  else if(op.kind==='viewport'){if(!Number.isInteger(op.width)||!Number.isInteger(op.height)||op.width<600||op.width>2000||op.height<600||op.height>1400)throw Error('Invalid QA viewport');value=await call('Emulation.setDeviceMetricsOverride',{width:op.width,height:op.height,deviceScaleFactor:1,mobile:false})}
  else if(op.kind==='reload')value=await call('Page.reload');
  else if(op.kind==='screenshot'){const f=safeFile(op.name)+'.png';if(fs.existsSync(f))throw Error('Proof exists');const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(f,Buffer.from(r.data,'base64'),{flag:'wx'});value={file:f,sha256:hash(f)}}
  else throw Error('Unknown opcode');receipts.push({name:op.name??op.kind,ms:Date.now()-t,value});
 }
}catch(e){failure=String(e);process.exitCode=1}finally{ws.close();const out=safeFile(path.basename(scenarioPath,'.json'))+'-result.json';fs.writeFileSync(out,JSON.stringify({host:os.hostname(),at:new Date().toISOString(),launch,processProof,page,receipts,errors,failure},null,2),{flag:'wx'});console.log(out)}
