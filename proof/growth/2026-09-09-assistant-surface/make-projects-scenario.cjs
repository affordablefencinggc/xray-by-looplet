// SC-18 live proof (no provider calls): New project from the + menu, pill and tab strip, switch back through the
// drawer and through a tab, the first project's design intact; corner resize by keyboard.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-assistant-surface";
const hydrated = ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"];
const jobId = "JSON.parse(localStorage.getItem('xray:fencing-job:v2')).id";
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
  ["eval", `(()=>{window.__firstId=${jobId};window.__firstWalls=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(document.querySelector('.architect-workspace').dataset.designId))).walls.length;return {firstId:window.__firstId,walls:window.__firstWalls}})()`],
  ["eval", "(()=>{document.querySelector('.live-assistant-launcher').click();return 'opened panel'})()"],
  ["wait", "--fn", "!!document.querySelector('#live-assistant-prompt')"],
  // New project from the + menu
  ["find", "role", "button", "click", "--name", "Add to assistant", "--exact"],
  ["find", "role", "menuitem", "click", "--name", "Projects", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.assistant-project-drawer')"],
  ["screenshot", `${shots}/projects-01-drawer.png`],
  ["eval", "(()=>{document.querySelector('.assistant-project-new').click();return 'new project requested'})()"],
  ["wait", "--fn", `${jobId}!==window.__firstId&&document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'`, "--timeout", "30000"],
  ["wait", "--fn", "!!document.querySelector('.assistant-project-strip')&&document.querySelectorAll('.assistant-project-tab').length>=1", "--timeout", "10000"],
  ["eval", `(()=>{window.__secondId=${jobId};const reg=JSON.parse(localStorage.getItem('xray:projects:v1'));const tabs=JSON.parse(localStorage.getItem('xray:assistant-project-tabs:v1')||'[]');const pill=document.querySelector('.assistant-project-pill');const shelf=localStorage.getItem('xray:project-shelf:v1:'+window.__firstId);if(!shelf)throw Error('First project not shelved');if(reg.entries.length<2)throw Error('Registry has '+reg.entries.length+' entries');return {secondId:window.__secondId,pill:pill.textContent.trim().slice(0,60),pillProject:pill.dataset.projectId===window.__secondId,tabs,entries:reg.entries.map(e=>e.name),shelfBytes:shelf.length,closeButton:!!document.querySelector('.assistant-project-close')}})()`],
  ["screenshot", `${shots}/projects-02-new-project-pill.png`],
  // Back to the first project through the drawer row
  ["find", "role", "button", "click", "--name", "Add to assistant", "--exact"],
  ["find", "role", "menuitem", "click", "--name", "Projects", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.assistant-project-drawer')"],
  ["eval", "(()=>{const li=document.querySelector('.assistant-project-list li[data-project-id=\"'+window.__firstId+'\"]');if(!li)throw Error('First project not listed');const open=[...li.querySelectorAll('button')].find(b=>/^Open /.test(b.getAttribute('aria-label')||'')&&!/in a tab/.test(b.getAttribute('aria-label')||''));open.click();return 'opening first project: '+open.getAttribute('aria-label')})()"],
  ["wait", "--fn", `${jobId}===window.__firstId&&document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'`, "--timeout", "30000"],
  ["find", "role", "button", "click", "--name", "Sketch", "--exact"],
  ["wait", "--fn", "!!document.querySelector('nav[aria-label=\"Sketch workspaces\"]')||!!document.querySelector('.architect-workspace[data-design-revision]')"],
  ["eval", "(()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Sketch workspaces\"] button')].find(b=>b.textContent.trim()==='Architectural workspace');if(b)b.click();return 'workspace'})()"],
  ["wait", "--fn", "!!document.querySelector('.architect-workspace[data-design-revision]')", "--timeout", "30000"],
  ["eval", "(()=>{const walls=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(document.querySelector('.architect-workspace').dataset.designId))).walls.length;if(walls!==window.__firstWalls)throw Error('First project design changed: '+walls+' vs '+window.__firstWalls);const tabs=[...document.querySelectorAll('.assistant-project-tab')].map(t=>t.textContent.trim()+':'+t.getAttribute('aria-selected'));const shelf2=localStorage.getItem('xray:project-shelf:v1:'+window.__secondId);if(!shelf2)throw Error('Second project not shelved');return {walls,tabs,selectedPill:document.querySelector('.assistant-project-pill')?.dataset.projectId===window.__firstId}})()"],
  ["screenshot", `${shots}/projects-03-switched-back.png`],
  // Flick to the other project with its tab
  ["eval", "(()=>{const tab=[...document.querySelectorAll('.assistant-project-tab')].find(t=>t.getAttribute('aria-selected')!=='true');if(!tab)throw Error('No other tab');tab.click();return 'tab clicked: '+tab.textContent.trim()})()"],
  ["wait", "--fn", `${jobId}===window.__secondId&&document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'`, "--timeout", "30000"],
  ["eval", `(()=>({now:${jobId}===window.__secondId,tabs:[...document.querySelectorAll('.assistant-project-tab')].map(t=>t.textContent.trim()+':'+t.getAttribute('aria-selected'))}))()`],
  ["screenshot", `${shots}/projects-04-tab-flick.png`],
  // Corner resize by keyboard on the bottom-right handle
  ["eval", "(()=>{const p=document.querySelector('.live-assistant-panel').getBoundingClientRect();window.__before={w:Math.round(p.width),h:Math.round(p.height)};const c=document.querySelector('.assistant-corner[data-corner=se]');c.focus();for(let i=0;i<3;i++){c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));}return window.__before})()"],
  ["wait", "--fn", "Math.round(document.querySelector('.live-assistant-panel').getBoundingClientRect().width)>window.__before.w||Math.round(document.querySelector('.live-assistant-panel').getBoundingClientRect().height)>window.__before.h", "--timeout", "5000"],
  ["eval", "(()=>{const p=document.querySelector('.live-assistant-panel').getBoundingClientRect();return {before:window.__before,after:{w:Math.round(p.width),h:Math.round(p.height)},corners:document.querySelectorAll('.assistant-corner').length}})()"],
  ["screenshot", `${shots}/projects-05-corner-resize.png`],
  ["errors"],
];
fs.writeFileSync(path.join(S, "projects-desktop.json"), JSON.stringify(scenario, null, 1));
console.log("projects scenario written");
