import test from "node:test";
import assert from "node:assert/strict";
import { addPricedLine, appendPriceBookRevision, editPriceBook, emptyPriceBookLibrary, parsePriceBookLibrary,
  parsePriceCsv, persistPriceBooks, previewPriceRows, priceBookKey, priceImportSchema, priceLineAmount,
  priceRevisionCsv, pricedWorksheetCsv, pricedWorksheetTotals, readPriceBooks, removePricedLine, resolvePricedLine, suggestPriceMapping, type PriceImport } from "./priceBooks.ts";

const bookId = "00000000-0000-4000-8000-000000000001", lineId = "00000000-0000-4000-8000-000000000002";
const now = "2026-09-07T10:00:00.000Z";
const source: PriceImport = {
  metadata: { supplier: "QA supplier", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-07", sourceReference: "QA estimate fixture only" },
  source: { fileName: "supplier.csv", sizeBytes: 100, sha256: "a".repeat(64), delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
  rows: [{ sourceLine: 2, stockCode: "ST-1", description: "Structural steel fixture", unit: "kg", rate: 12.345 }],
};
const create = () => appendPriceBookRevision(emptyPriceBookLibrary("job-one"), source, "Structural supplier", null, () => bookId, now);
function storageFixture() { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, raw: string) => { data.set(key, raw); } }; }

