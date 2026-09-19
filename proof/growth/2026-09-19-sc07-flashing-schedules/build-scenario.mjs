/**
 * build-scenario.mjs — Fast CDP Test Scenario Builder for SC-07:
 * ROOF-05/06 Flashing, Fixing Schedules & Full Takeoff Export Deliverable
 */
import { writeFileSync, mkdirSync } from "node:fs";

const dir = "proof/growth/2026-09-19-sc07-flashing-schedules";
const captures = "proof/growth/2026-09-19-sc07-flashing-schedules/captures";
const shots = "screenshots/growth/sc07";
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
    id: 'doc-roof-sc07',
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

const switchToFlashingsTab = wrap(`
  click('Flashings & Fixings (ROOF-05/06)');
  return 'switched to flashings and fixings tab';
`);

const assertFlashingsRendered = wrap(`
  const panel = document.querySelector('[data-testid="flashing-fixings-panel"]');
  if (!panel) throw Error('No flashing fixings panel found in DOM');
  const table = panel.querySelector('[data-testid="flashing-table-wrap"]');
  if (!table) throw Error('No flashing table wrap found');
  const fastenerCard = panel.querySelector('[data-testid="fastener-schedule-card"]');
  if (!fastenerCard) throw Error('No fastener schedule card found');
  const sealCard = panel.querySelector('[data-testid="delivery-seal-card"]');
  if (!sealCard) throw Error('No cryptographic delivery seal card found');
  if (!sealCard.textContent.includes('SHA-256:')) throw Error('Missing SHA-256 seal hash');
  return 'Flashings, fasteners and cryptographic seal verified';
`);

const changeToHighWindN4 = wrap(`
  const sel = document.querySelector('#' + CSS.escape([...document.querySelectorAll('label')].find(l => l.textContent.includes('AS 4055 Wind Classification'))?.htmlFor));
  if (!sel) throw Error('No wind classification select');
  setValue(sel, 'N4');

  const subSel = document.querySelector('#' + CSS.escape([...document.querySelectorAll('label')].find(l => l.textContent.includes('Batten Substrate'))?.htmlFor));
  if (!subSel) throw Error('No substrate select');
  setValue(subSel, 'steel-battens');

  return 'updated wind to N4 and substrate to steel-battens';
`);

const assertHighWindN4Active = wrap(`
  const card = document.querySelector('[data-testid="fastener-schedule-card"]');
  if (!card) throw Error('No fastener card');
  const text = card.textContent;
  if (!text.includes('TEK-12-20-C4') && !text.includes('AutoTek')) {
    throw Error('Fastener profile did not update to AutoTek steel screw');
  }
  if (!text.includes('7.5') || !text.includes('10.5')) {
    throw Error('Fastener densities did not scale to N4 standard (7.5 / 10.5 screws/m²)');
  }
  return 'Wind N4 and AutoTek screw profile verified';
`);

const frameTopControls = wrap(`
  return focusTop('[data-testid="flashing-fixings-panel"]');
`);

const frameFlashingTable = wrap(`
  return focusOn('[data-testid="flashing-table-wrap"]');
`);

const frameFastenerAndSeal = wrap(`
  return focusOn('[data-testid="delivery-seal-card"]');
`);

const framePanel = wrap(`
  return focusOn('[data-testid="flashing-fixings-panel"]');
`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seed],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", showRoofing],
  ["wait", "--fn", "!!document.querySelector('.roofing-worksheet')"],

  // 1. Switch to Flashings & Fixings Tab
  ["eval", switchToFlashingsTab],
  ["wait", "--fn", "!!document.querySelector('[data-testid=\"flashing-fixings-panel\"]')"],
  ["eval", assertFlashingsRendered],

  // Capture 1: Desktop KPI Summary Cards & Parameters (1600x1000)
  ["eval", frameTopControls],
  ["screenshot", `${captures}/sc07-flashing-kpi-controls-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc07-flashing-kpi-controls-desktop-1600x1000.png`],

  // Capture 2: Desktop Flashing Girth & Quantity Takeoff Table (1600x1000)
  ["eval", frameFlashingTable],
  ["screenshot", `${captures}/sc07-flashing-schedule-table-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc07-flashing-schedule-table-desktop-1600x1000.png`],

  // Capture 3: Desktop Fastener Schedule & Cryptographic Delivery Seal (1600x1000)
  ["eval", frameFastenerAndSeal],
  ["screenshot", `${captures}/sc07-fastener-and-seal-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc07-fastener-and-seal-desktop-1600x1000.png`],

  // 2. Change Wind Zone to N4 & Substrate to Steel Battens
  ["eval", changeToHighWindN4],
  ["wait", "--fn", "document.querySelector('[data-testid=\"fastener-schedule-card\"]')?.textContent.includes('AutoTek')"],
  ["eval", assertHighWindN4Active],

  // Capture 4: Updated High-Wind N4 Schedule & AutoTek Screws
  ["eval", frameFastenerAndSeal],
  ["screenshot", `${captures}/sc07-wind-n4-fastener-update-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc07-wind-n4-fastener-update-desktop-1600x1000.png`],

  // 3. Tablet Landscape Responsive Viewport (1024x768)
  ["set", "viewport", "1024", "768"],
  ["eval", frameTopControls],
  ["screenshot", `${captures}/sc07-flashing-tablet-1024x768.png`],
  ["screenshot", `${shots}/sc07-flashing-tablet-1024x768.png`],

  ["errors"],
];

const outScenario = `${dir}/sc07-flashing-schedules.scenario.json`;
writeFileSync(outScenario, JSON.stringify(scenario, null, 2), "utf8");
console.log(`Scenario written to ${outScenario} (${scenario.length} operations).`);
