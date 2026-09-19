import fs from "node:fs";

/** The eval opcode sends its string as a script body, so a bare top-level
 *  `return` is a SyntaxError. Every payload is wrapped in an IIFE so it can hand
 *  a value back to the runner. */
const iife = (body) => `(() => {\n${body}\n})()`;

/** Shared in-page helpers. Every eval below is a standalone closure: the CDP
 *  batch sends each opcode to a fresh execution, so nothing can be carried in
 *  module scope between steps. */
const PRELUDE = [
  "const byLabel = (text) => [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));",
  "const setValue = (el, value) => {",
  "  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;",
  "  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);",
  "  el.dispatchEvent(new Event('input', { bubbles: true }));",
  "  el.dispatchEvent(new Event('change', { bubbles: true }));",
  "};",
  "const ledger = () => document.querySelector('[data-testid=\"qs-item-binding-ledger\"]');",
  "const statuses = (el) => [...el.querySelectorAll('[data-binding-status]')].map(r => r.getAttribute('data-binding-status'));",
  "const notice = (el) => el.querySelector('[data-testid=\"qs-binding-withheld-notice\"]');",
  "const pricing = (el, id) => el.querySelector('[data-testid=\"qs-binding-pricing-' + id + '\"]');",
  "const focusTop = (s) => { const el = document.querySelector(s); if (!el) throw Error('Nothing to show for ' + s); el.scrollIntoView({ block: 'start' }); return 'framed ' + s; };",
].join("\n");