test("CSV handles BOM, quoted commas, escaped quotes and physical multiline provenance", () => {
  const table = parsePriceCsv('\uFEFFSKU,Item,UOM,Unit price\r\nS1,"Steel, \"\"A\"\"",kg,12.345\r\nC1,"Concrete\r\nservice",m3,140\r\n\r\nE1,Electrical service,hour,0\r\n');
  const result = previewPriceRows(table, suggestPriceMapping(table.headers));
  assert.deepEqual(result.errors, []); assert.equal(result.rows[0].description, 'Steel, "A"');
  assert.deepEqual(result.rows.map(r => r.sourceLine), [2, 3, 6]); assert.equal(result.rows[2].rate, 0);
  assert.equal(result.rows[1].unit, "m3");
});
test("separator is explicit; malformed CSV and ambiguous mapping are blocked", () => {
  const table = parsePriceCsv("Description;Unit;Rate\nEngineering service;hour;150", ";");
  assert.equal(previewPriceRows(table, { stockCode: null, description: 0, unit: 1, rate: 2 }).rows[0].rate, 150);
  assert.throws(() => parsePriceCsv('A,B\n"unfinished,2'), /unclosed/);
  assert.throws(() => parsePriceCsv('A,B\n"closed"oops,2'), /unexpected/);
  assert.match(previewPriceRows(table, { stockCode: null, description: 0, unit: 0, rate: 2 }).errors[0], /different column/);
  assert.match(previewPriceRows(table, { stockCode: null, description: 0, unit: 1, rate: 8 }).errors[0], /existing source column/);
});
test("invalid prices, missing units, duplicate SKU and irregular row lengths fail without partial save", () => {
  for (const value of ["", "-1", "1e3", "NaN", "Infinity", "$25", "1,234", "12.1234567"]) {
    const table = parsePriceCsv(`Code,Description,Unit,Rate\nA,Concrete,m3,"${value}"`);
    assert.equal(previewPriceRows(table, suggestPriceMapping(table.headers)).errors.length, 1, value);
  }
  const table = parsePriceCsv("Code,Description,Unit,Rate\nA,Steel,kg,1\na,Cable,m,2\nB,Service,,3\nC,Concrete,m3,4,extra");
  const result = previewPriceRows(table, suggestPriceMapping(table.headers));
  assert.equal(result.errors.length, 3); assert.match(result.errors[0], /Duplicate stock code/);
});
test("provenance metadata and source mapping are validated, including leap dates", () => {
  assert.ok(priceImportSchema.safeParse(source).success);
  for (const metadata of [{ ...source.metadata, supplier: "" }, { ...source.metadata, currency: "$" }, { ...source.metadata, effectiveDate: "2026-02-29" }, { ...source.metadata, taxBasis: "unspecified" }, { ...source.metadata, amountDecimals: 5 }])
    assert.equal(priceImportSchema.safeParse({ ...source, metadata }).success, false);
  assert.ok(priceImportSchema.safeParse({ ...source, metadata: { ...source.metadata, effectiveDate: "2028-02-29" } }).success);
  assert.equal(priceImportSchema.safeParse({ ...source, source: { ...source.source, sha256: "missing" } }).success, false);
  assert.equal(priceImportSchema.safeParse({ ...source, source: { ...source.source, mapping: { ...source.source.mapping, rate: 20 } } }).success, false);
});
test("revisions preserve original rates and applied worksheet references", () => {
  let library = addPricedLine(create(), bookId, 1, 2, "2", () => lineId, now);
  library = appendPriceBookRevision(library, { ...source, rows: [{ ...source.rows[0], rate: 20 }] }, "Ignored for revisions", bookId, undefined, now);
  const resolved = resolvePricedLine(library, library.worksheet[0]);
  assert.equal(resolved.amount, "24.69"); assert.equal(resolved.outdated, true); assert.equal(resolved.row.rate, 12.345);
  assert.equal(library.books[0].name, "Structural supplier"); assert.equal(library.books[0].revisions[1].rows[0].rate, 20);
  library = editPriceBook(library, bookId, { name: "Supplier renamed", archived: true });
  assert.equal(resolvePricedLine(library, library.worksheet[0]).amount, "24.69");
  assert.throws(() => addPricedLine(library, bookId, 2, 2, "1"), /active/);
  assert.throws(() => appendPriceBookRevision(library, source, "", bookId), /archived/);
  assert.equal(removePricedLine(library, lineId).worksheet.length, 0); assert.equal(library.worksheet.length, 1);
});
test("money calculation uses exact decimal arithmetic and explicit half-up rounding", () => {
  assert.equal(priceLineAmount(0.1, "3", 2), "0.30"); assert.equal(priceLineAmount(1.005, "1", 2), "1.01");
  assert.equal(priceLineAmount(0.000001, "1000000", 2), "1.00");
  assert.equal(priceLineAmount(1000000000, "1000000000", 4), "1000000000000000000.0000");
  assert.equal(priceLineAmount(2.5, "1", 0), "3"); assert.equal(priceLineAmount(2.5, "0", 2), "0.00");
  for (const quantity of ["", "-1", "1e2", "0.0000001", "1000000001", "Infinity", "1,000"]) assert.throws(() => priceLineAmount(1, quantity, 2));
  assert.throws(() => priceLineAmount(0.0000001, "1", 2)); assert.throws(() => priceLineAmount(1, "1", -1));
});
test("storage is job-scoped, preserves legacy rates and rejects stale writes", () => {
  const storage = storageFixture(); storage.setItem("xray.price-sheet.v1", "legacy untouched");
  const session = readPriceBooks(storage, "job-one"), next = create();
  const saved = persistPriceBooks(storage, session, next);
  assert.equal(saved.value.books.length, 1); assert.equal(readPriceBooks(storage, "job-two").value.books.length, 0);
  assert.equal(storage.getItem("xray.price-sheet.v1"), "legacy untouched");
  assert.throws(() => persistPriceBooks(storage, session, next), /another window/);
  assert.throws(() => parsePriceBookLibrary(saved.raw!, "job-two"), /another project/);
  const mutated = structuredClone(saved.value); mutated.revision++; mutated.books[0].revisions[0].rows[0].rate = 999;
  assert.throws(() => persistPriceBooks(storage, saved, mutated), /cannot be removed or overwritten/);
  assert.equal(storage.getItem(priceBookKey("job-one")), saved.raw);
});
test("corrupt and quota-failed storage is preserved; no phantom saved revision", () => {
  const storage = storageFixture(); storage.setItem(priceBookKey("job-one"), "broken");
  const blocked = readPriceBooks(storage, "job-one"); assert.equal(blocked.blocked, true);
  assert.throws(() => persistPriceBooks(storage, blocked, create()), /blocked/); assert.equal(storage.getItem(priceBookKey("job-one")), "broken");
  const fresh = readPriceBooks(storageFixture(), "job-one");
  assert.throws(() => persistPriceBooks({ getItem: () => null, setItem: () => { throw Error("Quota exceeded"); } }, fresh, create()), /Quota/);
  assert.equal(fresh.value.books.length, 0);
});
test("export records provenance and escapes spreadsheet formulas", () => {
  const library = appendPriceBookRevision(emptyPriceBookLibrary("job-one"), { ...source, rows: [{ ...source.rows[0], description: '=HYPERLINK("bad")' }] }, "Export QA", null, () => bookId, now);
  const csv = priceRevisionCsv(library.books[0], 1);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"')); assert.ok(csv.includes("a".repeat(64)));
  assert.ok(csv.includes('"AUD","exclusive","10","QA supplier","2026-09-07"')); assert.ok(csv.includes('"2","Export QA","1"'));
});
test("worksheet totals sum rounded lines and keep currencies and tax bases separate", () => {
  let library = addPricedLine(create(), bookId, 1, 2, "1", () => lineId, now);
  const secondBook = "00000000-0000-4000-8000-000000000003", thirdBook = "00000000-0000-4000-8000-000000000004";
  library = appendPriceBookRevision(library, { ...source, metadata: { ...source.metadata, currency: "USD" } }, "US engineering", null, () => secondBook, now);
  library = appendPriceBookRevision(library, { ...source, metadata: { ...source.metadata, taxBasis: "inclusive" } }, "Electrical", null, () => thirdBook, now);
  library = addPricedLine(library, bookId, 1, 2, "1", () => "00000000-0000-4000-8000-000000000005", now);
  library = addPricedLine(library, secondBook, 1, 2, "1", () => "00000000-0000-4000-8000-000000000006", now);
  library = addPricedLine(library, thirdBook, 1, 2, "1", () => "00000000-0000-4000-8000-000000000007", now);
  const totals = pricedWorksheetTotals(library); assert.equal(totals.length, 3); assert.equal(totals[0].amount, "24.70");
  assert.equal(totals[1].currency, "USD"); assert.equal(totals[2].taxBasis, "inclusive");
  const csv = pricedWorksheetCsv(library); assert.ok(csv.includes('"1","kg","12.345","12.35","AUD","exclusive"')); assert.ok(csv.includes(source.source.sha256));
});
