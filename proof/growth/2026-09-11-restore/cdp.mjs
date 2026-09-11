import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
if (os.hostname().toLowerCase() !== 'dans1') throw Error('DANS1 required');
const [scenario, output] = process.argv.slice(2);
await fs.mkdir(output, { recursive: true });
const bytes = await fs.readFile(scenario), commands = JSON.parse(bytes);
const version = await (await fetch('http://127.0.0.1:9337/json/version')).json();
const endpoint = new URL(version.webSocketDebuggerUrl);
if (endpoint.hostname !== '127.0.0.1' || endpoint.port !== '9337') throw Error('Unexpected CDP endpoint');
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let seq = 0, sessionId, contextId, fixture, peerTarget;
const pending = new Map(), errors = [], receipts = [];
ws.addEventListener('message', ({data}) => {
  const m = JSON.parse(data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  const p = pending.get(m.id); if (!p) return;
  pending.delete(m.id); clearTimeout(p.timer);
  m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
});
function call(method, params = {}, browser = false, targetSession) {
  return new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 240000);
    pending.set(id, {resolve, reject, timer});
    ws.send(JSON.stringify({id, method, params, ...(!browser && sessionId ? {sessionId: targetSession || sessionId} : {})}));
  });
}
async function evaluate(expression) {
  // Vite adds HMR timestamps. Import the URL actually loaded by the app so QA never
  // creates a second store instance by importing an older, unversioned module URL.
  expression = expression.replace(/import\((['"])(\/src\/[^'"]+)\1\)/g, (_match,_quote,modulePath) =>
    `import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===${JSON.stringify(modulePath)}).at(-1)?.name||${JSON.stringify(modulePath)})`);
  const r = await call('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
let failure;
try {
  ({browserContextId: contextId} = await call('Target.createBrowserContext', {}, true));
  const {targetId} = await call('Target.createTarget', {url:'about:blank', browserContextId:contextId}, true);
  ({sessionId} = await call('Target.attachToTarget', {targetId, flatten:true}, true));
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width:1280, height:800, deviceScaleFactor:1, mobile:false});
  for (const [op, arg, extra] of commands) {
    const start = performance.now(); let value;
    if (op === 'navigate' || op === 'reload-action') {
      const loaded = new Promise((resolve,reject)=>{
        const listener=({data})=>{const m=JSON.parse(data);if(m.sessionId===sessionId&&m.method==='Page.loadEventFired'){clearTimeout(timer);ws.removeEventListener('message',listener);resolve();}};
        const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('Page load deadline'));},90000);
        ws.addEventListener('message',listener);
      });
      if (op === 'navigate') {
        value = await call('Page.navigate', {url:arg}); if(value.errorText) throw Error(value.errorText);
      } else {
        try { value = await evaluate(arg); }
        catch (error) { if (!/Inspected target navigated|Execution context was destroyed/.test(String(error))) throw error; }
      }
      await loaded;
    }
    else if (op === 'new-context') {
      if(peerTarget)throw Error('Close peer before switching context');
      await call('Target.disposeBrowserContext',{browserContextId:contextId},true);
      ({browserContextId:contextId}=await call('Target.createBrowserContext',{},true));
      const {targetId}=await call('Target.createTarget',{url:'about:blank',browserContextId:contextId},true);
      ({sessionId}=await call('Target.attachToTarget',{targetId,flatten:true},true));
      await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});value={freshStorage:true};
    }
    else if (op === 'open-peer') {
      if (peerTarget) throw Error('Peer already open');
      ({targetId: peerTarget} = await call('Target.createTarget', {url:'about:blank',browserContextId:contextId},true));
      const {sessionId: peerSession} = await call('Target.attachToTarget',{targetId:peerTarget,flatten:true},true);
      await call('Page.enable',{},false,peerSession); await call('Runtime.enable',{},false,peerSession);
      const loaded = new Promise((resolve,reject)=>{
        const listener=({data})=>{const m=JSON.parse(data);if(m.sessionId===peerSession&&m.method==='Page.loadEventFired'){clearTimeout(timer);ws.removeEventListener('message',listener);resolve();}};
        const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('Peer page load deadline'));},90000);ws.addEventListener('message',listener);
      });
      await call('Page.navigate',{url:arg},false,peerSession); await loaded;
      const ready = await call('Runtime.evaluate',{expression:`new Promise((resolve,reject)=>{const end=performance.now()+90000;function check(){if(document.querySelector('[data-hydration-status]')?.dataset.hydrationStatus==='ready')return resolve(true);if(performance.now()>end)return reject(Error('Peer hydration deadline'));requestAnimationFrame(check)}check()})`,awaitPromise:true,returnByValue:true},false,peerSession);
      if(ready.exceptionDetails || ready.result.value!==true)throw Error('Peer editor did not hydrate');
      await call('Page.bringToFront');value={peerTarget,editorHydrated:true};
    }
    else if (op === 'close-peer') { if(!peerTarget)throw Error('No peer');await call('Target.closeTarget',{targetId:peerTarget},true);peerTarget=undefined;value=true; }
    else if (op === 'eval') value = await evaluate(arg);
    else if (op === 'capture-fixture') { fixture=await evaluate(arg);value=fixture; }
    else if (op === 'eval-fixture') value=await evaluate(`(${arg})(${JSON.stringify(fixture)})`);
    else if (op === 'viewport') {
      if(!Array.isArray(arg)||!arg.slice(0,2).every(Number.isInteger))throw Error('Invalid viewport');
      await call('Emulation.setDeviceMetricsOverride',{width:arg[0],height:arg[1],deviceScaleFactor:1,mobile:false});
      await call('Emulation.setTouchEmulationEnabled',{enabled:!!arg[2]}); value=arg;
    }
    else if (op === 'wait') value = await evaluate(`new Promise((resolve,reject)=>{const end=performance.now()+${extra||90000}; function check(){try{if(${arg})return resolve(true);if(performance.now()>end)return reject(Error('Readiness deadline'));requestAnimationFrame(check)}catch(e){reject(e)}}check()})`);
    else if (op === 'screenshot') {
      if (!/^[\w.-]+\.png$/.test(arg)) throw Error('Unsafe screenshot path');
      const shot = Buffer.from((await call('Page.captureScreenshot', {format:'png'})).data, 'base64');
      await fs.writeFile(path.join(output,arg),shot); value={file:arg,sha256:createHash('sha256').update(shot).digest('hex')};
    } else if (op === 'errors') { if(errors.length) throw Error(errors.join('\n')); value=[]; }
    else throw Error('Unknown opcode '+op);
    receipts.push({op, value, ms:performance.now()-start});
    await fs.writeFile(path.join(output,'progress.json'),JSON.stringify(receipts,null,2));
  }
} catch (e) {
  failure=e.stack;
  try { await fs.writeFile(path.join(output,'failure-state.json'),JSON.stringify(await evaluate('window.audit?.results ?? null'),null,2)); } catch {}
  try { await fs.writeFile(path.join(output,'failure-page.txt'),await evaluate('document.body.innerText')); await fs.writeFile(path.join(output,'failure.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64')); } catch {}
}
finally {
  if(contextId) { try { await call('Target.disposeBrowserContext',{browserContextId:contextId},true); } catch(e) { failure=(failure||'')+'\nCleanup: '+e.message; } }
  ws.close();
}
const result={host:os.hostname(),browser:version.Browser,scenarioSha256:createHash('sha256').update(bytes).digest('hex'),planned:commands.length,completed:receipts.length,pass:!failure,errors,failure,receipts};
await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({host:result.host,pass:result.pass,completed:result.completed,planned:result.planned,failure,output}));
process.exitCode=failure?1:0;
