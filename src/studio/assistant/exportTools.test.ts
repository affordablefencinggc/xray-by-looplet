import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob, type FencingJob } from "../domain.ts";
import { demonstration } from "../architect/model.ts";
import { changeAuthoredSheets, reviewAuthoredSheetArchive } from "../architect/authoredSheetSet.ts";
import { saveSheetLifecycle, sheetSourceIdentity, type SheetStorage } from "../sheetLifecycle.ts";
import { describeExportReceipt, exportDesign, exportDesignSchema, sha256Hex, type ExportFormat } from "./exportTools.ts";

function storage(): SheetStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
}
function importedJob(): FencingJob {
  const job = createDefaultJob();
  job.documents = [{ id: "plan-1", name: "Architectural set.pdf", kind: "pdf", source: "web", importedAt: "2026-09-07T00:00:00.000Z", sha256: "b".repeat(64), pageCount: 4 }];
  job.activeDocumentId = "plan-1";
  return job;
}
function recorder() {
  const calls: { name: string; bytes: Uint8Array; mimeType: string }[] = [];
  return { calls, download: (name: string, bytes: Uint8Array, mimeType: string) => { calls.push({ name, bytes, mimeType }); } };
}
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
/** demonstration() mints fresh element ids on every call, so byte-stability is checked on two exports of the same project. */
const run = (format: ExportFormat, project = demonstration("x"), extra: Record<string, unknown> = {}) => {
  const sink = recorder();
  return exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision, format, ...extra }, sink).then(receipt => ({ receipt, sink, project }));
};

test("dxf export hands the exact bytes to the download and is byte-stable across two calls", async () => {
  const a = await run("dxf"), b = await run("dxf", a.project);
  assert.equal(a.receipt.format, "dxf"); assert.equal(a.receipt.fileName, "architect-design.dxf"); assert.equal(a.receipt.mimeType, "application/dxf");
  assert.ok(a.receipt.byteLength > 0); assert.equal(a.receipt.byteLength, a.receipt.bytes.byteLength);
  assert.match(text(a.receipt.bytes), /^\s*0\r?\nSECTION/); assert.ok(text(a.receipt.bytes).includes("ENTITIES"));
  assert.equal(a.receipt.sha256, b.receipt.sha256); assert.equal(a.receipt.deterministic, true);
  assert.equal(a.sink.calls.length, 1); assert.equal(a.sink.calls[0].bytes, a.receipt.bytes); assert.equal(a.sink.calls[0].name, "architect-design.dxf");
  assert.equal(a.receipt.sha256, await sha256Hex(a.sink.calls[0].bytes));
  assert.equal(a.receipt.downloaded, true); assert.equal(a.receipt.savedToDiskVerified, false); assert.equal(a.receipt.readbackVerified, false);
  assert.equal(a.receipt.scope, "File offered by the browser download; nothing was uploaded or sent anywhere.");
  assert.ok(!("bytes" in describeExportReceipt(a.receipt)));
});

test("ifc export returns a STEP file; its header carries a timestamp so only length and header are asserted", async () => {
  const a = await run("ifc"), b = await run("ifc", a.project);
  assert.equal(a.receipt.fileName, "architect-design.ifc"); assert.equal(a.receipt.mimeType, "application/x-step");
  assert.ok(a.receipt.byteLength > 0); assert.ok(text(a.receipt.bytes).startsWith("ISO-10303-21;")); assert.ok(text(a.receipt.bytes).includes("IFCWALL"));
  assert.equal(a.receipt.deterministic, false); assert.equal(a.receipt.byteLength, b.receipt.byteLength);
  assert.equal(a.receipt.sha256, await sha256Hex(a.sink.calls[0].bytes));
});

test("drawing-pdf export renders the active sheet with a sanitised file name and a PDF header", async () => {
  const a = await run("drawing-pdf");
  assert.equal(a.receipt.fileName, "A-101.pdf"); assert.equal(a.receipt.mimeType, "application/pdf"); assert.equal(a.receipt.sheetNumber, "A-101");
  assert.equal(a.receipt.paper, "A3"); assert.equal(a.receipt.pageCount, 1); assert.equal(a.receipt.viewports, 1); assert.equal(a.receipt.sheetId, "legacy-sheet");
  assert.ok(a.receipt.byteLength > 0); assert.equal(text(a.receipt.bytes.subarray(0, 5)), "%PDF-"); assert.equal(a.receipt.deterministic, false);
  assert.equal(a.receipt.sha256, await sha256Hex(a.sink.calls[0].bytes));
  const blank = demonstration("x"); blank.sheet.number = "  ";
  const fallback = await exportDesign({ project: blank }, { expectedJobId: "x", expectedRevision: blank.revision, format: "drawing-pdf" }, recorder());
  assert.equal(fallback.fileName, "Drawing sheet.pdf");
  const odd = demonstration("x"); odd.sheet.number = "A/1:2";
  const sanitised = await exportDesign({ project: odd }, { expectedJobId: "x", expectedRevision: odd.revision, format: "drawing-pdf" }, recorder());
  assert.equal(sanitised.fileName, "A_1_2.pdf");
});

