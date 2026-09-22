// Diagnostic: pauses on every exception while one assistant message is sent, records non-Error throws, always resumes.
const targets = await (await fetch('http://127.0.0.1:9292/json/list')).json();
const t = targets.find(x => x.type === 'page' && x.url.startsWith('http://tauri.localhost'));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const seen = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', async ev => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Debugger.paused') { const d = m.params.data || {}; const top = m.params.callFrames?.[0];
    seen.push({ reason: m.params.reason, type: d.type, subtype: d.subtype, className: d.className, description: String(d.description ?? d.value ?? '').slice(0, 500), at: top ? `${top.functionName}@${top.url.split('/').pop()}:${top.location.lineNumber}` : '' });
    send('Debugger.resume'); } });
await send('Debugger.enable'); await send('Debugger.setPauseOnExceptions', { state: 'all' });
const script = `(()=>{const p=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(p,'Read only. What is the net length of Run 02? One line.');p.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>document.querySelector('[aria-label="Send assistant message"]').click(),200);return 'sent'})()`;
console.log((await send('Runtime.evaluate', { expression: script, returnByValue: true })).result?.result?.value);
const deadline = Date.now() + 180000;
while (Date.now() < deadline) { await new Promise(r => setTimeout(r, 2000));
  const st = await send('Runtime.evaluate', { expression: "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&document.querySelectorAll('.assistant-chat-error').length+document.querySelectorAll('.assistant-chat-entry.is-assistant').length", returnByValue: true });
  if (st.result?.result?.value >= 3) break; }
await send('Debugger.setPauseOnExceptions', { state: 'none' }); await send('Debugger.disable');
console.log(JSON.stringify(seen.filter(s => s.subtype !== 'error' || /assistant|invoke|provider|gemini|mcp/i.test(s.description)).slice(-25), null, 1));
ws.close();
