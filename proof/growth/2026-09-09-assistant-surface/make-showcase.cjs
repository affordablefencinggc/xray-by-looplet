// SC-17 showcase: a fresh project (no sample plan), the client's rough sketch attached, the assistant
// designs the finished multi-storey wireframe. Three scenario files: start (attach + brief), round
// (one "continue" turn, re-run from the shell until the reply is DONE), finish (verify, screenshots,
// real-life view, exports). Every message goes to the real provider from .env.local (user-authorized).
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios"); fs.mkdirSync(S, { recursive: true });
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const sketch = "/@fs/" + path.resolve(__dirname, "../../../screenshots/growth/2026-09-09-assistant-surface/client-sketch.png").replace(/\\/g, "/");
const hydrated = ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"];
const replyDone = (timeout = "840000") => ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')&&(document.querySelectorAll('.assistant-chat-entry.is-assistant').length>(window.__replies||0)||document.querySelectorAll('.assistant-chat-error').length>(window.__errors||0))", "--timeout", timeout];
const counts = ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;window.__errors=document.querySelectorAll('.assistant-chat-error').length;return {replies:window.__replies,errors:window.__errors}})()"];
const setDraft = text => ["eval", `(()=>{const ta=document.querySelector('#live-assistant-prompt');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(text)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.length})()`];
const allowEdits = ["eval", "(()=>{const c=document.querySelector('.assistant-permission input');if(!c.checked)c.click();if(!c.checked)throw Error('Permission not enabled');return 'edits allowed'})()"];
const send = ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"];
const designStats = "(()=>{const w=document.querySelector('.architect-workspace');const raw=localStorage.getItem('xray:architect:v1:'+encodeURIComponent(w.dataset.designId));if(!raw)return {name:'(default design, not saved yet)',revision:Number(w.dataset.designRevision||0),levels:[],walls:0,doors:0,windows:0,rooms:[],slabs:0,roofs:[],extentMm:[0,0,0,0]};const d=JSON.parse(raw);const ext=d.walls.reduce((a,x)=>{for(const p of [x.a,x.b]){a[0]=Math.min(a[0],p[0]);a[1]=Math.min(a[1],p[1]);a[2]=Math.max(a[2],p[0]);a[3]=Math.max(a[3],p[1]);}return a},[Infinity,Infinity,-Infinity,-Infinity]);return {name:d.name,revision:d.revision,levels:d.levels.map(l=>l.name+'@'+l.elevation),walls:d.walls.length,doors:d.openings.filter(o=>o.kind==='door').length,windows:d.openings.filter(o=>o.kind==='window').length,rooms:d.roomTags.map(r=>r.name),slabs:d.slabs.length,roofs:d.roofs.map(r=>r.edges.map(e=>e.gable?'g':e.pitch).join('/')),extentMm:ext.map(Math.round)}})()";
const summary = ["eval", "(()=>{const errors=[...document.querySelectorAll('.assistant-chat-error')].map(e=>e.textContent.slice(0,160));const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].filter(e=>/Tool result|Action failed/.test(e.textContent)).map(e=>e.textContent.trim().slice(0,90));const last=[...document.querySelectorAll('.assistant-chat-entry.is-assistant')].at(-1)?.textContent.replace(/^Assistant/,'')||'';const paused=/Paused after eight/.test(errors.at(-1)||'');const done=/\\bDONE\\b/.test(last.slice(-40))||/\\bDONE\\.?\\s*$/.test(last.trim());return {done,paused,errors:errors.slice(-2),receipts:tools.length,lastTools:tools.slice(-6),last:last.slice(0,700),design:"+designStats+"}})()"];
const brief = "This is my client's rough sketch and notes (attached image) for a new building. Design the finished product from it as a complete wireframe in this architectural workspace, following every dimension and note on the sketch: the 36 m by 18 m footprint, three storeys of 3.6 m plus the smaller plant level on top over the east half, 200 mm slabs on every level, the two 3 m by 6 m stair cores at each end, the 2.5 m by 2.5 m lift beside the east stair, the 2.4 m central corridor, the four labs on the north side and the workshop, office and plant rooms on the south side (same layout on every storey), 1.8 m double doors from the corridor into each lab and 0.9 m doors elsewhere, 1.8 m wide windows every 3 m along the north and south walls, the 4 m roller door on the west end at ground level, room tags for every room, and a skillion roof over the whole footprint falling to the south at 5 degrees with 600 mm eaves. Name the design \"Riverside Lab & Workshop\". Use footprint, level, slab, wall, door, window, room and roof operations as needed. Work through it step by step; if you pause, I will tell you to continue. When everything on the sketch exists in the design, reply exactly DONE.";
const start = [
  ["open", "http://127.0.0.1:8091/", "--timeout", "120000"],
  ["set", "viewport", "1280", "800"],
  hydrated,
  ["eval", "(()=>{const job=JSON.parse(localStorage.getItem('xray:fencing-job:v2')||'null');return {project:job?.name,documents:job?.documents?.map(d=>d.name)}})()"],
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')"],
  ["eval", "(()=>{[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace').click();return 'opened'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ["eval", designStats],
  ["wait", "--fn", "!!document.querySelector('.live-assistant-launcher')"],
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')"],
  ["eval", `(async()=>{const res=await fetch(${JSON.stringify(sketch)});if(!res.ok)throw Error('sketch fetch '+res.status);const blob=await res.blob();const file=new File([blob],'client-sketch.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(file);const target=document.querySelector('.live-assistant');target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));return {bytes:blob.size,type:blob.type}})()`],
  ["wait", "--fn", "document.querySelectorAll('.assistant-attachments img').length===1", "--timeout", "30000"],
  ["screenshot", `${shots}/showcase-01-sketch-attached.png`],
  allowEdits,
  setDraft(brief),
  counts,
  send,
  replyDone(),
  summary,
  ["screenshot", `${shots}/showcase-02-first-reply.png`],
  ["errors"],
];
const continueIfFull = [
  ["eval", "(()=>{const b=document.querySelector('.assistant-context-banner.assistant-context-full button.assistant-continue-chat');if(b){window.__continued=(window.__continued||0)+1;b.click();return 'continued in a new chat ('+window.__continued+')'}return 'chat not full'})()"],
  ["wait", "--fn", "!document.querySelector('.assistant-context-banner.assistant-context-full')&&!document.querySelector('#live-assistant-prompt')?.disabled&&!document.querySelector('.assistant-permission input')?.disabled", "--timeout", "20000"],
];
const round = [
  ["wait", "--fn", "!document.querySelector('[aria-label=\"Stop assistant response\"]')", "--timeout", "840000"],
  ...continueIfFull,
  allowEdits,
  setDraft("Continue with the remaining steps from the sketch brief; do not repeat actions that already completed (read the design first if unsure). When everything on the sketch exists in the design, reply exactly DONE."),
  counts,
  send,
  replyDone(),
  summary,
  ["errors"],
];
const finish = [
  ["eval", "(()=>{const s="+designStats+";if(!/Riverside/i.test(s.name))throw Error('Design not named: '+s.name);if(s.levels.length<4)throw Error('Fewer than 4 levels: '+s.levels.join(','));if(s.walls<30)throw Error('Only '+s.walls+' walls');if(s.doors<8)throw Error('Only '+s.doors+' doors');if(s.windows<10)throw Error('Only '+s.windows+' windows');if(s.rooms.length<6)throw Error('Only '+s.rooms.length+' room tags');if(s.slabs<3)throw Error('Only '+s.slabs+' slabs');if(s.roofs.length<1)throw Error('No roof');if(Math.abs((s.extentMm[2]-s.extentMm[0])-36000)>600||Math.abs((s.extentMm[3]-s.extentMm[1])-18000)>600)throw Error('Footprint extent off: '+s.extentMm.join(','));return s})()"],
  ["eval", "(()=>{const all=[...document.querySelectorAll('.architect-workspace label')].find(l=>/All levels in 3D/.test(l.textContent))?.querySelector('input');if(all&&!all.checked)all.click();const live=[...document.querySelectorAll('.architect-workspace label')].find(l=>/Live 3D/.test(l.textContent))?.querySelector('input');if(live&&!live.checked)live.click();return 'all levels in 3D'})()"],
  ["wait", "--fn", "Number(document.querySelector('canvas[aria-label=\"Live architectural 3D model\"]')?.dataset.frameCount||0)>2", "--timeout", "30000"],
  ["eval", "(()=>{const c=document.querySelector('[aria-label=\"Collapse live assistant\"]');if(c)c.click();const fit=[...document.querySelectorAll('.architect-workspace button')].find(b=>b.textContent.trim()==='Fit');if(fit)fit.click();return 'panel collapsed, plan fitted'})()"],
  ["wait", "--fn", "!document.querySelector('.live-assistant-panel')", "--timeout", "5000"],
  ["screenshot", `${shots}/showcase-03-design-desktop.png`],
  ["set", "viewport", "1024", "768"],
  ["wait", "--fn", "Number(document.querySelector('canvas[aria-label=\"Live architectural 3D model\"]')?.dataset.frameCount||0)>2", "--timeout", "30000"],
  ["screenshot", `${shots}/showcase-04-design-tablet.png`],
  ["set", "viewport", "1280", "800"],
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel reopened'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')", "--timeout", "5000"],
  ...continueIfFull,
  // real-life view of the finished design (web only)
  allowEdits,
  setDraft("Generate a real life view of this design as it would look when built, using the current architectural 3D view. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const r=tools.find(t=>t.startsWith('generate_render_visualisation')&&/Tool result/.test(t));if(!r||!/\"rendered\":true/.test(r))throw Error('No render receipt: '+tools.filter(t=>t.startsWith('generate_render')).map(t=>t.slice(0,200)).join('|'));return r.slice(0,400)})()"],
  ["find", "role", "button", "click", "--name", "Render", "--exact"],
  ["wait", "--fn", "!!document.querySelector('img[alt*=\"AI\"], img[alt*=\"render\"], .render-ai-card img, figure img')", "--timeout", "30000"],
  ["screenshot", `${shots}/showcase-05-real-life-view.png`],
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')"],
  // exports with hash receipts
  ...continueIfFull,
  allowEdits,
  setDraft("Export this design as DXF and as IFC and give me the sha256 and byte length of each file. Then reply DONE."),
  counts,
  send,
  replyDone(),
  ["eval", "(()=>{const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent).filter(t=>t.startsWith('export_design_file')&&/Tool result/.test(t));const hashes=tools.map(t=>(t.match(/\"sha256\":\"([a-f0-9]{64})\"/)||[])[1]).filter(Boolean);const bytes=tools.map(t=>(t.match(/\"byteLength\":(\\d+)|\"bytes\":(\\d+)/)||[])[0]).filter(Boolean);if(hashes.length<2)throw Error('Expected two export receipts with sha256, got '+hashes.length);return {receipts:tools.length,hashes,bytes,reply:[...document.querySelectorAll('.assistant-chat-entry.is-assistant')].at(-1)?.textContent.slice(0,500)}})()"],
  ["screenshot", `${shots}/showcase-06-exports.png`],
  ["eval", designStats],
  ["errors"],
];
fs.writeFileSync(path.join(S, "showcase-start.json"), JSON.stringify(start, null, 1));
fs.writeFileSync(path.join(S, "showcase-round.json"), JSON.stringify(round, null, 1));
fs.writeFileSync(path.join(S, "showcase-finish.json"), JSON.stringify(finish, null, 1));
console.log("showcase scenarios written; sketch url", sketch);
