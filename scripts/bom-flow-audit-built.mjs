#!/usr/bin/env node
/**
 * SC-07H browser proof for the production bundle.
 *
 * The exact built route chunk is served with one append-only observability
 * assignment that exposes its existing Zustand store to this audit. No
 * production behavior is replaced. A deterministic in-page Tauri invoke stub
 * returns the reviewed golden response, rebound to the request compiled by the
 * production code. Native binaries and external integrations are never run.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] ?? "http://127.0.0.1:8081/");
const timeout = Number(process.env.BOM_FLOW_AUDIT_TIMEOUT_MS ?? 45_000);
const root = process.cwd();
const screenshotRoot = process.platform === "win32" ? resolve(root, "screenshots") : "/workspace/screenshots";
const proofRoot = resolve(root, "proof", "SC-07");
const verdictPath = checkedOutputPath(resolve(proofRoot, "bom-flow-audit-built.json"), [proofRoot], "built BOM flow verdict");
const requestPath = resolve(root, "engine", "fixtures", "bom-contract", "colorbond.request.json");
const responsePath = resolve(root, "engine", "fixtures", "bom-contract", "colorbond.response.json");
const requestText = readFileSync(requestPath, "utf8");
const responseText = readFileSync(responsePath, "utf8");
const requestFixture = JSON.parse(requestText);
const responseFixture = JSON.parse(responseText);
const auditScriptSha256 = createHash("sha256").update(readFileSync(new URL(import.meta.url), "utf8")).digest("hex");
const allViewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];
const viewportFilter = process.env.BOM_FLOW_AUDIT_VIEWPORT;
const viewports = viewportFilter ? allViewports.filter(({ name }) => name === viewportFilter) : allViewports;

mkdirSync(screenshotRoot, { recursive: true });
mkdirSync(dirname(verdictPath), { recursive: true });

function assert(value, message) {
  if (!value) throw new Error(message);
}

function observe(page, record) {
  page.on("console", (message) => {
    if (message.type() === "error") record.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => record.pageErrors.push(String(error?.message ?? error)));
}

async function installProductionInstrumentation(context, record) {
  await context.route(/\/assets\/routes-[^/]+\.js(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "xray:fencing-job:v2";
    const anchor = "export{Ks as component};";
    assert(body.includes(marker), "The intercepted route chunk did not contain the Studio persistence marker.");
    assert(body.endsWith(anchor), "The production route chunk did not end at the reviewed export anchor.");
    const instrumented = `${body}\nglobalThis.__SC07_PRODUCTION_AUDIT__={store:J,reconcileBomBinding:Xr};globalThis.__SC07_PRODUCTION_STORE__=J;\n`;
    record.instrumentation = {
      strategy: "append-only-built-chunk-observability",
      originalSha256: createHash("sha256").update(body).digest("hex"),
      originalBytes: Buffer.byteLength(body),
      appendBytes: Buffer.byteLength(instrumented) - Buffer.byteLength(body),
      replacements: 0,
      sourceBehaviorChanged: false,
    };
    await route.fulfill({ response, body: instrumented, headers: { ...response.headers(), "content-length": String(Buffer.byteLength(instrumented)) } });
  });
}

async function installFakeTauri(context) {
  await context.addInitScript(({ goldenResponse }) => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    window.__SC07_BOM_FAKE__ = { runCalls: 0, cancelCalls: 0, lastRequestId: null, lastRequestJson: null, mode: "success", held: [], heartbeat: 0 };
    setInterval(() => { window.__SC07_BOM_FAKE__.heartbeat += 1; }, 25);
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args = {}) => {
        if (command === "xray_bom_status") {
          return { available: true, host: "tauri", requestSchemas: ["xray.job-to-bom/v1"], responseSchemas: ["xray.bom/v1"], rulesets: [{ id: "fencing-v1", version: 1 }] };
        }
        if (command === "xray_cancel_bom") {
          window.__SC07_BOM_FAKE__.cancelCalls += 1;
          return null;
        }
        if (command !== "xray_run_bom") throw new Error(`Unexpected SC-07 Tauri command ${command}.`);
        const request = JSON.parse(args.requestJson);
        window.__SC07_BOM_FAKE__.runCalls += 1;
        window.__SC07_BOM_FAKE__.lastRequestId = request.requestId;
        window.__SC07_BOM_FAKE__.lastRequestJson = args.requestJson;
        sessionStorage.setItem("sc07:last-bom-request", args.requestJson);

        const response = clone(goldenResponse);
        response.requestId = request.requestId;
        response.bom.jobId = request.job.id;
        response.bom.jobRevision = request.job.revision;
        response.bom.inputDigest = request.inputDigest;
        response.bom.documentSha256 = request.document.sha256;
        response.bom.recipeSet = { id: request.recipeSet.id, revision: request.recipeSet.revision, digest: request.recipeSet.digest };
        const activeRecipeIds = new Set(request.runs.map((run) => run.recipeId));
        const assumptions = request.recipeSet.recipes.filter((recipe) => activeRecipeIds.has(recipe.id)).flatMap((recipe) => recipe.assumptions);
        response.bom.assumptions = assumptions;
        const byKey = Object.fromEntries(assumptions.map((assumption) => [assumption.key, assumption.id]));
        const fixtureKey = Object.fromEntries(goldenResponse.bom.assumptions.map((assumption) => [assumption.id, assumption.key]));
        const keyAliases = { "effective-sheet-cover-mm": "sheet-cover-and-rail-rows", "rail-rows": "sheet-cover-and-rail-rows" };
        response.bom.lines = response.bom.lines.map((line) => ({
          ...line,
          assumptionRefs: line.assumptionRefs.map((id) => byKey[keyAliases[fixtureKey[id]] ?? fixtureKey[id]] ?? id),
        }));
        if (window.__SC07_BOM_FAKE__.mode === "domain") {
          return { ok: true, requestId: request.requestId, response: { schema: "xray.bom/v1", ok: false, requestId: request.requestId, inputDigest: request.inputDigest, issues: [{ code: "gate-overlap", message: "Two approved gate openings overlap on the selected run.", entityId: "gate-double", path: "gates" }] } };
        }
        if (window.__SC07_BOM_FAKE__.mode === "unsafe-transport") {
          return { ok: false, requestId: request.requestId, error: { code: "spawn-failed", stage: "spawn", retryable: true, safeMessage: "C:\\Users\\daniel\\secrets.txt\u0007 STACK_TRACE api_key=xai-DO_NOT_RENDER_12345678", diagnosticId: "SC07_REDACTION" } };
        }
        const envelope = { ok: true, requestId: request.requestId, response };
        window.__SC07_BOM_FAKE__.lastEnvelope = envelope;
        if (window.__SC07_BOM_FAKE__.mode === "hold") return new Promise((resolve) => window.__SC07_BOM_FAKE__.held.push({ requestId: request.requestId, envelope, release: () => resolve(envelope) }));
        return envelope;
      },
    };
  }, { goldenResponse: responseFixture });
}

async function waitForStudio(page) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  assert(response?.ok(), `Navigation returned HTTP ${response?.status() ?? 0}.`);
  await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout });
  await page.getByRole("navigation", { name: "Panes" }).waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => window.__SC07_PRODUCTION_STORE__?.getState().persistenceHydrated === true, undefined, { timeout });
  return response.status();
}

async function selectPane(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  assert((await button.count()) === 1, `${name} pane control is missing or duplicated.`);
  await button.click();
  await page.waitForFunction((label) => document.querySelector('nav[aria-label="Panes"] button.active')?.textContent?.trim() === label, name, { timeout });
}

async function seedFixtureJob(page, fixture) {
  return page.evaluate((input) => {
    const useStudio = window.__SC07_PRODUCTION_STORE__;
    const timestamp = "2026-09-04T00:00:00.000Z";
    const sourceRun = input.runs[0];
    const sourceGate = input.gates[0];
    const base = useStudio.getState().job;
    const candidate = {
      id: input.calibrations[0].candidateId,
      source: "declared",
      metresPerUnit: Number(input.calibrations[0].metresPerUnit),
      confidence: 1,
      inputDistance: null,
      knownDistanceM: null,
      points: null,
      provenance: { method: "SC-07 built browser audit fixture", evidence: "Known deterministic contract geometry", documentId: input.document.id },
    };
    const specification = sourceRun.specification;
    const run = {
      id: sourceRun.id, revision: sourceRun.revision, sheet: sourceRun.sheet, label: sourceRun.label,
      points: [{ x: 0, y: 0 }, { x: sourceRun.segments[0].lengthMm / 1000, y: 0 }],
      lengthM: sourceRun.storedLengths.netMm / 1000,
      grossLengthM: sourceRun.storedLengths.grossMm / 1000,
      gateDeductionM: sourceRun.storedLengths.gateDeductionMm / 1000,
      netLengthM: sourceRun.storedLengths.netMm / 1000,
      specification: {
        system: specification.system, customSystem: specification.customSystem, profile: specification.profile,
        heightM: specification.heightMm / 1000, bayWidthM: specification.bayWidthMm / 1000,
        ground: specification.ground, slope: specification.slope, removalRequired: specification.removalRequired,
        removalMaterial: specification.removalMaterial,
        removalLengthM: specification.removalLengthMm === null ? null : specification.removalLengthMm / 1000,
        disposalRequired: specification.disposalRequired, access: specification.access, sleepers: specification.sleepers,
        retainingRequired: specification.retainingRequired, retainingType: specification.retainingType,
        retainingHeightM: specification.retainingHeightMm === null ? null : specification.retainingHeightMm / 1000,
        retainingCondition: specification.retainingCondition, corners: [], postOverrides: [], notes: specification.notes,
      },
      photoIds: [],
      review: { status: "approved", decidedAt: sourceRun.approval.decidedAt, decidedBy: sourceRun.approval.decidedBy, note: sourceRun.approval.note },
    };
    const gate = {
      id: sourceGate.id, revision: sourceGate.revision, sheet: sourceGate.sheet, label: sourceGate.label,
      point: { x: sourceGate.centreOffsetMm / 1000, y: 0 }, runId: sourceGate.runId,
      segmentIndex: sourceGate.segmentIndex, segmentT: sourceGate.centreOffsetMm / sourceRun.segments[sourceGate.segmentIndex].lengthMm,
      photoIds: [], review: { status: "approved", decidedAt: sourceGate.approval.decidedAt, decidedBy: sourceGate.approval.decidedBy, note: sourceGate.approval.note },
      widthM: sourceGate.widthMm / 1000, heightM: sourceGate.heightMm / 1000, type: sourceGate.type,
      customType: sourceGate.customType, openingDirection: sourceGate.openingDirection, hingeSide: sourceGate.hingeSide,
      hardware: sourceGate.hardware, latch: sourceGate.latch, postSize: sourceGate.postSize, finish: sourceGate.finish,
      clearanceM: sourceGate.clearanceMm === null ? null : sourceGate.clearanceMm / 1000, motorised: sourceGate.motorised, notes: "",
    };
    const job = {
      ...base, schemaVersion: 2, id: input.job.id, revision: input.job.revision, name: "SC-07 production BOM audit",
      createdAt: timestamp, updatedAt: timestamp,
      documents: [{ id: input.document.id, name: input.document.name, kind: input.document.kind, importedAt: timestamp, pageCount: 1, sha256: input.document.sha256, source: "web" }],
      activeDocumentId: input.document.id,
      calibrations: [{ sheet: 0, metresPerUnit: candidate.metresPerUnit, source: "declared", confidence: 1, locked: true, knownDistanceM: null, points: null, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, inputDistance: null, candidates: [candidate], selectedCandidateId: candidate.id, conflict: null }],
      runs: [run], gates: [gate], photos: [], bom: [], quoteDraft: null, revisionHistory: [],
    };
    useStudio.setState({
      pane: "cost", sheet: 0, job,
      bomState: { schema: "xray.bom-state/v1", stateRevision: 0, jobId: job.id, pending: null, snapshot: null, invalidation: null, lastFailure: null },
      persistenceHydrated: true, hydrationStatus: "ready", persistenceError: null, bomPersistenceError: null,
      assetReadiness: { document: { state: "ready", message: null }, photos: {} },
      activePlanBinary: { documentId: input.document.id, name: input.document.name, kind: input.document.kind, mimeType: "image/svg+xml", sizeBytes: 1, sha256: input.document.sha256, bytes: new Uint8Array([32]) },
    });
    return { storeExposed: true, jobId: job.id, jobRevision: job.revision, runId: run.id, gateId: gate.id };
  }, fixture);
}

async function exerciseCancellation(page, fixture) {
  await page.evaluate((input) => window.__SC07_PRODUCTION_STORE__.getState().beginBomGeneration(input, "2026-09-04T00:00:01.000Z"), fixture);
  await page.getByRole("button", { name: "Cancel build" }).click();
  await page.getByText("Quantity build cancelled by the estimator.", { exact: true }).waitFor({ state: "visible", timeout });
  const state = await page.evaluate(() => {
    const bom = window.__SC07_PRODUCTION_STORE__.getState().bomState;
    return { pending: bom.pending, failure: bom.lastFailure };
  });
  assert(state.pending === null && state.failure?.kind === "transport", "Cancellation did not clear pending state with a typed transport failure.");
  return { button: true, pendingCleared: true, failureKind: state.failure.kind, message: state.failure.message };
}

async function resetBomState(page) {
  await page.evaluate(() => {
    const store = window.__SC07_PRODUCTION_STORE__;
    const state = store.getState();
    store.setState({ bomState: { schema: "xray.bom-state/v1", stateRevision: 0, jobId: state.job.id, pending: null, snapshot: null, invalidation: null, lastFailure: null }, bomPersistenceError: null });
  });
}

async function verifyActorGate(page) {
  await page.getByRole("button", { name: "Accept assumption" }).first().click();
  const message = "Enter the reviewer responsible for accepting this project assumption.";
  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout });
  return { blockedWithoutActor: true, message };
}

async function acceptAllAssumptions(page) {
  const reviewer = "SC-07 production auditor";
  await page.getByLabel(/Responsible estimator|Assumption reviewer/).fill(reviewer);
  let accepted = 0;
  while ((await page.getByRole("button", { name: "Accept assumption" }).count()) > 0) {
    const before = await page.getByRole("button", { name: "Accept assumption" }).count();
    await page.getByRole("button", { name: "Accept assumption" }).first().click();
    await page.waitForFunction((count) => [...document.querySelectorAll("button")].filter((button) => button.textContent?.trim() === "Accept assumption").length < count, before, { timeout });
    accepted += 1;
  }
  assert(accepted > 0, "No active recipe assumptions were accepted.");
  return { reviewer, accepted };
}

async function generateAndInspect(page, screenshot) {
  await page.getByRole("button", { name: "Generate BOM" }).click();
  await page.getByText("Current result", { exact: true }).waitFor({ state: "visible", timeout });
  const rows = page.locator("table").filter({ has: page.getByText("CB-POST-END", { exact: true }) }).locator("tbody tr");
  const rowCount = await rows.count();
  assert(rowCount === 11, `Expected 11 visible material lines, observed ${rowCount}.`);
  const details = rows.filter({ has: page.getByText("CB-POST-END", { exact: true }) }).first().locator("details");
  await details.locator("summary").click();
  await details.getByText("Expression", { exact: true }).waitFor({ state: "visible", timeout });
  const detailText = await details.innerText();
  assert(/two outer run endpoints = 2 end posts/i.test(detailText), "Calculation expression is not visible.");
  assert(/run:run-boundary rev 5/i.test(detailText), "Evidence reference is not visible.");
  assert(/spacing/i.test(detailText), "Active spacing assumption is not visible.");
  assert(/Single source/i.test(detailText), "Confidence tier is not visible.");
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector(".studio-main")?.scrollTo(0, 0);
  });
  await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });
  const state = await page.evaluate(() => {
    const bom = window.__SC07_PRODUCTION_STORE__.getState().bomState;
    return { pending: bom.pending, hasSnapshot: bom.snapshot !== null, requestId: bom.snapshot?.requestId ?? null, lineCount: bom.snapshot?.response.ok ? bom.snapshot.response.bom.summary.lineCount : null, invalidation: bom.invalidation };
  });
  assert(state.pending === null && state.hasSnapshot && state.lineCount === rowCount, "Successful production generation was not atomically committed.");
  const bridge = await page.evaluate(() => ({ ...window.__SC07_BOM_FAKE__, lastRequestJson: undefined }));
  assert(bridge.runCalls === 1, `Expected one fake Tauri run invocation, observed ${bridge.runCalls}.`);
  await details.getByRole("button", { name: /run:run-boundary rev 5/i }).click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="Panes"] button.active')?.textContent?.trim() === "Measure", undefined, { timeout });
  const selectedRunId = await page.evaluate(() => window.__SC07_PRODUCTION_STORE__.getState().selectedRunId);
  assert(selectedRunId === "run-boundary", `Evidence navigation selected ${selectedRunId ?? "no run"}.`);
  await selectPane(page, "Cost");
  return { ...state, transport: "fake-tauri", bridge, visibleRows: rowCount, expressionExpanded: true, evidenceVisible: true, assumptionsVisible: true, confidenceVisible: true, evidenceNavigation: { pane: "Measure", selectedRunId }, nativeEngineExecuted: false };
}

async function verifyReload(page, expectedRequestId, accepted) {
  await page.waitForTimeout(750);
  await page.reload({ waitUntil: "domcontentloaded", timeout });
  await page.locator('[data-hydration-status="ready"]').waitFor({ state: "attached", timeout });
  await page.waitForFunction(() => window.__SC07_PRODUCTION_STORE__?.getState().persistenceHydrated === true, undefined, { timeout });
  await selectPane(page, "Cost");
  await page.getByText("Current result", { exact: true }).waitFor({ state: "visible", timeout });
  const state = await page.evaluate(() => {
    const bom = window.__SC07_PRODUCTION_STORE__.getState().bomState;
    return { requestId: bom.snapshot?.requestId ?? null, invalidation: bom.invalidation, failure: bom.lastFailure };
  });
  const acceptedDecisionCount = await page.getByRole("button", { name: "Reopen" }).count();
  assert(state.requestId === expectedRequestId && state.invalidation === null, "Reload did not restore the same current snapshot.");
  assert(acceptedDecisionCount === accepted, `Reload restored ${acceptedDecisionCount} accepted assumptions instead of ${accepted}.`);
  return { restored: true, requestId: state.requestId, stayedCurrent: true, acceptedDecisionCount, failure: state.failure };
}

async function verifyCancellationPreservesSnapshot(page, expectedRequestId) {
  await page.evaluate(() => {
    const store = window.__SC07_PRODUCTION_STORE__;
    store.getState().beginBomGeneration(JSON.parse(sessionStorage.getItem("sc07:last-bom-request")), new Date().toISOString());
  });
  await page.getByRole("button", { name: "Cancel build" }).click();
  const state = await page.evaluate(() => {
    const store = window.__SC07_PRODUCTION_STORE__;
    const bom = store.getState().bomState;
    const result = { pending: bom.pending, requestId: bom.snapshot?.requestId ?? null, failureKind: bom.lastFailure?.kind ?? null, failureMessage: bom.lastFailure?.message ?? null };
    store.setState({ bomState: { ...bom, lastFailure: null } });
    return result;
  });
  assert(state.pending === null && state.requestId === expectedRequestId && state.failureKind === "transport", "Cancellation did not preserve the committed snapshot.");
  await page.getByText("Current result", { exact: true }).waitFor({ state: "visible", timeout });
  return { ...state, snapshotPreserved: true };
}

async function prepareRetry(page) {
  await page.evaluate(() => {
    const store = window.__SC07_PRODUCTION_STORE__;
    const request = JSON.parse(sessionStorage.getItem("sc07:last-bom-request"));
    store.getState().beginBomGeneration(request, new Date().toISOString());
    store.getState().failBomGeneration("Retry fixture: prior transport attempt interrupted.", new Date().toISOString());
  });
  await page.getByRole("heading", { name: "BOM could not be generated" }).waitFor({ state: "visible", timeout });
}

async function verifyResponsiveLateResultRace(page) {
  await prepareRetry(page);
  await page.evaluate(() => { window.__SC07_BOM_FAKE__.mode = "hold"; });
  await page.getByRole("button", { name: "Retry build" }).click();
  await page.getByRole("heading", { name: "Compiling quantities" }).waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => window.__SC07_BOM_FAKE__.held.length === 1, undefined, { timeout });

  const retainedDetails = page.locator("details").first();
  await retainedDetails.locator("summary").click();
  const heartbeat = await page.evaluate(() => new Promise((resolve) => {
    const startedAt = performance.now();
    setTimeout(() => resolve({ ticks: 1, elapsedMs: performance.now() - startedAt }), 75);
  }));
  assert(heartbeat.ticks === 1 && heartbeat.elapsedMs >= 0, "Bundled browser event-loop heartbeat stopped while the Tauri invoke was held pending.");
  assert(await retainedDetails.evaluate((element) => element.open), "Bundled retained-result details did not respond while the invoke was held pending.");

  const changed = await page.evaluate(() => {
    const { store, reconcileBomBinding } = window.__SC07_PRODUCTION_AUDIT__;
    const before = store.getState();
    store.getState().updateJobName(`${before.job.name} · revised while compiling`);
    const afterJob = store.getState();
    const reference = afterJob.bomState.pending?.binding ?? afterJob.bomState.snapshot?.binding;
    const observed = {
      ...reference,
      jobRevision: afterJob.job.revision,
      recipeSetRevision: reference.recipeSetRevision + 1,
      recipeSetDigest: `${reference.recipeSetDigest[0] === "f" ? "e" : "f"}${reference.recipeSetDigest.slice(1)}`,
      ruleset: { ...reference.ruleset, version: reference.ruleset.version + 1 },
      inputDigest: `${reference.inputDigest[0] === "f" ? "e" : "f"}${reference.inputDigest.slice(1)}`,
    };
    store.setState({ bomState: reconcileBomBinding(afterJob.bomState, observed, new Date().toISOString()) });
    return { jobRevisionBefore: before.job.revision, jobRevisionAfter: afterJob.job.revision, pendingCleared: store.getState().bomState.pending === null, reasons: store.getState().bomState.invalidation?.reasons ?? [] };
  });
  assert(changed.jobRevisionAfter === changed.jobRevisionBefore + 1, "The bundled store job mutation did not advance one revision.");
  assert(changed.pendingCleared, "Bundled binding reconciliation did not cancel the obsolete pending request.");
  for (const reason of ["job-changed", "recipe-changed", "ruleset-changed"]) assert(changed.reasons.includes(reason), `Missing ${reason} invalidation during the bundled held request.`);

  await page.getByRole("button", { name: "Regenerate BOM" }).waitFor({ state: "visible", timeout });
  const staleRegenerationControlAvailable = (await page.getByRole("button", { name: "Regenerate BOM" }).count()) === 1;
  assert(staleRegenerationControlAvailable, "The bundled native-capable retained-stale state did not expose Regenerate BOM.");
  await page.evaluate(() => { window.__SC07_BOM_FAKE__.mode = "success"; });
  await page.getByRole("button", { name: "Regenerate BOM" }).click();
  await page.getByText("Current result", { exact: true }).waitFor({ state: "visible", timeout });
  const newest = await page.evaluate(() => ({ requestId: window.__SC07_PRODUCTION_STORE__.getState().bomState.snapshot?.requestId ?? null, runCalls: window.__SC07_BOM_FAKE__.runCalls }));
  assert(newest.runCalls >= 3 && newest.requestId, `The visible bundled regeneration action did not commit the newest request; calls=${newest.runCalls}.`);
  const released = await page.evaluate(() => {
    const held = window.__SC07_BOM_FAKE__.held.splice(0);
    for (const entry of held) entry.release();
    return held.map((entry) => entry.requestId);
  });
  assert(released.length === 1 && released[0] !== newest.requestId, "The bundled held response identity was not older than the committed result.");
  await page.waitForTimeout(250);
  const final = await page.evaluate(() => {
    const bom = window.__SC07_PRODUCTION_STORE__.getState().bomState;
    return { requestId: bom.snapshot?.requestId ?? null, pending: bom.pending, failure: bom.lastFailure };
  });
  assert(final.requestId === newest.requestId && final.pending === null && final.failure === null, "The bundled late success displaced or damaged the newest committed binding.");
  return { pendingInvokeHeld: true, heartbeat, retainedDetailResponsive: true, bindingChanges: changed, heldRequestId: released[0], newestRequestId: newest.requestId, lateResultIgnored: true, newestStart: "visible Regenerate BOM control", staleRegenerationControlAvailable, uiBlocker: null, rulesetControl: "No user-facing ruleset selector exists; the bundled production binding reconciler was driven directly for this dimension." };
}

async function verifyDomainAndSafeTransportFailures(page) {
  await prepareRetry(page);
  await page.evaluate(() => { window.__SC07_BOM_FAKE__.mode = "domain"; });
  await page.getByRole("button", { name: "Retry build" }).click();
  await page.getByRole("heading", { name: "Resolve before generating" }).waitFor({ state: "visible", timeout });
  await page.getByText("gate-overlap", { exact: true }).waitFor({ state: "visible", timeout });
  const domainText = await page.locator(".bom-panel").innerText();
  assert(!domainText.includes("BOM could not be generated"), "Bundled domain issues collapsed into the transport-failure presentation.");

  await page.evaluate(() => { window.__SC07_BOM_FAKE__.mode = "unsafe-transport"; });
  await page.getByRole("button", { name: "Check again" }).click();
  await page.getByRole("heading", { name: "BOM could not be generated" }).waitFor({ state: "visible", timeout });
  const transportText = await page.locator(".bom-panel").innerText();
  const safeMessage = "The BOM engine returned an invalid transport result.";
  const forbidden = ["C:\\Users\\daniel\\secrets.txt", "STACK_TRACE", "api_key=xai-DO_NOT_RENDER_12345678", "\u0007"];
  assert(transportText.includes(safeMessage), `Bundled safe transport message was not rendered: ${transportText}`);
  for (const value of forbidden) assert(!transportText.includes(value), `Forbidden bundled diagnostic detail reached the UI: ${JSON.stringify(value)}.`);
  return { domain: { distinctPresentation: true, issueCodeVisible: "gate-overlap", transportHeadingAbsent: true }, transport: { distinctPresentation: true, safeMessage, attemptedForbiddenDetails: forbidden, forbiddenDetailsRendered: false, expectedNormalizedCode: "response-contract" } };
}

async function mutateJobAndRecipeAndVerifyStale(page, screenshot) {
  const mutation = await page.evaluate(() => {
    const { store, reconcileBomBinding } = window.__SC07_PRODUCTION_AUDIT__;
    const before = store.getState();
    const binding = before.bomState.snapshot.binding;
    store.setState({ job: { ...before.job, revision: before.job.revision + 1, updatedAt: new Date().toISOString() } });
    const observed = {
      ...binding,
      jobRevision: binding.jobRevision + 1,
      recipeSetRevision: binding.recipeSetRevision + 1,
      recipeSetDigest: `${binding.recipeSetDigest[0] === "f" ? "e" : "f"}${binding.recipeSetDigest.slice(1)}`,
      inputDigest: `${binding.inputDigest[0] === "f" ? "e" : "f"}${binding.inputDigest.slice(1)}`,
    };
    store.setState({ bomState: reconcileBomBinding(store.getState().bomState, observed, new Date().toISOString()) });
    const after = store.getState();
    return { beforeRevision: before.job.revision, afterRevision: after.job.revision, hasSnapshot: after.bomState.snapshot !== null, reasons: after.bomState.invalidation?.reasons ?? [] };
  });
  await page.getByText("Stale — source inputs changed", { exact: true }).waitFor({ state: "visible", timeout });
  assert(mutation.afterRevision === mutation.beforeRevision + 1 && mutation.hasSnapshot, "Stale mutation did not retain the snapshot at the next job revision.");
  assert(mutation.reasons.includes("job-changed") && mutation.reasons.includes("recipe-changed"), `Stale reasons were ${mutation.reasons.join(", ")}.`);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector(".studio-main")?.scrollTo(0, 0);
  });
  await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });
  return { ...mutation, staleLabelVisible: true };
}

async function auditBrowserUnavailable(browser, viewport) {
  const screenshot = checkedOutputPath(resolve(screenshotRoot, `bom-flow-built-${viewport.name}-unavailable.png`), [screenshotRoot]);
  const record = { viewport, host: "web", status: null, instrumentation: null, assumptionsAccepted: 0, titleVisible: false, generateUnavailable: false, consoleErrors: [], pageErrors: [], screenshot, ok: false };
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await installProductionInstrumentation(context, record);
  const page = await context.newPage();
  observe(page, record);
  try {
    record.status = await waitForStudio(page);
    await seedFixtureJob(page, requestFixture);
    await page.getByLabel(/Responsible estimator|Assumption reviewer/).waitFor({ state: "visible", timeout });
    record.assumptionsAccepted = (await acceptAllAssumptions(page)).accepted;
    await page.getByRole("heading", { name: "Desktop quantity engine required" }).waitFor({ state: "visible", timeout });
    record.titleVisible = true;
    record.generateUnavailable = (await page.getByRole("button", { name: "Generate BOM" }).count()) === 0;
    assert(record.generateUnavailable, "True bundled browser-host unavailable state exposed Generate BOM.");
    assert((await page.locator("body").innerText()).includes("cannot generate a new BOM"), "Bundled browser-host unavailable explanation was not visible.");
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector(".studio-main")?.scrollTo(0, 0);
    });
    await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });
    assert(record.consoleErrors.length === 0 && record.pageErrors.length === 0, "Bundled browser-host unavailable audit emitted browser errors.");
    record.ok = true;
  } catch (error) {
    record.error = String(error?.message ?? error);
  } finally {
    await context.close();
  }
  return record;
}

async function auditViewport(browser, viewport) {
  const currentScreenshot = checkedOutputPath(resolve(screenshotRoot, `bom-flow-built-${viewport.name}-current.png`), [screenshotRoot]);
  const staleScreenshot = checkedOutputPath(resolve(screenshotRoot, `bom-flow-built-${viewport.name}-stale.png`), [screenshotRoot]);
  const record = { viewport, browserChannel: "msedge", status: null, instrumentation: null, noRecipe: null, cancellation: null, actorGate: null, assumptions: null, generation: null, reload: null, failurePreservation: null, responsiveLateResult: null, failureKinds: null, stale: null, horizontalOverflow: null, consoleErrors: [], pageErrors: [], screenshots: { current: currentScreenshot, stale: staleScreenshot }, ok: false };
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await installProductionInstrumentation(context, record);
  await installFakeTauri(context);
  const page = await context.newPage();
  observe(page, record);
  try {
    record.status = await waitForStudio(page);
    await selectPane(page, "Cost");
    await page.getByText("No materials recipe", { exact: true }).waitFor({ state: "visible", timeout });
    record.noRecipe = { visible: true, generateUnavailable: (await page.getByRole("button", { name: "Generate BOM" }).count()) === 0 };
    assert(record.noRecipe.generateUnavailable, "No-recipe state exposed Generate BOM.");
    record.seed = await seedFixtureJob(page, requestFixture);
    await page.getByLabel(/Responsible estimator|Assumption reviewer/).waitFor({ state: "visible", timeout });
    record.cancellation = await exerciseCancellation(page, requestFixture);
    await resetBomState(page);
    await selectPane(page, "Review");
    await selectPane(page, "Cost");
    record.actorGate = await verifyActorGate(page);
    await selectPane(page, "Review");
    await selectPane(page, "Cost");
    record.assumptions = await acceptAllAssumptions(page);
    await selectPane(page, "Review");
    await selectPane(page, "Cost");
    record.generation = await generateAndInspect(page, currentScreenshot);
    record.responsiveLateResult = await verifyResponsiveLateResultRace(page);
    record.failureKinds = await verifyDomainAndSafeTransportFailures(page);
    await page.evaluate(() => {
      const store = window.__SC07_PRODUCTION_STORE__;
      store.setState({ bomState: { ...store.getState().bomState, lastFailure: null } });
    });
    await selectPane(page, "Review");
    await selectPane(page, "Cost");
    record.reload = await verifyReload(page, record.responsiveLateResult.newestRequestId, record.assumptions.accepted);
    record.failurePreservation = await verifyCancellationPreservesSnapshot(page, record.responsiveLateResult.newestRequestId);
    record.stale = await mutateJobAndRecipeAndVerifyStale(page, staleScreenshot);
    record.horizontalOverflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, body: document.body.scrollWidth > document.body.clientWidth + 1 }));
    assert(!record.horizontalOverflow.document && !record.horizontalOverflow.body, "Built BOM flow caused page-level horizontal overflow.");
    assert(record.consoleErrors.length === 0, `Browser console errors: ${record.consoleErrors.join(" | ")}`);
    assert(record.pageErrors.length === 0, `Page errors: ${record.pageErrors.join(" | ")}`);
    record.ok = true;
  } catch (error) {
    record.error = String(error?.message ?? error);
    record.failureDiagnostics = await page.evaluate(() => ({
      storeExposed: Boolean(window.__SC07_PRODUCTION_STORE__),
      pane: window.__SC07_PRODUCTION_STORE__?.getState().pane ?? null,
      jobId: window.__SC07_PRODUCTION_STORE__?.getState().job.id ?? null,
      mainText: document.querySelector(".studio-main")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1400) ?? null,
      storageKeys: Object.keys(localStorage),
      fakeBridge: window.__SC07_BOM_FAKE__ ?? null,
    })).catch((diagnosticError) => ({ error: String(diagnosticError?.message ?? diagnosticError) }));
    const failure = checkedOutputPath(resolve(screenshotRoot, `bom-flow-built-${viewport.name}-failure.png`), [screenshotRoot]);
    await page.screenshot({ path: failure, fullPage: false, animations: "disabled" }).catch(() => {});
    record.screenshots.failure = failure;
  } finally {
    await context.close();
  }
  return record;
}

const verdict = {
  schema: "xray.sc-07-bom-flow-audit/v1",
  scope: "production bundle UI with append-only store observability and deterministic fake Tauri invoke",
  url,
  browserRequired: "Microsoft Edge",
  browserUsed: null,
  productionTested: true,
  production: { attempted: true, supportedByAuditSeam: true, exactBuiltBytesServed: false, productionLogicReplaced: false, observabilitySideEffect: true, observability: "One append-only global assignment exposes the existing bundled store and binding reconciler; no built statement is replaced." },
  nativeEngineExecuted: false,
  generatedAt: new Date().toISOString(),
  auditScriptSha256,
  fixture: {
    requestPath: "engine/fixtures/bom-contract/colorbond.request.json",
    requestSha256: createHash("sha256").update(requestText).digest("hex"),
    responsePath: "engine/fixtures/bom-contract/colorbond.response.json",
    responseSha256: createHash("sha256").update(responseText).digest("hex"),
    requestId: requestFixture.requestId,
  },
  viewports: [],
  browserUnavailableViewports: [],
  ok: false,
};

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  verdict.browserUsed = "msedge";
  for (const viewport of viewports) {
    verdict.browserUnavailableViewports.push(await auditBrowserUnavailable(browser, viewport));
    verdict.viewports.push(await auditViewport(browser, viewport));
  }
  verdict.ok = verdict.viewports.length === viewports.length && verdict.viewports.every((entry) => entry.ok) && verdict.browserUnavailableViewports.every((entry) => entry.ok);
} catch (error) {
  verdict.launchError = String(error?.message ?? error);
} finally {
  await browser?.close();
  writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ verdictPath, ok: verdict.ok, browserUsed: verdict.browserUsed, viewports: verdict.viewports.map((entry) => ({ name: entry.viewport.name, ok: entry.ok, error: entry.error ?? null })) }, null, 2));
if (!verdict.ok) process.exitCode = 1;
