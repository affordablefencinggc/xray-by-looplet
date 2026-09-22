import test from "node:test";
import assert from "node:assert/strict";
import { addPricedLine, appendPriceBookRevision, emptyPriceBookLibrary, pricedWorksheetCsv, pricedWorksheetTotals, priceBookLibrarySchema, type PriceImport } from "./priceBooks.ts";
import { clearBomMapping, derivedQuantity, setBomMapping, syncBomPricedLines } from "./bomPricing.ts";

const bookId = "00000000-0000-4000-8000-000000000001";
let next = 10;
const makeId = () => `00000000-0000-4000-8000-0000000000${next++}` as `${string}-${string}-${string}-${string}-${string}`;
const now = "2026-09-23T10:00:00.000Z";
const rates: PriceImport = {
  metadata: { supplier: "AFGC training", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: null, effectiveDate: "2026-09-23", sourceReference: "Fixture" },
  source: { fileName: "rates.csv", sizeBytes: 100, sha256: "b".repeat(64), delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
  rows: [
    { sourceLine: 2, stockCode: "FEN-M002", description: "Treated pine post 100x100x2400mm", unit: "ea", rate: 18.5 },
    { sourceLine: 4, stockCode: "FEN-M005", description: "Paling 150x12x1800mm", unit: "ea", rate: 3 },
    { sourceLine: 5, stockCode: "FEN-M007", description: "Rail 75x50x2400mm", unit: "ea", rate: 10 },
  ],
};
const library = () => appendPriceBookRevision(emptyPriceBookLibrary("job-one"), rates, "AFGC", null, () => bookId, now);
const map = (lib: ReturnType<typeof library>, key: string, sourceLine: number, factor = "1", rounding: "exact" | "up" = "exact") =>
  setBomMapping(lib, { key, bookId, bookRevision: 1, sourceLine, factor, rounding });
const bom = (commitRevision: number, palings: string, posts: string, railLm: string) => ({ commitRevision, lines: [
  { key: "TP-PALING", description: "Timber palings", quantity: palings, unit: "ea" },
  { key: "TP-POST-ORD", description: "Timber line post", quantity: posts, unit: "ea" },
  { key: "TP-RAIL-LM", description: "Timber rail material", quantity: railLm, unit: "lm" },
] });

test("derived quantities use exact decimals and whole-unit rounding up", () => {
  assert.equal(derivedQuantity("281", "1", "exact"), "281");
  assert.equal(derivedQuantity("99.176", "0.416667", "exact"), "41.323366");
  assert.equal(derivedQuantity("99.176", "0.416667", "up"), "42");
  assert.equal(derivedQuantity("48", "0.5", "up"), "24");
  assert.equal(derivedQuantity("0.1234567", "1", "exact"), "0.123457");
});

test("mapped materials price themselves and a new material commit updates the same lines", () => {
  let lib = map(map(map(library(), "TP-PALING", 4), "TP-POST-ORD", 2), "TP-RAIL-LM", 5, "0.416667", "up");
  lib = addPricedLine(lib, bookId, 1, 2, "3", makeId, now); // manual line: never touched by sync
  const first = syncBomPricedLines(lib, bom(1, "281", "9", "49.764"), makeId, now);
  assert.deepEqual(first.changes.map(c => c.kind), ["added", "added", "added"]);
  const linked = first.library.worksheet.filter(line => line.bom);
  assert.deepEqual(linked.map(line => [line.bom!.key, line.quantity]), [["TP-PALING", "281"], ["TP-POST-ORD", "9"], ["TP-RAIL-LM", "21"]]);
  assert.equal(pricedWorksheetTotals(first.library)[0].amount, "1275.00"); // 55.50 manual + 843 + 166.50 + 210
  const ids = linked.map(line => line.id);

  const revised = syncBomPricedLines(first.library, bom(2, "368", "12", "65.004"), makeId, now);
  assert.deepEqual(revised.changes, [
    { kind: "updated", key: "TP-PALING", from: "281", to: "368" },
    { kind: "updated", key: "TP-POST-ORD", from: "9", to: "12" },
    { kind: "updated", key: "TP-RAIL-LM", from: "21", to: "28" },
  ]);
  assert.deepEqual(revised.library.worksheet.filter(line => line.bom).map(line => line.id), ids, "linked lines keep their identity");
  assert.ok(revised.library.worksheet.every(line => !line.bom || line.bom.commitRevision === 2));
  assert.equal(revised.library.worksheet.find(line => !line.bom)!.quantity, "3");
  assert.equal(pricedWorksheetTotals(revised.library)[0].amount, "1661.50"); // 55.50 + 1104 + 222 + 280
  assert.equal(revised.library.revision, first.library.revision + 1);
  const csv = pricedWorksheetCsv(revised.library);
  assert.ok(csv.includes('"material register 2: TP-PALING 368 ea x 1"')); assert.ok(csv.includes('"entered"'));
});

test("an unchanged register is a no-op, and removed materials or mappings drop their linked line", () => {
  const lib = syncBomPricedLines(map(map(library(), "TP-PALING", 4), "TP-POST-ORD", 2), bom(1, "281", "9", "49.764"), makeId, now).library;
  const same = syncBomPricedLines(lib, bom(1, "281", "9", "49.764"), makeId, now);
  assert.deepEqual(same.library, lib); assert.deepEqual(same.changes, []); assert.equal(same.library.revision, lib.revision);
  const withoutPosts = syncBomPricedLines(lib, { commitRevision: 2, lines: bom(2, "281", "9", "1").lines.filter(l => l.key !== "TP-POST-ORD") }, makeId, now);
  assert.deepEqual(withoutPosts.changes, [{ kind: "removed", key: "TP-POST-ORD", quantity: "9" }]);
  const unmapped = syncBomPricedLines(clearBomMapping(lib, "TP-PALING"), bom(1, "281", "9", "49.764"), makeId, now);
  assert.deepEqual(unmapped.changes, [{ kind: "removed", key: "TP-PALING", quantity: "281" }]);
});

test("mappings must point at an active saved rate and stay unique per material", () => {
  assert.throws(() => setBomMapping(library(), { key: "TP-PALING", bookId, bookRevision: 1, sourceLine: 99, factor: "1", rounding: "exact" }), /active saved rate/);
  assert.throws(() => map(library(), "TP-PALING", 4, "0"), /greater than zero/);
  const remapped = map(map(library(), "TP-PALING", 4), "TP-PALING", 5);
  assert.deepEqual(remapped.bomMappings, [{ key: "TP-PALING", bookId, bookRevision: 1, sourceLine: 5, factor: "1", rounding: "exact" }]);
  assert.ok(priceBookLibrarySchema.safeParse({ ...remapped, bomMappings: [...remapped.bomMappings!, remapped.bomMappings![0]] }).success === false);
});
