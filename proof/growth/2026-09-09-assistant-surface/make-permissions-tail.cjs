// SC-20 tail: read-only refuses a drawing request without prompting; "Edit freely" draws without prompting.
// Run after the ask-mode leg (make-permissions-scenario.cjs); starts from a fresh page in the same session.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const hydrated = ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"];
const replyDone = (timeout = "600000") => ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&(document.querySelectorAll('.assistant-chat-entry.is-assistant').length>(window.__replies||0)||document.querySelectorAll('.assistant-chat-error').length>(window.__errors||0))", "--timeout", timeout];
const counts = ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;window.__errors=document.querySelectorAll('.assistant-chat-error').length;return {replies:window.__replies,errors:window.__errors}})()"];
const setDraft = text => ["eval", `(()=>{const ta=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(text)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.length})()`];
const send = ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"];
const setMode = label => ["eval", `(()=>{const b=[...document.querySelectorAll('.assistant-permission [role=radio]')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('No mode button: ' + ${JSON.stringify(label)});b.click();return 'mode ' + ${JSON.stringify(label)}})()`];
const openPanel = [
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')||!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ["eval", "(()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(x=>x.textContent.trim()==='Architectural workspace');if(b)b.click();return 'workspace'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
  ["eval", "(()=>{window.confirm=()=>true;return 'confirm auto-accepted'})()"],
  ["find", "role", "button", "click", "--name", "Load demonstration", "--exact"],
  ["wait", "--fn", "document.querySelectorAll('.architect-plan [data-entity-id]').length>4"],
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')&&!!document.querySelector('.assistant-permission[role=radiogroup]')"],
];
const wallCount = "JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(document.querySelector('.architect-workspace').dataset.designId))).walls.length";
const scenario = [
  ["open", "http://127.0.0.1:8091/", "--timeout", "120000"],
  ["set", "viewport", "1280", "800"],
  hydrated,
  ...openPanel,
  // Read only: the request is refused by the gate, no prompt, no geometry.
  setMode("Read only"),
  ["wait", "--fn", "document.querySelector('.assistant-permission [role=radio][aria-checked=true]')?.textContent.trim()==='Read only'"],
  ["eval", `(()=>{window.__wallsBefore=${wallCount};return {walls:window.__wallsBefore,mode:localStorage.getItem('xray:assistant-permissions:v1')}})()`],
  setDraft("Draw a wall from (0, 0) to (0, 3000) on the Ground level, 2700 mm high, in Sketch mode. If you cannot, say why in one sentence."),
  counts,
  send,
  replyDone(),
  ["eval", `(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const refused=raw.some(t=>/Read-only mode/.test(t));const walls=${wallCount};const reply=([...document.querySelectorAll('.assistant-chat-entry.is-assistant')].at(-1)?.textContent||'').slice(0,300);if(walls!==window.__wallsBefore)throw Error('A wall was drawn in read-only mode: '+walls+' vs '+window.__wallsBefore);if(document.querySelector('.assistant-permission-card'))throw Error('Read-only mode should not prompt');const rows=[...document.querySelectorAll('.assistant-tool-row')].map(r=>r.querySelector('.assistant-tool-title').textContent+' · '+r.querySelector('.assistant-tool-summary').textContent);return {refusedReceipt:refused,walls,reply,rows:rows.slice(-3)}})()`],
  ["screenshot", `${shots}/perm-tail-01-read-only.png`],
  // Edit freely: no prompt, the wall appears, the mirror checkbox mirrors the mode.
  setMode("Edit freely"),
  ["wait", "--fn", "document.querySelector('.assistant-permission input')?.checked===true"],
  ["eval", `(()=>{window.__wallsBefore=${wallCount};return {walls:window.__wallsBefore,mode:localStorage.getItem('xray:assistant-permissions:v1'),mirror:document.querySelector('.assistant-permission input').checked}})()`],
  setDraft("Now draw that wall from (0, 0) to (0, 3000) on the Ground level, 2700 mm high, in Sketch mode. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", `(()=>{const walls=${wallCount};if(walls<=window.__wallsBefore)throw Error('Edit freely did not draw: '+walls+' vs '+window.__wallsBefore);if(document.querySelector('.assistant-permission-card'))throw Error('Edit freely should not prompt');const rows=[...document.querySelectorAll('.assistant-tool-row')].map(r=>r.querySelector('.assistant-tool-title').textContent+' · '+r.querySelector('.assistant-tool-summary').textContent);return {walls,before:window.__wallsBefore,rows:rows.slice(-2)}})()`],
  ["screenshot", `${shots}/perm-tail-02-edit-freely.png`],
  setMode("Ask before edits"),
  ["errors"],
];
fs.writeFileSync(path.join(S, "permissions-tail.json"), JSON.stringify(scenario, null, 1));
console.log("permissions tail scenario written");
