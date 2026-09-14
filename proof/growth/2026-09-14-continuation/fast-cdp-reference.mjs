/** Host-only, fail-fast JSON opcode batches over one hot browser CDP socket.
 * No worker should receive this socket: browser-level CDP owns every context.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { authorityCampaign } from './browser-authority.mjs';

class Socket {
  constructor(url) { this.url=url; this.pending=new Map(); this.id=0; }
  async connect() {
    this.ws=new WebSocket(this.url);
    await new Promise((yes,no)=>{
      const timer=setTimeout(()=>no(Error('CDP connection deadline')),8000);
      this.ws.addEventListener('open',()=>{clearTimeout(timer);yes();},{once:true});
      this.ws.addEventListener('error',()=>{clearTimeout(timer);no(Error('CDP connection failed'));},{once:true});
    });
    this.ws.addEventListener('message',({data})=>{
      const m=JSON.parse(data), p=this.pending.get(m.id); if(!p)return;
      clearTimeout(p.timer); this.pending.delete(m.id);
      m.error ? p.no(Error(m.error.message)) : p.yes(m.result);
    });
    this.ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.no(Error('CDP closed'));}this.pending.clear();});
  }
  call(method,params={},sessionId) {
    return new Promise((yes,no)=>{
      const id=++this.id;
      const timer=setTimeout(()=>{this.pending.delete(id);no(Error(method+' deadline'));},15000);
      this.pending.set(id,{yes,no,timer});
      this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  async evaluate(expression,sessionId) {
    const result=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
}

export class FastCdpBatch {
  constructor(socket,output) {this.socket=socket;this.output=resolve(output);this.contexts=new Map();this.receipts=[];}
  async run(commands) {
    for(const [op,...args] of commands) {
      const start=performance.now();
      let value;
      if(op==='authority') {
        value=await authorityCampaign(new FastCdpBatch(this.socket,this.output),args[0]);
      } else if(op==='context') {
        const [name]=args;
        if(this.contexts.has(name))throw Error('context already exists');
        const {browserContextId}=await this.socket.call('Target.createBrowserContext',{disposeOnDetach:true});
        this.contexts.set(name,{browserContextId});
        await this.socket.call('Browser.setDownloadBehavior',{behavior:'deny',browserContextId});
        const {targetId}=await this.socket.call('Target.createTarget',{url:'about:blank',browserContextId});
        const {sessionId}=await this.socket.call('Target.attachToTarget',{targetId,flatten:true});
        this.contexts.set(name,{browserContextId,targetId,sessionId});
        await this.socket.call('Page.enable',{},sessionId);
        value={created:name};
      } else {
        const [name,...rest]=args, context=this.contexts.get(name);
        if(!context)throw Error('unknown context '+name);
        if(op==='navigate') {
          value=await this.socket.call('Page.navigate',{url:rest[0]},context.sessionId);
          if(value.errorText)throw Error(value.errorText);
        } else if(op==='wait') {
          const predicate=rest[0];
          value=await this.socket.evaluate(`new Promise((resolve,reject)=>{let observer,timer;const clean=()=>{observer?.disconnect();clearTimeout(timer)};const check=()=>{try{if(${predicate}){clean();resolve(true);return true}}catch(e){clean();reject(e);return true}};if(check())return;observer=new MutationObserver(check);observer.observe(document,{subtree:true,childList:true,attributes:true});timer=setTimeout(()=>{clean();reject(Error('readiness deadline'))},10000)})`,context.sessionId);
        } else if(op==='eval') {
          value=await this.socket.evaluate(rest[0],context.sessionId);
        } else if(op==='screenshot') {
          const file=rest[0];
          if(!/^[a-zA-Z0-9_-]+\.png$/.test(file))throw Error('invalid proof filename');
          const {data}=await this.socket.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},context.sessionId);
          const bytes=Buffer.from(data,'base64');
          await writeFile(join(this.output,file),bytes);
          value={eventId:randomUUID(),context:name,targetId:context.targetId,file,sha256:createHash('sha256').update(bytes).digest('hex')};
        } else if(op==='dispose') {
          await this.socket.call('Target.disposeBrowserContext',{browserContextId:context.browserContextId});
          this.contexts.delete(name);value={disposed:name};
        } else throw Error('unsupported opcode '+op);
      }
      this.receipts.push({op,args:args.slice(0,1),elapsedMs:performance.now()-start,value});
    }
  }
  async cleanup(){for(const {browserContextId} of this.contexts.values())await this.socket.call('Target.disposeBrowserContext',{browserContextId});this.contexts.clear();}
}

const seed=`(async()=>{
  document.cookie='ledger_canary=attempt_A; path=/';
  localStorage.setItem('ledger_canary','attempt_A');sessionStorage.setItem('ledger_canary','attempt_A');
  const cache=await caches.open('ledger_canary');await cache.put('/canary',new Response('attempt_A'));
  await new Promise((resolve,reject)=>{const r=indexedDB.open('ledger_canary',1);r.onupgradeneeded=()=>r.result.createObjectStore('items');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('items','readwrite');tx.objectStore('items').put('attempt_A','key');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});
  await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
  document.querySelector('#state').textContent='Attempt A: private state seeded';document.body.dataset.seeded='true';
  return {cookie:document.cookie,storage:true,cache:true,indexedDB:true,serviceWorker:true};
})()`;
const clean=`(async()=>{
  const checks={cookies:!document.cookie.includes('ledger_canary'),localStorage:localStorage.getItem('ledger_canary')===null,sessionStorage:sessionStorage.getItem('ledger_canary')===null,cacheStorage:!(await caches.keys()).includes('ledger_canary'),indexedDB:!(await indexedDB.databases()).some(x=>x.name==='ledger_canary'),serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length===0};
  for(const [name,pass] of Object.entries(checks))if(!pass)throw Error('Isolation escape: '+name);
  document.querySelector('#state').textContent='Fresh attempt: all six storage checks passed';document.body.dataset.verified='true';return checks;
})()`;

export function isolationCommands(iterations,url='{{ORIGIN}}') {
  let commands=[];const ready="document.body?.dataset.hydrationStatus==='ready'";
  for(let i=0;i<iterations;i++) {
    commands.push(['context','A'],['navigate','A',url],['wait','A',ready]);
    if(i===0)commands.push(['screenshot','A','before-attempt-a.png']);
    commands.push(['eval','A',seed],['context','B'],['navigate','B',url],['wait','B',ready],['eval','B',clean]);
    if(i===0)commands.push(['screenshot','A','after-attempt-a.png'],['screenshot','B','isolated-attempt-b.png']);
    commands.push(['eval','A',"if(localStorage.getItem('ledger_canary')!=='attempt_A')throw Error('Control lost seeded state');true"],['dispose','A'],['dispose','B']);
  }
  return commands;
}

async function main() {
  if(process.argv[2]==='--generate-authority') {process.stdout.write(JSON.stringify([['authority','{{ORIGIN}}']]));return;}
  if(['--generate','--generate-combined'].includes(process.argv[2])) {
    const n=Number(process.argv[3]);if(!Number.isInteger(n)||n<1||n>10000)throw Error('invalid iterations');
    const commands=isolationCommands(n);
    if(process.argv[2]==='--generate-combined')commands.push(['authority','{{ORIGIN}}']);
    process.stdout.write(JSON.stringify(commands));return;
  }
  const [activePortFile,output='proof/browser',count='1',inputMode]=process.argv.slice(2);
  if(!activePortFile)throw Error('Usage: node scripts/fast-cdp.mjs DevToolsActivePort output [iterations]');
  const iterations=Number(count);if(!Number.isInteger(iterations)||iterations<1||iterations>10000)throw Error('invalid iterations');
  await mkdir(output,{recursive:true});
  const [port,path]=(await readFile(activePortFile,'utf8')).trim().split(/\r?\n/);
  const socket=new Socket(`ws://127.0.0.1:${port}${path}`);await socket.connect();
  const browserVersion=await socket.call('Browser.getVersion');
  const sourceHashes={};
  for(const name of ['fast-cdp.mjs','browser-authority.mjs','run-fast-cdp.ps1'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex');
  await writeFile(join(output,'browser-run-binding.json'),JSON.stringify({host:hostname(),node:process.version,browserVersion,sourceHashes,release_authorized:false},null,2));
  const server=createServer((req,res)=>{
    if(req.url==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Atomic Ledger isolation fixture</title><style>body{font:20px system-ui;background:#101827;color:#edf4ff;padding:48px}h1{font-size:36px}section{padding:28px;border:1px solid #466080;border-radius:12px}p{line-height:1.6}</style></head><body data-hydration-status="ready"><h1>Atomic Ledger · browser isolation</h1><section><p id="state">Clean attempt ready</p><p>Cookie · local storage · session storage · cache · IndexedDB · service worker</p><input id="entry" aria-label="Scoped input"><button id="apply" onclick="document.querySelector('#state').textContent=document.querySelector('#entry').value">Apply</button></section></body></html>`);
  });
  await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
  const url=`http://127.0.0.1:${server.address().port}/`, batch=new FastCdpBatch(socket,output);
  let commands=isolationCommands(iterations,url);
  if(inputMode==='--stdin') {
    let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>32_000_000)throw Error('batch byte quota exceeded');}
    commands=JSON.parse(text);
    if(!Array.isArray(commands))throw Error('batch must be an opcode array');
    commands=commands.map(op=>op.map(value=>typeof value==='string'?value.replaceAll('{{ORIGIN}}',url):value));
  }
  await writeFile(join(output,'scenario.json'),JSON.stringify(commands,null,2));
  const started=performance.now();
  let error;
  let launchArguments, sandboxDiagnostics;
  try {
    if(process.env.CDP_REQUIRE_SANDBOX==='1') {
      ({arguments:launchArguments}=await socket.call('Browser.getBrowserCommandLine'));
      if(!Array.isArray(launchArguments)||launchArguments.some(x=>/^--(no-sandbox|disable-setuid-sandbox|single-process|disable-seccomp-filter-sandbox|disable-gpu-sandbox)(=|$)/.test(x)))throw Error('unsafe browser launch configuration');
      await batch.run([['context','supervisor'],['navigate','supervisor','chrome://sandbox/'],['wait','supervisor',"document.readyState==='complete' && /Lockdown/.test(document.body?.innerText)"],['eval','supervisor','document.body.innerText'],['screenshot','supervisor','browser-sandbox.png']]);
      sandboxDiagnostics=batch.receipts.at(-2).value;
      await batch.run([['dispose','supervisor']]);
      await writeFile(join(output,'sandbox-diagnostics.txt'),sandboxDiagnostics);
      await writeFile(join(output,'browser-launch.json'),JSON.stringify({launchArguments,sandboxDiagnostics},null,2));
      await writeFile(join(output,'network-sandbox-histograms.json'),JSON.stringify(await socket.call('Browser.getHistograms',{query:'NetworkSandbox'}),null,2));
      const processLines=sandboxDiagnostics.split('\n').filter(x=>/^\d+\t/.test(x));
      const renderers=processLines.filter(x=>x.split('\t')[1]==='Renderer');
      if(!renderers.length||renderers.some(x=>!x.includes('\tLockdown\t')||!x.includes('Untrusted')))throw Error('renderer lockdown not proved');
      if(processLines.some(x=>x.includes('Not Sandboxed')))throw Error('unsandboxed browser subprocess');
      batch.receipts=[];
    }
    await batch.run(commands);
  }catch(e){error=e;}
  finally {
    try{await batch.cleanup();}catch(e){error ||= e;}
    socket.ws.close();await new Promise(yes=>server.close(yes));
    const report={method:'Fast CDP hot-socket declarative opcode batch; fail-fast; reactive readiness',browserSandbox:process.env.CDP_BROWSER_SANDBOX||'unverified',iterations,completedOps:batch.receipts.length,plannedOps:commands.length,elapsedMs:performance.now()-started,verdict:error?(/Isolation escape|Authority escape|Control lost/.test(error.message)?'FAIL':'INFRA_FAILURE'):'PASS',limitations:['Browser-level CDP is host authority, not a worker capability','No clipboard, download-content, OS process, secret or network-egress isolation proof','Tests use a local controlled fixture, not a production app'],error:error?.message,receipts:batch.receipts};
    await writeFile(join(output,'browser-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({...report,receipts:undefined}));
  }
  if(error)throw error;
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e);process.exitCode=1;});
