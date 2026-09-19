/**
 * build-scenario.mjs — Fast CDP Test Scenario Builder for SC-08:
 * QS-01/02 Hierarchy CSV Overlap Disclosure & Tablet Report Compilation
 */
import { writeFileSync, mkdirSync } from "node:fs";

const dir = "proof/growth/2026-09-19-sc08-qs-hierarchy";
const captures = "proof/growth/2026-09-19-sc08-qs-hierarchy/captures";
const shots = "screenshots/growth/sc08";
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

const seedAndPopulateQS = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const storage = await import('/src/studio/industries/draftStorage.ts');

  const revision = {
    id: 'doc-qs-sc08',
    name: 'Commercial Office Takeoff Package Rev C.pdf',
    kind: 'pdf',
    importedAt: new Date().toISOString(),
    pageCount: 3,
    sha256: '778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566',
    source: 'web'
  };

  const before = store.useStudio.getState().job;
  const opened = ws.restoreDocumentWorkspace({ ...before, documents: [...before.documents.filter(d => d.id !== revision.id), revision] }, revision);
  const points = [{ x: 0, y: 0 }, { x: 500, y: 0 }];
  const candidate = { id: 'cand-manual-qs', source: 'manual', metresPerUnit: 0.01, confidence: 1, inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points, provenance: { method: 'Two-point manual scale', evidence: 'Standard 5m grid', documentId: revision.id } };
  const calibration = { ...opened.calibrations[0], metresPerUnit: 0.01, source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points, inputDistance: { value: 5, unit: 'm' }, candidates: [candidate], selectedCandidateId: candidate.id };
  let job;
  try { job = domain.fencingJobSchema.parse({ ...opened, calibrations: [calibration, ...opened.calibrations.slice(1)] }); }
  catch (f) { throw Error('seed rejected: ' + JSON.stringify((f.issues ?? []).slice(0, 4))); }
  store.useStudio.setState({ pane: 'cost', job });

  // Strictly schema-valid QuantityForm adhering to quantityFormSchema
  const nodeSub = { key: 'node-sub', code: '01', label: 'Substructure', parentKey: '' };
  const nodeFoot = { key: 'node-foot', code: '01.01', label: 'Concrete Footings', parentKey: 'node-sub' };
  const nodeSuper = { key: 'node-super', code: '02', label: 'Superstructure', parentKey: '' };
  const nodeFrame = { key: 'node-frame', code: '02.01', label: 'Structural Framing', parentKey: 'node-super' };

  const item1 = { key: 'item-exc', reference: 'Bulk Trench Excavation', quantity: '45.5', unit: 'm3', evidence: 'sample', nodeKey: 'node-sub' };
  const item2 = { key: 'item-pad', reference: 'Reinforced Concrete Pad Footings', quantity: '12.25', unit: 'm3', evidence: 'sample', nodeKey: 'node-foot' };
  const item3 = { key: 'item-posts', reference: '150UC Universal Column Steel Posts', quantity: '24', unit: 'ea', evidence: 'sample', nodeKey: 'node-frame' };
  const item4 = { key: 'item-joists', reference: '240x45 Structural Pine Floor Joists', quantity: '150.0', unit: 'lm', evidence: 'inferred', nodeKey: 'node-frame' };
  const item5 = { key: 'item-shed', reference: 'Site Amenities & Storage Shed', quantity: '1', unit: 'ea', evidence: 'unverified', nodeKey: '' };

  const qsForm = {
    hierarchyId: 'QS Commercial Takeoff Schedule',
    hierarchyRevision: 'Rev-D',
    calculated: true,
    binding: null,
    nodes: [nodeSub, nodeFoot, nodeSuper, nodeFrame],
    items: [item1, item2, item3, item4, item5]
  };

  const key = storage.industryDraftKey(before.id);
  const library = {
    format: 'xray.industry-drafts/1',
    projectId: before.id,
    revision: 1,
    drafts: {
      'quantity-surveying': {
        revision: 1,
        form: qsForm
      }
    }
  };
  localStorage.setItem(key, JSON.stringify(library));

  return 'Seeded project and saved QS draft';
})()`;

const showQS = wrap(`
  showSheet('quantity-surveying');
  const w = document.querySelector('.industry-workbench');
  if (w) w.open = true;
  return 'quantity surveying worksheet opened';