test("drawing-pdf sheetId exports a non-active authored sheet on a throwaway view and refuses archived sheets", async () => {
  const base = demonstration("x"), withSheets = changeAuthoredSheets(base, { type: "add" }, () => "sheet-two");
  const added = withSheets.sheetSet!.sheets.find(sheet => sheet.id !== withSheets.sheetSet!.activeId)!;
  const backToFirst = changeAuthoredSheets(withSheets, { type: "select", sheetId: added.id });
  const snapshot = JSON.stringify(backToFirst);
  const sink = recorder();
  const receipt = await exportDesign({ project: backToFirst }, { expectedJobId: "x", expectedRevision: backToFirst.revision, format: "drawing-pdf", sheetId: withSheets.sheetSet!.activeId }, sink);
  assert.equal(receipt.sheetId, withSheets.sheetSet!.activeId); assert.equal(receipt.sheetNumber, withSheets.sheet.number); assert.equal(receipt.fileName, `${withSheets.sheet.number}.pdf`);
  assert.equal(JSON.stringify(backToFirst), snapshot, "the mounted design is never mutated by an export");
  await assert.rejects(exportDesign({ project: backToFirst }, { expectedJobId: "x", expectedRevision: backToFirst.revision, format: "drawing-pdf", sheetId: "missing-sheet" }, sink), /no longer exists/);
  const archived = changeAuthoredSheets(backToFirst, { type: "archive", review: reviewAuthoredSheetArchive(backToFirst, withSheets.sheetSet!.activeId) });
  assert.equal(archived.sheetSet!.sheets.find(sheet => sheet.id === withSheets.sheetSet!.activeId)!.archived, true);
  await assert.rejects(exportDesign({ project: archived }, { expectedJobId: "x", expectedRevision: archived.revision, format: "drawing-pdf", sheetId: withSheets.sheetSet!.activeId }, sink), /Recover this drawing sheet/);
  await assert.rejects(exportDesign({ project: base }, { expectedJobId: "x", expectedRevision: base.revision, format: "dxf", sheetId: "legacy-sheet" }, sink), /sheetId only selects/);
  assert.equal(sink.calls.length, 1);
});

test("material-pdf export is byte-stable, lists quantity rows and states that nothing was imported or synced", async () => {
  const a = await run("material-pdf"), b = await run("material-pdf", a.project);
  assert.equal(a.receipt.fileName, `Authored design revision ${a.project.revision}.pdf`); assert.equal(a.receipt.mimeType, "application/pdf");
  assert.equal(text(a.receipt.bytes.subarray(0, 5)), "%PDF-"); assert.ok(a.receipt.byteLength > 0);
  assert.equal(a.receipt.sha256, b.receipt.sha256); assert.equal(a.receipt.deterministic, true);
  assert.ok((a.receipt.pageCount as number) >= 2); assert.ok((a.receipt.quantityRows as number) > 0);
  assert.equal(a.receipt.importedAsEvidence, false); assert.equal(a.receipt.materialRegisterSynced, false);
  assert.equal(a.sink.calls[0].bytes, a.receipt.bytes);
});

