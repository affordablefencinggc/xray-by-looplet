import test from "node:test";
import assert from "node:assert/strict";
import { calculateQsCostPlan, canonicalQsJson, qsCostInputSchema, type QsCostInput, type QsCostSnapshot } from "./qsRateBook.ts";
import { compareQsCostPlans, subtractQsDecimal } from "./qsDeltaComparison.ts";

const BOOK = "11111111-1111-4111-8111-111111111111", HASH = "a".repeat(64), GEO = "b".repeat(64);
function fixture(): QsCostInput {
  return qsCostInputSchema.parse({ format: "xray.qs-cost-input/v1", projectId: "p", revision: 1,
    createdAt: "2026-09-19T04:00:00Z", createdBy: "Estimator", currency: "AUD",
    priceBooks: { schema: "xray.price-books/v1", jobId: "p", revision: 1, worksheet: [], books: [{ id: BOOK, name: "Supplier", archived: false, revisions: [{
      revision: 1, importedAt: "2026-09-01T00:00:00Z", metadata: { supplier: "Supplier", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 0, effectiveDate: "2026-09-01", sourceReference: "Offer 1" },
      source: { fileName: "rates.csv", sha256: HASH, sizeBytes: 40, delimiter: ",", headers: ["Description", "Unit", "Rate"], mapping: { stockCode: null, description: 0, unit: 1, rate: 2 } },
      rows: [{ sourceLine: 2, stockCode: "W", description: "Wall material", unit: "m", rate: 10 }],
    }] }] },
    rateBook: { format: "xray.qs-rate-book/v1", projectId: "p", revision: 1, rates: [{ id: "r", revision: 1, description: "Supply only", unit: "m",
      material: { bookId: BOOK, bookRevision: 1, sourceLine: 2 }, labour: null, labourAssumption: "Labour excluded from supplier's supply-only rate.", wastagePercent: "0", markupPercent: "0", createdAt: "2026-09-18T00:00:00Z", createdBy: "Estimator" }] },
    items: [{ itemId: "a", description: "Measured wall A", quantity: "3", unit: "m", evidence: "unverified", rateId: "r", rateRevision: 1, optionId: null,
      binding: { format: "xray.qs-item-binding/v1", itemId: "a", projectId: "p", entityId: "wall-a", entityType: "wall-run", measuredQuantity: "3", unit: "m", entityGeometrySha256: GEO, sourceSha256: HASH, calibrationId: "cal", boundAt: "2026-09-18T00:00:00Z", boundBy: "Estimator" },
      entity: { entityId: "wall-a", entityType: "wall-run", geometrySha256: GEO, sourceSha256: HASH, calibrationId: "cal", unit: "m", measuredQuantity: "3" },
    }], options: [], activeOptionIds: [],
  });
}
function snapshot(input: QsCostInput): QsCostSnapshot {
  const result = calculateQsCostPlan(input); assert.ok(result.ok, result.ok ? undefined : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("Blocked fixture"); return result.snapshot;
}
function quantity(input: QsCostInput, value: string, index = 0) {
  input.items[index].quantity = value; input.items[index].binding!.measuredQuantity = value; input.items[index].entity!.measuredQuantity = value;
}
function addItem(input: QsCostInput, id: string, value: string, optionId: string | null = null) {
  const item = structuredClone(input.items[0]); item.itemId = id; item.description = `Wall ${id}`; item.optionId = optionId;
  item.binding!.itemId = id; item.binding!.entityId = `wall-${id}`; item.entity!.entityId = `wall-${id}`;
  input.items.push(item); quantity(input, value, input.items.length - 1);
}
function setRate(input: QsCostInput, rate: number) {
  const book = input.priceBooks.books[0], source = structuredClone(book.revisions[book.revisions.length - 1]);
  source.revision++; source.rows[0].rate = rate; book.revisions.push(source); input.priceBooks.revision++;
  const prior = input.rateBook.rates[input.rateBook.rates.length - 1];
  input.rateBook.rates.push({ ...prior, revision: prior.revision + 1, material: { ...prior.material, bookRevision: source.revision } }); input.rateBook.revision++;
  for (const item of input.items) item.rateRevision = prior.revision + 1;
}

test("SC10-D01 quantity and rate deltas use an exact old-rate counterfactual", () => {
  const before = fixture(), after = fixture(); after.revision = 2; quantity(after, "5"); setRate(after, 12);
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.equal(delta.rows[0].quantityDelta, "2");
  assert.deepEqual(delta.totals, { quantityMinor: 2000, rateMinor: 1000, scopeMinor: 0, totalMinor: 3000 });
  assert.equal(delta.rows[0].status, "modified"); assert.equal(delta.baseDeltaMinor, 3000);
});
test("SC10-D02 added and removed scope is separate and rows have stable deterministic ordering", () => {
  const before = fixture(); addItem(before, "z-removed", "1");
  const after = fixture(); after.revision = 2; addItem(after, "b-new", "2"); after.items.reverse();
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.deepEqual(delta.rows.map(row => [row.itemId, row.status]), [["a", "unchanged"], ["b-new", "new"], ["z-removed", "removed"]]);
  assert.deepEqual(delta.totals, { quantityMinor: 0, rateMinor: 0, scopeMinor: 1000, totalMinor: 1000 });
  assert.equal(delta.rows[2].scopeMinor, -1000);
});
test("SC10-D03 an inactive proposal is visible but contributes zero accepted/base delta", () => {
  const before = fixture(), after = fixture(); after.revision = 2; after.options.push({ id: "opt", label: "Upgrade" }); addItem(after, "opt-row", "2", "opt");
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.equal(delta.totals.totalMinor, 0); assert.equal(delta.baseDeltaMinor, 0);
  assert.equal(delta.rows[1].proposalDeltaMinor, 2000); assert.equal(delta.rows[1].totalMinor, 0);
  assert.deepEqual(delta.options[0], { id: "opt", label: "Upgrade", beforeActive: false, afterActive: false, proposalDeltaMinor: 2000, acceptedDeltaMinor: 0 });
});
test("SC10-D04 activation is scope delta and leaves the base tender unchanged", () => {
  const before = fixture(); before.options.push({ id: "opt", label: "Upgrade" }); addItem(before, "opt-row", "2", "opt");
  const after = structuredClone(before); after.revision = 2; after.activeOptionIds = ["opt"];
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.deepEqual(delta.totals, { quantityMinor: 0, rateMinor: 0, scopeMinor: 2000, totalMinor: 2000 });
  assert.equal(delta.baseDeltaMinor, 0); assert.equal(delta.options[0].proposalDeltaMinor, 0); assert.equal(delta.options[0].acceptedDeltaMinor, 2000);
});
test("SC10-D05 removing acceptance reverses scope exactly, without erasing the proposal", () => {
  const before = fixture(); before.options.push({ id: "opt", label: "Upgrade" }); addItem(before, "opt-row", "2", "opt"); before.activeOptionIds = ["opt"];
  const after = structuredClone(before); after.revision = 2; after.activeOptionIds = [];
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.equal(delta.totals.scopeMinor, -2000); assert.equal(delta.rows[1].proposalDeltaMinor, 0);
});
test("SC10-D06 markup and tax changes are rate-policy effects with exact awkward-cent reconciliation", () => {
  const before = fixture(); quantity(before, "0.333333"); before.priceBooks.books[0].revisions[0].rows[0].rate = 0.05;
  const after = structuredClone(before); after.revision = 2; quantity(after, "1.000001"); setRate(after, 0.07);
  after.rateBook.rates[1].markupPercent = "17.5"; after.priceBooks.books[0].revisions[1].metadata.taxPercent = 10;
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  // Before 2 cents. Old rate/new quantity = 5 cents. New: 7 + 1 markup + 1 tax = 9.
  assert.deepEqual(delta.totals, { quantityMinor: 3, rateMinor: 4, scopeMinor: 0, totalMinor: 7 });
});
test("SC10-D07 reassigning an existing row to a proposal is a scope effect", () => {
  const before = fixture(), after = fixture(); after.revision = 2; after.options = [{ id: "opt", label: "Optional wall" }]; after.items[0].optionId = "opt";
  const delta = compareQsCostPlans(snapshot(before), snapshot(after));
  assert.equal(delta.totals.scopeMinor, -3000); assert.equal(delta.rows[0].proposalDeltaMinor, 0);
});
test("SC10-D08 incompatible project/currency/revision and corrupted snapshots are rejected", () => {
  const a = snapshot(fixture()), next = fixture(); next.revision = 2;
  assert.throws(() => compareQsCostPlans(a, a), /earlier/);
  next.currency = "USD"; next.priceBooks.books[0].revisions[0].metadata.currency = "USD";
  assert.throws(() => compareQsCostPlans(a, snapshot(next)), /currencies/);
  const corrupt = structuredClone(a); corrupt.items[0].totalMinor++;
  assert.throws(() => compareQsCostPlans(a, corrupt), /reconcile/);
  const other = fixture(); other.revision = 2; other.projectId = "other"; other.priceBooks.jobId = "other"; other.rateBook.projectId = "other"; other.items[0].binding!.projectId = "other";
  assert.throws(() => compareQsCostPlans(a, snapshot(other)), /projects/);
});
test("SC10-D09 reordering input does not affect comparison bytes; returned history is frozen", () => {
  const before = fixture(); addItem(before, "b", "2"); const after = structuredClone(before); after.revision = 2; quantity(after, "4");
  const a = compareQsCostPlans(snapshot(before), snapshot(after));
  after.items.reverse(); before.items.reverse();
  assert.equal(canonicalQsJson(a), canonicalQsJson(compareQsCostPlans(snapshot(before), snapshot(after))));
  assert.ok(Object.isFrozen(a.rows[0].before)); assert.ok(Object.isFrozen(a.totals));
});
test("SC10-D10 quantity subtraction preserves fractional precision and signed zero canonicalization", () => {
  assert.equal(subtractQsDecimal("1", "1.000000"), "0");
  assert.equal(subtractQsDecimal("0.000001", "1"), "-0.999999");
  assert.equal(subtractQsDecimal("999999999999.999999", "0.000001"), "999999999999.999998");
});
test("SC10-D11 historical supplier and contractor records cannot be rewritten under the same revision", () => {
  const before = fixture(), after = fixture(); after.revision = 2;
  after.priceBooks.books[0].revisions[0].rows[0].rate = 12;
  assert.throws(() => compareQsCostPlans(snapshot(before), snapshot(after)), /Supplier revision history/);
  const definition = fixture(); definition.revision = 2; definition.rateBook.rates[0].markupPercent = "20";
  assert.throws(() => compareQsCostPlans(snapshot(before), snapshot(definition)), /Contractor rate history/);
});
