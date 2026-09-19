/**
 * build-scenario.mjs — Fast CDP Test Scenario Builder for SC-06:
 * ROOF-04 Stock Sheet Layout, Kerf, Nesting & Offcut Classification
 */
import { writeFileSync, mkdirSync } from "node:fs";

const dir = "proof/growth/2026-09-19-sc06-stock-nesting";
const captures = "proof/growth/2026-09-19-sc06-stock-nesting/captures";
const shots = "screenshots/growth/sc06";
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
const click = (text) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(text)); if (!b) throw Error('No button: ' + text); if (b.disabled) throw Error('Button disabled: ' + text); b.click(); return true; };
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
const focusTop = (selector) => {
  const el = document.querySelector(selector);
  if (!el) throw Error('Nothing to show for ' + selector);
  el.scrollIntoView({ block: 'start' });
  return 'framed top ' + selector;
};
`;

const wrap = (body) => `(() => {${helpers}${body}})()`;

const seed = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const revision = {
    id: 'doc-roof-sc06',
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

const switchToStockNesting = wrap(`
  click('Stock Nesting & Cut List (ROOF-04)');
  return 'switched to stock nesting tab';
`);

const assertStockNestingRendered = wrap(`
  const panel = document.querySelector('[data-testid="cutting-list-panel"]');
  if (!panel) throw Error('No cutting list panel found in DOM');
  const diagram = panel.querySelector('[data-testid="cutting-diagram-container"]');
  if (!diagram) throw Error('No cutting diagram container found');
  const svgs = diagram.querySelectorAll('svg');
  if (svgs.length === 0) throw Error('No stock sheet SVG bars rendered');
  const text = panel.textContent;
  if (!text.includes('Total Stock Ordered')) throw Error('Missing Total Stock Ordered KPI card');
  if (!text.includes('Reusable Offcuts')) throw Error('Missing Reusable Offcuts KPI card');
  if (!text.includes('Scrap & Kerf Waste')) throw Error('Missing Scrap & Kerf Waste KPI card');
  return 'Stock nesting verified with ' + svgs.length + ' stock sheets rendered';
`);

const switchToSamplePreset = wrap(`
  click('Sample Preset (12 Cuts)');
  return 'switched to sample preset (12 cuts)';
`);

const assertSamplePresetActive = wrap(`
  const panel = document.querySelector('[data-testid="cutting-list-panel"]');
  if (!panel) throw Error('No cutting list panel found');
  const text = panel.textContent;
  if (!text.includes('North Rafter 1') && !text.includes('East Hip Taper')) {
    throw Error('Sample preset cuts not reflected in panel');
  }
  return 'Sample preset verified with custom rafter and taper cuts';
`);

const frameCuttingDiagram = wrap(`
  return focusOn('[data-testid="cutting-diagram-container"]');
`);

const frameTakeoffTable = wrap(`
  return focusOn('.industry-table-wrap');
`);

const framePanel = wrap(`
  return focusOn('[data-testid="cutting-list-panel"]');
`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seed],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", showRoofing],
  ["wait", "--fn", "!!document.querySelector('.roofing-worksheet')"],

  // 1. Switch to Stock Nesting & Cut List Tab
  ["eval", switchToStockNesting],
  ["wait", "--fn", "!!document.querySelector('[data-testid=\"cutting-list-panel\"]')"],
  ["eval", assertStockNestingRendered],

  // Capture 1: Desktop KPI Summary Cards & Parameters (1600x1000)
  ["eval", wrap(`return focusTop('[data-testid="cutting-list-panel"]');`)],
  ["screenshot", `${captures}/sc06-stock-nesting-kpi-controls-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc06-stock-nesting-kpi-controls-desktop-1600x1000.png`],

  // Capture 1b: Desktop Full Cutting Diagrams (1600x1000)
  ["eval", frameCuttingDiagram],
  ["screenshot", `${captures}/sc06-stock-nesting-diagram-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc06-stock-nesting-diagram-desktop-1600x1000.png`],

  // Capture 2: Desktop Takeoff & Offcut Allocation Table
  ["eval", frameTakeoffTable],
  ["screenshot", `${captures}/sc06-stock-nesting-takeoff-table-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc06-stock-nesting-takeoff-table-desktop-1600x1000.png`],

  // 2. Switch to Sample Preset (12 Cuts)
  ["eval", switchToSamplePreset],
  ["wait", "--fn", "document.querySelector('[data-testid=\"cutting-list-panel\"]')?.textContent.includes('North Rafter')"],
  ["eval", assertSamplePresetActive],

  // Capture 3: Desktop Sample Preset Nesting Layout
  ["eval", framePanel],
  ["screenshot", `${captures}/sc06-stock-nesting-sample-preset-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc06-stock-nesting-sample-preset-desktop-1600x1000.png`],

  // 3. Tablet Landscape Responsive Viewport (1024x768)
  ["set", "viewport", "1024", "768"],
  ["eval", framePanel],
  ["screenshot", `${captures}/sc06-stock-nesting-tablet-1024x768.png`],
  ["screenshot", `${shots}/sc06-stock-nesting-tablet-1024x768.png`],

  ["errors"],
];

const outScenario = `${dir}/sc06-stock-nesting.scenario.json`;
writeFileSync(outScenario, JSON.stringify(scenario, null, 2), "utf8");
console.log(`Scenario written to ${outScenario} (${scenario.length} operations).`);
