import test from "node:test";
import assert from "node:assert/strict";
import { addPricedLine, appendPriceBookRevision, emptyPriceBookLibrary, type PriceImport } from "./priceBooks.ts";
import { setBomMapping, syncBomPricedLines } from "./bomPricing.ts";
import { buildQuoteDraft, quoteDraftPdf } from "./quotePdf.ts";

const bookId = "00000000-0000-4000-8000-000000000001";
let next = 50;
const makeId = () => `00000000-0000-4000-8000-0000000000${next++}` as `${string}-${string}-${string}-${string}-${string}`;
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
});

test("a stale or missing material register and missing details refuse the draft", () => {
  assert.throws(() => buildQuoteDraft(priced(), details, { commitRevision: 3, current: false }), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), details, { commitRevision: 4, current: true }), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), details, null), /materials changed/);
  assert.throws(() => buildQuoteDraft(priced(), { ...details, customer: " " }, { commitRevision: 3, current: true }), /customer/);
  assert.throws(() => buildQuoteDraft(emptyPriceBookLibrary("job-q"), details, null), /Add priced lines/);
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
