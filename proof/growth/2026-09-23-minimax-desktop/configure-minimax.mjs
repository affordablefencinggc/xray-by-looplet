// Saves the user's MiniMax key from .env.local into the desktop app (app config folder) through its own command. Never prints the key.
import fs from 'node:fs'; import { parseEnv } from 'node:util';
const env = parseEnv(fs.readFileSync('.env.local', 'utf8')); const key = env.MINIMAX_API_KEY, model = env.MINIMAX_MODEL || 'MiniMax-M3';
if (!key) throw Error('MINIMAX_API_KEY missing');
const port = process.argv[2]; const t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page' && x.url.startsWith('http://tauri.localhost'));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
const expression = `(async()=>{const s=await window.__TAURI_INTERNALS__.invoke('xray_configure_minimax',{key:${JSON.stringify(key)},model:${JSON.stringify(model)}});return JSON.stringify(s)})()`;
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
const reply = await new Promise(r => ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id === 1) r(m); }));
ws.close(); const value = reply.result?.result?.value ?? 'error';
if (value.includes(key)) throw Error('status echoed key'); console.log(value);
