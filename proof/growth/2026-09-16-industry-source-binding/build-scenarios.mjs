/** Builds the Fast CDP scenarios for the source-binding browser proof. Run with node from the repo root. */
import { writeFileSync, mkdirSync } from "node:fs";

const dir = "proof/growth/2026-09-16-industry-source-binding/scenarios";
const shots = "proof/growth/2026-09-16-industry-source-binding/screenshots";
mkdirSync(dir, { recursive: true });
mkdirSync(shots, { recursive: true });

const SHA_A = "c0ffee".repeat(10) + "abcd";
const SHA_B = "beef01".repeat(10) + "2345";

/** Shared in-page helpers. Every UI-driving eval is wrapped as synced JS, never as a bare script. */
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
const showSheet = (value) => { const w = document.querySelector('.industry-workbench'); if (!w) throw Error('No industry workbench'); w.open = true; const sel = document.querySelector('.industry-picker select'); if (!sel) throw Error('No worksheet picker'); setValue(sel, value); return value; };
const labelPresent = (text) => [...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith(text));
const focusOn = (selector) => { const el = document.querySelector(selector); if (!el) throw Error('Nothing to show for ' + selector); el.scrollIntoView({ block: 'center' }); return 'framed ' + selector; };
const focusCaption = (text) => { const c = [...document.querySelectorAll('caption')].find(x => x.textContent.trim() === text); if (!c) throw Error('No table captioned ' + text); c.scrollIntoView({ block: 'center' }); return 'framed table ' + text; };
`;

/** Wrap a body as a synchronous in-page closure: a bare script cannot use `return`. */
const wrap = (body) => `(() => {${helpers}${body}})()`;

/** Scroll a region into frame before its screenshot, so the capture shows the state it names. */
const frame = (selector) => wrap(`return focusOn(${JSON.stringify(selector)});`);
const frameCaption = (text) => wrap(`return focusCaption(${JSON.stringify(text)});`);
const show = (value) => wrap(`showSheet('${value}'); return 'showing ${value}';`);
const labelWait = (text) => `[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('${text}'))`;
const buttonWait = (text) => `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '${text}' && !b.disabled)`;

const seed = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const revision = { id: 'doc-ground-floor', name: 'Ground floor plan rev C.pdf', kind: 'pdf', importedAt: new Date().toISOString(), pageCount: 3, sha256: '${SHA_A}', source: 'web' };
  const before = store.useStudio.getState().job;
  // Start from an unbound worksheet so the scenario proves the bind action, not a leftover draft.
  Object.keys(localStorage).filter(k => k.startsWith('xray.industry-drafts.v1:')).forEach(k => localStorage.removeItem(k));
  const opened = ws.restoreDocumentWorkspace({ ...before, documents: [...before.documents.filter(d => d.id !== revision.id), revision] }, revision);
  // A locked manual calibration on sheet 0: the record shape the calibration UI itself writes.
  const points = [{ x: 0, y: 0 }, { x: 400, y: 0 }];
  const candidate = { id: 'cand-manual-1', source: 'manual', metresPerUnit: 0.0125, confidence: 1, inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points, provenance: { method: 'Two-point manual scale', evidence: 'Measured between grid lines A and B on the source', documentId: revision.id } };
  const calibration = { ...opened.calibrations[0], metresPerUnit: 0.0125, source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points, inputDistance: { value: 5, unit: 'm' }, candidates: [candidate], selectedCandidateId: candidate.id };
  let job;
  try { job = domain.fencingJobSchema.parse({ ...opened, calibrations: [calibration, ...opened.calibrations.slice(1)] }); }
  catch (failure) { throw Error('seed rejected: ' + JSON.stringify((failure.issues ?? []).slice(0, 4))); }
  store.useStudio.setState({ pane: 'cost', job });
  return 'seeded ' + revision.name + ' activeDocumentId=' + job.activeDocumentId + ' sha=' + job.documents[job.documents.length - 1].sha256.slice(0, 8);
})()`;

const showCost = `(async () => { const store = await import('/src/studio/store.ts'); store.useStudio.setState({ pane: 'cost' }); return 'cost pane'; })()`;

const fillRoof = wrap(`
fill('Plane name', 'North plane');
fill('Horizontal plan area', '120');
fill('Pitch from horizontal', '35');
fill('Area reference', 'Plan sheet A-201, scaled at 0.0125 m/unit');
fill('Pitch reference', 'Section B-B, geometric pitch');
click('Calculate draft roof areas');
return 'roof inputs entered';`);

const bindRoof = wrap(`
const sheet = document.querySelector('.industry-workbench').textContent;
if (!sheet.includes('Binds to')) throw Error('Roof sheet does not offer the current source');
if (!sheet.includes('Ground floor plan rev C.pdf')) throw Error('Roof sheet does not name the open source');
fill('Source page index', '1');
fill('Evidence class', 'traced');
fill('Reference', 'North plane traced on plan sheet A-201');
click('Bind to current project source');
return 'roof bind requested';`);

