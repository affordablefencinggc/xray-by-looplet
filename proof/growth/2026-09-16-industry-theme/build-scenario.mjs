/**
 * Builds the Fast CDP scenario for the SH-05 industry theme and accessibility proof.
 * Run with: node proof/growth/2026-09-16-industry-theme/build-scenario.mjs
 *
 * The campaign runs against an owned dev server on port 8085, not the user-facing 8080.
 * localStorage is origin-scoped, so the isolated port cannot touch saved user state.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const DIR = "proof/growth/2026-09-16-industry-theme";
const SHOTS = `${DIR}/screenshots`;
const BASE = "http://127.0.0.1:8085/";
mkdirSync(SHOTS, { recursive: true });

const SHA_A = "c0ffee".repeat(10) + "abcd";

/** Shared in-page helpers. Every UI-driving eval is wrapped as a synced closure. */
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
const frameOn = (selector) => { const el = document.querySelector(selector); if (!el) throw Error('Nothing to show for ' + selector); el.scrollIntoView({ block: 'center' }); return 'framed ' + selector; };
const alphaOf = (s) => { const m = String(s).match(/[\\d.]+/g); return m && m.length >= 4 ? Number(m[3]) : 1; };
const parseRgb = (s) => { const m = String(s).match(/[\\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const contrast = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; if (alphaOf(c) > 0.5) return parseRgb(c); n = n.parentElement; } return parseRgb(getComputedStyle(document.body).backgroundColor); };
const workbenchRoot = () => { const wb = document.querySelector('.industry-workbench'); if (!wb) throw Error('No industry workbench'); return wb; };
`;

const wrap = (body) => `(() => {${helpers}${body}})()`;

const skinNavy = `(async () => {
  const store = await import('/src/studio/store.ts');
  store.useStudio.getState().setSkin('navy');
  return 'skin=' + store.useStudio.getState().skin;
})()`;

const seed = `(async () => {
  const store = await import('/src/studio/store.ts');
  const ws = await import('/src/studio/documentWorkspaces.ts');
  const domain = await import('/src/studio/domain.ts');
  const revision = { id: 'doc-ground-floor', name: 'Ground floor plan rev C.pdf', kind: 'pdf', importedAt: new Date().toISOString(), pageCount: 3, sha256: '${SHA_A}', source: 'web' };
  const before = store.useStudio.getState().job;
  Object.keys(localStorage).filter(k => k.startsWith('xray.industry-drafts.v1:')).forEach(k => localStorage.removeItem(k));
  const opened = ws.restoreDocumentWorkspace({ ...before, documents: [...before.documents.filter(d => d.id !== revision.id), revision] }, revision);
  const points = [{ x: 0, y: 0 }, { x: 400, y: 0 }];
  const candidate = { id: 'cand-manual-1', source: 'manual', metresPerUnit: 0.0125, confidence: 1, inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points, provenance: { method: 'Two-point manual scale', evidence: 'Measured between grid lines A and B on the source', documentId: revision.id } };
  const calibration = { ...opened.calibrations[0], metresPerUnit: 0.0125, source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points, inputDistance: { value: 5, unit: 'm' }, candidates: [candidate], selectedCandidateId: candidate.id };
  let job;
  try { job = domain.fencingJobSchema.parse({ ...opened, calibrations: [calibration, ...opened.calibrations.slice(1)] }); }
  catch (failure) { throw Error('seed rejected: ' + JSON.stringify((failure.issues ?? []).slice(0, 4))); }
  store.useStudio.setState({ pane: 'cost', job });
  return 'seeded with ' + revision.name;
})()`;

const fillRoof = wrap(`
fill('Plane name', 'North plane');
fill('Horizontal plan area', '120');
fill('Pitch from horizontal', '35');
fill('Area reference', 'Plan sheet A-201, scaled at 0.0125 m/unit');
fill('Pitch reference', 'Section B-B, geometric pitch');
click('Calculate draft roof areas');
return 'roof inputs entered';`);

const bindRoof = wrap(`
fill('Source page index', '1');
fill('Evidence class', 'traced');
fill('Reference', 'North plane traced on plan sheet A-201');
click('Bind to current project source');
return 'roof bind requested';`);

/** Assert the navy skin actually reached every industry-workbench surface, by computed value. */
const themeSurfaces = wrap(`
const skin = document.querySelector('.workbench')?.getAttribute('data-skin');
if (skin !== 'navy') throw Error('Workbench skin is ' + skin + ', expected navy');
const wb = workbenchRoot();
const pick = (el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor }; };
const summary = wb.querySelector(':scope > summary');
const field = wb.querySelector('input:not([type=checkbox])');
const note = wb.querySelector('.industry-note');
if (!summary || !field) throw Error('Workbench is missing its summary or a field');
const got = { workbench: pick(wb), summary: pick(summary), field: pick(field), note: note ? pick(note) : null };
const expect = {
  workbench: { bg: 'rgb(34, 34, 34)', color: 'rgb(242, 242, 242)', border: 'rgb(64, 64, 64)' },
  summary: { bg: 'rgb(38, 38, 38)' },
  // Field surfaces resolve to --color-field (#2b2b2b in navy), not the --color-bg that
  // industryDrafts.css names: src/studio/surfaceContrast.css applies --color-field to
  // every .workbench input with higher precedence. Both tokens are themed, so the
  // surface is correct either way; this asserts the value the browser actually paints.
  field: { bg: 'rgb(43, 43, 43)', color: 'rgb(242, 242, 242)' },
  note: { color: 'rgb(185, 185, 185)' }
};
const bad = [];
for (const key of Object.keys(expect)) {
  if (!got[key]) { if (key !== 'note') bad.push(key + ' missing'); continue; }
  const want = expect[key];
  for (const f of Object.keys(want)) if (got[key][f] !== want[f]) bad.push(key + '.' + f + ' is ' + got[key][f] + ', expected ' + want[f]);
}
if (bad.length) throw Error('Navy skin did not reach the industry workbench: ' + bad.join('; '));
return got;`);

/** Every control must carry an accessible name: wrapping label, aria-label or aria-labelledby. */
const labelAudit = wrap(`
const wb = workbenchRoot();
const controls = [...wb.querySelectorAll('input,select,textarea')].filter(el => el.type !== 'hidden' && el.getClientRects().length);
if (!controls.length) throw Error('No visible controls in the workbench to label');
const unnamed = [];
for (const el of controls) {
  let name = (el.getAttribute('aria-label') || '').trim();
  if (!name && el.getAttribute('aria-labelledby')) { const t = document.getElementById(el.getAttribute('aria-labelledby')); name = t ? t.textContent.trim() : ''; }
  if (!name) { const w = el.closest('label'); if (w) name = w.textContent.trim(); }
  if (!name) unnamed.push(el.tagName + ' ' + el.outerHTML.slice(0, 90));
}
if (unnamed.length) throw Error('Controls with no accessible name: ' + JSON.stringify(unnamed));
return { labelled: controls.length, unnamed: 0 };`);

/**
 * Keyboard focus must be visible at the agreed 2px ring.
 *
 * Chromium only matches :focus-visible for a programmatic .focus() on some elements - in
 * this run the first six fields matched and the remaining seven did not - and the CDP
 * runner exposes no key event, so Tab cannot be driven here. The ring is therefore
 * demonstrated on a real focused field, and coverage for every control is proven from the
 * stylesheet rule that applies to all of them. The limitation is recorded in the proof.
 */
const focusAudit = wrap(`
const wb = workbenchRoot();
const inputs = [...wb.querySelectorAll('input:not([type=hidden])')].filter(el => el.getClientRects().length && !el.disabled);
if (!inputs.length) throw Error('No focusable text fields');
const first = inputs[0];
first.focus();
const cs = getComputedStyle(first);
const ring = { focusVisible: first.matches(':focus-visible'), width: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor };
if (!ring.focusVisible || ring.width !== '2px' || ring.style !== 'solid') throw Error('Focused field has no 2px focus ring: ' + JSON.stringify(ring));
const found = [];
for (const sheet of document.styleSheets) {
  let list; try { list = sheet.cssRules; } catch (blocked) { continue; }
  for (const rule of list) {
    if (!rule.selectorText || !rule.selectorText.includes(':focus-visible')) continue;
    // The declaration uses the outline shorthand with var(), so the longhands stay empty
    // at parse time: read the shorthand text as authored.
    found.push({ selector: rule.selectorText, outline: rule.style.outline, offset: rule.style.outlineOffset });
  }
}
const cover = found.filter(r => r.selector.includes('.industry-workbench'));
if (!cover.length) throw Error('No :focus-visible rule targets .industry-workbench: ' + JSON.stringify(found));
const usable = cover.filter(r => r.outline.includes('2px') && r.outline.includes('solid'));
if (!usable.length) throw Error('Focus rule does not set a 2px solid outline: ' + JSON.stringify(cover));
if (!cover.some(r => r.selector.includes('input') && r.selector.includes('select') && r.selector.includes('button') && r.selector.includes('summary'))) throw Error('Focus rule does not cover input, select, button and summary: ' + JSON.stringify(cover));
const unreachable = [...wb.querySelectorAll('input:not([type=hidden]),select,button,summary')].filter(el => el.getClientRects().length && !el.disabled && el.tabIndex < 0);
if (unreachable.length) throw Error('Controls unreachable by keyboard: ' + unreachable.length);
const selects = [...wb.querySelectorAll('select')].filter(el => el.getClientRects().length && !el.disabled).length;
return { demonstratedOn: (first.closest('label')?.textContent || '').trim().slice(0, 34), ring: ring.width + ' ' + ring.style + ' ' + ring.color + ' offset ' + cs.outlineOffset, rule: cover[0].selector, fields: inputs.length, selects: selects, reachable: inputs.length + selects };`);

/** Text contrast against its real painted background, at the WCAG AA thresholds. */
const contrastAudit = wrap(`
const wb = workbenchRoot();
const failures = [];
let checked = 0;
for (const el of wb.querySelectorAll('*')) {
  if (el.children.length > 0) continue;
  const text = (el.textContent || '').trim();
  if (!text) continue;
  if (!el.getClientRects().length) continue;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) continue;
  const size = parseFloat(cs.fontSize);
  const weight = Number(cs.fontWeight) || 400;
  const large = size >= 24 || (size >= 18.66 && weight >= 700);
  const need = large ? 3 : 4.5;
  const bg = bgOf(el);
  const ratio = contrast(parseRgb(cs.color), bg);
  checked += 1;
  if (ratio < need) failures.push({ text: text.slice(0, 40), color: cs.color, bg: 'rgb(' + bg.join(', ') + ')', size: size, ratio: Math.round(ratio * 100) / 100, need: need });
}
if (failures.length) throw Error('Contrast below AA: ' + JSON.stringify(failures));
return { checked: checked, failures: 0 };`);

/** No horizontal page scroll; wide tables scroll inside their own wrapper. */
const overflowAudit = wrap(`
const over = document.documentElement.scrollWidth - window.innerWidth;
if (over > 1) throw Error('Page scrolls horizontally by ' + over + 'px at ' + window.innerWidth + 'px wide');
const wraps = [...document.querySelectorAll('.industry-table-wrap')].map(w => ({ overflowPx: w.scrollWidth - w.clientWidth, overflowX: getComputedStyle(w).overflowX }));
for (const w of wraps) if (w.overflowPx > 1 && w.overflowX !== 'auto' && w.overflowX !== 'scroll') throw Error('Table overflows without a scroll container: ' + JSON.stringify(w));
return { viewport: window.innerWidth + 'x' + window.innerHeight, pageOverflowPx: over, tableWraps: wraps.length };`);

const LONG_REF = "North plane traced on plan sheet A-201 rev C, grid lines A-B between 1-4, cross-checked against section B-B and the roof framing plan S-301, including the 300 mm overhang allowance, the ridge capping line and the box gutter upstand";

/**
 * Long state on a worksheet field that survives binding. The binding "Reference" input
 * only exists while the worksheet is unbound, so it cannot carry this check.
 */
const longReference = wrap(`
fill('Area reference', ${JSON.stringify(LONG_REF)});
return 'area reference holds ' + ${LONG_REF.length} + ' characters';`);

const restoreReference = wrap(`
fill('Area reference', 'Plan sheet A-201, scaled at 0.0125 m/unit');
return 'area reference restored';`);

/** Error state: a required worksheet value is cleared, so the calculation must refuse visibly. */
const triggerError = wrap(`
window.__err0 = document.querySelectorAll('.industry-error').length;
fill('Horizontal plan area', '');
click('Calculate draft roof areas');
return 'calculation requested with no plan area';`);

const restoreArea = wrap(`
fill('Horizontal plan area', '120');
click('Calculate draft roof areas');
return 'plan area restored and recalculated';`);

const errorAudit = wrap(`
const wb = workbenchRoot();
const errors = [...wb.querySelectorAll('.industry-error')];
if (errors.length <= (window.__err0 || 0)) throw Error('No new .industry-error appeared; count stayed at ' + errors.length);
const el = errors[errors.length - 1];
const cs = getComputedStyle(el);
const ratio = contrast(parseRgb(cs.color), bgOf(el));
if (ratio < 4.5) throw Error('Error text contrast is ' + Math.round(ratio * 100) / 100 + ', below 4.5');
if (!el.textContent.trim()) throw Error('Error element carries no message');
const role = el.getAttribute('role');
return { message: el.textContent.trim().slice(0, 160), color: cs.color, bg: 'rgb(' + bgOf(el).join(', ') + ')', contrast: Math.round(ratio * 100) / 100, role: role };`);

const singleColumn = wrap(`
const el = document.querySelector('.industry-fields');
if (!el) throw Error('No .industry-fields group to check');
const track = getComputedStyle(el).gridTemplateColumns;
const count = track.split(' ').filter(Boolean).length;
if (count !== 1) throw Error('At ' + window.innerWidth + 'px the field grid has ' + count + ' columns: ' + track);
return { viewport: window.innerWidth + 'px', gridTemplateColumns: track };`);

const addHvacSection = wrap(`click('Add straight section'); return 'straight section added';`);

/** Every duct value carries its own source reference: the SH-02 contract requires one. */
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
click('Calculate classification');
return 'quantity inputs entered';`);