`);

const assertQSReportRendered = wrap(`
  const panel = document.querySelector('.qs-report-panel');
  if (!panel) throw Error('No .qs-report-panel found in DOM');

  // Verify warning banner
  const banner = panel.querySelector('.qs-overlap-warning-banner');
  if (!banner) throw Error('Missing .qs-overlap-warning-banner');
  if (!banner.textContent.includes('NOTICE: Parent nodes represent aggregate sub-totals. Do not sum total column blindly.')) {
    throw Error('Warning banner text missing required disclosure');
  }

  // Verify breakdown table
  const hierarchySection = panel.querySelector('.qs-hierarchy-section');
  if (!hierarchySection) throw Error('Missing .qs-hierarchy-section table');

  // Verify SUMMARY_NODE and LEAF_ITEM badges
  const text = hierarchySection.textContent;
  if (!text.includes('SUMMARY_NODE')) throw Error('Missing SUMMARY_NODE tags');
  if (!text.includes('LEAF_ITEM')) throw Error('Missing LEAF_ITEM tags');
  if (!text.includes('AGGREGATE — DO NOT SUM')) throw Error('Missing aggregate warning in rows');

  // Verify export buttons
  const hierBtn = panel.querySelector('[data-testid="export-hierarchical-csv-btn"]');
  if (!hierBtn) throw Error('Missing Hierarchical CSV export button');

  return 'QS report, warning banner, and hierarchy breakdown verified';
`);

const filterSubtreeSubstructure = wrap(`
  const select = byLabel('Classification branch')?.querySelector('select');
  if (!select) throw Error('No branch select');
  setValue(select, '01');
  return 'Filtered to 01 Substructure';
`);

const filterUnassigned = wrap(`
  const select = byLabel('Show quantities')?.querySelector('select');
  if (!select) throw Error('No show quantities select');
  setValue(select, 'unassigned');
  return 'Filtered to unassigned items';
`);

const resetFilterAll = wrap(`
  const select = byLabel('Show quantities')?.querySelector('select');
  if (!select) throw Error('No show quantities select');
  setValue(select, 'all');
  const branch = byLabel('Classification branch')?.querySelector('select');
  if (branch) setValue(branch, '');
  return 'Reset to all items';
`);

const frameTop = wrap(`
  return focusTop('.qs-report-panel');
`);

const frameHierarchyTable = wrap(`
  return focusOn('.qs-hierarchy-section');
`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seedAndPopulateQS],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", showQS],
  ["wait", "--fn", "!!document.querySelector('.qs-report-panel')"],
  ["eval", assertQSReportRendered],

  // Capture 1: Desktop - Warning Banner and Grand Totals (1600x1000)
  ["eval", frameTop],
  ["screenshot", `${captures}/sc08-qs-report-warning-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc08-qs-report-warning-desktop-1600x1000.png`],

  // Capture 2: Desktop - Hierarchy Breakdown Table with SUMMARY_NODE / LEAF_ITEM distinction (1600x1000)
  ["eval", frameHierarchyTable],
  ["screenshot", `${captures}/sc08-qs-report-hierarchy-table-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc08-qs-report-hierarchy-table-desktop-1600x1000.png`],

  // Capture 3: Desktop - Filtered Subtree (Substructure) (1600x1000)
  ["eval", filterSubtreeSubstructure],
  ["wait", "--fn", "document.querySelector('.qs-hierarchy-section')?.textContent.includes('Substructure')"],
  ["eval", frameTop],
  ["screenshot", `${captures}/sc08-qs-report-filter-subtree-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc08-qs-report-filter-subtree-desktop-1600x1000.png`],

  // Capture 4: Desktop - Filtered Unassigned Items (1600x1000)
  ["eval", filterUnassigned],
  ["wait", "--fn", "document.querySelector('.qs-hierarchy-section')?.textContent.includes('Site Amenities')"],
  ["eval", frameTop],
  ["screenshot", `${captures}/sc08-qs-report-unassigned-desktop-1600x1000.png`],
  ["screenshot", `${shots}/sc08-qs-report-unassigned-desktop-1600x1000.png`],

  // Capture 5: Tablet Landscape (1024x768) Viewport
  ["eval", resetFilterAll],
  ["set", "viewport", "1024", "768"],
  ["eval", frameHierarchyTable],
  ["screenshot", `${captures}/sc08-qs-report-tablet-1024x768.png`],
  ["screenshot", `${shots}/sc08-qs-report-tablet-1024x768.png`],

  ["errors"],
];

const outScenario = `${dir}/sc08-qs-hierarchy.scenario.json`;
writeFileSync(outScenario, JSON.stringify(scenario, null, 2), "utf8");
console.log(`Scenario written to ${outScenario} (${scenario.length} operations).`);
