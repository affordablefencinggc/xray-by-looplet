/**
 * build-scenario.mjs — Fast CDP Test Scenario Builder for SC-05:
 * ROOF-02/03 True 3D Hip, Valley & Pitch Surface Geometry Unfolding
 */
import { writeFileSync, mkdirSync } from "node:fs";

const dir = "proof/growth/2026-09-19-sc05-roof-geometry";
const captures = "proof/growth/2026-09-19-sc05-roof-geometry/captures";
const shots = "screenshots/growth/sc05";
mkdirSync(dir, { recursive: true });
mkdirSync(captures, { recursive: true });
mkdirSync(shots, { recursive: true });

const helpers = `
const byLabel = (text) => [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));
const setValue = (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const fill = (text, value) => { const el = byLabel(text)?.querySelector('input,select'); if (!el) throw Error('No field labelled: ' + text); setValue(el, value); return true; };
const click = (text) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === text); if (!b) throw Error('No button: ' + text); if (b.disabled) throw Error('Button disabled: ' + text); b.click(); return true; };
const showSheet = (value) => {
  const w = document.querySelector('.industry-workbench');
  if (!w) throw Error('No industry workbench');
  w.open = true;
  const sel = document.querySelector('.industry-picker select');
  if (!sel) throw Error('No worksheet picker');
  setValue(sel, value);
  return value;
};
const focusOn = (selector) => {
  const el = document.querySelector(selector);
  if (!el) throw Error('Nothing to show for ' + selector);
  el.scrollIntoView({ block: 'center' });
  return 'framed ' + selector;
};
`;

const wrap = (body) => `(() => {${helpers}${body}})()`;

const seed = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const revision = {
    id: 'doc-roof-sc05',
    name: 'Roof Architectural Plan Rev D.pdf',
    kind: 'pdf',
    importedAt: new Date().toISOString(),
    pageCount: 2,
    sha256: 'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffee9988',
    source: 'web'
  };
  const before = store.useStudio.getState().job;
  const opened = ws.restoreDocumentWorkspace({ ...before, documents: [...before.documents.filter(d => d.id !== revision.id), revision] }, revision);
  const points = [{ x: 0, y: 0 }, { x: 400, y: 0 }];
  const candidate = { id: 'cand-manual-1', source: 'manual', metresPerUnit: 0.0125, confidence: 1, inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points, provenance: { method: 'Two-point manual scale', evidence: 'Measured between grid lines A and B', documentId: revision.id } };
  const calibration = { ...opened.calibrations[0], metresPerUnit: 0.0125, source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points, inputDistance: { value: 5, unit: 'm' }, candidates: [candidate], selectedCandidateId: candidate.id };
  let job;
  try { job = domain.fencingJobSchema.parse({ ...opened, calibrations: [calibration, ...opened.calibrations.slice(1)] }); }
  catch (f) { throw Error('seed rejected: ' + JSON.stringify((f.issues ?? []).slice(0, 4))); }
  store.useStudio.setState({ pane: 'cost', job });
  return 'seeded ' + revision.name;
})()`;

const showRoofing = wrap(`
  showSheet('roofing');
  const w = document.querySelector('.industry-workbench');
  if (w) w.open = true;
  return 'roofing worksheet opened';
`);

const assert3DRoofRendered = wrap(`
  const rw = document.querySelector('.roofing-worksheet');
  if (!rw) throw Error('No roofing worksheet in DOM');
  const svg = rw.querySelector('svg');
  if (!svg) throw Error('No SVG roof diagram rendered');
  const polygons = svg.querySelectorAll('polygon');
  if (polygons.length < 4) throw Error('Expected at least 4 roof plane polygons in 3D wireframe, got ' + polygons.length);
  const lines = svg.querySelectorAll('line');
  if (lines.length < 8) throw Error('Expected at least 8 edge lines in 3D wireframe, got ' + lines.length);
  return '3D wireframe verified with ' + polygons.length + ' faces and ' + lines.length + ' edges';
