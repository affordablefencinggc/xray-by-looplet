import { mkdir, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { execFileSync } from 'node:child_process';
import { FastCdpBatch } from './fast-cdp.mjs';
if (hostname().toLowerCase() !== 'dans1') throw Error('Wrong host');
const [attempt, origin] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(attempt) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Invalid campaign');
const output = `C:/Users/danie/XRayBuilds/industry-visible-20260913/${attempt}`;
await mkdir(output);
const ps = `$ProgressPreference='SilentlyContinue'; $listeners=@(Get-NetTCPConnection -LocalPort 9341 -State Listen); if(!$listeners -or @($listeners|Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count){throw 'Unsafe binding'}; foreach($listener in $listeners){$process=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"; if($process.Name -ne 'msedge.exe' -or $process.CommandLine -match '--no-sandbox|--disable-gpu-sandbox|--single-process'){throw 'Unexpected browser'}; $process|Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine}|ConvertTo-Json`;
// Parenthesize pipeline output after foreach for Windows PowerShell 5.
const check = ps.replace('foreach($listener', '$proof=@(foreach($listener').replace('CommandLine}|ConvertTo-Json', 'CommandLine}); $proof|ConvertTo-Json');
const processProof = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(check,'utf16le').toString('base64')], { encoding:'utf8', windowsHide:true }));
const version = await (await fetch('http://127.0.0.1:9341/json/version')).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
let next=0, held=null, heldResolve, loadedResolve;
const pending=new Map(), errors=[], network=[], commands=[];
const heldReady = new Promise(resolve => { heldResolve=resolve; });
const staleLoaded = new Promise(resolve => { loadedResolve=resolve; });
ws.onmessage=({data})=>{
  const m=JSON.parse(data), p=pending.get(m.id);
  if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params);
  if(m.method==='Network.requestWillBeSent' && /\/api\/(minimax-ai|assistant-ai)$/.test(m.params.request.url)) network.push({url:m.params.request.url,method:m.params.request.method,id:m.params.requestId});
  if(m.method==='Fetch.requestPaused'){held={...m.params,sessionId:m.sessionId};heldResolve(held);}
  if(m.method==='Network.loadingFinished' && held?.networkId===m.params.requestId)loadedResolve(true);
};
const socket={call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' deadline'));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});},async evaluate(expression,sessionId){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}};
const batch=new FastCdpBatch(socket,output);
const run=async ops=>{commands.push(...ops);await batch.run(ops);};
const deadline=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),15000);})]);}finally{clearTimeout(timer);}};
const select = provider => `(()=>{const button=[...document.querySelectorAll('.assistant-provider-option')].find(n=>n.querySelector('strong')?.textContent.startsWith('${provider}'));if(!button||button.disabled)throw Error('Provider choice unavailable');button.click();})()`;
let failure=null, cleanup=false, sessionId;
try{
  await run([['context','provider'],['viewport','provider',1280,900]]);
  sessionId=batch.contexts.get('provider').sessionId;
  await socket.call('Network.enable',{},sessionId); await socket.call('Runtime.enable',{},sessionId);
  await run([['navigate','provider',origin],['wait','provider',`!!document.querySelector('.live-assistant-launcher') && !document.body.innerText.includes('Checking saved work')`],['eval','provider',`document.querySelector('.live-assistant-launcher').click()`],['wait','provider',`document.querySelector('.assistant-provider-button')?.getAttribute('aria-label').startsWith('Provider: MiniMax') && document.querySelector('.assistant-status-light')?.title.includes('MiniMax is configured')`]]);
  await socket.call('Fetch.enable',{patterns:[{urlPattern:'*/api/assistant-ai',requestStage:'Response'}]},sessionId);
  await run([['eval','provider',`document.querySelector('.assistant-provider-button').click()`],['wait','provider',`!!document.querySelector('.assistant-provider-menu')`],['eval','provider',select('Gemini')]]);
  await deadline(heldReady,'delayed Gemini response');
  await run([['eval','provider',`(()=>{if(!document.querySelector('.assistant-provider-button').textContent.includes('Gemini'))throw Error('Selection missing');if(document.querySelector('.assistant-status-light').classList.contains('is-on'))throw Error('Previous provider still shown ready');return {selected:'Gemini',staleLightCleared:true};})()`],['screenshot','provider','gemini-status-pending.png'],['eval','provider',`document.querySelector('.assistant-provider-button').click()`],['wait','provider',`!!document.querySelector('.assistant-provider-menu')`],['eval','provider',select('MiniMax')],['wait','provider',`document.querySelector('.assistant-status-light')?.title.includes('MiniMax is configured')`]]);
  await socket.call('Fetch.continueResponse',{requestId:held.requestId},sessionId);
  await deadline(staleLoaded,'released stale response');
  await socket.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',sessionId);
  await run([['eval','provider',`(()=>{const button=document.querySelector('.assistant-provider-button'),light=document.querySelector('.assistant-status-light');if(!button.textContent.includes('MiniMax')||!light.title.includes('MiniMax is configured'))throw Error('Late response replaced current provider');return {selected:button.textContent,status:light.title,lateResponseIgnored:true};})()`],['screenshot','provider','minimax-after-stale-response.png'],['viewport','provider',1024,768],['eval','provider',`document.querySelector('.assistant-provider-button').click()`],['wait','provider',`!!document.querySelector('.assistant-provider-menu')`],['eval','provider',`(()=>{if(document.documentElement.scrollWidth>innerWidth+2)throw Error('Horizontal overflow');return document.querySelector('.assistant-provider-menu').innerText;})()`],['screenshot','provider','tablet-provider-options.png']]);
  if(errors.length)throw Error('Browser runtime errors');
  if(network.some(r=>r.method!=='GET'))throw Error('Unexpected model turn');
  if(network.filter(r=>r.url.endsWith('/api/minimax-ai')).length<2)throw Error('New MiniMax status was not requested');
}catch(error){failure=String(error);try{await run([['screenshot','provider','failure.png']]);}catch{}}
finally{
  if(sessionId)try{await socket.call('Fetch.disable',{},sessionId);}catch{}
  try{await batch.cleanup();cleanup=true;}catch(error){failure ||=String(error);}
  ws.close();
  await writeFile(output+'/result.json',JSON.stringify({host:hostname(),at:new Date().toISOString(),attempt,origin,processProof,version,network,errors,commands,receipts:batch.receipts,failure,cleanup,verdict:failure?'FAIL':'PASS'},null,2));
  console.log(JSON.stringify({attempt,verdict:failure?'FAIL':'PASS',failure,cleanup,operations:batch.receipts.length}));
}
if(failure)process.exitCode=1;
