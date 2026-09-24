import fs from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { runNativeReadback } from './native-readback.mjs';
if (hostname().toLowerCase() !== 'daniel') throw Error('Explicitly authorized DANIEL campaign only');
const [root, run, port = '9353', email = 'false'] = process.argv.slice(2);
const receipts = [];
const browserErrors = [];
const workloadFile = path.resolve('proof/growth/2026-09-24-stability/native-workload.json');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.type === 'page' && /tauri|localhost/.test(t.url));
if (!target) throw Error('Native page not found');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown' || (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error')) browserErrors.push(message);
  const entry = pending.get(message.id);
  if (entry) { clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result); }
};
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 30000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function perform(command) {
  const [op, ...args] = command;
  if (op === 'eval') return evaluate(args[0]);
  if (op === 'wait') return evaluate(`new Promise((resolve,reject)=>{const start=performance.now();const check=()=>{try{if(${args[1]})return resolve(true)}catch{};if(performance.now()-start>${Number(args[3]) || 20000})return reject(Error('Wait failed: '+${JSON.stringify(args[1])}));requestAnimationFrame(check)};check()})`);
  if (op === 'find') return evaluate(`(()=>{const es=[...document.querySelectorAll('button,[role="button"]')].filter(e=>e.offsetParent&&(e.getAttribute('aria-label')||e.textContent).trim()===${JSON.stringify(args[4])});if(es.length!==1||es[0].disabled)throw Error('Button unavailable: '+${JSON.stringify(args[4])});es[0].click();return true})()`);
  if (op === 'select') return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(args[0])});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(args[1])});e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  if (op === 'mouse') {
    if (args[0] === 'move') { perform.point = { x: Number(args[1]), y: Number(args[2]) }; return call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...perform.point }); }
    return call('Input.dispatchMouseEvent', { type: args[0] === 'down' ? 'mousePressed' : 'mouseReleased', ...perform.point, button: 'left', clickCount: 1 });
  }
  if (op === 'upload') {
    const { root: document } = await call('DOM.getDocument');
    const { nodeId } = await call('DOM.querySelector', { nodeId: document.nodeId, selector: args[0] });
    return call('DOM.setFileInputFiles', { nodeId, files: [path.resolve('proof/growth/2026-09-23-quote-handover/AFGC-LOOPLET-CRM-RATES.csv')] });
  }
  if (op === 'screenshot') return 'intermediate capture omitted; final state captured per run';
  throw Error('Unsupported opcode ' + op);
}
try {
  await call('Runtime.enable');
  await call('Log.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const downloads = path.resolve(root, 'downloads-' + run);
  fs.mkdirSync(downloads, { recursive: true });
  await call('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const deadline = performance.now() + 25000;
  let result;
  for (let attempt = 0; ; attempt++) {
    try {
      result = await call('Runtime.evaluate', { expression: `new Promise((resolve,reject)=>{const start=performance.now();const check=()=>{if(document.querySelector('[data-hydration-status="ready"]'))return resolve({ready:document.readyState,hydration:'ready',at:performance.now()});if(performance.now()-start>${Math.max(1, deadline - performance.now())})return reject(Error('hydration deadline'));requestAnimationFrame(check)};check()})`, awaitPromise: true, returnByValue: true });
      break;
    } catch (error) {
      if (attempt >= 3 || performance.now() >= deadline || !/context.*destroyed|Cannot find context|target navigated/i.test(error.message)) throw error;
      receipts.push({ startupNavigationRetry: attempt + 1, reason: error.message });
    }
  }
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  fs.writeFileSync(path.join(root, `probe-${run}.json`), JSON.stringify({ target: target.url, result }, null, 2));
  await runNativeReadback({ call, evaluate, root });
  if (browserErrors.length) throw Error('Native browser error: ' + JSON.stringify(browserErrors));
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(root, `ready-${run}.png`), Buffer.from(shot.data, 'base64'));
} catch (error) {
  fs.writeFileSync(path.join(root, `probe-error-${run}.json`), JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
  const shot = await call('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (shot) fs.writeFileSync(path.join(root, `failed-${run}.png`), Buffer.from(shot.data, 'base64'));
  throw error;
} finally {
  fs.writeFileSync(path.join(root, `workload-${run}.json`), JSON.stringify(receipts, null, 2));
  fs.writeFileSync(path.join(root, `browser-errors-${run}.json`), JSON.stringify(browserErrors, null, 2));
  socket.close();
}
