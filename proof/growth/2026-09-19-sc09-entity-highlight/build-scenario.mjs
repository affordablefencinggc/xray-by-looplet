/**
 * DANS1-only fast-CDP scenario builder for SC-09.
 *
 * This gate proves the complete user path rather than manufacturing a highlight:
 * two source-calibrated runs are loaded, two QS rows are bound through the UI,
 * the first row selects the same entity in the mounted 2D and 3D surfaces, and
 * Measure's real canvas pointer handlers move that entity. Returning to Costs
 * must make only that binding stale while the untouched binding remains current.
 *
 * Building this JSON is not a product test. Execute the emitted scenario only
 * on DANS1, through the repository's fast-CDP compatibility runner.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const dir = "proof/growth/2026-09-19-sc09-entity-highlight";
const captures = `${dir}/captures`;
mkdirSync(captures, { recursive: true });

const RUN_A = "run-sc09-a";
const RUN_B = "run-sc09-b";
const ITEM_A = "QS-WALL-A";
const ITEM_B = "QS-WALL-B";

const helpers = `
const setValue = (element, value) => {
  if (!element) throw Error('Cannot set a missing form control');
  const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};
const clickExact = (text) => {
  const button = [...document.querySelectorAll('button')].find(entry => entry.textContent.trim() === text);
  if (!button) throw Error('No button named ' + text);
  if (button.disabled) throw Error('Button is disabled: ' + text);
  button.click();
};
const selectWorksheet = () => {
  const workbench = document.querySelector('.industry-workbench');
  if (!workbench) throw Error('Industry workbench is not mounted');
  workbench.open = true;
  const select = document.querySelector('.industry-picker select');
  if (!select) throw Error('Worksheet picker is not mounted');
  setValue(select, 'quantity-surveying');
};
const bindingRows = () => [...document.querySelectorAll('[data-testid^="qs-binding-row-"]')];
const rowFor = (itemId) => bindingRows().find(row => row.getAttribute('data-testid') === 'qs-binding-row-' + itemId);
const highlightButtonFor = (itemId) => document.querySelector('[data-testid="qs-binding-highlight-' + itemId + '"]');
const planSurface = () => document.querySelector('[data-qs-highlight-surface="plan-2d"]');
const modelSurface = () => document.querySelector('canvas[data-qs-highlight-surface="model-3d"]');
const frame = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw Error('Cannot frame missing element ' + selector);
  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  return selector;
};
`;

const wrap = (body) => `(() => {${helpers}${body}})()`;

const seedRealGeometry = `(async () => {
  const { useStudio } = await import('/src/studio/store.ts');
  const domain = await import('/src/studio/domain.ts');
  const { industryDraftKey } = await import('/src/studio/industries/draftStorage.ts');

  const now = new Date().toISOString();
  const projectId = 'job-sc09-entity-highlight';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#f4f1e8"/><path d="M40 40H560V360H40Z M100 120H500 M100 280H420" fill="none" stroke="#77818c" stroke-width="2"/><text x="44" y="30" font-family="sans-serif" font-size="14">SC09 calibrated source geometry</text></svg>';
  const sourceBytes = new TextEncoder().encode(svg);
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', sourceBytes))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const document = {
    id: 'doc-sc09-source',
    name: 'SC09 measured wall source Rev C.svg',
    kind: 'svg',
    importedAt: now,
    pageCount: 1,
    sha256: sourceSha256,
    source: 'web',
  };
  const calibrationPoints = [{ x: 100, y: 40 }, { x: 500, y: 40 }];
  const candidate = {
    id: 'cal-sc09-grid-5m',
    source: 'manual',
    metresPerUnit: 0.0125,
    confidence: 1,
    inputDistance: { value: 5, unit: 'm' },
    knownDistanceM: 5,
    points: calibrationPoints,
    provenance: {
      method: 'two-point',
      evidence: 'SC09 controlled 5 m grid reference',
      documentId: document.id,
    },
  };
  const calibration = {
    sheet: 0,
    coordinateSpace: 'source-page-v1',
    metresPerUnit: candidate.metresPerUnit,
    source: 'manual',
    confidence: 1,
    locked: true,
    knownDistanceM: 5,
    points: calibrationPoints,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    inputDistance: candidate.inputDistance,
    candidates: [candidate],
    selectedCandidateId: candidate.id,
    conflict: null,
  };
  const specification = (assembly) => ({
    ...domain.createRunSpecification(),
    constructionEnabled: true,
    construction: {
      assembly,
      trade: 'General construction',
      quantity: 'length',
      widthM: null,
      depthM: null,
      reference: 'SC09 source-bound measured geometry',
    },
  });
  const runA = {
    id: '${RUN_A}', revision: 1, sheet: 0, label: 'Measured wall A',
    points: [{ x: 100, y: 120 }, { x: 500, y: 120 }],
    lengthM: 5, grossLengthM: 5, gateDeductionM: 0, netLengthM: 5,
    specification: specification('wall'), photoIds: [], review: domain.createReviewDecision(),
  };
  const runB = {
    id: '${RUN_B}', revision: 1, sheet: 0, label: 'Measured wall B',
    points: [{ x: 100, y: 280 }, { x: 420, y: 280 }],
    lengthM: 4, grossLengthM: 4, gateDeductionM: 0, netLengthM: 4,
    specification: specification('partition'), photoIds: [], review: domain.createReviewDecision(),
  };
  const base = domain.createDefaultJob(now);
  const job = domain.fencingJobSchema.parse({
    ...base,
    id: projectId,
    revision: 1,
    name: 'SC09 entity binding proof',
    updatedAt: now,
    documents: [document],
    activeDocumentId: document.id,
    calibrations: [calibration],
    runs: [runA, runB],
    gates: [],
    photos: [],
    bom: [],
    quoteDraft: null,
    revisionHistory: [],
  });

  // The controlled fixture supplies two unbound cost rows. Entity selection is
  // intentionally left to the product controls below; no binding is seeded.
  localStorage.setItem(industryDraftKey(projectId), JSON.stringify({
    format: 'xray.industry-drafts/1',
    projectId,
    revision: 1,
    drafts: {
      'quantity-surveying': {
        revision: 1,
        form: {
          hierarchyId: 'SC09 measured walls',
          hierarchyRevision: 'Rev C',
          calculated: false,
          binding: null,
          nodes: [
            { key: 'node-wall-a', code: 'A', label: 'External wall', parentKey: '' },
            { key: 'node-wall-b', code: 'B', label: 'Internal wall', parentKey: '' },
          ],
          items: [
            { key: 'item-wall-a', reference: '${ITEM_A}', quantity: '5', unit: 'm', evidence: 'unverified', nodeKey: 'node-wall-a' },
            { key: 'item-wall-b', reference: '${ITEM_B}', quantity: '4', unit: 'm', evidence: 'unverified', nodeKey: 'node-wall-b' },
          ],
        },
      },
    },
  }));
  useStudio.setState({
    pane: 'cost',
    sheet: 0,
    job,
    selectedRunId: null,
    selectedVertexIndex: null,
    selectedGateId: null,
    traceError: null,
    traceUndoStack: [],
    traceRedoStack: [],
    tool: 'none',
    pending: [],
    currentCalibration: calibration,
    scaleM: calibration.metresPerUnit,
    zoom2d: 1,
    pan2d: { x: 0, y: 0 },
    persistenceHydrated: true,
    hydrationStatus: 'ready',
    persistenceError: null,
    assetReadiness: { document: { state: 'ready', message: null }, photos: {} },
    activePlanBinary: {
      documentId: document.id,
      name: document.name,
      kind: document.kind,
      mimeType: 'image/svg+xml',
      sizeBytes: sourceBytes.byteLength,
      sha256: sourceSha256,
      bytes: sourceBytes,
    },
  });
  window.__SC09_PROOF__ = {
    projectId,
    sourceSha256,
    calibrationId: candidate.id,
    runA: { id: runA.id, revision: runA.revision, points: structuredClone(runA.points), lengthM: runA.lengthM },
    runB: { id: runB.id, revision: runB.revision, points: structuredClone(runB.points), lengthM: runB.lengthM },
  };
  return window.__SC09_PROOF__;
})()`;

const openQuantitySurveying = wrap(`
  selectWorksheet();
  return 'Quantity classification worksheet opened';
`);

const bindEntity = (row, runId) => wrap(`
  const select = document.querySelector('[data-testid="qs-entity-select-${row}"]');
  if (!select) throw Error('No measured entity selector for row ${row}');
  const option = [...select.options].find(entry => entry.value === '${runId}');
  if (!option || option.disabled) throw Error('Measured entity ${runId} is unavailable for row ${row}');
  setValue(select, '${runId}');
  return 'Bound row ${row} to ${runId} through the measured-entity selector';
`);

const calculate = wrap(`
  clickExact('Calculate classification');
  return 'Classification calculated after explicit entity binding';
`);

const assertBothBindingsCurrent = wrap(`
  const rowA = rowFor('${ITEM_A}');
  const rowB = rowFor('${ITEM_B}');
  if (!rowA || !rowB) throw Error('Both QS ledger rows must render');
  const statusA = rowA.getAttribute('data-binding-status');
  const statusB = rowB.getAttribute('data-binding-status');
  if (statusA !== 'verified' || statusB !== 'verified') {
    throw Error('Expected two current bindings, got ' + statusA + '/' + statusB);
  }
  if (rowA.getAttribute('data-highlight-claim') !== 'measured-and-current') throw Error('Run A has the wrong current highlight claim');
  if (rowB.getAttribute('data-highlight-claim') !== 'measured-and-current') throw Error('Run B has the wrong current highlight claim');
  if (!highlightButtonFor('${ITEM_A}') || !highlightButtonFor('${ITEM_B}')) throw Error('Current bindings are not selectable');
  return { statuses: [statusA, statusB], entities: ['${RUN_A}', '${RUN_B}'] };
`);

const clickCurrentHighlight = wrap(`
  const button = highlightButtonFor('${ITEM_A}');
  if (!button) throw Error('No Show in plan + 3D control for ${ITEM_A}');
  button.click();
  return 'Activated ${ITEM_A} through its Show in plan + 3D control';
`);

const assertExactSurfaceSelection = (expected, stage) => wrap(`
  const plan = planSurface();
  const model = modelSurface();
  if (!plan || !model) throw Error('Both 2D and 3D measured surfaces must be mounted');
  const planId = plan.getAttribute('data-highlighted-entity');
  const modelId = model.getAttribute('data-highlighted-entity');
  if (planId !== '${expected}' || modelId !== '${expected}') {
    throw Error('${stage}: exact surface selection mismatch ' + JSON.stringify({ planId, modelId }));
  }
  const meshCount = Number(model.getAttribute('data-mesh-count'));
  if (!Number.isFinite(meshCount) || meshCount < 2) throw Error('${stage}: 3D model did not render both measured runs');
  const planRect = plan.getBoundingClientRect();
  const modelRect = model.getBoundingClientRect();
  if (planRect.width < 120 || planRect.height < 90 || modelRect.width < 120 || modelRect.height < 90) {
    throw Error('${stage}: a measured surface is not visibly rendered');
  }
  if (plan.querySelector('.document-preview')?.getAttribute('data-source-ready') !== 'true') {
    throw Error('${stage}: the source drawing is not rendered in the measured plan');
  }
  const planCanvas = plan.querySelector('canvas[aria-label="Plan drawing canvas"]');
  if (!planCanvas) throw Error('${stage}: measured plan canvas missing');
  const pixels = planCanvas.getContext('2d').getImageData(0, 0, planCanvas.width, planCanvas.height).data;
  let highlightedPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 210 && pixels[i + 1] > 100 && pixels[i + 1] < 215 && pixels[i + 2] < 75 && pixels[i + 3] > 100) highlightedPixels++;
  }
  if (highlightedPixels < 20) throw Error('${stage}: selected geometry is not painted within the 2D canvas');
  return { stage: '${stage}', entityId: '${expected}', planId, modelId, meshCount, highlightedPixels };
`);

const framePreview = wrap(`return frame('[data-testid="qs-evidence-preview"]');`);
const frameLedger = wrap(`return frame('[data-testid="qs-item-binding-ledger"]');`);

const prepareRealRunCanvasDrag = `(async () => {
  const { useStudio } = await import('/src/studio/store.ts');
  const { documentPointToCanvasPoint } = await import('/src/studio/IsoCanvas.tsx');
  const canvas = document.querySelector('.measure-document-preview canvas[aria-label="Plan drawing canvas"]');
  if (!canvas) throw Error('The real Measure plan canvas is not mounted');
  const state = useStudio.getState();
  if (state.selectedRunId !== '${RUN_A}') throw Error('Measure did not retain the highlighted run selection');
  if (state.tool !== 'none') throw Error('A drawing tool is active; vertex editing would not be the pointer path');
  const before = state.job.runs.find(run => run.id === '${RUN_A}');
  const untouchedBefore = state.job.runs.find(run => run.id === '${RUN_B}');
  if (!before || !untouchedBefore) throw Error('Seeded measured runs are missing before the canvas edit');
  const sourceBounds = { x: 0, y: 0, width: 600, height: 400 };
  const viewport = {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    zoom: state.zoom2d,
    pan: state.pan2d,
    kind: 'cover',
    floors: state.floors,
    sourceBounds,
  };
  const start = documentPointToCanvasPoint(before.points[0], viewport);
  const movedDocumentPoint = { x: before.points[0].x, y: before.points[0].y + 48 };
  const finish = documentPointToCanvasPoint(movedDocumentPoint, viewport);
  const rect = canvas.getBoundingClientRect();
  const client = point => ({
    x: rect.left + point.x * rect.width / canvas.clientWidth,
    y: rect.top + point.y * rect.height / canvas.clientHeight,
  });
  const from = client(start);
  const to = client(finish);
  window.__SC09_PROOF__.canvasDrag = {
    from,
    to,
    before: structuredClone(before),
    untouchedBefore: structuredClone(untouchedBefore),
  };
  return window.__SC09_PROOF__.canvasDrag;
})()`;

const canvasDragFrom = `(() => {
  const point = window.__SC09_PROOF__?.canvasDrag?.from;
  if (!point) throw Error('SC09 canvas drag start was not prepared');
  return point;
})()`;

const canvasDragTo = `(() => {
  const point = window.__SC09_PROOF__?.canvasDrag?.to;
  if (!point) throw Error('SC09 canvas drag destination was not prepared');
  return point;
})()`;

const assertRealRunCanvasDrag = `(async () => {
  const { useStudio } = await import('/src/studio/store.ts');
  const prepared = window.__SC09_PROOF__?.canvasDrag;
  if (!prepared) throw Error('SC09 canvas drag state was not prepared');
  const before = prepared.before;
  const untouchedBefore = prepared.untouchedBefore;
  const afterState = useStudio.getState();
  const after = afterState.job.runs.find(run => run.id === '${RUN_A}');
  const untouchedAfter = afterState.job.runs.find(run => run.id === '${RUN_B}');
  if (!after || !untouchedAfter) throw Error('A measured run disappeared during the canvas edit');
  if (afterState.traceError) throw Error('Canvas edit was rejected: ' + afterState.traceError);
  if (after.revision !== before.revision + 1) throw Error('Canvas edit did not create a new run revision');
  if (after.points[0].x === before.points[0].x && after.points[0].y === before.points[0].y) throw Error('Canvas pointer path did not move the selected vertex');
  if (after.lengthM === before.lengthM) throw Error('Canvas pointer path did not change measured geometry length');
  if (untouchedAfter.revision !== untouchedBefore.revision || JSON.stringify(untouchedAfter.points) !== JSON.stringify(untouchedBefore.points)) {
    throw Error('Editing run A also changed run B');
  }
  window.__SC09_PROOF__.canvasEdit = {
    entityId: after.id,
    beforeRevision: before.revision,
    afterRevision: after.revision,
    beforePoint: structuredClone(before.points[0]),
    afterPoint: structuredClone(after.points[0]),
    beforeLengthM: before.lengthM,
    afterLengthM: after.lengthM,
    untouchedEntityId: untouchedAfter.id,
    untouchedRevision: untouchedAfter.revision,
  };
  return window.__SC09_PROOF__.canvasEdit;
})()`;

const assertCanvasEditPersisted = `(async () => {
  const { useStudio } = await import('/src/studio/store.ts');
  const proof = window.__SC09_PROOF__?.canvasEdit;
  const run = useStudio.getState().job.runs.find(entry => entry.id === '${RUN_A}');
  if (!proof || !run) return false;
  return run.revision === proof.afterRevision
    && run.points[0].x === proof.afterPoint.x
    && run.points[0].y === proof.afterPoint.y;
})()`;

const frameMeasureCanvas = wrap(`return frame('.measure-document-preview');`);

const assertOnlyEditedBindingStale = wrap(`
  const rowA = rowFor('${ITEM_A}');
  const rowB = rowFor('${ITEM_B}');
  if (!rowA || !rowB) throw Error('Both QS ledger rows must survive the pane round trip');
  const statusA = rowA.getAttribute('data-binding-status');
  const statusB = rowB.getAttribute('data-binding-status');
  if (statusA !== 'stale-measurement') throw Error('Edited run A must be stale, got ' + statusA);
  if (statusB !== 'verified') throw Error('Untouched run B must remain current, got ' + statusB);
  if (rowA.getAttribute('data-highlight-claim') !== 'measured-then-changed') throw Error('Stale run A has the wrong warning claim');
  if (rowB.getAttribute('data-highlight-claim') !== 'measured-and-current') throw Error('Current run B lost its current claim');
  if (rowA.getAttribute('data-highlight-resolvable') !== 'true') throw Error('Stale run A is no longer selectable');
  const button = highlightButtonFor('${ITEM_A}');
  if (!button) throw Error('Stale run A lost its Show in plan + 3D control');
  const notice = document.querySelector('[data-testid="qs-binding-withheld-notice"]');
  if (!notice || !notice.textContent.includes('Pricing withheld on 1 item')) throw Error('Withheld tally does not isolate run A');
  return { edited: statusA, untouched: statusB, staleSelectable: true };
`);

const clickStaleHighlight = wrap(`
  const button = highlightButtonFor('${ITEM_A}');
  if (!button) throw Error('Stale entity is not selectable');
  button.click();
  return 'Selected the stale entity through its retained Show in plan + 3D control';
`);

const assertTablet = wrap(`
  const plan = planSurface();
  const model = modelSurface();
  const button = highlightButtonFor('${ITEM_A}');
  if (!plan || !model || !button) throw Error('Tablet proof is missing a required control or surface');
  if (plan.getAttribute('data-highlighted-entity') !== '${RUN_A}' || model.getAttribute('data-highlighted-entity') !== '${RUN_A}') {
    throw Error('Tablet did not retain the exact stale entity selection');
  }
  const buttonRect = button.getBoundingClientRect();
  if (buttonRect.width < 44 || buttonRect.height < 44) throw Error('Tablet highlight control is smaller than 44 px');
  if (document.documentElement.scrollWidth > window.innerWidth + 1) throw Error('Tablet layout overflows the viewport');
  return { viewport: [innerWidth, innerHeight], touchTarget: [buttonRect.width, buttonRect.height], entityId: '${RUN_A}' };
`);

const scenario = [
  ["expect-cancelled-fetch", "http://127.0.0.1:8080/api/pricing-research", 4, "PricingResearchPanel effect cleanup aborts its GET provider-status probe on unmount (PricingResearchPanel.tsx:55-64); no search or failed asset is permitted."],
  ["set", "viewport", "1600", "1000"],
  ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status') === 'ready'"],
  ["eval", seedRealGeometry],
  ["wait", "--fn", "document.querySelector('nav[aria-label=\"Main workflow\"] button[aria-current=\"page\"]')?.textContent?.trim() === 'Estimate' && !!document.querySelector('.industry-workbench')"],
  ["eval", openQuantitySurveying],
  ["wait", "--fn", "document.querySelector('[data-draft-industry=\"quantity-surveying\"]')?.getAttribute('data-draft-save') === 'saved'"],

  ["wait", "--fn", `document.querySelector('[data-testid="qs-binding-row-${ITEM_A}"]')?.getAttribute('data-binding-status') === 'unbound' && document.querySelector('[data-testid="qs-binding-row-${ITEM_B}"]')?.getAttribute('data-binding-status') === 'unbound'`],
  ["wait", "--fn", `document.querySelector('[data-testid="qs-entity-select-1"]')?.querySelector('option[value="${RUN_A}"]:not([disabled])') && document.querySelector('[data-testid="qs-entity-select-2"]')?.querySelector('option[value="${RUN_B}"]:not([disabled])')`],

  ["eval", bindEntity(1, RUN_A)],
  ["wait", "--fn", `document.querySelector('[data-testid="qs-entity-select-1"]')?.value === '${RUN_A}'`],
  ["eval", bindEntity(2, RUN_B)],
  ["wait", "--fn", `document.querySelector('[data-testid="qs-entity-select-2"]')?.value === '${RUN_B}'`],
  ["eval", calculate],
  ["wait", "--fn", `document.querySelector('[data-testid="qs-binding-row-${ITEM_A}"]')?.getAttribute('data-binding-status') === 'verified' && document.querySelector('[data-testid="qs-binding-row-${ITEM_B}"]')?.getAttribute('data-binding-status') === 'verified'`],
  ["wait", "--fn", "document.querySelector('[data-draft-industry=\"quantity-surveying\"]')?.getAttribute('data-draft-save') === 'saved'"],
  ["eval", assertBothBindingsCurrent],

  ["eval", clickCurrentHighlight],
  ["wait", "--fn", `document.querySelector('[data-qs-highlight-surface="plan-2d"]')?.getAttribute('data-highlighted-entity') === '${RUN_A}' && document.querySelector('canvas[data-qs-highlight-surface="model-3d"]')?.getAttribute('data-highlighted-entity') === '${RUN_A}'`],
  ["eval", assertExactSurfaceSelection(RUN_A, "current binding")],
  ["eval", framePreview],
  ["screenshot", `${captures}/sc09-current-exact-2d-3d-desktop-1600x1000.png`],
  ["eval", frameLedger],
  ["screenshot", `${captures}/sc09-two-current-bindings-desktop-1600x1000.png`],

  ["find", "role", "button", "click", "--name", "Takeoff", "--exact"],
  ["wait", "--fn", "document.querySelector('nav[aria-label=\"Workspace tools\"] button[aria-current=\"page\"]')?.textContent?.trim() === 'Measure'"],
  ["wait", "--fn", "document.querySelector('.measure-document-preview')?.getAttribute('data-source-ready') === 'true' && !!document.querySelector('.trace-editor-panel')"],
  ["find", "role", "button", "click", "--name", "Move vertex", "--exact"],
  ["wait", "--fn", "document.querySelector('.trace-edit-modes button[aria-pressed=\"true\"]')?.textContent?.trim() === 'Move vertex'"],
  ["eval", prepareRealRunCanvasDrag],
  ["drag", "--from", canvasDragFrom, "--to", canvasDragTo, "--steps", "8", "--button", "left"],
  ["eval", assertRealRunCanvasDrag],
  ["wait", "--fn", assertCanvasEditPersisted],
  ["eval", frameMeasureCanvas],
  ["screenshot", `${captures}/sc09-real-canvas-vertex-edit-desktop-1600x1000.png`],

  ["find", "role", "button", "click", "--name", "Estimate", "--exact"],
  ["wait", "--fn", "document.querySelector('nav[aria-label=\"Main workflow\"] button[aria-current=\"page\"]')?.textContent?.trim() === 'Estimate' && !!document.querySelector('.industry-workbench')"],
  ["eval", openQuantitySurveying],
  ["wait", "--fn", "document.querySelector('[data-draft-industry=\"quantity-surveying\"]')?.getAttribute('data-draft-save') === 'saved'"],
  ["wait", "--fn", `document.querySelector('[data-testid="qs-binding-row-${ITEM_A}"]')?.getAttribute('data-binding-status') === 'stale-measurement' && document.querySelector('[data-testid="qs-binding-row-${ITEM_B}"]')?.getAttribute('data-binding-status') === 'verified'`],
  ["eval", assertOnlyEditedBindingStale],
  ["eval", clickStaleHighlight],
  ["wait", "--fn", `document.querySelector('[data-qs-highlight-surface="plan-2d"]')?.getAttribute('data-highlighted-entity') === '${RUN_A}' && document.querySelector('canvas[data-qs-highlight-surface="model-3d"]')?.getAttribute('data-highlighted-entity') === '${RUN_A}'`],
  ["eval", assertExactSurfaceSelection(RUN_A, "stale binding")],
  ["eval", framePreview],
  ["screenshot", `${captures}/sc09-stale-exact-2d-3d-desktop-1600x1000.png`],
  ["eval", frameLedger],
  ["screenshot", `${captures}/sc09-only-edited-run-stale-desktop-1600x1000.png`],

  ["set", "viewport", "1024", "768"],
  ["eval", assertTablet],
  ["eval", framePreview],
  ["screenshot", `${captures}/sc09-stale-exact-2d-3d-tablet-1024x768.png`],
  ["eval", frameLedger],
  ["screenshot", `${captures}/sc09-only-edited-run-stale-tablet-1024x768.png`],
  ["errors"],
];

const out = `${dir}/sc09-entity-highlight.scenario.json`;
writeFileSync(out, JSON.stringify(scenario, null, 2), "utf8");
console.log(`Scenario written to ${out} (${scenario.length} operations).`);
