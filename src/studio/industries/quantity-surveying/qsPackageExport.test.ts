import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { unzipSync, zipSync } from "fflate";
import { calculateQsCostPlan, canonicalQsJson, qsCostInputSchema, type QsCostSnapshot } from "./qsRateBook.ts";
import { qsItemBindingSchema } from "./qsItemBinding.ts";
import { qsWorksheetStateSchema } from "./qsWorksheetState.ts";
import {
  QS_PACKAGE_ENTRIES, QS_PACKAGE_MAX_BYTES, QS_PACKAGE_MAX_ENTRY_BYTES, QS_COST_CSV_COLUMNS,
  createQsCostPlanPackage, exportQsCostPlanPackage, parseQsCostPlanPackage, qsPackageDigest,
  restoreQsCostPlanWorksheet, type QsPackageInput,
} from "./qsPackageExport.ts";

// A complete host form schema is passed explicitly, just as the production form
// passes quantityFormSchema.parse. The package domain never imports its host.
const worksheetSchema = z.object({
  hierarchyId: z.string(), hierarchyRevision: z.string(), calculated: z.boolean(), binding: z.null(),
  nodes: z.array(z.object({ key: z.string(), code: z.string(), label: z.string(), parentKey: z.string() }).strict()),
  items: z.array(z.object({ key: z.string(), reference: z.string(), quantity: z.string(), unit: z.string(),
    evidence: z.enum(["unverified", "inferred", "sample"]), nodeKey: z.string(), entityBinding: qsItemBindingSchema }).strict()),
  pricing: qsWorksheetStateSchema,
}).strict();
type Worksheet = z.infer<typeof worksheetSchema>;
const parseWorksheet = (raw: unknown) => worksheetSchema.parse(raw);
const HASH = "a".repeat(64), GEOMETRY = "b".repeat(64), BOOK = "11111111-1111-4111-8111-111111111111";

