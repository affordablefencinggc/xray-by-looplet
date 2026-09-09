// SC-21 tail: screenshot the rendered real-life view on the Render pane, then ask the assistant to take the
// design back out of the model viewer. Runs in the session that already mounted the designed model.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const replyDone = (timeout = "600000") => ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&(document.querySelectorAll('.assistant-chat-entry.is-assistant').length>(window.__replies||0)||document.querySelectorAll('.assistant-chat-error').length>(window.__errors||0))", "--timeout", timeout];
const counts = ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;window.__errors=document.querySelectorAll('.assistant-chat-error').length;return {replies:window.__replies,errors:window.__errors}})()"];
const setDraft = text => ["eval", `(()=>{const ta=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(text)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.length})()`];
const send = ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"];
const scenario = [
  // The render already happened in the main run; show it on the Render pane and photograph it.
  ["find", "role", "button", "click", "--name", "Render", "--exact"],
  ["wait", "--fn", "/LATEST AI RENDER|Latest AI render/i.test(document.body.textContent)", "--timeout", "30000"],
  ["eval", "(()=>{const c=document.querySelector('[aria-label=\"Collapse live assistant\"]');if(c)c.click();return 'panel collapsed'})()"],
  ["eval", "(()=>{const imgs=[...document.querySelectorAll('img')].map(i=>({alt:i.alt,w:i.naturalWidth,h:i.naturalHeight}));const img=[...document.querySelectorAll('img')].find(i=>i.naturalWidth>200&&i.naturalHeight>200);if(img)img.scrollIntoView({block:'center'});return {picked:img?{alt:img.alt,w:img.naturalWidth,h:img.naturalHeight}:null,imgs:imgs.slice(0,6)}})()"],
  ["screenshot", `${shots}/model-03-real-life-view.png`],
  // Back to the source building
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')"],
  setDraft("Take the design back out of the model viewer and show the source building again. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const hid=raw.find(t=>t.startsWith('hide_designed_model')&&/Tool result/.test(t));const status=document.querySelector('[data-model-status]')?.getAttribute('data-model-status');if(!hid)throw Error('No hide_designed_model receipt: '+raw.map(t=>t.slice(0,50)).join(' | '));if(status==='designed')throw Error('Viewer still shows the designed model');const rows=[...document.querySelectorAll('.assistant-tool-row')].map(r=>r.querySelector('.assistant-tool-title').textContent+' · '+r.querySelector('.assistant-tool-summary').textContent).slice(-2);return {hidden:true,status,rows,receipt:hid.slice(0,200)}})()"],
  ["find", "role", "button", "click", "--name", "Model", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.building-canvas')", "--timeout", "30000"],
  ["eval", "(()=>{const c=document.querySelector('[aria-label=\"Collapse live assistant\"]');if(c)c.click();return 'collapsed'})()"],
  ["screenshot", `${shots}/model-04-back-to-source.png`],
  ["errors"],
];
fs.writeFileSync(path.join(S, "modelmode-tail.json"), JSON.stringify(scenario, null, 1));
console.log("model mode tail scenario written");
