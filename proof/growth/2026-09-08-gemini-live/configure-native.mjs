import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { once } from 'node:events';
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
let input = '';
for await (const chunk of process.stdin) input += chunk;
const value = input.trim();
const parsed = value.includes('=') ? parseEnv(value) : {};
const key = parsed.GEMINI_API_KEY || parsed.GOOGLE_API_KEY || value;
if (!/^AIza[A-Za-z0-9_-]{30,100}$/.test(key)) {
  console.log(JSON.stringify({ configured: false, reason: 'Clipboard does not contain a recognized Google API key. Clipboard content was not logged or saved.' }));
  process.exit(1);
}
const model = env.XRAY_AI_MODEL || 'gemini-3.8-flash';
if (!/^gemini-[A-Za-z0-9._-]{1,100}$/.test(model)) throw Error('Invalid model configuration');
const targets = await (await fetch('http://127.0.0.1:9273/json/list')).json();
const target = targets.find(t => t.type === 'page' && t.url.startsWith('http://tauri.localhost'));
if (!target) throw Error('X-Ray native target unavailable');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await once(socket, 'open');
let id = 0;
async function evaluate(expression) {
  const requestId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(Error('Native configuration timed out')); }, 15000);
    function listener(event) {
      const message = JSON.parse(event.data);
      if (message.id !== requestId) return;
      clearTimeout(timer); socket.removeEventListener('message', listener);
      if (message.error || message.result?.exceptionDetails) reject(Error('Native configuration failed; provider diagnostics omitted'));
      else resolve(message.result.result.value);
    }
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
}
try {
  const status = await evaluate(`(async()=>{const invoke=window.__TAURI_INTERNALS__.invoke;await invoke('xray_configure_material_ai',{key:${JSON.stringify(key)},model:${JSON.stringify(model)}});return invoke('xray_assistant_status')})()`);
  const record = { at: new Date().toISOString(), source: 'user-authorized clipboard', model: status.model, configured: status.configured, available: status.available, credentialsVerified: false, clipboardMatchesEnvFile: key === env.GEMINI_API_KEY, persistence: 'native process memory only' };
  fs.writeFileSync('proof/growth/2026-09-08-gemini-live/native-configuration.json', JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record));
} finally { socket.close(); }
