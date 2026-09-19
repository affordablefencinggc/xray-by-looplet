import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
if (hostname().split('.')[0].toLowerCase() !== 'dans1') throw Error('DANS1 only');
const baseline = resolve(process.argv[2]), output = resolve(process.argv[3]);
const bytes = await readFile(baseline), baselineHash = createHash('sha256').update(bytes).digest('hex');
const parsed = JSON.parse(bytes), operations = Array.isArray(parsed) ? parsed : parsed.operations;
if (operations.length !== 297) throw Error('SC10 immutable setup must have exactly 297 operations');
if (baselineHash !== '71613342cdc43f72625466f1a33e555ce7605dda85ec052ab4e9a8b369b42bb7') throw Error('SC10 immutable scenario identity changed');
const prefix = 'captures/sc11-';
const js = (fn, ...args) => `(${fn.toString()})(${args.map(value => JSON.stringify(value)).join(',')})`;
const evaluate = (fn, ...args) => operations.push(['eval', js(fn, ...args)]);
const wait = (fn, ...args) => operations.push(['wait', '--fn', js(fn, ...args)]);
const click = name => operations.push(['find', 'role', 'button', 'click', '--name', name, '--exact']);
const image = name => operations.push(['screenshot', prefix + name + '.png']);
function helpers() {
  window.__SC11__ = {
    control(name) {
      const label = [...document.querySelectorAll('label')].find(el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim() === name);
      const el = label?.querySelector('input,select,textarea');
      if (!el) throw Error('Missing labeled control: ' + name);
      return el;
    },
    set(name, value) {
      const el = this.control(name);
      if (el.matches(':disabled')) throw Error('Disabled input: ' + name);
      const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return { name, value };
    },
    saved() { return document.querySelector('[data-draft-industry="quantity-surveying"]')?.getAttribute('data-draft-save') === 'saved'; },
    frame(selector) { const el = document.querySelector(selector); if (!el) throw Error('Missing visible boundary: ' + selector); el.scrollIntoView({ block: 'center' }); return true; },
    panel() { const el = document.querySelector('.qs-package-panel'); if (!el || !el.closest('[data-testid="qs-cost-worksheet"]')) throw Error('Package panel is not mounted inside the real QS worksheet'); return el; },
  };
  return true;
}
function layout() {
  const panel = window.__SC11__.panel(), rect = panel.getBoundingClientRect();
  if (document.documentElement.scrollWidth > innerWidth + 1 || rect.left < -1 || rect.right > innerWidth + 1) throw Error('Package panel produces horizontal page overflow');
  const controls = [...panel.querySelectorAll('button,input:not([type=checkbox]),select,textarea,summary')].filter(el => el.getClientRects().length);
  for (const el of controls) { const r = el.getBoundingClientRect(); if (r.height < 43 || r.left < rect.left - 1 || r.right > rect.right + 1) throw Error('Package control clipped or below 44px target: ' + el.outerHTML.slice(0, 120)); }
  return { viewport: [innerWidth, innerHeight], mountedInsideWorksheet: true, controls: controls.length, horizontalBounds: [rect.left, rect.right], boundedManifestTableScrollAllowed: true };
}
operations.push(['set', 'viewport', '1600', '1000']);
evaluate(helpers);
wait(() => window.__SC11__.saved() && !!document.querySelector('.qs-package-panel'));
evaluate(async () => {
  const { industryDraftKey } = await import('/src/studio/industries/draftStorage.ts');
  const key = industryDraftKey('job-sc10-rate-delta'), raw = localStorage.getItem(key), form = JSON.parse(raw).drafts['quantity-surveying'].form;
  if (form.pricing.snapshots.length !== 4 || !form.nodes.length || form.items.some(item => item.evidence !== 'unverified')) throw Error('Expected four saved revisions with explicitly unverified classification quantities');
  const timestamp = new Date(Date.parse(form.pricing.snapshots.at(-1).input.createdAt) + 1000).toISOString();
  Object.assign(window.__SC11__, { key, originalForm: JSON.stringify(form), originalHierarchy: form.hierarchyId, timestamp });
  const panel = window.__SC11__.panel(); panel.querySelector('details').open = true;
  return { timestamp, projectId: form.pricing.projectId, savedRevision: 4, sourceEvidence: form.items.map(i => i.evidence), classificationNodes: form.nodes.length };
});
for (const [label, value] of Object.entries({
  'Cost plan title': 'SC11 mounted QS cost plan — controlled qualification',
  'Transmittal reference': 'SC11-MOUNTED-DANS1-001',
  'Revision label': 'R4 — draft qualification only',
  'Prepared by': 'DANS1 controlled estimator',
  'Intended recipient': 'Internal qualification — no external issue',
  'Purpose': 'Verify actual mounted package export and explicit worksheet restoration',
  'Basis of estimate': 'Calibrated controlled SVG construction-run quantities; preserved exact measured decimal.\nPinned supplier CSV source revisions and declared labour basis.\nThis controlled qualification is not a commercial estimate.',
  'Assumptions': 'Source geometry is controlled qualification data; classification quantities remain Unverified.\nAUD rate/tax/wastage/markup assumptions remain as explicitly authored in the worksheet.',
  'Exclusions': 'No professional quantity certification, deployment claim, native device claim or external transmission.\nRoom-area and roof-plane families are outside this construction-run fixture.',
  'Delivery identifier': 'sc11-mounted-package-r4',
  'Delivery state': 'saved-draft',
})) {
  evaluate((label, value) => window.__SC11__.set(label, value), label, value);
  wait((label, value) => window.__SC11__.control(label).value === value, label, value);
}
for (const label of ['Transmittal created at', 'Delivery created at']) {
  evaluate(label => window.__SC11__.set(label, window.__SC11__.timestamp), label);
  wait(label => window.__SC11__.control(label).value === window.__SC11__.timestamp, label);
}
evaluate(layout);
evaluate(() => window.__SC11__.frame('.qs-package-panel header'));
image('mounted-export-details-desktop-1600x1000');
click('Prepare package from saved revision');
wait(() => { const p = window.__SC11__.panel(), error = p.querySelector('[role=alert]'); if (error) throw Error(error.textContent); return !!p.querySelector('[aria-label="Prepared cost package"]'); });
evaluate(() => window.__SC11__.frame('[aria-label="Prepared cost package"]'));
image('prepared-draft-package-desktop-1600x1000');
for (const [alias, label, file] of [['zip', 'Download package ZIP', 'cost-plan-r4.xray-qs.zip'], ['pdf', 'Download PDF', 'cost-plan-r4.pdf'], ['csv', 'Download CSV', 'cost-plan-r4.csv']]) {
  operations.push(['download-arm', 'default', alias, file]); click(label); operations.push(['download-wait', 'default', alias]);
}
operations.push(['inspect-downloads', 'default', 'zip', 'pdf', 'csv']);
evaluate(() => window.__SC11__.set('Hierarchy name', window.__SC11__.originalHierarchy + ' / changed before reopen'));
wait(() => window.__SC11__.saved() && window.__SC11__.control('Hierarchy name').value.endsWith(' / changed before reopen'));
evaluate(() => { window.__SC11__.beforeReopen = localStorage.getItem(window.__SC11__.key); return { changedWorksheetPreservedUntilExplicitRestore: true }; });
operations.push(['set-file', 'default', '.qs-package-panel input[type=file]', 'zip']);
wait(() => { const p = window.__SC11__.panel(), error = p.querySelector('[role=alert]'); if (error) throw Error(error.textContent); return !!p.querySelector('.qs-package-hashes'); });
evaluate(() => {
  const p = window.__SC11__.panel(), hash = [...p.querySelectorAll('dt')].find(el => el.textContent === 'Package SHA-256')?.nextElementSibling.textContent.trim();
  if (hash !== window.__SC11_DISK_DOWNLOADS__.zip.sha256) throw Error('Reopened panel SHA-256 differs from actual disk download');
  if (localStorage.getItem(window.__SC11__.key) !== window.__SC11__.beforeReopen) throw Error('Reopening changed the worksheet automatically');
  const restore = [...p.querySelectorAll('button')].find(el => el.textContent === 'Restore inspected worksheet to this project');
  if (!restore?.disabled || p.querySelector('.qs-package-confirm input')?.checked) throw Error('Restore lacks explicit unchecked confirmation');
  const rows = p.querySelectorAll('.qs-package-table-scroll tbody tr'); if (rows.length !== 8) throw Error('Expected eight exact imported files');
  return { packageSha256: hash, files: rows.length, noAutomaticRestore: true, restoreDisabledUntilConfirmed: true };
});
evaluate(() => window.__SC11__.frame('.qs-package-hashes'));
image('disk-reopened-sha256-desktop-1600x1000');
operations.push(['set', 'viewport', '1024', '768']);
evaluate(layout);
evaluate(() => window.__SC11__.frame('.qs-package-hashes'));
image('disk-reopened-sha256-tablet-1024x768');
evaluate(() => window.__SC11__.frame('.qs-package-confirm'));
image('explicit-restore-gate-tablet-1024x768');
evaluate(() => { const checkbox = document.querySelector('.qs-package-confirm input'); if (!checkbox || checkbox.disabled || checkbox.checked) throw Error('Confirmation unavailable'); checkbox.click(); return true; });
wait(() => ![...window.__SC11__.panel().querySelectorAll('button')].find(el => el.textContent === 'Restore inspected worksheet to this project')?.disabled);
click('Restore inspected worksheet to this project');
wait(() => { const error = window.__SC11__.panel().querySelector('[role=alert]'); if (error) throw Error(error.textContent); const form = JSON.parse(localStorage.getItem(window.__SC11__.key)).drafts['quantity-surveying'].form; return window.__SC11__.saved() && JSON.stringify(form) === window.__SC11__.originalForm; });
evaluate(() => {
  const form = JSON.parse(localStorage.getItem(window.__SC11__.key)).drafts['quantity-surveying'].form;
  if (window.__SC11__.control('Hierarchy name').value !== window.__SC11__.originalHierarchy || form.pricing.snapshots.length !== 4 || form.items.some(item => item.evidence !== 'unverified')) throw Error('Explicit restore failed to recover full worksheet without evidence promotion');
  sessionStorage.setItem('sc11-restored-form-observer', JSON.stringify(form));
  window.__SC11__.afterRestore = localStorage.getItem(window.__SC11__.key);
  return { restoredByteExactForm: true, pricingRevisions: 4, evidencePreserved: true, hostSaved: true };
});
evaluate(() => window.__SC11__.frame('.qs-package-confirm'));
image('explicit-restore-saved-tablet-1024x768');
operations.push(['tamper-zip', 'default', 'zip', 'tampered']);
operations.push(['set-file', 'default', '.qs-package-panel input[type=file]', 'tampered']);
wait(() => !!window.__SC11__.panel().querySelector('[role=alert]') && window.__SC11__.panel().getAttribute('aria-busy') === 'false');
evaluate(() => {
  const panel = window.__SC11__.panel(), error = panel.querySelector('[role=alert]')?.textContent;
  if (!/SHA-256|integrity|digest|hash/i.test(error || '')) throw Error('Tampered PDF was not rejected for integrity: ' + error);
  if (panel.querySelector('.qs-package-hashes') || panel.querySelector('.qs-package-confirm')) throw Error('Invalid archive exposed trusted manifest or restore gate');
  if (localStorage.getItem(window.__SC11__.key) !== window.__SC11__.afterRestore) throw Error('Tampered reopen mutated the worksheet');
  if (!panel.textContent.includes('Original imported bytes retained') || !panel.textContent.includes('Retry validation of retained file')) throw Error('Rejected original import was not retained');
  return { exactError: error, worksheetUnchanged: true, invalidManifestNotTrusted: true, originalBytesRetained: true };
});
evaluate(() => window.__SC11__.frame('[aria-label="Reopen cost package"]'));
image('tamper-rejected-tablet-1024x768');
operations.push(['set', 'viewport', '1600', '1000']);
evaluate(layout);
evaluate(() => window.__SC11__.frame('[aria-label="Reopen cost package"]'));
image('tamper-rejected-desktop-1600x1000');
operations.push(['open', '{{ORIGIN}}/']);
wait(async () => { const { useStudio } = await import('/src/studio/store.ts'); return useStudio.getState().job?.id === 'job-sc10-rate-delta' && useStudio.getState().assetReadiness.document.state === 'ready'; });
evaluate(async () => {
  const { industryDraftKey } = await import('/src/studio/industries/draftStorage.ts');
  const form = JSON.parse(localStorage.getItem(industryDraftKey('job-sc10-rate-delta'))).drafts['quantity-surveying'].form;
  if (JSON.stringify(form) !== sessionStorage.getItem('sc11-restored-form-observer')) throw Error('Restored worksheet changed on reload');
  return { reloadFromNormalStorage: true, formByteExact: true, savedCostRevisions: form.pricing.snapshots.length };
});
operations.push(['errors']);
await writeFile(output, JSON.stringify({ schemaVersion: 1, name: 'SC11 real mounted QS package disk round trip', host: 'DANS1', baselineSc10Sha256: baselineHash, baselineSc10Operations: 297, operations }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ output, baselineSc10Sha256: baselineHash, operations: operations.length, SC11AppExportsOnly: true }));
