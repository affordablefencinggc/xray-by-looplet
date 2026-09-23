import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import type { QuoteDraft } from "./quotePdf.ts";
import { GMAIL_COMPOSE_PREFIX, QUOTE_HANDOVER_SCHEMA, quoteEmailLink, quoteGmailLink, quoteHandoverFiles, quoteHandoverJson, quoteHandoverZip, quoteLinesCsv } from "./quoteHandover.ts";

const draft: QuoteDraft = {
  from: "Affordable Fencing Gold Coast", customer: "=QA customer", siteAddress: "74 Annie Street", reference: "Q 7/1", validDays: 30, notes: "",
  preparedAt: "2026-09-23T10:00:00.000Z",
  lines: [{ description: "Paling 150x12x1800mm", stockCode: "FEN-M005", quantity: "815", unit: "ea", rate: "3", amount: "2445.00", currency: "AUD", source: "material register 3 (TP-PALING)" }],
  totals: [{ currency: "AUD", amount: "2445.00", taxLabel: "tax not included", taxAmount: null, totalWithTax: null }],
  provenance: ["AFGC revision 1"],
  pricingBasis: { libraryRevision: 4, materialRegisterRevision: 3, books: [{ id: "00000000-0000-4000-8000-000000000001", name: "AFGC", revision: 1,
    supplier: "QA supplier", effectiveDate: "2026-09-23", sourceReference: "Fixture", fileName: "rates.csv", sha256: "c".repeat(64) }] },
};

test("JSON handover carries the documented schema, lines and draft status", () => {
  const value = JSON.parse(quoteHandoverJson(draft));
  assert.equal(value.schema, QUOTE_HANDOVER_SCHEMA); assert.equal(value.status, "draft-not-sent");
  assert.deepEqual(value.lines[0], { description: "Paling 150x12x1800mm", stockCode: "FEN-M005", quantity: "815", unit: "ea", unitRate: "3", amount: "2445.00", currency: "AUD", quantitySource: "material register 3 (TP-PALING)", taxBasis: null });
  assert.deepEqual(value.totals, [{ currency: "AUD", subtotal: "2445.00", taxBasis: "tax not included", tax: null, total: null }]);
});

test("line CSV has import-friendly columns, expiry date and a spreadsheet-formula guard", () => {
  const csv = quoteLinesCsv(draft);
  assert.ok(csv.startsWith('\uFEFF"ContactName","Reference","Date","ExpiryDate","ItemCode"'));
  assert.ok(csv.includes(`"'=QA customer","Q 7/1","2026-09-23","2026-10-23","FEN-M005","Paling 150x12x1800mm","815","ea","3.00","2445.00","AUD"`));
});

test("mixed tax bases in one currency retain the per-line tax declaration", () => {
  const mixed = { ...draft, lines: [{ ...draft.lines[0], taxLabel: "tax included (10%)" }, { ...draft.lines[0], taxLabel: "plus tax 10%" }],
    totals: [draft.totals[0], { ...draft.totals[0], taxLabel: "tax included (10%)" }] };
  const rows = quoteLinesCsv(mixed).split("\r\n"); assert.ok(rows[1].includes('"tax included (10%)"')); assert.ok(rows[2].includes('"plus tax 10%"'));
  const legacy = { ...mixed, lines: draft.lines }; assert.match(quoteLinesCsv(legacy), /Mixed tax basis/);
});

test("issued exports identify the issue and frozen price revisions while preserving supplier precision", () => {
  const issued = { ...draft, issue: { id: "00000000-0000-4000-8000-000000000009", issuedAt: "2026-09-23T11:00:00.000Z" },
    lines: [{ ...draft.lines[0], rate: "3.123456" }] };
  const value = JSON.parse(quoteHandoverJson(issued));
  assert.equal(value.status, "issued"); assert.deepEqual(value.issue, issued.issue);
  assert.deepEqual(value.pricingBasis, draft.pricingBasis);
  assert.ok(quoteLinesCsv(issued).includes('"3.123456"'));
  assert.ok(quoteLinesCsv(issued).includes('"issued","2026-09-23T11:00:00.000Z","4"'));
  assert.equal(quoteHandoverFiles(issued, new Uint8Array())[0].name, "Q-7-1-issued-quote.pdf");
});

test("handover files use safe names and the ZIP holds all three", () => {
  const files = quoteHandoverFiles(draft, new Uint8Array([37, 80, 68, 70]));
  assert.deepEqual(files.map(f => f.name), ["Q-7-1-draft-quote.pdf", "Q-7-1-draft-quote-lines.csv", "Q-7-1-draft-quote.json"]);
  const zip = quoteHandoverZip(draft, files);
  assert.equal(zip.name, "Q-7-1-draft-quote-handover.zip");
  const entries = unzipSync(zip.bytes);
  assert.deepEqual(Object.keys(entries).sort(), files.map(f => f.name).sort());
  assert.equal(strFromU8(entries["Q-7-1-draft-quote.pdf"]), "%PDF");
});

test("email link fills subject and body but attaches nothing itself", () => {
  const link = decodeURIComponent(quoteEmailLink(draft, "C:/Dropbox/Q-7-1-draft-quote.pdf"));
  assert.ok(link.startsWith("mailto:?subject=Quote Q 7/1 - Affordable Fencing Gold Coast"));
  assert.match(link, /Total: AUD 2445.00 \(tax not included\)/);
  assert.match(link, /\(Attach: C:\/Dropbox\/Q-7-1-draft-quote.pdf\)/);
});

test("Gmail link opens Gmail's compose page with the same subject and body", () => {
  const link = quoteGmailLink(draft, null);
  assert.ok(link.startsWith(`${GMAIL_COMPOSE_PREFIX}&su=`));
  const params = new URL(link).searchParams;
  assert.equal(params.get("su"), "Quote Q 7/1 - Affordable Fencing Gold Coast");
  assert.match(params.get("body")!, /Total: AUD 2445.00 \(tax not included\)/);
  assert.match(params.get("body")!, /Attach the PDF Q-7-1-draft-quote.pdf/);
  assert.ok(!/\s/.test(link), "no raw whitespace in the link");
});
