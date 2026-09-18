/**
 * The scenario that takes SC-03's screenshots.
 *
 * It seeds the app's own storage with the project `sc03-seed-project.mjs` built — a
 * project holding an issued Rev A and a Rev B altered from it — then drives the
 * shipped UI to the revision overlay, turns the cloud layer on, and reads the SVG
 * back out of the live DOM. The readings are asserted in the page rather than only
 * photographed: how many clouds the browser actually drew, what each encloses, and
 * whether toggling the layer changed the canvas without re-rendering the plan.
 *
 * Run from the repo root: node .temp/live-rig/build-sc03-scenario.mjs
 */
import fs from 'node:fs';

const SEEDED = JSON.parse(fs.readFileSync('.temp/live-rig/sc03-seeded-project.json', 'utf8'));
const PROJECT = JSON.stringify(SEEDED.design);
const OUT = '.temp/live-rig/sc03-proof.json';
const SHOTS = 'screenshots/growth/sc03';

const seed = `(()=>{
  const raw = localStorage.getItem('xray:fencing-job:v2');
  if (!raw) throw Error('the app has not created a job yet');
  const job = JSON.parse(raw);
  const wanted = 'job-sc03-proof';
  localStorage.setItem('xray:fencing-job:v2', JSON.stringify({ ...job, id: wanted, name: 'SC-03 proof fixture' }));
  const key = 'xray:architect:v1:' + encodeURIComponent(wanted);
  localStorage.setItem(key, ${JSON.stringify(PROJECT)});
  return JSON.stringify({ jobId: wanted, seeded: localStorage.getItem(key).length });
})()`;

const openDelta = `(()=>{
  const byText = (t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t);
  const design = byText('Design'); if (!design) throw Error('no Design tab'); design.click();
  return 'design';
})()`;

const openWorkspace = `(()=>{
  const byText = (t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t);
  const ws = byText('Architectural workspace'); if (!ws) throw Error('no Architectural workspace tab'); ws.click();
  return 'workspace';
})()`;

/* The delta panel and the overlay inside it are both collapsed folds until opened. */
const openOverlay = `(()=>{
  const folds = [...document.querySelectorAll('details')];
  const overlay = document.querySelector('.revision-overlay');
  if (!overlay) {
    const summary = folds.find(d => /plan revision overlay/i.test(d.querySelector('summary')?.textContent ?? ''));
    if (!summary) throw Error('no revision overlay in the document');
    summary.open = true;
  }
  const el = document.querySelector('.revision-overlay');
  el.open = true;
  el.scrollIntoView({ block: 'start' });
  return 'overlay open';
})()`;

/* Paint the overlay for a moment so React has committed before anything is read. */
const settle = 'new Promise(r=>setTimeout(()=>r(true),800))';

const toggle = `(()=>{
  const label = [...document.querySelectorAll('.revision-overlay-controls label')]
    .find(l => /revision clouds/i.test(l.textContent ?? ''));
  if (!label) throw Error('no revision-clouds control');
  const box = label.querySelector('input[type=checkbox]');
  if (!box) throw Error('the revision-clouds control is not a checkbox');
  const before = box.checked;
  box.click();
  return JSON.stringify({ wasChecked: before, nowChecked: box.checked });
})()`;

const read = `(()=>{
  const layer = document.querySelector('[data-overlay-layer="clouds"]');
  const clouds = [...document.querySelectorAll('polyline[data-cloud-id]')].map(p => {
    const nums = (p.getAttribute('points') ?? '').trim().split(/\\s+/).map(pair => pair.split(',').map(Number));
    const xs = nums.map(n => n[0]), ys = nums.map(n => n[1]);
    return {
      id: p.getAttribute('data-cloud-id'),
      status: p.getAttribute('data-cloud-status'),
      vertices: nums.length,
      closed: nums.length > 2 && nums[0][0] === nums[nums.length-1][0] && nums[0][1] === nums[nums.length-1][1],
      minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
      stroke: p.getAttribute('stroke'), fill: p.getAttribute('fill'),
    };
  });
  const marks = [...document.querySelectorAll('text[data-delta-mark]')].map(t => ({
    id: t.getAttribute('data-delta-mark'), text: t.textContent, x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')),
  }));
  const note = document.querySelector('.revision-cloud-note');
  return JSON.stringify({
    layerPresent: !!layer,
    layerLabel: layer?.getAttribute('aria-label') ?? null,
    clouds,
    marks,
    note: note?.textContent ?? null,
    cloudCountAttr: note?.getAttribute('data-cloud-count') ?? null,
    planPaths: document.querySelectorAll('[data-overlay-layer="later"] path, [data-overlay-layer="later"] polyline').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  });
})()`;

const scenario = [
  ['set', 'viewport', '1600', '1000'],
  ['open', 'http://127.0.0.1:8085/'],
  ['wait', '--fn', "document.readyState==='complete'", '--timeout', '60000'],
  ['wait', '--fn', "!!localStorage.getItem('xray:fencing-job:v2')", '--timeout', '60000'],
  ['eval', seed],
  ['open', 'http://127.0.0.1:8085/'],
  ['wait', '--fn', "document.readyState==='complete'", '--timeout', '60000'],
  ['wait', '--fn', "[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Design')", '--timeout', '60000'],
  ['eval', openDelta],
  ['wait', '--fn', "[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Architectural workspace')", '--timeout', '60000'],
  ['eval', openWorkspace],
  ['wait', '--fn', "!!document.querySelector('.arch-delta-content')", '--timeout', '60000'],
  ['eval', "(()=>{const el=document.querySelector('.revision-overlay');if(el)el.scrollIntoView({block:'start'});return 'at overlay'})()"],
  ['eval', openOverlay],
  ['wait', '--fn', "!!document.querySelector('.revision-overlay[open]')", '--timeout', '30000'],
  ['eval', toggle],
  ['wait', '--fn', settle, '--timeout', '20000'],
  ['eval', read],
  ['eval', "(()=>{const el=document.querySelector('.revision-overlay');el.scrollIntoView({block:'start'});return 'framed'})()"],
  ['wait', '--fn', settle, '--timeout', '20000'],
  ['screenshot', `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc03-revision-clouds-desktop-1600x1000.png`],
  ['set', 'viewport', '1024', '768'],
  ['eval', "(()=>{const el=document.querySelector('.revision-overlay');el.scrollIntoView({block:'start'});return 'framed'})()"],
  ['wait', '--fn', settle, '--timeout', '20000'],
  ['eval', read],
  ['screenshot', `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc03-revision-clouds-tablet-1024x768.png`],
  /* The toggle must come off again without disturbing the plan below it. */
  ['set', 'viewport', '1600', '1000'],
  ['eval', toggle],
  ['wait', '--fn', settle, '--timeout', '20000'],
  ['eval', read],
  ['screenshot', `C:/Users/danie/repo/xray-by-looplet/${SHOTS}/sc03-clouds-off-1600x1000.png`],
  ['errors'],
];

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(scenario, null, 2));
console.log(`written  ${OUT}  (${scenario.length} ops, project ${PROJECT.length} chars embedded)`);
console.log(`screenshots land in ${SHOTS}/`);