const SEED = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const storage = await import('/src/studio/industries/draftStorage.ts');

  const revision = {
    id: 'doc-qs-sc09', name: 'Commercial Office Takeoff Package Rev C.pdf', kind: 'pdf',
    importedAt: new Date().toISOString(), pageCount: 3,
    sha256: '998877aabbccddeeff00112233445566778899aabbccddeeff00112233445566', source: 'web'
  };

  const before = store.useStudio.getState().job;
  const opened = ws.restoreDocumentWorkspace({ ...before, documents: [...before.documents.filter(d => d.id !== revision.id), revision] }, revision);
  const points = [{ x: 0, y: 0 }, { x: 500, y: 0 }];
  const candidate = { id: 'cand-manual-qs9', source: 'manual', metresPerUnit: 0.01, confidence: 1, inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points, provenance: { method: 'Two-point manual scale', evidence: 'Standard 5m grid', documentId: revision.id } };
  const calibration = { ...opened.calibrations[0], metresPerUnit: 0.01, source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points, inputDistance: { value: 5, unit: 'm' }, candidates: [candidate], selectedCandidateId: candidate.id };
  let job;
  try { job = domain.fencingJobSchema.parse({ ...opened, calibrations: [calibration, ...opened.calibrations.slice(1)] }); }
  catch (f) { throw Error('seed rejected: ' + JSON.stringify((f.issues ?? []).slice(0, 4))); }
  store.useStudio.setState({ pane: 'cost', job });

  const nodeA = { key: 'n-a', code: '01', label: 'Substructure', parentKey: '' };
  const nodeB = { key: 'n-b', code: '01.01', label: 'Concrete Footings', parentKey: 'n-a' };
  const item1 = { key: 'item-exc', reference: 'Bulk Trench Excavation', quantity: '45.5', unit: 'm3', evidence: 'sample', nodeKey: 'n-a' };
  const item2 = { key: 'item-pad', reference: 'Reinforced Concrete Pad Footings', quantity: '12.25', unit: 'm3', evidence: 'sample', nodeKey: 'n-b' };
  const item3 = { key: 'item-posts', reference: '150UC Universal Column Steel Posts', quantity: '24', unit: 'ea', evidence: 'inferred', nodeKey: 'n-a' };
  const qsForm = { hierarchyId: 'QS Item Binding Schedule', hierarchyRevision: 'Rev-E', calculated: true, binding: null,
    nodes: [nodeA, nodeB], items: [item1, item2, item3] };

  const key = storage.industryDraftKey(before.id);
  localStorage.setItem(key, JSON.stringify({ format: 'xray.industry-drafts/1', projectId: before.id, revision: 1,
    drafts: { 'quantity-surveying': { revision: 1, form: qsForm } } }));
  return 'Seeded project, calibration and QS draft for SC-09';
})()`;

const OPEN_QS = `${PRELUDE}
  const w = document.querySelector('.industry-workbench');
  if (!w) throw Error('No industry workbench');
  w.open = true;
  const sel = document.querySelector('.industry-picker select');
  if (!sel) throw Error('No worksheet picker');
  setValue(sel, 'quantity-surveying');
  return 'QS worksheet selected';`;

/** Every row carrying a reference, a quantity and a unit gets bound to the
 *  geometry derived from exactly those three values, so a freshly calculated
 *  draft is fully bound and fully verified. This is the baseline the edits below
 *  perturb, and perturbing it is the whole point of the slice. */
const CHECK_BOUND = `${PRELUDE}
  const el = ledger();
  if (!el) throw Error('No item binding ledger rendered');
  const rows = statuses(el);
  if (rows.length !== 3) throw Error('Expected 3 binding rows, got ' + rows.length);
  if (rows.some(s => s !== 'verified')) throw Error('Expected every row verified in a fresh draft, got: ' + rows.join(','));
  if (notice(el)) throw Error('Withheld notice shown while every item is verified');
  if (!pricing(el, 'Bulk Trench Excavation').textContent.includes('Permitted')) throw Error('A verified item did not permit pricing');
  if (el.textContent.includes('NOT BOUND')) throw Error('A fresh draft rendered an unbound row');
  return 'Fresh draft: 3 rows verified, no withheld notice, all pricing permitted';`;

/** Types into the worksheet like a user would. This is the whole point of the
 *  slice: the ledger must re-derive, not re-read a stored verdict. */
const CHANGE_QUANTITY = `${PRELUDE}
  const field = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Quantity 1'))?.querySelector('input');
  if (!field) throw Error('No Quantity 1 input');
  setValue(field, '99');
  return 'Typed 99 into Quantity 1';`;

const CHECK_STALE = `${PRELUDE}
  const el = ledger();
  if (!el) throw Error('No ledger after the edit');
  const rows = statuses(el);
  if (rows.length !== 3) throw Error('Ledger lost rows during an edit: ' + rows.join(','));
  const row = el.querySelector('[data-testid="qs-binding-row-Bulk Trench Excavation"]');
  if (!row) throw Error('No ledger row for Bulk Trench Excavation');
  if (row.getAttribute('data-binding-status') !== 'stale-measurement')
    throw Error('Edited item is not stale-measurement: ' + row.getAttribute('data-binding-status'));
  const cell = row.querySelector('td:nth-child(2)');
  if (!cell.textContent.includes('99')) throw Error('Ledger did not read the new quantity: ' + cell.textContent);
  if (!pricing(el, 'Bulk Trench Excavation').textContent.includes('Withheld')) throw Error('Stale item did not withhold pricing');
  // Only the edited row may go stale: an over-broad invalidation would be a bug
  // wearing the costume of caution.
  const others = rows.filter((s, i) => i !== 0);
  if (others.some(s => s !== 'verified')) throw Error('An untouched row went stale too: ' + rows.join(','));
  const banner = notice(el);
  if (!banner) throw Error('No withheld notice while an item is stale');
  if (!banner.textContent.includes('Pricing withheld on 1 item')) throw Error('Withheld count is not 1: ' + banner.textContent.slice(0, 200));
  if (!banner.textContent.includes('1 stale-measurement')) throw Error('Withheld notice does not name the stale state: ' + banner.textContent.slice(0, 200));
  return 'Edited row re-derived to stale-measurement with pricing withheld; the other two stayed verified: ' + rows.join(',');`;

/** Proves the other direction: editing an item back to a value that matches its
 *  binding must return it to verified, and the withheld notice must shrink. */
const CHECK_RECOVERS = `${PRELUDE}
  const el = ledger();
  if (!el) throw Error('No ledger');
  const rows = statuses(el);
  if (rows.length !== 3) throw Error('Ledger lost rows: ' + rows.join(','));
  if (rows.some(s => s !== 'verified')) throw Error('Item did not return to verified after its quantity was restored: ' + rows.join(','));
  // The notice must clear in this direction. A guard that only ever withholds is
  // indistinguishable from one that withholds unconditionally.
  if (notice(el)) throw Error('Withheld notice still shown after every item recovered: ' + notice(el).textContent.slice(0, 200));
  const row = el.querySelector('[data-testid="qs-binding-row-Bulk Trench Excavation"]');
  const cell = row.querySelector('td:nth-child(2)');
  if (!cell.textContent.includes('45.5')) throw Error('Quantity did not restore: ' + cell.textContent);
  return 'Restored quantity cleared staleness: every row verified, notice gone.';`;

const RESTORE_QUANTITY = `${PRELUDE}
  const field = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Quantity 1'))?.querySelector('input');
  if (!field) throw Error('No Quantity 1 input');
  setValue(field, '45.5');
  return 'Restored Quantity 1 to 45.5';`;

const OPEN_QS_AGAIN = `${PRELUDE}
  const w = document.querySelector('.industry-workbench');
  if (w) w.open = true;
  return focusTop('[data-testid="qs-item-binding-ledger"]');`;

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", SEED],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", iife(OPEN_QS)],
  ["wait", "--fn", "!!document.querySelector('[data-testid=\"qs-item-binding-ledger\"]')"],
  ["eval", iife(CHECK_BOUND)],
  ["eval", iife(focusEval())],
  ["screenshot", "proof/growth/2026-09-19-sc09-item-binding/captures/sc09-binding-all-bound-verified-desktop-1600x1000.png"],
  ["screenshot", "screenshots/growth/sc09/sc09-binding-all-bound-verified-desktop-1600x1000.png"],
  ["eval", iife(CHANGE_QUANTITY)],
  ["wait", "--fn", "document.querySelector('[data-testid=\"qs-binding-row-Bulk Trench Excavation\"]')?.getAttribute('data-binding-status')==='stale-measurement'"],
  ["eval", iife(CHECK_STALE)],
  ["eval", iife(focusEval())],
  ["screenshot", "proof/growth/2026-09-19-sc09-item-binding/captures/sc09-binding-stale-after-edit-desktop-1600x1000.png"],
  ["screenshot", "screenshots/growth/sc09/sc09-binding-stale-after-edit-desktop-1600x1000.png"],
  ["eval", iife(RESTORE_QUANTITY)],
  ["wait", "--fn", "document.querySelector('[data-testid=\"qs-binding-pricing-Bulk Trench Excavation\"]')?.textContent.includes('Permitted')"],
  ["eval", iife(CHECK_RECOVERS)],
  ["eval", iife(focusEval())],
  ["screenshot", "proof/growth/2026-09-19-sc09-item-binding/captures/sc09-binding-recovered-verified-desktop-1600x1000.png"],
  ["screenshot", "screenshots/growth/sc09/sc09-binding-recovered-verified-desktop-1600x1000.png"],
  ["set", "viewport", "1024", "768"],
  ["eval", iife(OPEN_QS_AGAIN)],
  ["screenshot", "proof/growth/2026-09-19-sc09-item-binding/captures/sc09-binding-tablet-1024x768.png"],
  ["screenshot", "screenshots/growth/sc09/sc09-binding-tablet-1024x768.png"],
  ["errors"],
];

function focusEval() {
  return `${PRELUDE}
  return focusTop('[data-testid="qs-item-binding-ledger"]');`;
}

fs.writeFileSync(new URL("./sc09-item-binding.scenario.json", import.meta.url), JSON.stringify(scenario, null, 2));
console.log("scenario commands:", scenario.length);
