// Generates the AFTER proof scenarios for the compact draggable Magic Pencil dock.
// Run from the repo root: node proof/growth/2026-09-09-draftsman-dock/generate-scenarios.mjs [base-url]
// The shared dev server (0.0.0.0:8080, PID 44196) had already exited when the final proof ran, so the
// default base is the agent-owned Vite instance on 127.0.0.1:8090 (same tree, started and stopped by the agent).
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8090/";
const DIR = "proof/growth/2026-09-09-draftsman-dock/";
const S = "screenshots/growth/2026-09-09-draftsman-dock/";
const GRIP = '[aria-label="Move drafting controls"]';

// Layout + accessibility invariants evaluated in-browser; throws on any failure.
//  - every button/select/input in the dock is >= 44x44 and lies inside the dock box and the viewport
//  - the dock itself is inside the viewport, has no internal horizontal overflow, and the page/stage do not scroll sideways
const CHECK = `(()=>{const d=document.querySelector("[data-testid=draftsman-dock]");const r=d.getBoundingClientRect();const st=d.offsetParent;const sr=st.getBoundingClientRect();const bad=[];const els=[...d.querySelectorAll("button,select,input")];for(const b of els){const q=b.getBoundingClientRect();const n=b.getAttribute("aria-label")||b.textContent.trim();if(q.width<44||q.height<44)bad.push({name:n,w:Math.round(q.width),h:Math.round(q.height)});if(q.left<0||q.right>innerWidth||q.top<0||q.bottom>innerHeight)bad.push({clippedByViewport:n});if(q.left<r.left-0.5||q.right>r.right+0.5||q.top<r.top-0.5||q.bottom>r.bottom+0.5)bad.push({clippedByDock:n,right:Math.round(q.right),dockRight:Math.round(r.right)})}if(bad.length)throw Error("hit-area/clip failures: "+JSON.stringify(bad));if(r.left<0||r.right>innerWidth||r.bottom>innerHeight)throw Error("dock clipped");if(d.scrollWidth>d.clientWidth+1)throw Error("dock internal horizontal overflow "+d.scrollWidth+">"+d.clientWidth);if(document.documentElement.scrollWidth>innerWidth)throw Error("page horizontal overflow");if(st.scrollWidth>st.clientWidth)throw Error("stage horizontal overflow");const faces=[...d.querySelectorAll(".draftsman-face")].map(f=>Math.round(f.getBoundingClientRect().height));const scrub=d.querySelector(".draftsman-scrubber-wrapper").getBoundingClientRect();return JSON.stringify({label:LABEL,viewport:[innerWidth,innerHeight],stage:{left:Math.round(sr.left),width:Math.round(sr.width)},dock:{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom)},rows:[...d.querySelectorAll(".draftsman-row")].map(x=>Math.round(x.getBoundingClientRect().height)),dockX:d.dataset.dockX,tools:d.dataset.dockTools,controls:els.length,minHit:Math.min(...els.map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))),faceHeights:[Math.min(...faces),Math.max(...faces)],scrubberWidth:Math.round(scrub.width),dockScroll:[d.scrollWidth,d.clientWidth],docScrollWidth:document.documentElement.scrollWidth,stored:localStorage.getItem("xray:draftsman-dock:v1")})})()`;

// Asserts the dock's left edge (dataset + rendered) equals EXPECT and pointer capture was released.
const ASSERT = `(()=>{const d=document.querySelector("[data-testid=draftsman-dock]");const r=d.getBoundingClientRect();const sr=d.offsetParent.getBoundingClientRect();const x=Number(d.dataset.dockX);const left=Math.round(r.left-sr.left);if(x!==EXPECT||left!==EXPECT)throw Error("STEP: expected dock x "+EXPECT+" got dataset "+x+" / rendered "+left);if(d.dataset.dockDragging)throw Error("STEP: pointer capture not released");return JSON.stringify({step:"STEP",dockX:x,renderedLeft:left,gapToStageRight:Math.round(sr.right-r.right),stored:localStorage.getItem("xray:draftsman-dock:v1"),focusOnGrip:document.activeElement===d.querySelector('[aria-label="Move drafting controls"]')})})()`;

const check = (label) => CHECK.replace("LABEL", JSON.stringify(label));
const assert = (step, n) => ASSERT.split("EXPECT").join(String(n)).split("STEP").join(step);

