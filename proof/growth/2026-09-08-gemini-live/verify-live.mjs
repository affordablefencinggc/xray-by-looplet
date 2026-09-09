import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { once } from 'node:events';
import { assistantAiTurn } from '../../../src/lib/assistantAi.server.ts';
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
env.XRAY_AI_WEB_ENABLED = 'true';
const targets = await (await fetch('http://127.0.0.1:9273/json/list')).json();
const target = targets.find(t => t.type === 'page' && t.url.startsWith('http://tauri.localhost'));
if (!target) throw Error('Native target missing');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await once(socket, 'open');
let id = 0;
const records = [];
async function native(request) {
  const requestId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(Error('Native live verification timed out')); }, 125000);
    function listener(event) {
      const message = JSON.parse(event.data);
      if (message.id !== requestId) return;
      clearTimeout(timer); socket.removeEventListener('message', listener);
      if (message.error || message.result?.exceptionDetails) reject(Error('Native live provider request failed; details omitted'));
      else resolve(message.result.result.value);
    }
    socket.addEventListener('message', listener);
    const expression = `window.__TAURI_INTERNALS__.invoke('xray_assistant_turn',{requestJson:${JSON.stringify(JSON.stringify(request))}}).then(value=>({ok:true,value}),error=>({ok:false,error:String(error)}))`;
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
}
try {
  for (const transport of ['native', 'web-server-function']) {
    for (const search of [false, true]) {
      const request = { schema: 'xray.assistant-request/v1', requestId: crypto.randomUUID(), contents: [{ role: 'user', parts: [{ text: search ? 'Search the web for the official Google Gemini API documentation. Return one short sentence and cite the official source. Do not discuss project data.' : 'Reply exactly: X-Ray Gemini live connection verified.' }] }], declarations: [], webSearch: search };
      const started = Date.now();
      let result;
      try { result = transport === 'native' ? await native(request) : { ok: true, value: await assistantAiTurn(JSON.stringify(request), { env }) }; }
      catch (error) { result = { ok: false, error: error instanceof Error ? error.message : 'Live call failed' }; }
      const record = { transport, search, at: new Date().toISOString(), elapsedMs: Date.now()-started, ...result };
      const encoded = JSON.stringify(record);
      if ([env.GEMINI_API_KEY, env.GOOGLE_API_KEY].filter(Boolean).some(key => encoded.includes(key))) throw Error('Credential output rejected');
      records.push(record);
      fs.writeFileSync('proof/growth/2026-09-08-gemini-live/live-results.json', JSON.stringify(records, null, 2));
      console.log(JSON.stringify(record));
      if (!result.ok) { process.exitCode = 1; break; }
    }
  }
} finally { socket.close(); }
