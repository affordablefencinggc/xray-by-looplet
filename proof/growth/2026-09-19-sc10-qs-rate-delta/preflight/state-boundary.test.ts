import test from "node:test";
import assert from "node:assert/strict";
import { calculateQsCostPlan, type QsCostSnapshot } from "../../../../src/studio/industries/quantity-surveying/qsRateBook.ts";
import {
  appendQsWorksheetSnapshot, createEmptyQsWorksheetState, qsWorksheetStateSchema,
} from "../../../../src/studio/industries/quantity-surveying/qsWorksheetState.ts";

function snapshot(revision = 1, projectId = "state-proof", quantity = "3"): QsCostSnapshot {
  const hash = "a".repeat(64), geometry = "b".repeat(64), bookId = "11111111-1111-4111-8111-111111111111";
  const result = calculateQsCostPlan({
    format: "xray.qs-cost-input/v1", projectId, revision, createdAt: "2026-09-19T04:00:00Z", createdBy: "State fixture", currency: "AUD", fxRates: [],
    priceBooks: { schema: "xray.price-books/v1", jobId: projectId, revision: 1, worksheet: [], books: [{
      id: bookId, name: "State fixture supplier", archived: false, revisions: [{ revision: 1, importedAt: "2026-09-01T00:00:00Z",
        metadata: { supplier: "Fixture supplier", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-01", sourceReference: "Explicit deterministic state fixture" },
        source: { fileName: "state-fixture.csv", sha256: hash, sizeBytes: 100, delimiter: ",", headers: ["Description", "Unit", "Rate"], mapping: { stockCode: null, description: 0, unit: 1, rate: 2 } },
        rows: [{ sourceLine: 2, stockCode: "", description: "Fixture material", unit: "m", rate: 10 }],
      }],
    }] },
    rateBook: { format: "xray.qs-rate-book/v1", projectId, revision: 1, rates: [{
      id: "fixture-rate", revision: 1, description: "Fixture supply only", unit: "m", material: { bookId, bookRevision: 1, sourceLine: 2 }, labour: null,
      labourAssumption: "Supply only; fixture labour explicitly excluded.", wastagePercent: "0", markupPercent: "0", createdAt: "2026-09-18T00:00:00Z", createdBy: "State fixture",
    }] },
    items: [{ itemId: "fixture-item", description: "Fixture measured row", quantity, unit: "m", evidence: "unverified", rateId: "fixture-rate", rateRevision: 1, optionId: null,
      binding: { format: "xray.qs-item-binding/v1", itemId: "fixture-item", projectId, entityId: "fixture-run", entityType: "wall-run", measuredQuantity: quantity, unit: "m", entityGeometrySha256: geometry, sourceSha256: hash, calibrationId: "fixture-calibration", boundAt: "2026-09-18T00:00:00Z", boundBy: "State fixture" },
      entity: { entityId: "fixture-run", entityType: "wall-run", geometrySha256: geometry, sourceSha256: hash, calibrationId: "fixture-calibration", unit: "m", measuredQuantity: quantity },
    }], options: [], activeOptionIds: [],
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("Invalid state fixture");
  return result.snapshot;
}
function configuredState(value = snapshot()) {
  return qsWorksheetStateSchema.parse({
    ...createEmptyQsWorksheetState(value.input.projectId),
    currency: value.input.currency, preparedBy: value.input.createdBy, rateBook: value.input.rateBook,
    fxRates: value.input.fxRates, options: value.input.options, activeOptionIds: value.input.activeOptionIds,
    assignments: value.items.map(item => ({ itemKey: `ui-${item.itemId}`, rateId: item.rate.id, rateRevision: item.rate.revision, optionId: item.optionId })),
  });
}
function reprice(input: QsCostSnapshot["input"]) {
  const result = calculateQsCostPlan(input);
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("Invalid regression fixture");
  return result.snapshot;
}

test("SC10-S01 empty worksheet roundtrip retains no rate pins, FX selections or priced history", () => {
  const state = createEmptyQsWorksheetState("state-proof");
  assert.deepEqual(qsWorksheetStateSchema.parse(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual([state.rateBook.rates.length, state.assignments.length, state.fxRates.length, state.snapshots.length], [0, 0, 0, 0]);
});
test("SC10-S02 append preserves exact prior snapshot bytes and freezes each saved source record", () => {
  const empty = configuredState();
  const first = appendQsWorksheetSnapshot(empty, snapshot());
  const original = JSON.stringify(first.snapshots[0]);
  const second = appendQsWorksheetSnapshot(first, snapshot(2, "state-proof", "5"));
  assert.equal(empty.snapshots.length, 0);
  assert.equal(first.snapshots.length, 1);
  assert.equal(second.snapshots.length, 2);
  assert.equal(JSON.stringify(second.snapshots[0]), original);
  assert.equal(second.snapshots[0].acceptedTotal.totalMinor, 3300);
  assert.equal(second.snapshots[1].acceptedTotal.totalMinor, 5500);
  assert.ok(Object.isFrozen(second.snapshots[0].input.priceBooks.books[0].revisions[0].rows[0]));
  assert.throws(() => { second.snapshots[0].acceptedTotal.totalMinor = 999; }, TypeError);
});
test("SC10-S03 append rejects another project and replacement/nonconsecutive revision", () => {
  const first = appendQsWorksheetSnapshot(configuredState(), snapshot());
  assert.throws(() => appendQsWorksheetSnapshot(first, snapshot()), /next cost revision/);
  assert.throws(() => appendQsWorksheetSnapshot(first, snapshot(3)), /next cost revision/);
  assert.throws(() => appendQsWorksheetSnapshot(first, snapshot(2, "other-project")), /another project/);
});
test("SC10-S04 saved monetary corruption and missing supplier provenance fail rehydration", () => {
  const state = appendQsWorksheetSnapshot(configuredState(), snapshot());
  const totals = structuredClone(state); totals.snapshots[0].acceptedTotal.totalMinor++;
  assert.equal(qsWorksheetStateSchema.safeParse(totals).success, false);
  const source = structuredClone(state); source.snapshots[0].input.priceBooks.books[0].revisions[0].rows[0].sourceLine = 77;
  assert.equal(qsWorksheetStateSchema.safeParse(source).success, false);
});
test("SC10-S05 draft assignment requires an existing exact rate revision and declared option", () => {
  const state = createEmptyQsWorksheetState("state-proof");
  assert.equal(qsWorksheetStateSchema.safeParse({ ...state, assignments: [{ itemKey: "row", rateId: "missing", rateRevision: 1, optionId: null }] }).success, false);
  assert.equal(qsWorksheetStateSchema.safeParse({ ...state, assignments: [{ itemKey: "row", rateId: null, rateRevision: null, optionId: "missing" }] }).success, false);
  assert.equal(qsWorksheetStateSchema.safeParse({ ...state, assignments: [{ itemKey: "row", rateId: null, rateRevision: 1, optionId: null }] }).success, false);
});
test("SC10-S06 persisted history rejects removed intermediate revisions and foreign project histories", () => {
  const state = appendQsWorksheetSnapshot(configuredState(), snapshot());
  assert.equal(qsWorksheetStateSchema.safeParse({ ...state, snapshots: [snapshot(2)] }).success, false);
  assert.equal(qsWorksheetStateSchema.safeParse({ ...state, snapshots: [snapshot(1, "other-project")] }).success, false);
});
test("SC10-S07 append cannot save a valid snapshot priced from a different current configuration", () => {
  const candidate = snapshot(), state = configuredState(candidate);
  const fx = { id: "fx-review", revision: 1, fromCurrency: "USD" as const, toCurrency: "AUD" as const, rate: "1.5", sourceReference: "Fixture reviewed conversion", effectiveAt: "2026-09-18T00:00:00Z", validUntil: null, reviewedAt: "2026-09-18T01:00:00Z", reviewedBy: "State fixture" };
  const alteredRateBook = structuredClone(state.rateBook);
  alteredRateBook.rates[0].markupPercent = "10";
  for (const changed of [
    { ...state, currency: "NZD" as const },
    { ...state, preparedBy: "Another preparer" },
    { ...state, rateBook: alteredRateBook },
    { ...state, options: [{ id: "option", label: "Another option" }] },
    { ...state, fxRates: [fx] },
  ]) assert.throws(() => appendQsWorksheetSnapshot(changed, candidate), undefined, "Different current pricing configuration must be rejected");
  const optionalInput = structuredClone(candidate.input); optionalInput.options = [{ id: "option", label: "Another option" }];
  const optional = reprice(optionalInput);
  assert.throws(() => appendQsWorksheetSnapshot({ ...configuredState(optional), activeOptionIds: ["option"] }, optional));
});
test("SC10-S08 append rejects changing contractor content under a historical identity and revision", () => {
  const first = appendQsWorksheetSnapshot(configuredState(), snapshot());
  const input = structuredClone(first.snapshots[0].input); input.revision = 2; input.rateBook.rates[0].markupPercent = "10";
  const candidate = reprice(input);
  const changed = { ...configuredState(candidate), snapshots: first.snapshots };
  assert.throws(() => appendQsWorksheetSnapshot(changed, candidate), undefined, "Reused rate revision cannot acquire different content");
});
test("SC10-S09 current catalog pruning may retain self-contained historical snapshots without reusing revision identities", () => {
  const first = appendQsWorksheetSnapshot(configuredState(), snapshot());
  const priorBytes = JSON.stringify(first.snapshots[0]);
  const input = structuredClone(first.snapshots[0].input); input.revision = 2;
  input.rateBook.rates[0].id = "new-rate-identity"; input.items[0].rateId = "new-rate-identity";
  const candidate = reprice(input);
  const next = appendQsWorksheetSnapshot({ ...configuredState(candidate), snapshots: first.snapshots }, candidate);
  assert.equal(JSON.stringify(next.snapshots[0]), priorBytes);
  assert.equal(next.rateBook.rates.length, 1);
  assert.equal(next.rateBook.rates[0].id, "new-rate-identity");
});