`);

const switchToUnfolded = wrap(`
  click('2D Unfolded Flat Patterns');
  return 'switched to 2d unfolded view';
`);

const assert2DUnfoldedRendered = wrap(`
  const svg = document.querySelector('.roofing-worksheet svg');
  if (!svg) throw Error('No SVG in roofing worksheet');
  const texts = [...svg.querySelectorAll('text')].map(t => t.textContent);
  const hasTrueArea = texts.some(t => t.includes('True Area:'));
  if (!hasTrueArea) throw Error('Unfolded view does not display true area labels');
  return '2D unfolded patterns verified with true area annotations';
`);

const switchToUnequalValley = wrap(`
  const sel = document.querySelector('#' + CSS.escape([...document.querySelectorAll('label')].find(l => l.textContent.includes('Roof Model Preset:'))?.htmlFor));
  if (!sel) throw Error('No preset selector found');
  setValue(sel, 'unequal-valley');
  click('3D Axonometric Wireframe');
  return 'switched to unequal valley preset';
`);

const assertUnequalValleyCalculated = wrap(`
  const notice = document.querySelector('.roofing-worksheet');
  if (!notice || !notice.textContent.includes('Analytic Asymmetrical Valley Intersection')) {
    throw Error('Unequal valley notice not found');
  }
  if (!notice.textContent.includes('35.66°') && !notice.textContent.includes('35.65°')) {
    throw Error('Unequal valley plan angle not displayed accurately');
  }
  if (!notice.textContent.includes('18.60°')) {
    throw Error('Unequal valley slope angle (18.60°) not displayed');
  }
  return 'Unequal valley asymmetrical geometry verified: plan angle ~35.66°, slope 18.60°';
`);

const frameWorksheet = wrap(`
  return focusOn('.roofing-worksheet');
`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seed],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", showRoofing],
  ["wait", "--fn", "!!document.querySelector('.roofing-worksheet')"],

  // 1. Desktop 3D Wireframe inspection
  ["eval", assert3DRoofRendered],
  ["eval", frameWorksheet],
  ["screenshot", `${captures}/sc05-3d-wireframe-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc05-3d-wireframe-desktop-1600x1000.png`],

  // 1b. Desktop Takeoff Tables inspection
  ["eval", wrap(`focusOn('.industry-table-wrap')`)],
  ["screenshot", `${captures}/sc05-takeoff-tables-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc05-takeoff-tables-desktop-1600x1000.png`],

  // 2. Desktop 2D Unfolded Flat Patterns
  ["eval", switchToUnfolded],
  ["wait", "--fn", "document.querySelector('.roofing-worksheet')?.textContent.includes('True Area:')"],
  ["eval", assert2DUnfoldedRendered],
  ["eval", frameWorksheet],
  ["screenshot", `${captures}/sc05-2d-unfolded-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc05-2d-unfolded-desktop-1600x1000.png`],

  // 3. Desktop Unequal Pitch Asymmetrical Valley Junction
  ["eval", switchToUnequalValley],
  ["wait", "--fn", "document.querySelector('.roofing-worksheet')?.textContent.includes('Analytic Asymmetrical Valley Intersection')"],
  ["eval", assertUnequalValleyCalculated],
  ["eval", frameWorksheet],
  ["screenshot", `${captures}/sc05-unequal-valley-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc05-unequal-valley-desktop-1600x1000.png`],

  // 4. Tablet Landscape Responsive Viewport (1024x768)
  ["set", "viewport", "1024", "768"],
  ["eval", frameWorksheet],
  ["screenshot", `${captures}/sc05-roof-inspector-tablet-1024x768.png`],
  ["screenshot", `${shots}/sc05-roof-inspector-tablet-1024x768.png`],

  ["errors"],
];

const outScenario = `${dir}/sc05-roof-geometry.scenario.json`;
writeFileSync(outScenario, JSON.stringify(scenario, null, 2), "utf8");
console.log(`Scenario written to ${outScenario} (${scenario.length} operations).`);
