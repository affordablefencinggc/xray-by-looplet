import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob, type FencingJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { readSheetLifecycle, sheetLifecycleStorageKey, sheetSourceIdentity, type SheetStorage } from "../sheetLifecycle.ts";
import { appendPriceBookRevision, emptyPriceBookLibrary, priceImportSchema } from "../pricing/priceBooks.ts";
import { createAppTools, type AppToolPort } from "./appTools.ts";
import { applySheetAction, describePriceBooks, describeSourceSheets, describeTakeoffEvidence } from "./workbenchTools.ts";
import { assistantToolAllowed } from "./skills.ts";

function storage(): SheetStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
}
function importedJob(): FencingJob {
  const job = createDefaultJob();
  job.documents = [{ id: "plan-1", name: "Architectural.pdf", kind: "pdf", source: "web", importedAt: "2026-09-07T00:00:00.000Z", sha256: "b".repeat(64), pageCount: 4 }];
  job.activeDocumentId = "plan-1";
  return job;
}

test("sample sources are reported as not organisable; imported sources list pages with evidence counts", () => {
  const sample = createDefaultJob(), store = storage();
  const none = describeSourceSheets(sample, store);
  assert.equal(none.available, false); assert.match((none as { reason: string }).reason, /sample/);
  const job = importedJob();
  job.calibrations = [{ sheet: 1, coordinateSpace: "source-page-v1", metresPerUnit: 0.01, source: "manual", confidence: 1, locked: true, knownDistanceM: 5, points: null, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, inputDistance: null, candidates: [], selectedCandidateId: null, conflict: null } as unknown as FencingJob["calibrations"][number]];
  const value = describeSourceSheets(job, store);
  assert.equal(value.available, true);
  if (!value.available) return;
  assert.equal(value.pageCount, 4); assert.equal(value.documentId, "plan-1"); assert.equal(value.sourceSha256, "b".repeat(64));
  assert.deepEqual(value.pages.map(page => page.originalPage), [1, 2, 3, 4]);
  assert.equal(value.pages[1].evidence.calibrations, 1); assert.equal(value.pages[0].evidence.calibrations, 0);
  assert.ok(value.pages.every(page => !page.archived && page.name.startsWith("Sheet")));
});

test("sheet actions rename, archive and recover through the shared sidecar with identity and state checks", () => {
  const job = importedJob(), store = storage(), identity = sheetSourceIdentity(job.id, job.documents[0])!;
  const renamed = applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "rename", pageIndex: 1, name: "Ground floor plan", discipline: "Architecture" }, store);
  assert.equal(renamed.after.name, "Ground floor plan"); assert.equal(renamed.after.discipline, "Architecture"); assert.equal(renamed.before.name, "Sheet 2");
  assert.equal(renamed.storageKey, sheetLifecycleStorageKey(identity)); assert.equal(renamed.lifecycleRevision, 1);
  const saved = readSheetLifecycle(identity, store);
  assert.equal(saved.pages.find(page => page.pageIndex === 1)!.name, "Ground floor plan");
  const archived = applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "archive", pageIndex: 2 }, store);
  assert.equal(archived.after.archived, true); assert.deepEqual(archived.retained, { calibrations: 0, traces: 0, items: 0, annotations: 0, linkedPhotos: 0, savedViews: 0 });
  assert.throws(() => applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "archive", pageIndex: 2 }, store), /already archived/);
  const recovered = applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "recover", pageIndex: 2 }, store);
  assert.equal(recovered.after.archived, false); assert.equal(recovered.lifecycleRevision, 3);
  assert.throws(() => applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "recover", pageIndex: 2 }, store), /not archived/);
  assert.throws(() => applySheetAction(job, { expectedJobId: job.id, documentId: "plan-9", action: "archive", pageIndex: 0 }, store), /changed/);
  assert.throws(() => applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "archive", pageIndex: 4 }, store), /not part of this source/);
  assert.throws(() => applySheetAction(job, { expectedJobId: job.id, documentId: "plan-1", action: "rename", pageIndex: 0 }, store), /name/);
  assert.throws(() => applySheetAction(createDefaultJob(), { expectedJobId: "x", documentId: "doc-sample", action: "archive", pageIndex: 0 }, store), /Sample/);
  assert.equal(readSheetLifecycle(identity, store).pages.find(page => page.pageIndex === 1)!.name, "Ground floor plan");
});

test("takeoff evidence lists calibration, traces, items and blockers per sheet without inventing quantities", () => {
  const job = createDefaultJob();
  const value = describeTakeoffEvidence(job);
  assert.equal(value.projectId, job.id); assert.ok(Array.isArray(value.blockers)); assert.ok(value.blockers.length > 0);
  assert.equal(value.sheets.length, job.calibrations.length + job.runs.length + job.gates.length === 0 ? 0 : value.sheets.length);
  const single = describeTakeoffEvidence(job, 0);
  assert.equal(single.sheets.length, 1); assert.equal(single.sheets[0].originalPage, 1);
  assert.ok(single.sheets[0].calibration === null || typeof single.sheets[0].calibration.locked === "boolean");
  assert.ok(single.sheets[0].traces.every(trace => typeof trace.lengthM === "number" && Array.isArray(trace.missingSpecification)));
  assert.match(value.scope, /not a quote|Nothing here is a quote/);
});

