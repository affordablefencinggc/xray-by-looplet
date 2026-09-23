import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bomBuildRequestSchema, computeBomInputDigest } from "./bomContract.ts";
import { buildBom } from "./bomRules.ts";
import { buildFencingStockPlan, fencingStockCsv } from "./fencingStock.ts";
import { fencingStockRuleSchema, type FencingStockRule } from "./fencingStockContract.ts";
import { emptyPriceBookLibrary, appendPriceBookRevision, pricedWorksheetTotals, type PriceImport } from "./pricing/priceBooks.ts";
import { setBomMapping, syncBomPricedLines, materialPriceCoverage } from "./pricing/bomPricing.ts";

async function fixture(length = 5000) {
  const request = bomBuildRequestSchema.parse(JSON.parse(readFileSync(new URL("../../engine/fixtures/bom-contract/colorbond.request.json", import.meta.url), "utf8")));
  request.recipeSet.recipes[0].bayLayout = "full-bays-terminal-cut";
  request.gates = []; request.runs[0].segments[0].lengthMm = length;
  request.runs[0].storedLengths = { grossMm: length, gateDeductionMm: 0, netMm: length };
  request.inputDigest = await computeBomInputDigest(request);
  const result = await buildBom(request); assert.ok(result.ok);
  return { request, source: { commitRevision: length === 5000 ? 1 : 2, lines: result.bom.lines.map(l => ({ key: l.itemCode!, description: l.description, quantity: l.quantity.value, unit: l.quantity.unit })) } };
}
const rule: FencingStockRule = { recipeId: "recipe-colorbond-good-neighbour", recipeRevision: 3, componentId: "cb-rail-cut", profile: "QA rail profile", stockLengthsMm: [2400, 4800], kerfMm: 5,
  reusableOffcutMm: 1200, railAdjustmentMm: 0, postLengthMm: null, reference: "Synthetic schedule, not supplier approval", reviewedBy: "QA estimator", reviewedAt: "2026-09-23T10:00:00.000Z" };
const settings = (request: Awaited<ReturnType<typeof fixture>>["request"], changes: Partial<FencingStockRule> = {}) => ({ ...rule, recipeRevision: request.recipeSet.recipes[0].revision, ...changes });

test("stock planning preserves actual full-bay rail cuts, posts, saw kerf and offcuts without combining profiles", async () => {
  const { request, source } = await fixture();
  const plan = buildFencingStockPlan(request, source, [settings(request), settings(request, { componentId: "cb-post-end", profile: "QA end post", postLengthMm: 2400 })]);
  const rails = plan.groups[0], posts = plan.groups[1];
  assert.deepEqual(rails.cuts.map(c => c.lengthM), [2.4, 2.4, 2.4, 2.4, .2, .2]);
  assert.equal(rails.layout.totalStockSheets, 5); assert.equal(rails.layout.totalRequiredCutLengthM, 10);
  assert.equal(rails.layout.totalKerfLossM, .01); assert.equal(rails.layout.totalReusableOffcutM, 1.99);
  assert.equal(posts.cuts.length, 2); assert.equal(posts.layout.totalStockSheets, 2);
  assert.ok(plan.lines.find(l => l.key === "CB-RAIL-LM")!.noRateReason);
  for (const group of plan.groups) for (const sheet of group.layout.sheets)
    assert.ok(Math.abs(sheet.usedLengthM + sheet.kerfLossM + sheet.offcutLengthM - sheet.stockLengthM) < .0001);
  assert.match(fencingStockCsv(plan), /StockPiece/); assert.match(fencingStockCsv(plan), new RegExp(request.inputDigest));
});

test("reviewed cuts fail closed on changed recipes, missing post length, sloping schedules, overrides and overlength", async () => {
  const { request, source } = await fixture();
  const base = settings(request);
  assert.throws(() => buildFencingStockPlan(request, source, [{ ...base, recipeRevision: base.recipeRevision + 1 }]), /review stock lengths/);
  assert.throws(() => buildFencingStockPlan(request, source, [{ ...base, componentId: "cb-post-end" }]), /finished post length/);
  assert.throws(() => buildFencingStockPlan(request, source, [{ ...base, stockLengthsMm: [2000] }]), /exceeds maximum/);
  assert.throws(() => buildFencingStockPlan(request, source, [{ ...base, railAdjustmentMm: -201 }]), /greater than/);
  assert.ok(!fencingStockRuleSchema.safeParse({ ...base, reference: "" }).success);
  request.runs[0].specification.slope = "raked";
  assert.throws(() => buildFencingStockPlan(request, source, [base]), /sloping runs/);
  request.runs[0].specification.slope = "level";
  request.runs[0].vertices[0].postOverride = { postSize: "Custom", lengthMm: 2700, embedmentMm: 800, notes: "Test" };
  assert.throws(() => buildFencingStockPlan(request, source, [{ ...base, componentId: "cb-post-end", postLengthMm: 2400 }]), /post overrides/);
});

test("stock purchases update mapped quantities after rebuild and suppress the underlying rail charge", async () => {
  const { request, source } = await fixture(), first = buildFencingStockPlan(request, source, [settings(request)]);
  const id = "00000000-0000-4000-8000-000000000001", now = rule.reviewedAt;
  const incoming: PriceImport = { metadata: { supplier: "QA", currency: "AUD", amountDecimals: 2, taxBasis: "inclusive", taxPercent: 10, effectiveDate: "2026-09-23", sourceReference: "Synthetic arithmetic fixture" },
    source: { fileName: "stock.csv", sizeBytes: 100, sha256: "a".repeat(64), delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
    rows: [{ sourceLine: 2, stockCode: "QA-RAIL", description: "QA rail 2400", unit: "ea", rate: 10 }] };
  let library = appendPriceBookRevision(emptyPriceBookLibrary("qa-stock"), incoming, "QA", null, () => id, now);
  const mapping = { bookId: id, bookRevision: 1, sourceLine: 2, factor: "1", rounding: "exact" as const };
  library = setBomMapping(library, { ...mapping, key: "CB-RAIL-LM" });
  library = setBomMapping(library, { ...mapping, key: first.groups[0].purchases[0].key });
  library = syncBomPricedLines(library, { ...source, lines: first.lines }).library;
  assert.equal(library.worksheet.length, 1); assert.equal(library.worksheet[0].quantity, "5");
  assert.equal(pricedWorksheetTotals(library)[0].amount, "50.00");
  assert.equal(materialPriceCoverage(library, { ...source, lines: first.lines }).find(l => l.key === "CB-RAIL-LM")!.status, "no-rate");
  const revised = await fixture(7400), second = buildFencingStockPlan(revised.request, revised.source, [settings(revised.request)]);
  library = syncBomPricedLines(library, { ...revised.source, lines: second.lines }).library;
  assert.equal(library.worksheet[0].quantity, "7"); assert.equal(pricedWorksheetTotals(library)[0].amount, "70.00");
  const changedProfile = buildFencingStockPlan(request, source, [settings(request, { profile: "Different grade" })]);
  assert.equal(syncBomPricedLines(library, { ...source, lines: changedProfile.lines }).library.worksheet.length, 0);
});