function priced(revision = 1, quantity = "3", itemId = "item-1"): QsCostSnapshot {
  const input = qsCostInputSchema.parse({
    format: "xray.qs-cost-input/v1", projectId: "package-project", revision,
    createdAt: `2026-09-19T0${revision}:00:00.000Z`, createdBy: "Estimator", currency: "AUD", fxRates: [],
    priceBooks: { schema: "xray.price-books/v1", jobId: "package-project", revision: 1, worksheet: [], books: [{
      id: BOOK, name: "Supplier schedule", archived: false, revisions: [{ revision: 1, importedAt: "2026-09-01T00:00:00.000Z",
        metadata: { supplier: "Supplier A", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-01", sourceReference: "Quotation A-001" },
        source: { fileName: "supplier.csv", sha256: HASH, sizeBytes: 100, delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
        rows: [{ sourceLine: 2, stockCode: "MAT", description: "Material", unit: "m", rate: 10 }],
      }],
    }] },
    rateBook: { format: "xray.qs-rate-book/v1", projectId: "package-project", revision: 1, rates: [{
      id: "wall-rate", revision: 1, description: "Measured wall", unit: "m", material: { bookId: BOOK, bookRevision: 1, sourceLine: 2 }, labour: null,
      labourAssumption: "Supply only; labour explicitly excluded.", wastagePercent: "10", markupPercent: "20", createdAt: "2026-09-18T00:00:00.000Z", createdBy: "Estimator",
    }] },
    items: [{ itemId, description: 'Wall, "external"', quantity, unit: "m", evidence: "unverified", rateId: "wall-rate", rateRevision: 1, optionId: null,
      binding: { format: "xray.qs-item-binding/v1", itemId, projectId: "package-project", entityId: "wall-1", entityType: "wall-run",
        measuredQuantity: quantity, unit: "m", entityGeometrySha256: GEOMETRY, sourceSha256: HASH, calibrationId: "cal-1", boundAt: "2026-09-18T00:00:00.000Z", boundBy: "Estimator" },
      entity: { entityId: "wall-1", entityType: "wall-run", geometrySha256: GEOMETRY, sourceSha256: HASH, calibrationId: "cal-1", unit: "m", measuredQuantity: quantity },
    }], options: [], activeOptionIds: [],
  });
  const result = calculateQsCostPlan(input);
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("Fixture did not calculate");
  return result.snapshot;
}
function fixture(revision = 1, itemId = "item-1"): QsPackageInput<Worksheet> {
  const current = priced(revision, revision === 1 ? "3" : "4", itemId), previous = revision === 1 ? null : priced(1, "3", itemId);
  const worksheet = parseWorksheet({
    hierarchyId: "Elements", hierarchyRevision: "2026", calculated: true, binding: null,
    nodes: [{ key: "root", code: "E", label: "Building elements", parentKey: "" }, { key: "walls", code: "E.1", label: "Walls", parentKey: "root" }],
    items: [{ key: "persistent-row-key", reference: itemId, quantity: `${current.items[0].quantity}.000`, unit: "m", evidence: "unverified", nodeKey: "walls", entityBinding: current.items[0].binding }],
    pricing: { format: "xray.qs-worksheet-state/v1", projectId: "package-project", currency: "AUD", preparedBy: "Estimator", rateBook: current.input.rateBook,
      assignments: [{ itemKey: "persistent-row-key", rateId: "wall-rate", rateRevision: 1, optionId: null }], options: [], activeOptionIds: [], fxRates: [], snapshots: previous ? [previous, current] : [current] },
  });
  return { worksheet, current, previous,
    transmittal: { title: "Measured cost plan", reference: "CP-001", revisionLabel: `Revision ${revision}`, preparedBy: "Estimator", recipient: "Client review", purpose: "Budget review", createdAt: "2026-09-19T06:00:00.000Z" },
    basisOfEstimate: ["Source-calibrated gross geometry; no net opening deductions."], assumptions: ["Supplier rates are those pinned in the saved revision."], exclusions: ["Labour is excluded from this supply-only plan."],
    delivery: { format: "xray.delivery-record/v1", id: `delivery-${revision}`, kind: "quantity-surveying", projectId: "package-project", state: "saved-draft", revision, createdAt: "2026-09-19T05:00:00.000Z", sourceBinding: null, status: "active" },
  };
}
const build = async (input = fixture()) => {
  const value = await createQsCostPlanPackage(input, parseWorksheet);
  return { value, exported: await exportQsCostPlanPackage(value, parseWorksheet) };
};
const encodeJson = (value: unknown) => new TextEncoder().encode(canonicalQsJson(value));
async function reseal(files: Record<string, Uint8Array>) {
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  for (const entry of manifest.entries) { entry.sizeBytes = files[entry.name].length; entry.sha256 = await qsPackageDigest(files[entry.name]); }
  const { sealSha256: _, ...core } = manifest;
  files["manifest.json"] = encodeJson({ ...core, sealSha256: await qsPackageDigest(canonicalQsJson(core)) });
  return zipSync(files, { level: 0 });
}
function pdfStrings(doc: PDFDocument, index: number) {
  const contents = doc.getPage(index).node.Contents();
  const entries = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return entries.map(entry => {
    const stream = doc.context.lookup(entry);
    assert.ok(stream instanceof PDFRawStream);
    const operators = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    return [...operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map(match => {
      const bytes = match[1].match(/../g)!.map(pair => Number.parseInt(pair, 16));
      return String.fromCharCode(...bytes);
    }).join("\n");
  }).join("\n");
}
function csvRows(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ",") { row.push(field); field = ""; }
    else if (!quoted && char === "\r" && text[i + 1] === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; }
    else field += char;
  }
  assert.equal(quoted, false); assert.equal(field, ""); return rows;
}

test("SC11-01 package round-trip restores exact typed worksheet, pins and raw decimals without mutation", async () => {
  const input = fixture(2), original = canonicalQsJson(input), { value, exported } = await build(input);
  assert.equal(canonicalQsJson(input), original);
  const reopened = await parseQsCostPlanPackage(exported.bytes, parseWorksheet);
  assert.equal(canonicalQsJson(reopened), canonicalQsJson(value));
  const restored = await restoreQsCostPlanWorksheet(reopened, input.current.input.projectId, parseWorksheet);
  assert.deepEqual(restored, input.worksheet);
  assert.equal(restored.items[0].quantity, "4.000");
  assert.equal(restored.items[0].key, "persistent-row-key");
  restored.items[0].quantity = "999";
  assert.equal(reopened.worksheet.items[0].quantity, "4.000", "restore returns a detached editable copy");
  assert.equal(canonicalQsJson(input), original);
});
test("SC11-02 identical snapshots produce identical PDF, CSV and package bytes", async () => {
  const a = await build(), b = await build();
  assert.equal(a.exported.contentSha256, b.exported.contentSha256);
  assert.equal(a.exported.packageSha256, b.exported.packageSha256);
  assert.deepEqual(a.exported.bytes, b.exported.bytes);
  assert.deepEqual(Object.keys(unzipSync(a.exported.bytes)).sort(), [...QS_PACKAGE_ENTRIES].sort());
});
test("SC11-03 PDF is a multi-page vector document containing summary, breakdown, variance and provenance", async () => {
  const { exported } = await build(fixture(2)), doc = await PDFDocument.load(exported.pdf);
  assert.ok(doc.getPageCount() >= 5);
  const texts = doc.getPageIndices().map(index => pdfStrings(doc, index));
  assert.ok(texts.some(text => text.includes("Executive summary")));
  assert.ok(texts.some(text => text.includes("Elements and trade breakdown")));
  assert.ok(texts.some(text => text.includes("Cost variance report")));
  assert.ok(texts.some(text => text.includes("Source and rate audit trail")));
  assert.ok(texts.some(text => text.includes("ACCEPTED TOTAL CHANGE")));
  assert.ok(texts.some(text => text.includes("Quotation A-001")));
  assert.equal(doc.getCreationDate()?.toISOString(), "2026-09-19T06:00:00.000Z");
  assert.ok(texts.every(text => /\d+ \/ \d+/.test(text)), "each vector page has a page counter");
});
test("SC11-04 CSV contains each actual item once and neutralises formula-like identities", async () => {
  const { exported } = await build(fixture(1, "=2+3")), rows = csvRows(exported.csv);
  assert.deepEqual(rows[0], [...QS_COST_CSV_COLUMNS]);
  assert.equal(rows.length, 2, "parent/sub-element summaries must not become priced CSV rows");
  assert.equal(rows[1][0], "'=2+3");
  assert.equal(rows[1][1], 'Wall, "external"');
  assert.deepEqual(JSON.parse(rows[1][2]), ["E Building elements", "E.1 Walls"]);
  assert.equal(rows[1][3], "3");
  assert.equal(rows[1][14], "43.56");
  assert.equal(rows[1][QS_COST_CSV_COLUMNS.indexOf("Material unit rate")], "10");
  assert.equal(rows[1][QS_COST_CSV_COLUMNS.indexOf("Material tax basis")], "exclusive");
  assert.equal(rows[1][QS_COST_CSV_COLUMNS.indexOf("Material tax percent")], "10");
});
test("SC11-05 all sealed payload files reject independent tampering before restoration", async () => {
  const { exported } = await build();
  for (const name of QS_PACKAGE_ENTRIES.filter(name => name !== "manifest.json")) {
    const files = unzipSync(exported.bytes); files[name] = Uint8Array.from(files[name]); files[name][0] ^= 1;
    await assert.rejects(parseQsCostPlanPackage(zipSync(files, { level: 0 }), parseWorksheet), /integrity verification/, name);
  }
  const files = unzipSync(exported.bytes), manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  manifest.contentSha256 = "c".repeat(64); files["manifest.json"] = encodeJson(manifest);
  await assert.rejects(parseQsCostPlanPackage(zipSync(files), parseWorksheet), /manifest failed/);
});
test("SC11-06 resealed PDF/CSV with contradictory contents cannot pass semantic verification", async () => {
  const { exported } = await build();
  for (const name of ["cost-plan.pdf", "schedule.csv"]) {
    const files = unzipSync(exported.bytes);
    files[name] = new TextEncoder().encode(name === "schedule.csv" ? exported.csv.replace("43.56", "999.00") : "%PDF-1.7\nContradictory document\n");
    await assert.rejects(parseQsCostPlanPackage(await reseal(files), parseWorksheet), /does not reconcile/, name);
  }
});
test("SC11-07 foreign project restore and forged content hashes leave the package and caller unchanged", async () => {
  const { value } = await build(), before = canonicalQsJson(value);
  await assert.rejects(restoreQsCostPlanWorksheet(value, "other-project", parseWorksheet), /another project/);
  const forged = structuredClone(value); forged.worksheet.items[0].quantity = "3.00";
  await assert.rejects(restoreQsCostPlanWorksheet(forged, "package-project", parseWorksheet), /SHA-256/);
  assert.equal(canonicalQsJson(value), before);
});
test("SC11-08 worksheet quantities, bindings, options and rate assignments must match the saved revision", async () => {
  for (const mutate of [
    (input: QsPackageInput<Worksheet>) => { input.worksheet.items[0].quantity = "5"; },
    (input: QsPackageInput<Worksheet>) => { input.worksheet.items[0].entityBinding.entityGeometrySha256 = "c".repeat(64); },
    (input: QsPackageInput<Worksheet>) => { input.worksheet.items[0].evidence = "sample"; },
    (input: QsPackageInput<Worksheet>) => { input.worksheet.pricing.assignments[0].rateId = null; input.worksheet.pricing.assignments[0].rateRevision = null; },
    (input: QsPackageInput<Worksheet>) => { input.worksheet.items.push(structuredClone(input.worksheet.items[0])); },
    (input: QsPackageInput<Worksheet>) => { input.worksheet.items[0].nodeKey = "missing"; },
  ]) {
    const input = structuredClone(fixture()); mutate(input);
    await assert.rejects(createQsCostPlanPackage(input, parseWorksheet));
  }
});
test("SC11-09 later revisions require the exact preceding preserved cost plan", async () => {
  const input = fixture(2); input.previous = null;
  await assert.rejects(createQsCostPlanPackage(input, parseWorksheet), /immediately preceding/);
  const wrong = fixture(2); wrong.previous = priced(1, "2");
  await assert.rejects(createQsCostPlanPackage(wrong, parseWorksheet), /immediately preceding/);
  const first = fixture(); first.previous = priced();
  await assert.rejects(createQsCostPlanPackage(first, parseWorksheet), /initial cost revision/);
});
test("SC11-10 delivery records must identify the same project, revision, source and valid chronology", async () => {
  for (const mutate of [
    (input: QsPackageInput<Worksheet>) => { input.delivery.projectId = "foreign"; },
    (input: QsPackageInput<Worksheet>) => { input.delivery.kind = "roofing"; },
    (input: QsPackageInput<Worksheet>) => { input.delivery.revision = 7; },
    (input: QsPackageInput<Worksheet>) => { input.delivery.createdAt = "2026-09-18T00:00:00.000Z"; },
    (input: QsPackageInput<Worksheet>) => { input.delivery.state = "issued-deliverable"; },
  ]) { const input = fixture(); mutate(input); await assert.rejects(createQsCostPlanPackage(input, parseWorksheet)); }
  const reviewed = fixture(); reviewed.delivery.state = "reviewed-estimate"; reviewed.delivery.reviewedAt = "2026-09-19T05:30:00.000Z";
  assert.equal((await createQsCostPlanPackage(reviewed, parseWorksheet)).delivery.state, "reviewed-estimate");
});
test("SC11-11 compressed packages reopen, while traversal, additional files and truncation fail closed", async () => {
  const { exported } = await build(), files = unzipSync(exported.bytes);
  assert.equal((await parseQsCostPlanPackage(zipSync(files, { level: 9 }), parseWorksheet)).delivery.projectId, "package-project");
  await assert.rejects(parseQsCostPlanPackage(zipSync({ ...files, "extra.json": encodeJson({}) }), parseWorksheet), /eight supported/);
  const renamed: Record<string, Uint8Array> = { ...files, "../worksheet.json": files["worksheet.json"] }; delete renamed["worksheet.json"];
  await assert.rejects(parseQsCostPlanPackage(zipSync(renamed), parseWorksheet), /unsupported path/);
  await assert.rejects(parseQsCostPlanPackage(exported.bytes.subarray(0, exported.bytes.length - 1), parseWorksheet));
});
test("SC11-12 archive and inflated size declarations are bounded before extraction", async () => {
  await assert.rejects(parseQsCostPlanPackage(new Uint8Array(QS_PACKAGE_MAX_BYTES + 1), parseWorksheet), /size/);
  const { exported } = await build(), changed = Uint8Array.from(exported.bytes), view = new DataView(changed.buffer);
  const end = changed.length - 22, directory = view.getUint32(end + 16, true);
  view.setUint32(directory + 24, QS_PACKAGE_MAX_ENTRY_BYTES + 1, true);
  await assert.rejects(parseQsCostPlanPackage(changed, parseWorksheet), /oversized entry/);
});
test("SC11-13 package capture happens before asynchronous hashing, so later form edits cannot alter export", async () => {
  const input = fixture(), expected = canonicalQsJson(input.worksheet);
  const pending = createQsCostPlanPackage(input, parseWorksheet);
  input.worksheet.items[0].quantity = "900"; input.transmittal.title = "Later edit";
  const value = await pending;
  assert.equal(canonicalQsJson(value.worksheet), expected);
  assert.equal(value.transmittal.title, "Measured cost plan");
});
test("SC11-14 long basis text paginates and Unicode remains explicit and recoverable", async () => {
  const input = fixture(); input.transmittal.title = "Cost plan for café 🏠";
  input.basisOfEstimate = Array.from({ length: 8 }, (_, i) => `${i + 1}: ${"Source basis paragraph with explicit dimensions. ".repeat(70)}`);
  const originalBasis = [...input.basisOfEstimate];
  const { value, exported } = await build(input), doc = await PDFDocument.load(exported.pdf);
  // Notes are trimmed at the package boundary, before sealing. Preserve every
  // interior character while explicitly testing that canonicalization contract.
  assert.deepEqual(value.basisOfEstimate, originalBasis.map(note => note.trim()));
  assert.deepEqual(input.basisOfEstimate, originalBasis);
  assert.ok(doc.getPageCount() > 5);
  const text = doc.getPageIndices().map(index => pdfStrings(doc, index)).join("\n");
  assert.match(text, /\\u\{1f3e0\}/);
  assert.ok(text.includes("8: Source basis paragraph"));
  const reopened = await parseQsCostPlanPackage(exported.bytes, parseWorksheet);
  assert.equal(reopened.transmittal.title, input.transmittal.title);
  assert.deepEqual(reopened.basisOfEstimate, value.basisOfEstimate);
});

test("SC11-15 exact measured quantity beyond six decimals survives export and editable reopen", async () => {
  const quantity = "5.999999930955706", input = fixture();
  input.current = priced(1, quantity);
  input.worksheet.items[0].quantity = quantity;
  input.worksheet.items[0].entityBinding = input.current.items[0].binding;
  input.worksheet.pricing.snapshots = [input.current];
  const { exported } = await build(input);
  assert.equal(input.current.baseTotal.totalMinor, 8712);
  assert.ok(exported.csv.includes(quantity), "CSV retains the exact measured quantity");
  const reopened = await parseQsCostPlanPackage(exported.bytes, parseWorksheet);
  const restored = await restoreQsCostPlanWorksheet(reopened, input.current.input.projectId, parseWorksheet);
  assert.equal(restored.items[0].quantity, quantity);
  assert.equal(restored.items[0].entityBinding.measuredQuantity, quantity);
  assert.equal(reopened.current.items[0].quantity, quantity);
  assert.equal(reopened.current.items[0].adjustedMaterialQuantity, "6.5999999240512766");
  assert.equal(reopened.current.baseTotal.totalMinor, 8712);
  const rounded = structuredClone(input); rounded.worksheet.items[0].quantity = "6";
  await assert.rejects(createQsCostPlanPackage(rounded, parseWorksheet), /does not match its priced measured evidence/);
});

test("SC11-16 PDF wraps ordinary title and basis words at word boundaries", async () => {
  const input = fixture();
  input.transmittal.title = "Synthetic cost plan qualification - previous/current revisions, accepted and proposed options, long source references and pagination";
  input.basisOfEstimate = ["Synthetic measured geometry is pinned to exact drawing, calibration and geometry identities. Historical supplier revisions remain immutable and accessible. ".repeat(4).trim()];
  const { exported } = await build(input), doc = await PDFDocument.load(exported.pdf);
  const plain = doc.getPageIndices().map(index => pdfStrings(doc, index)).join(" ").replace(/\s+/g, " ");
  assert.ok(plain.includes(input.transmittal.title), "a line break must not insert whitespace inside an ordinary title word");
  assert.ok(plain.includes(input.basisOfEstimate[0]), "ordinary basis words must remain whole across wrapped lines");
});

test("SC11-17 oversized audit blocks repeat the exact item identity before continuation text", async () => {
  const input = fixture(), changed = structuredClone(input.current.input);
  changed.priceBooks.books[0].revisions[0].metadata.sourceReference = "PROVENANCE-START " + "Long reviewed supplier source reference with retained record identity.\n".repeat(27) + " PROVENANCE-END";
  changed.rateBook.rates[0].labour = { ...changed.rateBook.rates[0].material };
  changed.rateBook.rates[0].labourAssumption = "Explicit labour basis and access assumptions. ".repeat(21).trim();
  const priced = calculateQsCostPlan(changed);
  assert.equal(priced.ok, true, priced.ok ? undefined : JSON.stringify(priced.blockers));
  if (!priced.ok) throw Error("Long audit fixture did not calculate");
  input.current = priced.snapshot;
  input.worksheet.pricing.rateBook = priced.snapshot.input.rateBook;
  input.worksheet.pricing.snapshots = [priced.snapshot];
  const { exported } = await build(input), doc = await PDFDocument.load(exported.pdf);
  const pages = doc.getPageIndices().map(index => pdfStrings(doc, index).split("\n"));
  const continued = pages.filter(lines => lines.includes("Source and rate audit trail (continued)"));
  assert.ok(continued.length > 0, "fixture must overflow one audit page");
  for (const lines of continued) assert.equal(lines[2], "Item item-1 (continued)", "continuation begins with the exact priced item identity");
  assert.equal(pages.flat().filter(line => line.includes("PROVENANCE-END")).length, 2, "material and labour source tails are retained");
  const reopened = await parseQsCostPlanPackage(exported.bytes, parseWorksheet);
  assert.equal(reopened.current.items[0].itemId, "item-1");
});