// Same route as proof/magic-pencil-redburn-cdp.scenario.json (the user's reference), plus a dock-ready wait.
const nav = (w, h, clear) => [
  ["open", BASE],
  ["set", "viewport", String(w), String(h)],
  ["wait", "--fn", "(document.querySelector('.workbench')||document.querySelector('[data-hydration-status]'))?.dataset.hydrationStatus==='ready'"],
  ...(clear ? [["eval", "localStorage.removeItem('xray:draftsman-dock:v1'); 'cleared'"]] : []),
  ["find", "role", "button", "click", "--name", "Model", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.building-workspace')"],
  ["find", "role", "button", "click", "--name", "Redburn BR250157", "--exact"],
  ["wait", "--fn", "document.querySelector('.building-center-column')?.textContent.includes('Redburn')"],
  ["find", "role", "button", "click", "--name", "Explore & Draw 3D Model", "--exact"],
  ["wait", "--fn", "!!document.querySelector('.building-canvas canvas')"],
  ["wait", "--fn", "Number(document.querySelector('.building-canvas canvas')?.dataset.frameCount) > 2"],
  ["find", "role", "button", "click", "--name", "Magic Pencil", "--exact"],
  ["wait", "--fn", "document.querySelector('.building-canvas canvas')?.dataset.drawMode === 'active'"],
  ["wait", "--fn", "(document.querySelector('[data-testid=draftsman-dock]')?.dataset.dockX||'')!==''"],
];
// After ["reload"]: wait for hydration again before clicking (the interrupted run clicked too early and timed out).
const renav = () => nav(0, 0, false).slice(2);

// Pointer drag with setPointerCapture: press on the grip centre, move in three steps, release.
const drag = (cx, cy, dx) => {
  const steps = [["mouse", "move", String(cx), String(cy)], ["mouse", "down"]];
  for (let i = 1; i <= 3; i++) steps.push(["mouse", "move", String(Math.max(0, Math.round(cx + (dx * i) / 3))), String(cy)]);
  steps.push(["mouse", "up"]);
  return steps;
};

// Before/after size measurement only (desktop then tablet), no interaction.
const MEASURE = `(()=>{const d=document.querySelector('[data-testid=draftsman-dock]');const r=d.getBoundingClientRect();const st=d.offsetParent.getBoundingClientRect();const g=d.querySelector('[aria-label="Move drafting controls"]').getBoundingClientRect();return JSON.stringify({label:LABEL,viewport:[innerWidth,innerHeight],stage:{left:Math.round(st.left),width:Math.round(st.width),top:Math.round(st.top),height:Math.round(st.height)},dock:{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom)},dockX:d.dataset.dockX,grip:{cx:Math.round(g.left+g.width/2),cy:Math.round(g.top+g.height/2),w:Math.round(g.width),h:Math.round(g.height)},controls:d.querySelectorAll('button,select,input').length})})()`;
const measure = (label) => MEASURE.replace("LABEL", JSON.stringify(label));
const measureScenario = [
  ...nav(1280, 800, true),
  ["eval", measure("AFTER desktop 1280x800 measure")],
  ["eval", check("AFTER desktop 1280x800 invariants")],
  ["set", "viewport", "1024", "768"],
  ["wait", "--fn", "innerWidth===1024"],
  ["eval", measure("AFTER tablet 1024x768 measure")],
  ["eval", check("AFTER tablet 1024x768 invariants")],
  ["screenshot", S + "after-measure-tablet-1024x768.png"],
  ["errors"],
];

// Desktop 1280x800: stage is 620px wide (left 260) -> dock range 8..92; grip centre (297,634) when x=8.
const desktop = [
  ...nav(1280, 800, true),
  ["eval", check("AFTER desktop 1280x800")],
  ["screenshot", S + "after-desktop-1280x800.png"],
  ...drag(297, 634, 300),
  ["eval", assert("desktop drag +300 clamps at right edge", 92)],
  ["screenshot", S + "after-desktop-drag-right-clamped.png"],
  ...drag(381, 634, -600),
  ["eval", assert("desktop drag -600 (pointer stops at viewport x=0) clamps at left edge", 8)],
  ["focus", GRIP],
  ["press", "ArrowRight"],
  ["eval", assert("desktop ArrowRight", 24)],
  ["press", "ArrowRight"],
  ["eval", assert("desktop ArrowRight x2", 40)],
  ["press", "ArrowLeft"],
  ["eval", assert("desktop ArrowLeft", 24)],
  ["press", "End"],
  ["eval", assert("desktop End", 92)],
  ["press", "Home"],
  ["eval", assert("desktop Home", 8)],
  ["press", "ArrowRight"],
  ["press", "ArrowRight"],
  ["eval", assert("desktop ArrowRight x2 before reload", 40)],
  ["screenshot", S + "after-desktop-grip-focus-x40.png"],
  ["click", '[aria-label="Show drafting tools"]'],
  ["wait", "--fn", "document.querySelector('[data-testid=draftsman-dock]')?.dataset.dockTools==='open'"],
  ["eval", check("AFTER desktop tools strip open")],
  ["screenshot", S + "after-desktop-tools-open.png"],
  ["click", '[aria-label="Hide drafting tools"]'],
  ["wait", "--fn", "document.querySelector('[data-testid=draftsman-dock]')?.dataset.dockTools==='closed'"],
  ["reload"],
  ...renav(),
  ["eval", assert("desktop reload persistence", 40)],
  ["screenshot", S + "after-desktop-reload-persisted-x40.png"],
  ["set", "viewport", "1024", "768"],
  ["wait", "--fn", "innerWidth===1024"],
  ["focus", GRIP],
  ["press", "End"],
  ["eval", assert("tablet End before shrinking back to desktop", 496)],
  ["set", "viewport", "1280", "800"],
  ["wait", "--fn", "innerWidth===1280"],
  ["wait", "--fn", "document.querySelector('[data-testid=draftsman-dock]')?.dataset.dockX==='92'"],
  ["eval", assert("resize re-clamp 1024->1280 (stage 620) clamps 496 -> 92", 92)],
  ["eval", check("AFTER desktop after resize re-clamp")],
  ["errors"],
];

// Tablet 1024x768: stage is the full 1024px -> dock range 8..496; grip centre (37,552) when x=8.
const tablet = [
  ...nav(1024, 768, true),
  ["eval", check("AFTER tablet 1024x768")],
  ["screenshot", S + "after-tablet-1024x768.png"],
  ...drag(37, 552, 300),
  ["eval", assert("tablet drag +300 tracks pointer 1:1", 308)],
  ...drag(337, 552, 300),
  ["eval", assert("tablet drag another +300 clamps at right edge", 496)],
  ["screenshot", S + "after-tablet-drag-right-clamped.png"],
  ...drag(525, 552, -600),
  ["eval", assert("tablet drag -600 clamps at left edge", 8)],
  ["screenshot", S + "after-tablet-drag-left-clamped.png"],
  ["focus", GRIP],
  ["press", "ArrowRight"],
  ["eval", assert("tablet ArrowRight", 24)],
  ["press", "End"],
  ["eval", assert("tablet End", 496)],
  ["press", "Home"],
  ["eval", assert("tablet Home", 8)],
  ["press", "ArrowRight"],
  ["press", "ArrowRight"],
  ["press", "ArrowRight"],
  ["eval", assert("tablet ArrowRight x3 before reload", 56)],
  ["screenshot", S + "after-tablet-grip-focus-x56.png"],
  ["reload"],
  ...renav(),
  ["eval", assert("tablet reload persistence", 56)],
  ["click", '[aria-label="Show drafting tools"]'],
  ["wait", "--fn", "document.querySelector('[data-testid=draftsman-dock]')?.dataset.dockTools==='open'"],
  ["eval", check("AFTER tablet tools strip open")],
  ["screenshot", S + "after-tablet-tools-open.png"],
  ["errors"],
];

fs.writeFileSync(DIR + "after-measure.scenario.json", JSON.stringify(measureScenario, null, 1));
fs.writeFileSync(DIR + "after-desktop.scenario.json", JSON.stringify(desktop, null, 1));
fs.writeFileSync(DIR + "after-tablet.scenario.json", JSON.stringify(tablet, null, 1));
console.log("base", BASE, "measure steps", measureScenario.length, "desktop steps", desktop.length, "tablet steps", tablet.length);
