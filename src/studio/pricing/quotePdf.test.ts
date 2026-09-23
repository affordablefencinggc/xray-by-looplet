import test from "node:test";
import assert from "node:assert/strict";
import { addPricedLine, appendPriceBookRevision, emptyPriceBookLibrary, parsePriceBookLibrary, persistPriceBooks, priceBookKey, readPriceBooks, type PriceImport } from "./priceBooks.ts";
import { setBomMapping, syncBomPricedLines } from "./bomPricing.ts";
import { buildQuoteDraft, issueQuote, quoteDraftPdf } from "./quotePdf.ts";
import { quoteRate } from "./quoteRecord.ts";

const bookId = "00000000-0000-4000-8000-000000000001";
let next = 50;
const makeId = () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`;
const now = "2026-09-23T10:00:00.000Z";
const rates: PriceImport = {
  metadata: { supplier: "AFGC training", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-23", sourceReference: "Fixture" },
  source: { fileName: "rates.csv", sizeBytes: 100, sha256: "c".repeat(64), delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
  rows: [
    { sourceLine: 2, stockCode: "FEN-M002", description: "Treated pine post 100x100x2400mm", unit: "ea", rate: 18.5 },
    { sourceLine: 4, stockCode: "FEN-M005", description: "Paling 150x12x1800mm", unit: "ea", rate: 3 },
  ],
};
const details = { from: "Affordable Fencing Gold Coast", customer: "QA customer", siteAddress: "74-78 Annie Street, Auchenflower", reference: "Q-TEST-1", validDays: 30, notes: "Training fixture." };
function priced() {
  let lib = appendPriceBookRevision(emptyPriceBookLibrary("job-q"), rates, "AFGC", null, () => bookId, now);
  lib = setBomMapping(lib, { key: "TP-PALING", bookId, bookRevision: 1, sourceLine: 4, factor: "1", rounding: "exact" });
  lib = syncBomPricedLines(lib, { commitRevision: 3, lines: [{ key: "TP-PALING", description: "Timber palings", quantity: "815", unit: "ea" }] }, makeId, now).library;
  return addPricedLine(lib, bookId, 1, 2, "3", makeId, now);
}

test("draft totals add tax only when the price book states an exclusive percentage", () => {
  const draft = buildQuoteDraft(priced(), details, { commitRevision: 3, current: true }, new Date(now));
  assert.deepEqual(draft.lines.map(l => [l.description, l.quantity, l.amount, l.source]), [
    ["Paling 150x12x1800mm", "815", "2445.00", "material register 3 (TP-PALING)"],
    ["Treated pine post 100x100x2400mm", "3", "55.50", "entered"],
  ]);
  assert.deepEqual(draft.totals, [{ currency: "AUD", amount: "2500.50", taxAmount: "250.05", totalWithTax: "2750.55", taxLabel: "plus tax 10%" }]);
  assert.match(draft.provenance.join("\n"), /material register 3/);
  assert.deepEqual(draft.lines.map(l => l.rate), ["3.00", "18.50"]);
  assert.equal(draft.pricingBasis.books[0].sha256, rates.source.sha256);
});

test("rate display pads cents without rounding away supplier precision", () => {
  assert.deepEqual([0, 3, 18.5, 1.005, 0.000001, 1000000000].map(quoteRate), ["0.00", "3.00", "18.50", "1.005", "0.000001", "1000000000.00"]);
});

test("an issued snapshot survives new rates, changed quantities and save/reload with its original cents and source", () => {
  const original = priced(), register = { commitRevision: 3, current: true };
  let library = issueQuote(original, details, register, new Date(now), makeId);
  const snapshot = structuredClone(library.issuedQuotes![0]);
  assert.equal(snapshot.issue.issuedAt, now); assert.equal(snapshot.pricingBasis.libraryRevision, original.revision);
  assert.throws(() => issueQuote(library, { ...details, reference: "q-test-1" }, register), /already issued/);
  assert.throws(() => issueQuote(library, { ...details, reference: "Q-2" }, { ...register, current: false }), /materials changed/);
  library = appendPriceBookRevision(library, { ...rates, rows: rates.rows.map(r => ({ ...r, rate: r.rate * 2 })) }, "AFGC", bookId, makeId, now);
  library = syncBomPricedLines(library, { commitRevision: 4, lines: [{ key: "TP-PALING", description: "Timber palings", quantity: "1000", unit: "ea" }] }, makeId, now).library;
  library = issueQuote(library, { ...details, reference: "Q-TEST-1-R2" }, { commitRevision: 4, current: true }, new Date(now), makeId);
  const restored = parsePriceBookLibrary(JSON.stringify(library), library.jobId);
  assert.deepEqual(restored.issuedQuotes![0], snapshot);
  assert.equal(restored.issuedQuotes![0].totals[0].totalWithTax, "2750.55");
  assert.equal(restored.issuedQuotes![1].totals[0].totalWithTax, "3361.05");
  assert.equal(original.issuedQuotes, undefined);
});

test("storage refuses issue mutation/removal and concurrent updates without replacing saved data", () => {
  const initial = priced(), data = new Map([[priceBookKey(initial.jobId), JSON.stringify(initial)]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, raw: string) => { data.set(key, raw); } };
  const before = readPriceBooks(storage, initial.jobId), nextLibrary = issueQuote(initial, details, { commitRevision: 3, current: true }, new Date(now), makeId);
  const saved = persistPriceBooks(storage, before, nextLibrary), savedRaw = saved.raw;
  const changed = structuredClone(saved.value); changed.revision++; changed.issuedQuotes![0].lines[0].amount = "0.00";
  assert.throws(() => persistPriceBooks(storage, saved, changed), /cannot be removed or overwritten/);
  assert.throws(() => persistPriceBooks(storage, saved, { ...saved.value, revision: saved.value.revision + 1, issuedQuotes: [] }), /cannot be removed or overwritten/);
  assert.throws(() => persistPriceBooks(storage, before, nextLibrary), /another window/);
  assert.equal(data.get(priceBookKey(initial.jobId)), savedRaw);
});

test("a stale or missing material register and missing details refuse the draft", () => {
  assert.throws(() => buildQuoteDraft(priced(), details, { commitRevision: 3, current: false }), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), details, { commitRevision: 4, current: true }), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), details, null), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), { ...details, customer: " " }, { commitRevision: 3, current: true }), /customer/);
  assert.throws(() => buildQuoteDraft(emptyPriceBookLibrary("job-q"), details, null), /Add priced lines/);
});

test("issued PDF carries the issue time, rate precision and pinned price library revision", async () => {
  const original = priced(), quote = issueQuote(original, details, { commitRevision: 3, current: true }, new Date(now), makeId).issuedQuotes![0];
  const bytes = await quoteDraftPdf(quote), { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes }), doc = await task.promise;
  try {
    const parts: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) parts.push((await (await doc.getPage(n)).getTextContent()).items.map(i => "str" in i ? i.str : "").join(" "));
    const text = parts.join(" ");
    for (const expected of ["ISSUED QUOTE", now, `Price library revision: ${original.revision}`, "revision 1", "3.00", "18.50", "AUD 2750.55"])
      assert.ok(text.includes(expected), `missing ${expected}`);
    assert.ok(!text.includes("DRAFT QUOTE"));
  } finally { await task.destroy(); }
});

test("the PDF is a readable draft carrying the lines, totals and not-sent marking", async () => {
  const bytes = await quoteDraftPdf(buildQuoteDraft(priced(), details, { commitRevision: 3, current: true }, new Date(now)));
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1), content = await page.getTextContent();
    const text = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
    for (const expected of ["DRAFT QUOTE", "not sent", "Affordable Fencing Gold Coast", "QA customer", "Q-TEST-1", "815", "AUD 2445.00", "AUD 2500.50", "AUD 250.05", "AUD 2750.55", "material register 3"])
      assert.ok(text.includes(expected), `missing ${expected}`);
    assert.equal((await doc.getMetadata()).info && (await doc.getMetadata() as { info: { Title?: string } }).info.Title, "Draft quote Q-TEST-1");
  } finally { await task.destroy(); }
});
