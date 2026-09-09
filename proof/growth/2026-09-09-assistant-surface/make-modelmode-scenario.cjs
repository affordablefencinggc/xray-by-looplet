// SC-21 Model mode: the assistant puts the current design into the Model pane's 3D viewer, the Magic Pencil
// draws it, the assistant captures it and renders a real-life view, then returns the viewer to its source building.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const hydrated = ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"];
const replyDone = (timeout = "600000") => ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&(document.querySelectorAll('.assistant-chat-entry.is-assistant').length>(window.__replies||0)||document.querySelectorAll('.assistant-chat-error').length>(window.__errors||0))", "--timeout", timeout];
const counts = ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;window.__errors=document.querySelectorAll('.assistant-chat-error').length;return {replies:window.__replies,errors:window.__errors}})()"];
const setDraft = text => ["eval", `(()=>{const ta=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(text)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.length})()`];
const send = ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"];
// Model mode and the render are view tools, but the design edit that seeds the demo needs edits: use "Edit freely".
const editFreely = ["eval", "(()=>{const b=[...document.querySelectorAll('.assistant-permission [role=radio]')].find(x=>x.textContent.trim()==='Edit freely');if(!b)throw Error('No permission control');b.click();return 'edit freely'})()"];
const scenario = [
  ["open", "http://127.0.0.1:8091/", "--timeout", "120000"],
  ["set", "viewport", "1280", "800"],
  hydrated,
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')"],
  ["eval", "(()=>{[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace').click();return 'opened'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ["eval", "(()=>{window.confirm=()=>true;return 'confirm auto-accepted'})()"],
  ["find", "role", "button", "click", "--name", "Load demonstration", "--exact"],
  ["wait", "--fn", "document.querySelectorAll('.architect-plan [data-entity-id]').length>4"],
  ["eval", "(()=>{const d=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(document.querySelector('.architect-workspace').dataset.designId)));return {name:d.name,walls:d.walls.length,openings:d.openings.length,levels:d.levels.length,roofs:d.roofs.length}})()"],
  ["eval", "(()=>{document.querySelector('.live-assistant-launcher').click();return 'opened panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')"],
  editFreely,
  // 1. Ask for Model mode by name
  setDraft("Show this design in Model mode — put it into the 3D model viewer so I can see it as a building. Then tell me how many objects it has."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const shown=raw.find(t=>t.startsWith('show_design_in_model')&&/Tool result/.test(t));const errors=[...document.querySelectorAll('.assistant-chat-error')].map(e=>e.textContent.slice(0,160));if(!shown)throw Error('No show_design_in_model receipt. errors='+errors.join('|')+' tools='+raw.map(t=>t.slice(0,60)).join(' | '));if(!/\"origin\":\"designed\"/.test(shown))throw Error('Receipt does not declare origin designed');if(!/\"evidence\":\"inferred\"/.test(shown))throw Error('Receipt does not declare inferred evidence');const rows=[...document.querySelectorAll('.assistant-tool-row')].map(r=>r.querySelector('.assistant-tool-title').textContent+' · '+r.querySelector('.assistant-tool-summary').textContent);return {receipt:shown.slice(0,300),rows:rows.slice(-4)}})()"],
  ["wait", "--fn", "!!document.querySelector('.building-canvas canvas')&&Number(document.querySelector('.building-canvas canvas').dataset.meshCount||0)>0", "--timeout", "60000"],
  ["eval", "(()=>{const c=document.querySelector('.building-canvas canvas');const status=document.querySelector('[data-model-status]')?.getAttribute('data-model-status');const heading=document.querySelector('.building-stage h1,.building-workspace h1')?.textContent;if(status!=='designed')throw Error('Viewer is not showing the designed model: '+status);return {meshCount:Number(c.dataset.meshCount),sourceSha256:(c.dataset.sourceSha256||'').slice(0,12),status,heading}})()"],
  ["screenshot", `${shots}/model-01-designed-in-viewer.png`],
  // 2. Magic Pencil draws the designed model
  setDraft("Draw it with the Magic Pencil so I can watch it being drawn, then tell me the phase it reached."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const drafts=raw.filter(t=>/^(control_draftsman|read_draftsman_status)/.test(t)&&/Tool result/.test(t));if(!drafts.length)throw Error('No draftsman receipt on the designed model');const designed=drafts.some(t=>/\"id\":\"designed\"/.test(t));const c=document.querySelector('.building-canvas canvas');return {receipts:drafts.length,mentionsDesigned:designed,frameCount:Number(c.dataset.frameCount||0),sample:drafts[0].slice(0,220)}})()"],
  ["screenshot", `${shots}/model-02-magic-pencil.png`],
  // 3. Real-life view of the designed model (web only)
  setDraft("Now generate a real life view of this model as it would look when built. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const r=raw.find(t=>t.startsWith('generate_render_visualisation')&&/Tool result/.test(t));if(!r||!/\"rendered\":true/.test(r))throw Error('No render receipt: '+raw.filter(t=>t.startsWith('generate_render')).map(t=>t.slice(0,200)).join(' | '));const target=/\"target\":\"source-building\"/.test(r);return {rendered:true,fromModelViewer:target,receipt:r.slice(0,260)}})()"],
  ["find", "role", "button", "click", "--name", "Render", "--exact"],
  ["wait", "--fn", "!!document.querySelector('img[alt*=\"AI\"], img[alt*=\"visualisation\"], figure img')", "--timeout", "30000"],
  ["eval", "(()=>{const c=document.querySelector('[aria-label=\"Collapse live assistant\"]');if(c)c.click();const img=[...document.querySelectorAll('img')].find(i=>/AI|visualisation/i.test(i.alt||''));if(img)img.scrollIntoView({block:'center'});return img?{alt:img.alt,w:img.naturalWidth,h:img.naturalHeight}:'no image'})()"],
  ["screenshot", `${shots}/model-03-real-life-view.png`],
  // 4. Back to the source building
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')"],
  setDraft("Take the design back out of the model viewer and show the source building again. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const raw=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const hid=raw.find(t=>t.startsWith('hide_designed_model')&&/Tool result/.test(t));if(!hid)throw Error('No hide_designed_model receipt');const status=document.querySelector('[data-model-status]')?.getAttribute('data-model-status');if(status==='designed')throw Error('Viewer still shows the designed model');return {hidden:true,status,receipt:hid.slice(0,200)}})()"],
  ["screenshot", `${shots}/model-04-back-to-source.png`],
  ["errors"],
];
fs.writeFileSync(path.join(S, "modelmode-desktop.json"), JSON.stringify(scenario, null, 1));
console.log("model mode scenario written");