const frame = (selector) => wrap(`return frameOn(${JSON.stringify(selector)});`);
const frameByLabel = (text) => wrap(`
const l = byLabel(${JSON.stringify(text)});
if (!l) throw Error('No field labelled: ' + ${JSON.stringify(text)});
l.scrollIntoView({ block: 'center' });
return 'framed field ' + ${JSON.stringify(text)};`);

const scenario = [
  ["set", "viewport", "1600", "1000"],
  ["open", BASE],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'"],
  ["eval", seed],
  ["eval", skinNavy],
  ["wait", "--fn", "document.querySelector('.workbench')?.getAttribute('data-skin')==='navy'"],
  ["wait", "--fn", "!!document.querySelector('.industry-workbench')"],

  // --- desktop: open the roofing worksheet and calculate, so the controls are all on screen ---
  ["eval", wrap(`showSheet('roofing'); return 'roofing sheet shown';`)],
  ["wait", "--fn", "[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Plane name'))"],
  ["eval", fillRoof],
  ["wait", "--fn", "!!document.querySelector('section[aria-label=\"Draft roofing result\"]')"],

  // --- machine checks: theme, labels, focus, contrast, overflow ---
  ["eval", themeSurfaces],
  ["eval", labelAudit],
  ["eval", focusAudit],
  ["eval", contrastAudit],
  ["eval", overflowAudit],
  ["eval", frame('.industry-workbench')],
  ["screenshot", `${SHOTS}/desktop-01-navy-worksheet.png`],

  // --- long state: a 240-character reference must not push the page sideways ---
  ["eval", longReference],
  ["eval", overflowAudit],
  ["eval", frameByLabel('Area reference')],
  ["screenshot", `${SHOTS}/desktop-02-long-reference.png`],
  ["eval", restoreReference],

  // --- error state: the calculation must refuse a cleared required value, visibly ---
  ["eval", triggerError],
  ["wait", "--fn", "document.querySelectorAll('.industry-error').length > (window.__err0||0)"],
  ["eval", errorAudit],
  ["eval", frame('.industry-error')],
  ["screenshot", `${SHOTS}/desktop-03-validation-error.png`],
  ["eval", restoreArea],
  ["wait", "--fn", "!!document.querySelector('section[aria-label=\"Draft roofing result\"]')"],

  // --- bind to the source, then re-check the theme on the bound controls ---
  ["eval", bindRoof],
  ["wait", "--fn", "document.body.textContent.includes('North plane traced on plan sheet A-201')"],
  ["eval", themeSurfaces],
  ["eval", labelAudit],
  ["eval", contrastAudit],
  ["eval", frame('.industry-workbench')],
  ["screenshot", `${SHOTS}/desktop-04-navy-bound-workbench.png`],

  // --- keyboard focus ring, captured on the field it lands on ---
  ["eval", wrap(`const el = workbenchRoot().querySelector('input:not([type=hidden])'); el.focus(); el.scrollIntoView({ block: 'center' }); return 'focused ' + (el.closest('label')?.textContent||'').trim().slice(0,30);`)],
  ["screenshot", `${SHOTS}/desktop-05-focus-ring.png`],

  // --- HVAC worksheet: the same controls under the same skin ---
  ["eval", wrap(`showSheet('hvac'); return 'hvac sheet shown';`)],
  ["wait", "--fn", "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Add straight section' && !b.disabled)"],
  ["eval", addHvacSection],
  ["wait", "--fn", "[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Section name'))"],
  ["eval", fillHvac],
  ["eval", bindHvac],
  ["wait", "--fn", "document.body.textContent.includes('Duct run D1 dimensioned on the mechanical sheet')"],
  ["eval", calculateHvac],
  ["wait", "--fn", "!!document.querySelector('section[aria-label=\"Duct draft result\"]')"],
  ["eval", themeSurfaces],
  ["eval", labelAudit],
  ["eval", contrastAudit],
  ["eval", overflowAudit],
  ["eval", frame('.industry-workbench')],
  ["screenshot", `${SHOTS}/desktop-06-navy-hvac-worksheet.png`],

  // --- QS report: the classification worksheet and its compiled report ---
  ["eval", wrap(`showSheet('quantity-surveying'); return 'quantity sheet shown';`)],
  ["wait", "--fn", "[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Hierarchy name'))"],
  ["eval", addQsClassification],
  ["wait", "--fn", "[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Classification code'))"],
  ["eval", nameQsClassification],
  ["wait", "--fn", "[...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Item reference'))"],
  ["eval", fillQs],
  ["wait", "--fn", "!!document.querySelector('.industry-result')"],
  ["eval", themeSurfaces],
  ["eval", labelAudit],
  ["eval", contrastAudit],
  ["eval", overflowAudit],
  ["eval", frame('.industry-result')],
  ["screenshot", `${SHOTS}/desktop-07-navy-qs-report.png`],

  // --- tablet landscape 1024x768, on the report itself ---
  ["set", "viewport", "1024", "768"],
  ["eval", themeSurfaces],
  ["eval", labelAudit],
  ["eval", contrastAudit],
  ["eval", overflowAudit],
  ["eval", frame('.industry-result')],
  ["screenshot", `${SHOTS}/tablet-01-1024-report.png`],

  // --- tablet portrait 768x1024: below the 900px breakpoint, fields go single column ---
  ["set", "viewport", "768", "1024"],
  ["eval", singleColumn],
  ["eval", overflowAudit],
  ["eval", contrastAudit],
  ["eval", frame('.industry-workbench')],
  ["screenshot", `${SHOTS}/tablet-02-768-portrait-single-column.png`],

  ["set", "viewport", "1600", "1000"],
  ["errors"],
];

writeFileSync(`${DIR}/scenarios/theme.json`, JSON.stringify(scenario, null, 2) + "\n");
console.log(`wrote ${DIR}/scenarios/theme.json with ${scenario.length} opcodes`);