const assertRoofSaved = wrap(`
const key = Object.keys(localStorage).filter(k => k.startsWith('xray.industry-drafts.v1:'))[0];
if (!key) throw Error('No industry draft library in this project');
const library = JSON.parse(localStorage.getItem(key));
const b = library.drafts.roofing.form.binding;
if (!b) throw Error('Roofing draft has no saved binding');
const expect = { schema: 'xray.industry-source-binding/1', projectId: library.projectId, sourceRevisionId: 'doc-ground-floor', sha256: '${SHA_A}', sourceName: 'Ground floor plan rev C.pdf', units: 'm', evidenceClass: 'traced', reference: 'North plane traced on plan sheet A-201' };
for (const [field, value] of Object.entries(expect)) if (b[field] !== value) throw Error('Saved binding ' + field + ' is ' + b[field] + ', expected ' + value);
if (b.calibrationId !== 'cal:0:manual:0.0125:cand-manual-1') throw Error('Saved binding calibration is ' + b.calibrationId);
if (b.locator.kind !== 'page' || b.locator.pageIndex !== 1) throw Error('Saved locator is ' + JSON.stringify(b.locator));
if (library.drafts.roofing.form.planes[0].grossPlanAreaM2 !== '120') throw Error('Saved plane area is not the entered value');
return JSON.stringify(b);`);

const reviseSource = (sha) => `(async () => {
  const store = await import('/src/studio/store.ts');
  const domain = await import('/src/studio/domain.ts');
  const job = store.useStudio.getState().job;
  const documents = job.documents.map(d => d.id === 'doc-ground-floor' ? { ...d, sha256: '${sha}' } : d);
  let next;
  try { next = domain.fencingJobSchema.parse({ ...job, documents }); }
  catch (failure) { throw Error('revision rejected: ' + JSON.stringify((failure.issues ?? []).slice(0, 3))); }
  store.useStudio.setState({ job: next });
  return 'source revision is now ' + '${sha}'.slice(0, 8);
})()`;

const addHvacSection = wrap(`click('Add straight section'); return 'straight section added';`);

const fillHvac = wrap(`
fill('Section name', 'Duct run D1');
fill('Length (m)', '12');
fill('Length (m) source reference', 'Mechanical sheet M-201, run D1');
fill('Width (m)', '0.6');
fill('Width (m) source reference', 'Mechanical sheet M-201, duct size 600x400');
fill('Height (m)', '0.4');
fill('Height (m) source reference', 'Mechanical sheet M-201, duct size 600x400');
return 'duct inputs entered';`);

const bindHvac = wrap(`
fill('Source page index', '2');
fill('Evidence class', 'dimensioned');
fill('Reference', 'Duct run D1 dimensioned on the mechanical sheet');
click('Bind to current project source');
return 'hvac bind requested';`);

const calculateHvac = wrap(`click('Calculate duct draft'); return 'duct draft requested';`);

const assertHvacSaved = wrap(`
const key = Object.keys(localStorage).filter(k => k.startsWith('xray.industry-drafts.v1:'))[0];
const b = JSON.parse(localStorage.getItem(key)).drafts.hvac.form.binding;
if (!b) throw Error('Duct draft has no saved binding');
if (b.evidenceClass !== 'dimensioned' || b.units !== 'm') throw Error('Duct binding is ' + JSON.stringify(b));
if (b.sourceName !== 'Ground floor plan rev C.pdf') throw Error('Duct binding source is ' + b.sourceName);
if (b.calibrationId !== 'cal:0:manual:0.0125:cand-manual-1') throw Error('Duct binding calibration is ' + b.calibrationId);
if (b.sha256 !== '${SHA_B}') throw Error('Duct binding did not record the revised source hash');
return JSON.stringify(b);`);

const addQsClassification = wrap(`
fill('Hierarchy name', 'Elemental cost plan');
fill('Hierarchy revision', 'R1');
click('Add classification');
return 'classification added';`);

const nameQsClassification = wrap(`
fill('Classification code', '2.1');
fill('Classification label', 'Ground floor slab');
click('Add quantity');
return 'classification named, quantity row added';`);

const fillQs = wrap(`
fill('Item reference', 'Q-01');
fill('Quantity', '84.5');
fill('Unit', 'm2');
const assign = byLabel('Assign item 1')?.querySelector('select');
if (!assign) throw Error('No assign control for item 1');
setValue(assign, assign.options[1].value);
return 'quantity inputs entered';`);

const bindQs = wrap(`
fill('Source page index', '1');
fill('Source units', 'm');
fill('Evidence class', 'dimensioned');
fill('Reference', 'Slab area dimensioned on plan sheet A-101');
click('Bind to current project source');
return 'qs bind requested';`);

const calculateQs = wrap(`click('Calculate classification'); return 'quantity classification requested';`);

