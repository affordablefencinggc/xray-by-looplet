import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { readPriceWorkbook, boundedWorkbookArchive, WORKBOOK_EXPANDED_LIMIT } from "./priceWorkbook.ts";
import { workbookPriceTable } from "./priceWorkbookTable.ts";
import { parsePriceCsv, previewPriceRows, suggestPriceMapping, priceImportSchema, appendPriceBookRevision, emptyPriceBookLibrary, addPricedLine, resolvePricedLine, parsePriceBookLibrary } from "./priceBooks.ts";

function workbook(sheets: Record<string, XLSX.WorkSheet>) {
  const value = XLSX.utils.book_new(); for (const [name, sheet] of Object.entries(sheets)) XLSX.utils.book_append_sheet(value, sheet, name);
  return new Uint8Array(XLSX.write(value, { type: "array", bookType: "xlsx", compression: true }));
}
const fixture = () => XLSX.utils.aoa_to_sheet([["Supplier pricing — QA only"], [], ["SKU", "Description", "Unit", "Rate"], ["ST-1", "Steel fixture", "kg", 12.345], ["CV-1", "Civil fixture", "m3", 150.25]]);
const mapping = { stockCode: 0, description: 1, unit: 2, rate: 3 };
test("real XLSX selects the requested worksheet and header row with physical row provenance", () => {
  const parsed = readPriceWorkbook(workbook({ Instructions: XLSX.utils.aoa_to_sheet([["Not rates"]]), "Supplier A": fixture() }));
  assert.deepEqual(parsed.sheets.map(s => s.name), ["Instructions", "Supplier A"]);
  const table = workbookPriceTable(parsed.sheets[1], 3), preview = previewPriceRows(table, mapping);
  assert.deepEqual(preview.errors, []); assert.deepEqual(preview.rows.map(r => r.sourceLine), [4, 5]);
  assert.equal(preview.rows[0].rate, 12.345); assert.equal(table.headerLine, 3);
  assert.throws(() => workbookPriceTable(parsed.sheets[1], 2), /empty/);
});
test("formula, shared/array formula, cached-result and spreadsheet errors never become mapped rates", () => {
  const sheet = fixture(); sheet.D4 = { t: "n", v: 999, f: "1000-1", F: "D4:D5" }; sheet.D5 = { t: "n", v: 777, F: "D4:D5" };
  const parsed = readPriceWorkbook(workbook({ Rates: sheet })).sheets[0];
  assert.equal(parsed.formulaCells, 2);
  const result = previewPriceRows(workbookPriceTable(parsed, 3), mapping);
  assert.equal(result.rows.length, 0); assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /Line 4: Cell D4 contains a formula/); assert.ok(!JSON.stringify(parsed).includes('999'));
  const errorSheet = fixture(); errorSheet.D4 = { t: "e", v: 7 };
  assert.match(previewPriceRows(workbookPriceTable(readPriceWorkbook(workbook({ Rates: errorSheet })).sheets[0], 3), mapping).errors[0], /spreadsheet error/);
});
test("formula in an unmapped note column is never used, while mapped constants can be reviewed", () => {
  const sheet = fixture(); sheet.E3 = { t: "s", v: "Internal note" }; sheet.E4 = { t: "n", f: 'WEBSERVICE("https://invalid.test")', v: 999 }; sheet["!ref"] = "A1:E5";
  const selected = readPriceWorkbook(workbook({ Rates: sheet })).sheets[0];
  const result = previewPriceRows(workbookPriceTable(selected, 3), mapping);
  assert.equal(selected.formulaCells, 1); assert.equal(result.errors.length, 0); assert.equal(result.rows[0].rate, 12.345);
  assert.ok(!JSON.stringify(selected).includes("WEBSERVICE"));
});
test("numeric SKU display padding is retained while price uses raw unrounded numeric value", () => {
  const sheet = fixture(); sheet.A4 = { t: "n", v: 123, z: "00000" }; sheet.D4 = { t: "n", v: 12.345, z: '"$"0.00' };
  const table = workbookPriceTable(readPriceWorkbook(workbook({ Rates: sheet })).sheets[0], 3), result = previewPriceRows(table, mapping);
  assert.equal(result.rows[0].stockCode, "00123"); assert.equal(result.rows[0].rate, 12.345);
});
test("merged mapped cells, date-formatted rates and header formulas block with cell-level explanation", () => {
  const merged = fixture(); merged["!merges"] = [XLSX.utils.decode_range("B4:B5")];
  assert.match(previewPriceRows(workbookPriceTable(readPriceWorkbook(workbook({ Rates: merged })).sheets[0], 3), mapping).errors[0], /Cell B4 is merged/);
  const dated = fixture(); dated.D4 = { t: "n", v: 45000, z: "yyyy-mm-dd" };
  assert.match(previewPriceRows(workbookPriceTable(readPriceWorkbook(workbook({ Rates: dated })).sheets[0], 3), mapping).errors[0], /Cell D4 is a date/);
  const header = fixture(); header.D3 = { t: "s", f: '"Rate"', v: "Rate" };
  assert.throws(() => workbookPriceTable(readPriceWorkbook(workbook({ Rates: header })).sheets[0], 3), /Header row 3.*formula/);
});
test("truncated, non-workbook, CRC-corrupted and macro archives fail before price parsing", () => {
  const bytes = workbook({ Rates: fixture() });
  assert.throws(() => readPriceWorkbook(bytes.subarray(0, bytes.length - 15)), /directory/);
  assert.throws(() => readPriceWorkbook(strToU8("not excel")), /not an XLSX/);
  assert.throws(() => readPriceWorkbook(zipSync({ "hello.txt": strToU8("test") })), /catalogue/);
  const contents = unzipSync(bytes); contents["xl/vbaProject.bin"] = new Uint8Array([1]);
  assert.throws(() => readPriceWorkbook(zipSync(contents)), /Macro-enabled/);
  const corrupt = workbook({ Rates: fixture() });
  const view = new DataView(corrupt.buffer); let index = 0;
  while (index < corrupt.length - 4 && view.getUint32(index, true) !== 0x02014b50) index++;
  view.setUint32(index + 16, 123456789, true);
  assert.throws(() => readPriceWorkbook(corrupt), /checksum/);
});
test("ZIP expansion limit rejects oversized content and worksheets exceeding supported dimensions", () => {
  const bomb = zipSync({ "[Content_Types].xml": strToU8("types"), "xl/workbook.xml": new Uint8Array(WORKBOOK_EXPANDED_LIMIT + 1) });
  assert.throws(() => boundedWorkbookArchive(bomb), /20 MB/);
  const wide = fixture(); wide.AO4 = { t: "s", v: "unsupported width" }; wide["!ref"] = "A1:AO5";
  assert.throws(() => workbookPriceTable(readPriceWorkbook(workbook({ Rates: wide })).sheets[0], 3), /40 columns/);
});
test("CSV header-row selection remains explicit and old CSV snapshots still validate unchanged", () => {
  const text = 'Price sheet\n\nSKU,Description,Unit,Rate\nS1,Steel,kg,12.345\n';
  const table = parsePriceCsv(text, ",", 3); assert.equal(previewPriceRows(table, suggestPriceMapping(table.headers)).rows[0].sourceLine, 4);
  const legacy = { metadata: { supplier: "QA", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-07", sourceReference: "QA only" },
    source: { fileName: "old.csv", sizeBytes: 100, sha256: "a".repeat(64), delimiter: ",", headers: table.headers, mapping }, rows: previewPriceRows(table, mapping).rows };
  const old = priceImportSchema.parse(legacy); assert.deepEqual(old, legacy);
  const id = "00000000-0000-4000-8000-000000000010", lineId = "00000000-0000-4000-8000-000000000011";
  let library = appendPriceBookRevision(emptyPriceBookLibrary("job"), old, "QA book", null, () => id);
  library = addPricedLine(library, id, 1, 4, "2", () => lineId);
  const newer = priceImportSchema.parse({ ...legacy, source: { ...legacy.source, kind: "xlsx", delimiter: undefined, worksheet: "Supplier A", headerRow: 3 }, rows: [{ ...legacy.rows[0], rate: 20 }] });
  library = appendPriceBookRevision(library, newer, "", id);
  const reloaded = parsePriceBookLibrary(JSON.stringify(library), "job");
  assert.equal(resolvePricedLine(reloaded, reloaded.worksheet[0]).amount, "24.69");
  assert.equal(reloaded.books[0].revisions[1].source.worksheet, "Supplier A");
  assert.equal(priceImportSchema.safeParse({ ...newer, source: { ...newer.source, worksheet: undefined } }).success, false);
});