test("price book summary reports books, revisions and worksheet lines but no rate rows", () => {
  const source = priceImportSchema.parse({ metadata: { supplier: "QA supplier", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-07", sourceReference: "QA fixture" },
    source: { fileName: "rates.csv", sha256: "c".repeat(64), sizeBytes: 100, delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
    rows: [{ sourceLine: 2, stockCode: "P-1", description: "Post", unit: "each", rate: 12.5 }] });
  const library = appendPriceBookRevision(emptyPriceBookLibrary("job-one"), source, "Structural supplier", null, () => "11111111-1111-4111-8111-111111111111", "2026-09-08T00:00:00.000Z");
  const value = describePriceBooks(library, false, null);
  assert.equal(value.books.length, 1); assert.equal(value.books[0].revisions[0].rows, 1); assert.equal(value.books[0].revisions[0].metadata.supplier, "QA supplier");
  assert.equal(value.worksheetLines, 0); assert.ok(!JSON.stringify(value).includes("\"Post\""));
});

function fixture() {
  const job = importedJob();
  const store = storage();
  const state = { job, pane: "sheets" as Pane, sheet: 0, hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false, persistenceError: null as string | null, lastSavedJobRevision: job.revision as number | null,
    setPane(pane: Pane) { state.pane = pane; }, saveCurrentProject() { return { ok: true, error: null as string | null }; } };
  const notified: string[] = []; let backups = 0;
  const port: AppToolPort = {
    getState: () => state, architect: async () => ({}), architectAvailable: () => false, capture: async () => ({ content: [] }),
    storage: store, sheetChanged: key => notified.push(key), priceBooks: jobId => ({ value: emptyPriceBookLibrary(jobId), raw: null, blocked: false, error: null }),
    backup: async name => { backups++; return { id: "22222222-2222-4222-8222-222222222222", name, createdAt: "2026-09-09T00:00:00.000Z", storedAt: "2026-09-09T00:00:00.000Z", archived: false, revision: 1, sha256: "d".repeat(64), sizeBytes: 100, jobName: job.name, jobId: job.id, jobRevision: job.revision, plans: 1, photos: 0, records: ["architecture"] }; },
  };
  const tools = createAppTools(port);
  return { state, port, store, notified, tools, get backups() { return backups; }, execute: (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute(args) };
}
const message = (result: { content: Array<{ type: string; text?: string }> }) => result.content.filter(row => row.type === "text").map(row => row.text).join("\n");

test("sheet tools bind to the project, notify the Sheets pane and fail closed without storage", async () => {
  const f = fixture(), id = f.state.job.id;
  const list = JSON.parse(message(await f.execute("read_source_sheets", { expectedJobId: id })));
  assert.equal(list.available, true); assert.equal(list.pages.length, 4);
  assert.equal((await f.execute("read_source_sheets", { expectedJobId: "other" })).isError, true);
  const result = await f.execute("manage_source_sheet", { expectedJobId: id, documentId: "plan-1", action: "rename", pageIndex: 0, name: "Cover" });
  assert.equal(result.isError, undefined); const value = JSON.parse(message(result));
  assert.equal(value.after.name, "Cover"); assert.equal("storageKey" in value, false); assert.equal(f.notified.length, 1);
  assert.equal((await f.execute("manage_source_sheet", { expectedJobId: id, documentId: "plan-1", action: "delete", pageIndex: 0 })).isError, true);
  f.state.persistenceRecoveryBlocked = true;
  assert.equal((await f.execute("manage_source_sheet", { expectedJobId: id, documentId: "plan-1", action: "archive", pageIndex: 0 })).isError, true);
  f.state.persistenceRecoveryBlocked = false; delete f.port.storage;
  assert.match(message(await f.execute("read_source_sheets", { expectedJobId: id })), /unavailable/);
  assert.equal(f.notified.length, 1);
  assert.equal(assistantToolAllowed("manage_source_sheet", false), false); assert.equal(assistantToolAllowed("manage_source_sheet", true), true);
  assert.equal(assistantToolAllowed("read_source_sheets", false), true);
});

test("takeoff, price book and backup tools bind to the project and verify the backup identity", async () => {
  const f = fixture(), id = f.state.job.id;
  const takeoff = JSON.parse(message(await f.execute("read_takeoff_evidence", { expectedJobId: id, sheet: 0 })));
  assert.equal(takeoff.projectId, id); assert.equal(takeoff.sheets[0].sheet, 0);
  assert.equal((await f.execute("read_takeoff_evidence", { expectedJobId: id, sheet: -1 })).isError, true);
  const books = JSON.parse(message(await f.execute("read_price_books", { expectedJobId: id })));
  assert.deepEqual(books.books, []); assert.equal(books.blocked, false);
  assert.equal(assistantToolAllowed("read_takeoff_evidence", false), true); assert.equal(assistantToolAllowed("read_price_books", false), true);
  assert.equal(assistantToolAllowed("capture_project_backup", false), false); assert.equal(assistantToolAllowed("capture_project_backup", true), true);
  const args = { expectedJobId: id, expectedRevision: f.state.job.revision, name: "Assistant checkpoint" };
  assert.equal((await f.execute("capture_project_backup", { ...args, expectedRevision: args.expectedRevision + 1 })).isError, true); assert.equal(f.backups, 0);
  const saved = JSON.parse(message(await f.execute("capture_project_backup", args)));
  assert.equal(saved.saved, true); assert.equal(saved.name, "Assistant checkpoint"); assert.equal(f.backups, 1);
  f.port.backup = async () => ({ id: "33333333-3333-4333-8333-333333333333", name: "x", createdAt: "2026-09-09T00:00:00.000Z", storedAt: "2026-09-09T00:00:00.000Z", archived: false, revision: 1, sha256: "e".repeat(64), sizeBytes: 1, jobName: "", jobId: "other", jobRevision: 1, plans: 0, photos: 0, records: [] });
  assert.match(message(await f.execute("capture_project_backup", args)), /does not match/);
  delete f.port.backup;
  assert.match(message(await f.execute("capture_project_backup", args)), /unavailable/);
});
