// Showcase tail re-run: back to the Architectural workspace (the Sketch pane opens on its workspace picker), then the
// DXF + IFC exports with hash receipts. Reuses the session that holds the finished design.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const replyDone = (timeout = "840000") => ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&(document.querySelectorAll('.assistant-chat-entry.is-assistant').length>(window.__replies||0)||document.querySelectorAll('.assistant-chat-error').length>(window.__errors||0))", "--timeout", timeout];
const counts = ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;window.__errors=document.querySelectorAll('.assistant-chat-error').length;return {replies:window.__replies,errors:window.__errors}})()"];
const setDraft = text => ["eval", `(()=>{const ta=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(text)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.length})()`];
const allowEdits = ["eval", "(()=>{const c=document.querySelector('.assistant-permission input');if(!c.checked)c.click();if(!c.checked)throw Error('Permission not enabled');return 'edits allowed'})()"];
const send = ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"];
const continueIfFull = [
  ["eval", "(()=>{const b=document.querySelector('.assistant-context-banner.assistant-context-full button.assistant-continue-chat');if(b){b.click();return 'continued in a new chat'}return 'chat not full'})()"],
  ["wait", "--fn", "!document.querySelector('.assistant-context-banner.assistant-context-full')&&!document.querySelector('#live-assistant-prompt')?.disabled&&!document.querySelector('.assistant-permission input')?.disabled", "--timeout", "20000"],
];
const designStats = "(()=>{const w=document.querySelector('.architect-workspace');const d=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(w.dataset.designId)));return {name:d.name,revision:d.revision,levels:d.levels.map(l=>l.name+'@'+l.elevation),walls:d.walls.length,doors:d.openings.filter(o=>o.kind==='door').length,windows:d.openings.filter(o=>o.kind==='window').length,rooms:d.roomTags.length,slabs:d.slabs.length,roofs:d.roofs.map(r=>r.edges.map(e=>e.gable?'g':e.pitch).join('/'))}})()";
const exportsRun = [
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')||!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
  ["eval", "(()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace');if(b)b.click();return b?'opened workspace':'workspace already open'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')", "--timeout", "5000"],
  ...continueIfFull,
  allowEdits,
  setDraft("Export this design as DXF and as IFC and give me the sha256 and byte length of each file. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent).filter(t=>t.startsWith('export_design_file')&&/Tool result/.test(t));const hashes=tools.map(t=>(t.match(/\"sha256\":\"([a-f0-9]{64})\"/)||[])[1]).filter(Boolean);const bytes=tools.map(t=>(t.match(/\"byteLength\":(\\d+)|\"bytes\":(\\d+)/)||[])[0]).filter(Boolean);if(hashes.length<2)throw Error('Expected two export receipts with sha256, got '+hashes.length+' — '+tools.map(t=>t.slice(0,160)).join(' | '));return {receipts:tools.length,hashes,bytes,reply:[...document.querySelectorAll('.assistant-chat-entry.is-assistant')].at(-1)?.textContent.slice(0,500)}})()"],
  ["screenshot", `${shots}/showcase-06-exports.png`],
  ["eval", designStats],
  ["errors"],
];
fs.writeFileSync(path.join(S, "showcase-exports.json"), JSON.stringify(exportsRun, null, 1));
console.log("showcase-exports written");
