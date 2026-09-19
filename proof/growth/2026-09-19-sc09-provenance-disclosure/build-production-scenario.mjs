/** Packaging only: no product module is imported or executed on this host. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const fixtureBytes = readFileSync(resolve(directory, 'production-fixture/fixture.json'));
const fixtureReceipt = JSON.parse(readFileSync(resolve(directory, 'production-fixture/fixture-results.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(fixtureReceipt.host.toLowerCase(), 'dans1');
assert.equal(fixtureReceipt.verdict, 'PASS');
assert.equal(hash(fixtureBytes), fixtureReceipt.fixtureSha256);
const fixture = JSON.parse(fixtureBytes);
const originalBytes = readFileSync(resolve(directory, 'combined.scenario.json'));
const original = JSON.parse(originalBytes);
const fixtureLiteral = JSON.stringify(fixture);
const expression = fn => `(${fn.toString()})(${fixtureLiteral})`;

const seed = expression(async fixture => {
  if (!location.pathname.endsWith('/industry-coverage/index.html') || document.querySelector('[data-hydration-status]')
    || document.querySelector('script[type="module"]'))
    throw Error('Persistent fixture may only be seeded before the product loads');
  if (localStorage.getItem(fixture.projectStorageKey) !== null || localStorage.getItem(fixture.industryStorageKey) !== null)
    throw Error('Proof context is not empty; existing work will not be overwritten');
  const bytes = Uint8Array.from(atob(fixture.source.bytesBase64), character => character.charCodeAt(0));
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== fixture.source.sha256 || bytes.byteLength !== fixture.source.sizeBytes) throw Error('Fixture source bytes do not match their identity');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(fixture.planDatabase, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(fixture.planStore, { keyPath: 'documentId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Fixture plan database is blocked'));
  });
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(fixture.planStore, 'readwrite');
      const { bytesBase64, ...metadata } = fixture.source;
      void bytesBase64;
      transaction.objectStore(fixture.planStore).add({ ...metadata, bytes: bytes.buffer });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? Error('Fixture transaction aborted'));
    });
  } finally { db.close(); }
  localStorage.setItem(fixture.projectStorageKey, JSON.stringify(fixture.job));
  localStorage.setItem(fixture.industryStorageKey, JSON.stringify(fixture.library));
  return { persistedBeforeProductLoad: true, projectId: fixture.job.id, sourceSha256: digest, bytes: bytes.byteLength, unboundRows: fixture.library.drafts['quantity-surveying'].form.items.length };
});

const inspectHydration = expression(async fixture => {
  const job = JSON.parse(localStorage.getItem(fixture.projectStorageKey));
  const library = JSON.parse(localStorage.getItem(fixture.industryStorageKey));
  if (job.id !== fixture.job.id || JSON.stringify(job.runs) !== JSON.stringify(fixture.job.runs)
    || JSON.stringify(job.calibrations) !== JSON.stringify(fixture.job.calibrations)) throw Error('Product hydration changed or failed to load exact fixture geometry');
  if (library.drafts['quantity-surveying'].form.items.some(item => item.entityBinding != null)) throw Error('Rows were unexpectedly bound before actual UI actions');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(fixture.planDatabase, 1);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  let content;
  try {
    content = await new Promise((resolve, reject) => {
      const request = db.transaction(fixture.planStore).objectStore(fixture.planStore).get(fixture.source.documentId);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
  if (!(content?.bytes instanceof ArrayBuffer)) throw Error('Persisted binary bytes were not retained');
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', content.bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (sourceSha256 !== fixture.source.sha256 || content.sha256 !== sourceSha256) throw Error('Persisted source content changed');
  if (document.querySelector('[data-boot-failure]') || document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status') !== 'ready') throw Error('Production boot/hydration not ready');
  // Test observations only. This object is never read by product code and does
  // not expose or write its store, hooks, source modules or runtime state.
  window.__SC09_PROOF__ = {
    projectId: job.id, sourceSha256, calibrationId: fixture.job.calibrations[0].selectedCandidateId,
    runA: structuredClone(job.runs[0]), runB: structuredClone(job.runs[1]), sourceBounds: fixture.sourceBounds,
  };
  return { projectId: job.id, sourceSha256, hydratedFromPersistence: true, unboundRows: 2 };
});

const prepareDrag = expression(fixture => {
  const job = JSON.parse(localStorage.getItem(fixture.projectStorageKey));
  const before = job.runs.find(run => run.id === 'run-sc09-a');
  const untouchedBefore = job.runs.find(run => run.id === 'run-sc09-b');
  const canvas = document.querySelector('.measure-document-preview canvas[aria-label="Plan drawing canvas"]');
  const source = document.querySelector('.measure-document-preview .document-source-page');
  if (!canvas || !source || !before || !untouchedBefore) throw Error('Production Measure source/canvas/runs missing');
  if (document.querySelector('#selected-run-heading')?.textContent !== before.label) throw Error('Measure did not retain exact selected run');
  if (document.querySelector('.trace-edit-modes button[aria-pressed="true"]')?.textContent.trim() !== 'Move vertex') throw Error('Real vertex edit mode is not active');
  if ([...document.querySelectorAll('.measure-tools button[aria-pressed="true"]')].some(button => /^(Run|Area|Gate)\s/.test(button.textContent.trim()))) throw Error('A drawing tool is active during vertex edit');
  if (document.querySelector('.trace-editor-error')) throw Error('Measure already contains a trace edit error');
  const bounds = fixture.sourceBounds, sourceRect = source.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
  if (sourceRect.width < 120 || sourceRect.height < 90 || Math.abs(sourceRect.width / sourceRect.height - bounds.width / bounds.height) > 0.001)
    throw Error('Rendered source frame is missing or has unexpected aspect ratio');
  // The displayed SVG image and overlay share source-page-v1 bounds. Read its
  // actual rendered rectangle: no dev import, store read, guessed zoom or pan.
  const client = point => ({ x: sourceRect.left + (point.x - bounds.x) / bounds.width * sourceRect.width,
    y: sourceRect.top + (point.y - bounds.y) / bounds.height * sourceRect.height });
  const from = client(before.points[0]);
  const to = client({ x: before.points[0].x, y: before.points[0].y + 48 });
  for (const point of [from, to]) if (point.x < canvasRect.left || point.x > canvasRect.right || point.y < canvasRect.top || point.y > canvasRect.bottom
    || point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) throw Error('Real drag points are outside visible canvas');
  const pixelX = (from.x - canvasRect.left) * canvas.width / canvasRect.width;
  const pixelY = (from.y - canvasRect.top) * canvas.height / canvasRect.height;
  const pixels = canvas.getContext('2d').getImageData(Math.max(0, Math.floor(pixelX - 10)), Math.max(0, Math.floor(pixelY - 10)), 20, 20).data;
  let selectedPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 210 && pixels[i + 1] > 100 && pixels[i + 1] < 215 && pixels[i + 2] < 75 && pixels[i + 3] > 100) selectedPixels++;
  if (selectedPixels < 5) throw Error('DOM-derived drag point does not coincide with painted selected geometry');
  window.__SC09_PROOF__.canvasDrag = { from, to, before: structuredClone(before), untouchedBefore: structuredClone(untouchedBefore) };
  return { ...window.__SC09_PROOF__.canvasDrag, selectedPixels, coordinateAuthority: 'rendered source image rectangle + known source-page-v1 bounds' };
});

const waitSavedEdit = expression(fixture => {
  const job = JSON.parse(localStorage.getItem(fixture.projectStorageKey));
  const before = window.__SC09_PROOF__?.canvasDrag?.before;
  const after = job?.runs.find(run => run.id === 'run-sc09-a');
  return Boolean(before && after && after.revision === before.revision + 1
    && (after.points[0].x !== before.points[0].x || after.points[0].y !== before.points[0].y));
});
const assertSavedEdit = expression(fixture => {
  const job = JSON.parse(localStorage.getItem(fixture.projectStorageKey));
  const prepared = window.__SC09_PROOF__?.canvasDrag;
  if (!prepared) throw Error('Production pointer path has no before observation');
  const { before, untouchedBefore } = prepared;
  const after = job.runs.find(run => run.id === 'run-sc09-a');
  const untouchedAfter = job.runs.find(run => run.id === 'run-sc09-b');
  if (!after || !untouchedAfter || document.querySelector('.trace-editor-error')) throw Error('Canvas edit failed or removed measured geometry');
  if (after.revision !== before.revision + 1) throw Error('Real canvas edit did not create exactly one run revision');
  if (after.points[0].x === before.points[0].x && after.points[0].y === before.points[0].y) throw Error('Native pointer path did not move selected vertex');
  if (after.lengthM === before.lengthM) throw Error('Native pointer path did not change measured length');
  if (JSON.stringify(untouchedAfter) !== JSON.stringify(untouchedBefore)) throw Error('Editing A also changed untouched B');
  window.__SC09_PROOF__.canvasEdit = { entityId: after.id, beforeRevision: before.revision, afterRevision: after.revision,
    beforePoint: before.points[0], afterPoint: after.points[0], beforeLengthM: before.lengthM, afterLengthM: after.lengthM,
    untouchedEntityId: untouchedAfter.id, untouchedRevision: untouchedAfter.revision };
  return window.__SC09_PROOF__.canvasEdit;
});
const assertEditStillSaved = expression(fixture => {
  const job = JSON.parse(localStorage.getItem(fixture.projectStorageKey));
  const proof = window.__SC09_PROOF__?.canvasEdit;
  const run = job?.runs.find(entry => entry.id === 'run-sc09-a');
  return Boolean(proof && run && run.revision === proof.afterRevision
    && run.points[0].x === proof.afterPoint.x && run.points[0].y === proof.afterPoint.y);
});

assert.equal(original[2][0], 'open');
assert.match(original[4][1], /useStudio\.setState/);
const output = [original[0], original[1], ['open', '{{ORIGIN}}/industry-coverage/index.html'],
  ['wait', '--fn', "location.pathname.endsWith('/industry-coverage/index.html') && document.readyState === 'complete' && document.querySelector('link[rel=\"icon\"]')?.getAttribute('href') === 'data:,'"],
  ['eval', seed], ['open', '{{ORIGIN}}/'], original[3], ['eval', inspectHydration],
  ['find', 'role', 'button', 'click', '--name', 'Estimate', '--exact']];
const replacements = { prepare: 0, assertion: 0, saved: 0 };
for (const operation of original.slice(5)) {
  const code = operation.find(value => typeof value === 'string' && value.includes('import('));
  if (!code) output.push(operation);
  else if (code.includes('documentPointToCanvasPoint')) { output.push(['eval', prepareDrag]); replacements.prepare++; }
  else if (code.includes('const prepared = window.__SC09_PROOF__?.canvasDrag')) {
    output.push(['wait', '--fn', waitSavedEdit], ['eval', assertSavedEdit]); replacements.assertion++;
  } else if (code.includes('const proof = window.__SC09_PROOF__?.canvasEdit')) {
    output.push(['wait', '--fn', assertEditStillSaved]); replacements.saved++;
  } else throw Error('Unreviewed dev-only operation in production campaign');
}
assert.deepEqual(replacements, { prepare: 1, assertion: 1, saved: 1 });
for (const operation of output) {
  if (operation[0] === 'screenshot') operation[1] = `production-captures/${operation[1].split('/').at(-1)}`;
  for (const value of operation) if (typeof value === 'string' && /import\(|useStudio|\/src\//.test(value)) throw Error('Production campaign contains a dev module or runtime store access');
}
const bytes = JSON.stringify(output, null, 2) + '\n';
writeFileSync(resolve(directory, 'production.scenario.json'), bytes);
writeFileSync(resolve(directory, 'production.source.json'), JSON.stringify({
  kind: 'production-campaign-generation-not-browser-proof', fixtureSha256: hash(fixtureBytes),
  fixtureSourceArchiveSha256: fixtureReceipt.sourceArchiveSha256, devScenarioSha256: hash(originalBytes),
  scenarioSha256: hash(bytes), operations: output.length, captures: output.filter(op => op[0] === 'screenshot').length,
  replacements, persistenceOnlySeed: true, devImports: 0, postSeedProductStoreWrites: 0,
  differences: ['Seed exact unbound fixture into persistent browser storage on existing static coverage page before product load',
    'Navigate through the actual Estimate button after hydration', 'Derive pointer coordinates from rendered source image bounds',
    'Wait for actual persisted edit then verify revision, changed geometry and untouched second entity'],
}, null, 2) + '\n');
console.log(`Generated production campaign: ${output.length} operations, DANS1 browser execution still required.`);