test("sheet-register export reads the Sheets pane sidecar, is byte-stable and fails closed on sample or unverified sources", async () => {
  const job = importedJob(), store = storage(), sink = recorder();
  const identity = sheetSourceIdentity(job.id, job.documents[0])!;
  const fresh = await exportDesign({ job, storage: store }, { expectedJobId: job.id, expectedRevision: job.revision, format: "sheet-register" }, sink);
  assert.equal(fresh.fileName, "Architectural_set_pdf.sheet-register.json"); assert.equal(fresh.mimeType, "application/json");
  assert.equal(fresh.lifecycleRevision, 0); assert.equal(fresh.sheets, 4); assert.equal(fresh.archived, 0); assert.equal(fresh.sourceSha256, "b".repeat(64)); assert.equal(fresh.documentId, "plan-1");
  const parsed = JSON.parse(text(fresh.bytes));
  assert.equal(parsed.format, "xray.sheet-register/v1"); assert.equal(parsed.sourceName, "Architectural set.pdf"); assert.equal(parsed.sheets.length, 4); assert.deepEqual(parsed.sheets.map((s: { originalPage: number }) => s.originalPage), [1, 2, 3, 4]);
  const again = await exportDesign({ job, storage: store }, { expectedJobId: job.id, expectedRevision: job.revision, format: "sheet-register" }, sink);
  assert.equal(again.sha256, fresh.sha256); assert.equal(fresh.sha256, await sha256Hex(sink.calls[0].bytes));
  const renamed = saveSheetLifecycle(saveSheetLifecycle({ ...JSON.parse(JSON.stringify({ format: "xray.sheet-lifecycle/v1", identity, revision: 0, pages: [0, 1, 2, 3].map(pageIndex => ({ pageIndex, name: `Sheet ${pageIndex + 1}`, archived: false })) })) }, { type: "rename", pageIndex: 1, name: "Ground floor" }, store), { type: "archive", pageIndex: 3 }, store);
  assert.equal(renamed.revision, 2);
  const saved = await exportDesign({ job, storage: store }, { expectedJobId: job.id, expectedRevision: job.revision, format: "sheet-register" }, sink);
  assert.equal(saved.lifecycleRevision, 2); assert.equal(saved.archived, 1); assert.notEqual(saved.sha256, fresh.sha256);
  const savedRegister = JSON.parse(text(saved.bytes));
  assert.equal(savedRegister.sheets[1].name, "Ground floor"); assert.equal(savedRegister.sheets[3].archived, true);
  const sample = createDefaultJob();
  await assert.rejects(exportDesign({ job: sample, storage: store }, { expectedJobId: sample.id, expectedRevision: sample.revision, format: "sheet-register" }, sink), /bundled sample/);
  const unverified = importedJob(); unverified.documents[0].sha256 = null;
  await assert.rejects(exportDesign({ job: unverified, storage: store }, { expectedJobId: unverified.id, expectedRevision: unverified.revision, format: "sheet-register" }, sink), /no verified identity/);
  await assert.rejects(exportDesign({ job }, { expectedJobId: job.id, expectedRevision: job.revision, format: "sheet-register" }, sink), /storage is unavailable/);
  const closed = importedJob(); closed.activeDocumentId = "plan-9";
  await assert.rejects(exportDesign({ job: closed, storage: store }, { expectedJobId: closed.id, expectedRevision: closed.revision, format: "sheet-register" }, sink), /No source drawing/);
  assert.equal(sink.calls.length, 3);
});

test("unknown formats, project and revision mismatches and missing sources are rejected before anything is generated or downloaded", async () => {
  const project = demonstration("x"), job = importedJob(), sink = recorder();
  assert.equal(exportDesignSchema.safeParse({ expectedJobId: "x", expectedRevision: project.revision, format: "dwg" }).success, false);
  assert.equal(exportDesignSchema.safeParse({ expectedJobId: "x", expectedRevision: project.revision, format: "dxf", extra: true }).success, false);
  assert.equal(exportDesignSchema.safeParse({ expectedJobId: "x", expectedRevision: 0, format: "dxf" }).success, false);
  await assert.rejects(exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision, format: "svg" }, sink));
  await assert.rejects(exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision + 1, format: "dxf" }, sink), /design revision changed/);
  await assert.rejects(exportDesign({ project }, { expectedJobId: "y", expectedRevision: project.revision, format: "ifc" }, sink), /active project changed/);
  await assert.rejects(exportDesign({}, { expectedJobId: "x", expectedRevision: project.revision, format: "material-pdf" }, sink), /Architectural workspace/);
  await assert.rejects(exportDesign({ job, storage: storage() }, { expectedJobId: job.id, expectedRevision: job.revision + 1, format: "sheet-register" }, sink), /project revision changed/);
  await assert.rejects(exportDesign({ job, storage: storage() }, { expectedJobId: "other", expectedRevision: job.revision, format: "sheet-register" }, sink), /active project changed/);
  await assert.rejects(exportDesign({}, { expectedJobId: job.id, expectedRevision: job.revision, format: "sheet-register" }, sink), /Project context/);
  assert.equal(sink.calls.length, 0);
});

test("without a download handler the receipt reports downloaded: false, and a custom digest is used for sha256", async () => {
  const project = demonstration("x");
  const plain = await exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision, format: "dxf" });
  assert.equal(plain.downloaded, false); assert.match(plain.scope, /no download handler/); assert.ok(plain.byteLength > 0);
  let hashed: Uint8Array | null = null;
  const custom = await exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision, format: "dxf" }, { digest: async bytes => { hashed = bytes; return "deadbeef"; } });
  assert.equal(custom.sha256, "deadbeef"); assert.equal(hashed, custom.bytes);
  const failing = recorder();
  await assert.rejects(exportDesign({ project }, { expectedJobId: "x", expectedRevision: project.revision, format: "dxf" }, { download: () => { throw Error("blocked by the browser"); } }), /blocked by the browser/);
  assert.equal(failing.calls.length, 0);
});
