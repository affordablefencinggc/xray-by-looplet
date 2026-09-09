// Showcase visual pass (no provider calls): the finished design with the panel collapsed and the workspace scrolled
// so the plan and the 3D block fill the frame, desktop and tablet; the Render pane's AI real-life view uncovered.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const openWorkspace = [
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')||!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
  ["eval", "(()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace');if(b)b.click();return b?'opened workspace':'workspace already open'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
];
const collapsePanel = ["eval", "(()=>{const c=document.querySelector('[aria-label=\"Collapse live assistant\"]');if(c)c.click();return 'panel collapsed'})()"];
const frame = ["eval", "(()=>{const all=[...document.querySelectorAll('.architect-workspace label')].find(l=>/All levels in 3D/.test(l.textContent))?.querySelector('input');if(all&&!all.checked)all.click();const live=[...document.querySelectorAll('.architect-workspace label')].find(l=>/Live 3D/.test(l.textContent))?.querySelector('input');if(live&&!live.checked)live.click();document.querySelector('.arch-canvases')?.scrollIntoView({block:'start'});const fit=[...document.querySelectorAll('.architect-workspace button')].find(b=>b.textContent.trim()==='Fit');if(fit)fit.click();return 'framed'})()"];
const frames = ["wait", "--fn", "Number(document.querySelector('canvas[aria-label=\"Live architectural 3D model\"]')?.dataset.frameCount||0)>2", "--timeout", "30000"];
const visual = [
  ["set", "viewport", "1280", "800"],
  ...openWorkspace,
  collapsePanel,
  ["wait", "--fn", "!document.querySelector('.live-assistant-panel')", "--timeout", "5000"],
  frame,
  frames,
  ["eval", "(()=>{const w=document.querySelector('.architect-workspace');const d=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(w.dataset.designId)));return {name:d.name,revision:d.revision,walls:d.walls.length,openings:d.openings.length,levels:d.levels.length,rooms:d.roomTags.length,slabs:d.slabs.length,roofs:d.roofs.length}})()"],
  ["screenshot", `${shots}/showcase-07-design-desktop-framed.png`],
  ["eval", "(()=>{const sel=document.querySelector('.architect-workspace select');const opts=sel?[...sel.options].map(o=>o.value):[];const three=opts.find(v=>/3d|iso|persp/i.test(v));if(sel&&three){const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(sel,three);sel.dispatchEvent(new Event('change',{bubbles:true}));return 'view '+three}return 'views: '+opts.join(',')})()"],
  frames,
  ["screenshot", `${shots}/showcase-08-design-desktop-3d.png`],
  ["set", "viewport", "1024", "768"],
  frame,
  frames,
  ["screenshot", `${shots}/showcase-09-design-tablet-framed.png`],
  ["set", "viewport", "1280", "800"],
  ["find", "role", "button", "click", "--name", "Render", "--exact"],
  ["wait", "--fn", "document.body.textContent.includes('LATEST AI RENDER')||document.body.textContent.includes('Latest AI render')", "--timeout", "30000"],
  collapsePanel,
  ["eval", "(()=>{const img=[...document.querySelectorAll('img')].find(i=>/AI|render|visualisation/i.test(i.alt||''))||[...document.querySelectorAll('figure img, .render-ai-card img')].at(-1);if(img)img.scrollIntoView({block:'center'});return img?{alt:img.alt,w:img.naturalWidth,h:img.naturalHeight}:'no render image'})()"],
  ["screenshot", `${shots}/showcase-10-real-life-view-uncovered.png`],
  ["errors"],
];
fs.writeFileSync(path.join(S, "showcase-visual.json"), JSON.stringify(visual, null, 1));
console.log("showcase-visual written");