const assertQsSaved = wrap(`
const key = Object.keys(localStorage).filter(k => k.startsWith('xray.industry-drafts.v1:'))[0];
const form = JSON.parse(localStorage.getItem(key)).drafts['quantity-surveying'].form;
const b = form.binding;
if (!b) throw Error('Quantity draft has no saved binding');
if (b.units !== 'm' || b.evidenceClass !== 'dimensioned') throw Error('Quantity binding is ' + JSON.stringify(b));
if (b.sourceName !== 'Ground floor plan rev C.pdf') throw Error('Quantity binding source is ' + b.sourceName);
if (form.calculated !== true) throw Error('Quantity worksheet did not record a calculation');
const rows = form.items.filter(item => item.nodeKey !== '');
if (rows.length !== 1) throw Error('Expected one assigned quantity row, found ' + rows.length);
return JSON.stringify({ binding: b, assignedRows: rows.length, quantity: rows[0].quantity, unit: rows[0].unit });`);

const withheld = (industry) => wrap(`
const text = document.body.textContent;
if (!text.includes('withheld')) throw Error('${industry} worksheet did not withhold its result: ' + document.querySelector('.industry-form')?.textContent.slice(0, 300));
return '${industry} withheld after the source changed';`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seed],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],

  ["eval", show("roofing")],
  ["wait", "--fn", labelWait("Plane name")],
  ["eval", fillRoof],
  ["wait", "--fn", "!!document.querySelector('section[aria-label=\"Draft roofing result\"]')"],
  ["eval", frame('section[aria-label="Draft roofing result"]')],
  ["screenshot", `${shots}/roof-01-unbound-calculated.png`],
  ["eval", bindRoof],
  ["wait", "--fn", "document.querySelector('.industry-draft-host')?.getAttribute('data-draft-save')==='saved'"],
  ["wait", "--fn", "document.body.textContent.includes('Ground floor plan rev C.pdf')"],
  ["eval", frameCaption("Bound source")],
  ["screenshot", `${shots}/roof-02-bound-traced.png`],
  ["eval", assertRoofSaved],

  ["reload"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", showCost],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],
  ["eval", show("roofing")],
  ["wait", "--fn", "document.body.textContent.includes('Ground floor plan rev C.pdf')"],
  ["eval", frameCaption("Bound source")],
  ["screenshot", `${shots}/roof-03-bound-after-reload.png`],

  ["eval", reviseSource(SHA_B)],
  ["wait", "--fn", "document.body.textContent.includes('Draft total withheld')"],
  ["eval", withheld("roof")],
  ["eval", frame("p.industry-error")],
  ["screenshot", `${shots}/roof-04-stale-withheld.png`],

  ["eval", show("hvac")],
  ["wait", "--fn", buttonWait("Add straight section")],
  ["eval", addHvacSection],
  ["wait", "--fn", labelWait("Length (m)")],
  ["eval", fillHvac],
  ["eval", bindHvac],
  ["wait", "--fn", "document.body.textContent.includes('Duct run D1 dimensioned on the mechanical sheet')"],
  ["eval", calculateHvac],
  ["wait", "--fn", "!!document.querySelector('section[aria-label=\"Duct draft result\"]')"],
  ["wait", "--fn", "document.querySelector('.industry-draft-host')?.getAttribute('data-draft-save')==='saved'"],
  ["eval", assertHvacSaved],
  ["eval", frame('section[aria-label="Duct draft result"]')],
  ["screenshot", `${shots}/hvac-01-bound-dimensioned.png`],

  ["eval", show("quantity-surveying")],
  ["wait", "--fn", labelWait("Hierarchy name")],
  ["eval", addQsClassification],
  ["wait", "--fn", labelWait("Classification code")],
  ["eval", nameQsClassification],
  ["wait", "--fn", labelWait("Item reference")],
  ["eval", fillQs],
  ["eval", bindQs],
  ["wait", "--fn", "document.body.textContent.includes('Slab area dimensioned on plan sheet A-101')"],
  ["eval", calculateQs],
  ["wait", "--fn", "!!document.querySelector('.industry-result')"],
  ["wait", "--fn", "document.querySelector('.industry-draft-host')?.getAttribute('data-draft-save')==='saved'"],
  ["eval", assertQsSaved],
  ["eval", frame(".industry-result")],
  ["screenshot", `${shots}/qs-01-bound-dimensioned.png`],

  ["eval", reviseSource(SHA_A)],
  ["wait", "--fn", "document.body.textContent.includes('Classification report withheld')"],
  ["eval", withheld("quantity")],
  ["eval", frame('.industry-result[role="status"]')],
  ["screenshot", `${shots}/qs-02-stale-withheld.png`],
  ["set", "viewport", "1024", "768"],
  ["eval", frame('.industry-result[role="status"]')],
  ["screenshot", `${shots}/tablet-01-qs-stale-withheld.png`],
  ["eval", show("hvac")],
  ["wait", "--fn", labelWait("Section name")],
  ["eval", calculateHvac],
  ["wait", "--fn", "document.body.textContent.includes('Result withheld')"],
  ["eval", withheld("duct")],
  ["eval", frame('section[aria-label="Withheld duct draft result"]')],
  ["screenshot", `${shots}/tablet-02-hvac-stale-withheld.png`],
  ["set", "viewport", "1600", "1000"],
  ["errors"],
];

writeFileSync(`${dir}/source-binding.json`, JSON.stringify(scenario, null, 2) + "\n");
console.log(`wrote ${dir}/source-binding.json with ${scenario.length} opcodes`);
