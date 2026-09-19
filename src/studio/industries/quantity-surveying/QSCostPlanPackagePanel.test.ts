import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { unzipSync, zipSync } from "fflate";
import { calculateQsCostPlan, canonicalQsJson, type QsCostSnapshot } from "./qsRateBook.ts";
import { createEmptyQuantityForm, quantityFormSchema, type QuantityForm } from "./quantityForm.ts";
import { createEmptyQsWorksheetState } from "./qsWorksheetState.ts";
import { qsPackageDigest } from "./qsPackageExport.ts";
import type { QsPackagePanelInputs, QsPackageTaskScope, QsSelectedPackageImport } from "./QSCostPlanPackagePanel.tsx";

// Execute actual component markup and production orchestration. CSS/downloads
// are browser-proof responsibilities; no browser delivery is simulated here.
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve("node_modules/.cache"), { recursive: true });
const cache = mkdtempSync(resolve("node_modules/.cache/qs-package-panel-"));
for (const file of ["QSCostPlanPackagePanel.tsx", "quantityForm.ts", "classification.ts", "report.ts", "qsPackageExport.ts", "qsRateBook.ts",
  "qsWorksheetState.ts", "qsDeltaComparison.ts", "qsItemBinding.ts", "../deliveryRecord.ts", "../sourceBinding.ts", "../draftStorage.ts", "../../pricing/priceBooks.ts"]) {
  const code = ts.transpileModule(readFileSync(join(here, file), "utf8"), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replace(/require\("[^"\n]+\.css"\);?/g, "")
    .replace(/require\("((?:\.\.?\/)+[\w/-]+?)(?:\.tsx?)?"\)/g, (_match, path: string) => `require("./${basename(path)}.cjs")`);
  writeFileSync(join(cache, basename(file).replace(/\.tsx?$/, ".cjs")), code);
}
const require = createRequire(import.meta.url);
const panel = require(join(cache, "QSCostPlanPackagePanel.cjs")) as typeof import("./QSCostPlanPackagePanel.tsx");
after(() => rmSync(cache, { recursive: true, force: true }));

const projectId = "panel-project", hash = "a".repeat(64), geometry = "b".repeat(64), bookId = "11111111-1111-4111-8111-111111111111";
function snapshot(revision: number): QsCostSnapshot {
  const result = calculateQsCostPlan({ format: "xray.qs-cost-input/v1", projectId, revision, createdAt: `2026-09-19T0${revision}:00:00.000Z`, createdBy: "Estimator", currency: "AUD",
    priceBooks: { schema: "xray.price-books/v1", jobId: projectId, revision: 1, worksheet: [], books: [{ id: bookId, name: "Synthetic source book", archived: false,
      revisions: [{ revision: 1, importedAt: "2026-09-01T00:00:00.000Z", metadata: { supplier: "Synthetic supplier", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-01", sourceReference: "Synthetic fixture rate" },
        source: { fileName: "fixture.csv", sha256: hash, sizeBytes: 100, delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
        rows: [{ sourceLine: 2, stockCode: "MAT", description: "Material", unit: "m", rate: 10 }] }] }] },
    rateBook: { format: "xray.qs-rate-book/v1", projectId, revision: 1, rates: [{ id: "rate-1", revision: 1, description: "Wall rate", unit: "m", material: { bookId, bookRevision: 1, sourceLine: 2 }, labour: null,
      labourAssumption: "Supply only, labour excluded", wastagePercent: "0", markupPercent: "0", createdAt: "2026-09-18T00:00:00.000Z", createdBy: "Estimator" }] },
    items: [{ itemId: "item-1", description: "Measured wall", quantity: "3", unit: "m", evidence: "unverified", rateId: "rate-1", rateRevision: 1, optionId: null,
      binding: { format: "xray.qs-item-binding/v1", itemId: "item-1", projectId, entityId: "wall-1", entityType: "wall-run", measuredQuantity: "3", unit: "m", entityGeometrySha256: geometry, sourceSha256: hash, calibrationId: "cal-1", boundAt: "2026-09-18T00:00:00.000Z", boundBy: "Estimator" },
      entity: { entityId: "wall-1", entityType: "wall-run", geometrySha256: geometry, sourceSha256: hash, calibrationId: "cal-1", unit: "m", measuredQuantity: "3" } }],
    options: [], activeOptionIds: [], fxRates: [] });
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("Fixture failed"); return result.snapshot;
}
function fixture(revision = 1): QuantityForm {
  const snapshots = Array.from({ length: revision }, (_, index) => snapshot(index + 1)), current = snapshots.at(-1)!;
  return quantityFormSchema.parse({ hierarchyId: "Elements", hierarchyRevision: "1", calculated: true, binding: null,
    nodes: [{ key: "wall", code: "E1", label: "Walls", parentKey: "" }],
    items: [{ key: "row-1", reference: "item-1", quantity: "3.000", unit: "m", evidence: "unverified", nodeKey: "wall", entityBinding: current.items[0].binding }],
    pricing: { ...createEmptyQsWorksheetState(projectId), preparedBy: "Estimator", rateBook: current.input.rateBook,
      assignments: [{ itemKey: "row-1", rateId: "rate-1", rateRevision: 1, optionId: null }], snapshots } });
}
const metadata = (): QsPackagePanelInputs => ({ title: "Cost plan <script>unsafe()</script>", reference: "CP-001", revisionLabel: "Client review", preparedBy: "Estimator", recipient: "Client", purpose: "Budget review",
  transmittalCreatedAt: "2026-09-19T06:00:00.000Z", basisOfEstimate: "Gross measured geometry\nNo opening deductions", assumptions: "Supplier rates pinned in revision", exclusions: "Labour excluded",
  deliveryId: "delivery-panel-1", deliveryState: "saved-draft", createdAt: "2026-09-19T05:00:00.000Z", reviewedAt: "", issuedAt: "" });
const scope = (form = fixture()): QsPackageTaskScope => ({ projectId, form, inputs: metadata(), disabled: false });
const build = () => panel.prepareQsPackagePanelExport(projectId, fixture(), metadata());

test("SC11-UI01 empty real panel permits inspection but not preparation or automatic restore", () => {
  let calls = 0;
  const html = renderToStaticMarkup(React.createElement(panel.QSCostPlanPackagePanel, { projectId, value: createEmptyQuantityForm(), onRestore() { calls++; return true; } }));
  assert.match(html, /Save a measured cost revision/); assert.match(html, /<fieldset disabled=""/);
  assert.match(html, /type="file"/); assert.match(html, /Draft quantities remain draft/);
  assert.doesNotMatch(html, /Restore inspected worksheet|Download package ZIP|Integrity-checked manifest/); assert.equal(calls, 0);
});
test("SC11-UI02 disabled panel keeps both export and file-selection controls unavailable", () => {
  const html = renderToStaticMarkup(React.createElement(panel.QSCostPlanPackagePanel, { projectId, value: fixture(), disabled: true, onRestore: () => true }));
  assert.match(html, /<fieldset disabled=""/); assert.match(html, /type="file"[^>]+disabled=""/);
  assert.match(html, /Choose delivery state/); assert.match(html, /Basis of estimate/); assert.match(html, /Review\/issue timestamps are explicit declarations/);
});
test("SC11-UI03 package input selects exact latest and immediate predecessor, preserving complete form", () => {
  const form = fixture(2), before = canonicalQsJson(form), input = panel.qsPackageInputFromForm(projectId, form, metadata());
  assert.equal(input.current.input.revision, 2); assert.equal(input.previous!.input.revision, 1);
  assert.deepEqual(input.worksheet, form); assert.notEqual(input.worksheet, form); assert.deepEqual(input.basisOfEstimate, ["Gross measured geometry", "No opening deductions"]);
  assert.equal(canonicalQsJson(form), before); assert.equal(input.delivery.state, "saved-draft");
});
test("SC11-UI04 missing saved state, foreign project and unchosen delivery state fail explicitly", () => {
  assert.throws(() => panel.qsPackageInputFromForm(projectId, createEmptyQuantityForm(), metadata()), /cost worksheet/);
  assert.throws(() => panel.qsPackageInputFromForm("other", fixture(), metadata()), /current project/);
  assert.throws(() => panel.qsPackageInputFromForm(projectId, fixture(), { ...metadata(), deliveryState: "" }), /explicitly/);
  const noHistory = fixture(); noHistory.pricing!.snapshots = [];
  assert.throws(() => panel.qsPackageInputFromForm(projectId, noHistory, metadata()), /Save a cost revision/);
});
test("SC11-UI05 changed quantities and missing explicit transmittal/basis inputs cannot export stale revision", async () => {
  const changed = fixture(); changed.items[0].quantity = "4";
  await assert.rejects(panel.prepareQsPackagePanelExport(projectId, changed, metadata()), /does not match/);
  await assert.rejects(panel.prepareQsPackagePanelExport(projectId, fixture(), { ...metadata(), title: "" }));
  await assert.rejects(panel.prepareQsPackagePanelExport(projectId, fixture(), { ...metadata(), exclusions: "" }));
});
test("SC11-UI06 import preview reconciles actual archive membership and every displayed SHA including manifest", async () => {
  const prepared = await build(), bytes = prepared.artifacts.bytes, before = Uint8Array.from(bytes);
  const preview = await panel.inspectQsPackagePanelImport(bytes), files = unzipSync(bytes);
  assert.equal(preview.entries.length, Object.keys(files).length);
  assert.deepEqual(preview.entries.map(entry => entry.name).sort(), Object.keys(files).sort());
  for (const entry of preview.entries) { assert.equal(entry.sizeBytes, files[entry.name].length); assert.equal(entry.sha256, await qsPackageDigest(files[entry.name])); }
  assert.equal(preview.packageSha256, await qsPackageDigest(bytes)); assert.deepEqual(preview.value.worksheet, fixture()); assert.deepEqual(bytes, before);
});
test("SC11-UI07 corrupted file cannot produce preview, and failure handling retains exact imported bytes", async () => {
  const prepared = await build(), files = unzipSync(prepared.artifacts.bytes); files["worksheet.json"][0] ^= 1;
  const bytes = zipSync(files), id = {}, file = new File([Uint8Array.from(bytes).buffer], "bad.zip");
  const record: QsSelectedPackageImport = { id, file, bytes, preview: null, error: "" };
  await assert.rejects(panel.inspectQsPackagePanelImport(bytes), /integrity/);
  const failed = panel.qsPackageImportFailure(record, id, Error("Integrity failed"));
  assert.equal(failed!.bytes, bytes); assert.equal(failed!.file, file); assert.match(failed!.error, /Integrity failed/); assert.equal(failed!.preview, null);
  assert.equal(panel.qsPackageImportFailure(record, {}, Error("Older operation")), record);
});
test("SC11-UI08 restore requires explicit confirmation and the same project before calling host", async () => {
  const { artifacts } = await build(), preview = await panel.inspectQsPackagePanelImport(artifacts.bytes); let calls = 0;
  const accept = () => { calls++; return true; };
  await assert.rejects(panel.restoreInspectedQsPackage(preview, projectId, false, accept, () => true), /explicitly confirm/);
  await assert.rejects(panel.restoreInspectedQsPackage(preview, "other", true, accept, () => true), /another project/); assert.equal(calls, 0);
  let restored: QuantityForm | undefined;
  assert.equal(await panel.restoreInspectedQsPackage(preview, projectId, true, next => { restored = next; return true; }, () => true), "accepted");
  assert.deepEqual(restored, fixture()); restored!.items[0].quantity = "99"; assert.equal(preview.value.worksheet.items[0].quantity, "3.000");
});
test("SC11-UI09 host refusal propagates without altering package, worksheet or retained bytes", async () => {
  const { artifacts } = await build(), preview = await panel.inspectQsPackagePanelImport(artifacts.bytes), before = canonicalQsJson(preview.value), bytesBefore = Uint8Array.from(artifacts.bytes);
  await assert.rejects(panel.restoreInspectedQsPackage(preview, projectId, true, () => false, () => true), /host rejected/);
  assert.equal(canonicalQsJson(preview.value), before); assert.deepEqual(artifacts.bytes, bytesBefore);
});
test("SC11-UI10 project A-to-B-to-A while hashing cancels the pending restore before host mutation", async () => {
  const { artifacts } = await build(), preview = await panel.inspectQsPackagePanelImport(artifacts.bytes), gate = panel.createQsPackageTaskGate(), a = scope();
  gate.sync(a); const current = gate.begin(); let calls = 0;
  const pending = panel.restoreInspectedQsPackage(preview, projectId, true, () => { calls++; return true; }, current);
  gate.sync({ ...a, projectId: "other" }); gate.sync(a);
  assert.equal(await pending, "cancelled"); assert.equal(calls, 0);
});
test("SC11-UI11 form, metadata, disabled state and unmount invalidate in-flight work", () => {
  for (const mutate of [(a: QsPackageTaskScope) => ({ ...a, form: fixture() }), (a: QsPackageTaskScope) => ({ ...a, inputs: metadata() }), (a: QsPackageTaskScope) => ({ ...a, disabled: true })]) {
    const gate = panel.createQsPackageTaskGate(), a = scope(); gate.sync(a); const current = gate.begin(); gate.sync(mutate(a)); assert.equal(current(), false);
  }
  const gate = panel.createQsPackageTaskGate(); gate.sync({ ...scope(), disabled: true }); assert.throws(() => gate.begin(), /unavailable/);
  gate.sync(scope()); const current = gate.begin(); gate.dispose(); assert.equal(current(), false); assert.throws(() => gate.begin(), /unavailable/);
  gate.activate(); assert.equal(current(), false); assert.equal(gate.begin()(), true);
});
test("SC11-UI12 a newer action supersedes an older promise without being cancelled itself", () => {
  const gate = panel.createQsPackageTaskGate(); gate.sync(scope()); const first = gate.begin(), second = gate.begin();
  assert.equal(first(), false); assert.equal(second(), true);
});
test("SC11-UI13 actual manifest markup names every file and escapes source-authored text", async () => {
  const { artifacts } = await build(), preview = await panel.inspectQsPackagePanelImport(artifacts.bytes);
  const html = renderToStaticMarkup(React.createElement(panel.QSCostPlanPackageManifest, { preview }));
  assert.match(html, new RegExp(`Integrity-checked manifest · ${preview.entries.length} files`));
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, preview.entries.length);
  assert.match(html, /Classification quantities remain draft/); assert.match(html, /matching hash is not source verification/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
});
test("SC11-UI14 file-size guard rejects oversized/invalid files before reading their bytes", () => {
  for (const size of [0, 21, -1, NaN, Infinity, 33 * 1024 * 1024]) assert.throws(() => panel.assertQsPackageFileSize(size), /32 MiB/);
  assert.doesNotThrow(() => panel.assertQsPackageFileSize(22)); assert.doesNotThrow(() => panel.assertQsPackageFileSize(32 * 1024 * 1024));
});
