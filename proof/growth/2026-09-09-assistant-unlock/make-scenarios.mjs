// Generates the five real-provider journey scenarios for the assistant unlock slice (run: node make-scenarios.mjs).
import fs from "node:fs";
const S = "proof/growth/2026-09-09-assistant-unlock/scenarios/", SH = "screenshots/growth/2026-09-09-assistant-unlock/";
fs.mkdirSync(S, { recursive: true }); fs.mkdirSync(SH, { recursive: true });
const hydrated = ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"];
const openAssistant = [
  ["wait", "--fn", "!!document.querySelector('.live-assistant-launcher')"],
  ["eval", "(()=>{if(!document.querySelector('.live-assistant-panel'))document.querySelector('.live-assistant-launcher').click();return 'panel'})()"],
  ["find", "role", "button", "click", "--name", "Add to assistant", "--exact"],
  ["find", "role", "menuitem", "click", "--name", "New chat", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.assistant-permission input')"],
  ["eval", "(()=>{const c=document.querySelector('.assistant-permission input');if(!c.checked)c.click();if(!c.checked)throw Error('Permission not enabled');return 'edits allowed'})()"],
];
const idle = "!document.querySelector('[aria-label=\"Stop assistant response\"]')";
const send = text => [
  ["fill", "#live-assistant-prompt", text],
  ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"],
  ["wait", "--fn", `${idle}&&(!!document.querySelector('.assistant-chat-entry.is-assistant')||!!document.querySelector('.assistant-chat-error'))`, "--timeout", "300000"],
  ["eval", "(()=>({paused:[...document.querySelectorAll('.assistant-chat-error')].some(e=>/Paused after eight/.test(e.textContent)),tools:[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent.trim().slice(0,160))}))()"],
];
const cont = [
  ["eval", "(()=>{const c=document.querySelector('.assistant-permission input');if(!c.checked)c.click();return 'edits allowed'})()"],
  ["eval", "(()=>{window.__replies=document.querySelectorAll('.assistant-chat-entry.is-assistant').length;return window.__replies})()"],
  ["fill", "#live-assistant-prompt", "If anything from my previous request is still outstanding, continue and finish it; otherwise reply exactly DONE."],
  ["find", "role", "button", "click", "--name", "Send assistant message", "--exact"],
  ["wait", "--fn", `${idle}&&document.querySelectorAll('.assistant-chat-entry.is-assistant').length>window.__replies`, "--timeout", "300000"],
  ["eval", "(()=>{const errors=[...document.querySelectorAll('.assistant-chat-error')].map(e=>e.textContent);const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent.trim().slice(0,200));const replies=[...document.querySelectorAll('.assistant-chat-entry.is-assistant')].map(e=>e.textContent.slice(0,1500));return {errors,tools,replies}})()"],
];
const w = (name, steps) => fs.writeFileSync(S + name + ".json", JSON.stringify(steps, null, 1));

w("a-design-edit", [
  ["open", "http://127.0.0.1:8091/", "--timeout", "120000"], ["set", "viewport", "1280", "800"], hydrated,
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"], ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')"],
  ["eval", "(()=>{[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace').click();return 'opened'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ...openAssistant,
  ...send("Draw a two-storey building 10 m by 8 m with a hip roof on the existing ground level (storeys 3000 mm). Then, using edit_architect_elements: remove the roof, move the ground-floor wall that runs from (0,0) to (10000,0) so it runs from (0,-2000) to (10000,-2000), and rename the design to \"Unlock test\". Finally tell me the wall, roof and level counts."),
  ...cont,
  ["eval", "(()=>{const w=document.querySelector('.architect-workspace');const d=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(w.dataset.designId)));const moved=d.walls.find(x=>x.a[1]===-2000&&x.b[1]===-2000);if(d.name!=='Unlock test')throw Error('Name not changed: '+d.name);if(d.roofs.length!==0)throw Error('Roof still present');if(d.walls.length<8)throw Error('Expected >=8 walls, got '+d.walls.length);if(!moved)throw Error('Wall not moved');return {name:d.name,revision:d.revision,walls:d.walls.length,roofs:d.roofs.length,levels:d.levels.length,movedWall:[moved.a,moved.b]}})()"],
  ["eval", "(()=>{const all=[...document.querySelectorAll('.architect-workspace label')].find(l=>/All levels in 3D/.test(l.textContent))?.querySelector('input');if(all&&!all.checked)all.click();return 'all levels'})()"],
  ["wait", "--fn", "Number(document.querySelector('canvas[aria-label=\"Live architectural 3D model\"]')?.dataset.frameCount||0)>2"],
  ["screenshot", SH + "a-design-edit-desktop.png"], ["errors"],
]);

w("b-takeoff", [
  ["find", "role", "button", "click", "--name", "Model", "--exact"], ["wait", "--fn", "document.querySelector('.building-primary')?.disabled===false", "--timeout", "60000"],
  ["find", "role", "button", "click", "--name", "Open Redburn BR250157 plan in 3D", "--exact"], ["wait", "--fn", "Number(document.querySelector('.building-canvas canvas')?.dataset.meshCount)===198", "--timeout", "60000"],
  ["find", "role", "button", "click", "--name", "Measure", "--exact"], ["wait", "--fn", "!!document.querySelector('[data-hydration-status=\"ready\"]')"],
  ...openAssistant,
  ...send("Work on sheet index 1 (original page 2) of the active source. Calibrate it: the two points x=100,y=100 and x=600,y=100 (page units) are 5 metres apart according to the scale bar on that sheet (that is my statement); method 'scale bar'; lock the calibration. Then trace a run from x=100,y=300 to x=600,y=300 on the same sheet. Then read the takeoff evidence and approve that run on my behalf — I am the reviewer and my name is Daniel Sivyer. Report the run length and status."),
  ...cont,
  ["eval", "(()=>{const job=JSON.parse(localStorage.getItem('xray:fencing-job:v2'));const cal=job.calibrations.find(c=>c.sheet===1);if(!cal||!cal.locked||cal.coordinateSpace!=='source-page-v1')throw Error('Calibration not locked on sheet 1: '+JSON.stringify(cal&&{locked:cal.locked,space:cal.coordinateSpace}));const run=job.runs.find(r=>r.sheet===1);if(!run)throw Error('No run on sheet 1');if(Math.abs(run.lengthM-5)>1e-6)throw Error('Run length '+run.lengthM);if(run.review.status!=='approved'||run.review.decidedBy!=='Daniel Sivyer')throw Error('Review '+JSON.stringify(run.review));const cand=cal.candidates.find(c=>c.id==='manual-sheet-1');return {metresPerUnit:cal.metresPerUnit,method:cand&&cand.provenance.method,evidence:cand&&cand.provenance.evidence,runId:run.id,lengthM:run.lengthM,review:run.review,jobRevision:job.revision}})()"],
  ["screenshot", SH + "b-takeoff-desktop.png"], ["errors"],
]);

w("c-price-import", [
  ["find", "role", "button", "click", "--name", "Cost", "--exact"], ["wait", "--fn", "!!document.querySelector('[data-hydration-status=\"ready\"]')"],
  ...openAssistant,
  ...send("Import this CSV as a new price book named \"Timber Co 2026\". Supplier: Timber Co. Currency AUD. Tax basis exclusive, 10%. Effective date 2026-09-01. Source reference: Quote Q-1234.\nStock code,Description,Unit,Rate\nP100,Treated pine post 100x100,each,18.50\nR75,Rail 75x50,m,4.20\nPAL,Paling 100x12,each,1.15"),
  ...cont,
  ["eval", "(()=>{const job=JSON.parse(localStorage.getItem('xray:fencing-job:v2'));const lib=JSON.parse(localStorage.getItem('xray:price-books:v1:'+encodeURIComponent(job.id)));const book=lib.books.find(b=>b.name==='Timber Co 2026');if(!book)throw Error('Book missing: '+JSON.stringify(lib.books.map(b=>b.name)));const rev=book.revisions[0];if(rev.rows.length!==3)throw Error('rows '+rev.rows.length);if(!/^Live assistant paste/.test(rev.metadata.sourceReference))throw Error('sourceReference '+rev.metadata.sourceReference);return {libraryRevision:lib.revision,book:book.name,rows:rev.rows.map(r=>[r.stockCode,r.rate]),sourceReference:rev.metadata.sourceReference,fileName:rev.source.fileName}})()"],
  ["find", "role", "button", "click", "--name", "Sheets", "--exact"], ["find", "role", "button", "click", "--name", "Cost", "--exact"],
  ["wait", "--fn", "/Timber Co 2026/.test(document.body.textContent)", "--timeout", "30000"],
  ["screenshot", SH + "c-price-import-desktop.png"], ["errors"],
]);

w("d-export", [
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"], ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')"],
  ["eval", "(()=>{[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace').click();return 'opened'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ...openAssistant,
  ...send("Export the current architectural design as DXF and as IFC, and give me the sha256 and byte length of each file."),
  ...cont,
  ["eval", "(()=>{const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const ex=tools.filter(t=>t.startsWith('export_design_file')&&/Tool result/.test(t)&&/sha256/.test(t));if(ex.length<2)throw Error('Expected 2 export receipts, got '+ex.length);return ex.map(t=>{const f=t.match(/\"format\":\"([a-z-]+)\"/),b=t.match(/\"byteLength\":(\\d+)/),s=t.match(/\"sha256\":\"([a-f0-9]{64})\"/);return {format:f&&f[1],bytes:b&&Number(b[1]),sha256:s&&s[1]}})})()"],
  ["screenshot", SH + "d-export-desktop.png"], ["errors"],
]);

w("e-render", [
  ["find", "role", "button", "click", "--name", "Model", "--exact"], ["wait", "--fn", "Number(document.querySelector('.building-canvas canvas')?.dataset.frameCount||0)>2", "--timeout", "60000"],
  ...openAssistant,
  ...send("generate a real life view of this plan"),
  ...cont,
  ["eval", "(()=>{const tools=[...document.querySelectorAll('.assistant-chat-entry.is-tool')].map(e=>e.textContent);const r=tools.find(t=>t.startsWith('generate_render_visualisation')&&/Tool result/.test(t));if(!r)throw Error('No render receipt; tools: '+tools.map(t=>t.slice(0,80)).join(' | '));if(!/\"rendered\":true/.test(r))throw Error('Render failed: '+r.slice(0,400));const m=r.match(/\"model\":\"([^\"]+)\"/);return {model:m&&m[1],receipt:r.slice(0,700)}})()"],
  ["find", "role", "button", "click", "--name", "Render", "--exact"], ["wait", "--fn", "!!document.querySelector('[aria-label=\"Latest AI render\"] img')", "--timeout", "30000"],
  ["eval", "(()=>{const img=document.querySelector('[aria-label=\"Latest AI render\"] img');return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,src:img.src.slice(0,40)}})()"],
  ["screenshot", SH + "e-render-desktop.png"], ["set", "viewport", "1024", "768"], ["screenshot", SH + "e-render-tablet.png"], ["errors"],
]);

fs.writeFileSync("proof/growth/2026-09-09-assistant-unlock/run-journeys.sh", [
  "#!/usr/bin/env bash",
  'cd "C:/Users/danie/repo/xray-by-looplet"',
  "S=proof/growth/2026-09-09-assistant-unlock/scenarios",
  'run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs unlock-desktop "$S/$1.json" 2>&1 | tail -1 | grep -o \'"exitCode":[0-9]*\\|"commands":[0-9]*\\|"log":"[^"]*"\'; }',
  "node scripts/fast-cdp-test.mjs unlock-desktop proof/growth/2026-09-09-assistant-wireframe/warm.scenario.json >/dev/null 2>&1",
  'for s in "$@"; do run $s; done',
  'echo "== JOURNEYS_DONE $(date -Is)"',
  "",
].join("\n"));
console.log("scenarios:", fs.readdirSync(S).join(", "));
