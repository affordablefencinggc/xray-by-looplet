import test from "node:test";
import assert from "node:assert/strict";
import {
  appendQsRateRevision, calculateQsCostPlan, canonicalQsJson, createQsRateBook,
  parseQsCostSnapshot, qsCostInputSchema, qsDecimalSchema, qsRateBookSchema,
  type QsCostInput, type QsCostSnapshot,
} from "./qsRateBook.ts";

const BOOK = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64), GEOMETRY = "b".repeat(64);
function fixture(): QsCostInput {
  return qsCostInputSchema.parse({
    format: "xray.qs-cost-input/v1", projectId: "project-1", revision: 1,
    createdAt: "2026-09-19T04:00:00Z", createdBy: "Estimator", currency: "AUD",
    priceBooks: { schema: "xray.price-books/v1", jobId: "project-1", revision: 1, worksheet: [], books: [{
      id: BOOK, name: "Confirmed supplier", archived: false, revisions: [{ revision: 1, importedAt: "2026-09-01T00:00:00Z",
        metadata: { supplier: "Supplier A", currency: "AUD", amountDecimals: 2, taxBasis: "exclusive", taxPercent: 10, effectiveDate: "2026-09-01", sourceReference: "Quotation A-001" },
        source: { fileName: "supplier.csv", sha256: HASH, sizeBytes: 100, delimiter: ",", headers: ["Code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } },
        rows: [{ sourceLine: 2, stockCode: "MAT", description: "Material", unit: "m", rate: 10 }, { sourceLine: 3, stockCode: "LAB", description: "Labour per measured metre", unit: "m", rate: 2 }],
      }],
    }] },
    rateBook: { format: "xray.qs-rate-book/v1", projectId: "project-1", revision: 1, rates: [{
      id: "wall-rate", revision: 1, description: "Measured wall", unit: "m",
      material: { bookId: BOOK, bookRevision: 1, sourceLine: 2 }, labour: { bookId: BOOK, bookRevision: 1, sourceLine: 3 },
      labourAssumption: "Supplier labour rate per measured metre, no productivity inference.", wastagePercent: "10", markupPercent: "20",
      createdAt: "2026-09-18T00:00:00Z", createdBy: "Estimator",
    }] },
    items: [{ itemId: "item-1", description: "Wall", quantity: "3", unit: "m", evidence: "unverified", rateId: "wall-rate", rateRevision: 1, optionId: null,
      binding: { format: "xray.qs-item-binding/v1", itemId: "item-1", projectId: "project-1", entityId: "wall-1", entityType: "wall-run",
        measuredQuantity: "3", unit: "m", entityGeometrySha256: GEOMETRY, sourceSha256: HASH, calibrationId: "cal-1", boundAt: "2026-09-18T00:00:00Z", boundBy: "Estimator" },
      entity: { entityId: "wall-1", entityType: "wall-run", geometrySha256: GEOMETRY, sourceSha256: HASH, calibrationId: "cal-1", unit: "m", measuredQuantity: "3" },
    }], options: [], activeOptionIds: [],
  });
}
function snapshot(input = fixture()): QsCostSnapshot {
  const result = calculateQsCostPlan(input);
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.blockers));
  if (!result.ok) throw Error("No snapshot");
  return result.snapshot;
}
function blocked(input: unknown, code?: string) {
  const result = calculateQsCostPlan(input); assert.equal(result.ok, false);
  if (result.ok) throw Error("Unexpected calculated price");
  if (code) assert.ok(result.blockers.some(value => value.code === code), JSON.stringify(result.blockers));
  assert.equal("snapshot" in result, false);
}
const metadata = (input: QsCostInput) => input.priceBooks.books[0].revisions[0].metadata;
const supplierRows = (input: QsCostInput) => input.priceBooks.books[0].revisions[0].rows;
function setQuantity(input: QsCostInput, quantity: string) {
  input.items[0].quantity = quantity;
  input.items[0].binding!.measuredQuantity = quantity;
  input.items[0].entity!.measuredQuantity = quantity;
}

test("SC10-01 material wastage, explicit labour, markup and GST reconcile in integer cents", () => {
  const value = snapshot();
  assert.deepEqual(value.baseTotal, { materialMinor: 3300, labourMinor: 600, markupMinor: 780, netMinor: 4680, taxMinor: 468, totalMinor: 5148 });
  assert.equal(value.items[0].adjustedMaterialQuantity, "3.3");
  assert.equal(value.items[0].quantity, "3");
  assert.equal(value.items[0].materialSource.sourceSha256, HASH);
  assert.equal(value.items[0].materialSource.sourceReference, "Quotation A-001");
  assert.equal(value.items[0].labourSource?.sourceLine, 3);
});
test("SC10-02 inclusive and exclusive supplier GST normalize to the same worked result", () => {
  const input = fixture(); metadata(input).taxBasis = "inclusive";
  supplierRows(input)[0].rate = 11; supplierRows(input)[1].rate = 2.2;
  assert.deepEqual(snapshot(input).baseTotal, snapshot().baseTotal);
});
test("SC10-03 half-up component extension and inclusive extraction preserve the declared gross cent", () => {
  const input = fixture(); setQuantity(input, "1");
  input.rateBook.rates[0].labour = null; input.rateBook.rates[0].wastagePercent = "0"; input.rateBook.rates[0].markupPercent = "0";
  metadata(input).taxBasis = "inclusive"; supplierRows(input)[0].rate = 0.05;
  assert.deepEqual(snapshot(input).baseTotal, { materialMinor: 5, labourMinor: 0, markupMinor: 0, netMinor: 5, taxMinor: 0, totalMinor: 5 });
  metadata(input).taxBasis = "exclusive"; metadata(input).taxPercent = 0; supplierRows(input)[0].rate = 0.005;
  assert.equal(snapshot(input).baseTotal.totalMinor, 1);
});
test("SC10-04 proposed and accepted alternatives never change the base tender", () => {
  const input = fixture(), item = structuredClone(input.items[0]);
  item.itemId = "option-item"; item.binding!.itemId = item.itemId; item.binding!.entityId = "option-wall"; item.entity!.entityId = "option-wall"; item.optionId = "upgrade";
  input.items.push(item); input.options.push({ id: "upgrade", label: "Alternative finish" });
  const proposed = snapshot(input);
  assert.equal(proposed.baseTotal.totalMinor, 5148); assert.equal(proposed.acceptedTotal.totalMinor, 5148);
  assert.equal(proposed.options[0].totals.totalMinor, 5148); assert.equal(proposed.items[1].included, false);
  input.activeOptionIds = ["upgrade"];
  const accepted = snapshot(input);
  assert.equal(accepted.baseTotal.totalMinor, 5148); assert.equal(accepted.acceptedTotal.totalMinor, 10296);
});
test("SC10-05 unknown/missing tax basis fails closed, while explicit zero tax remains zero", () => {
  const input = fixture(); metadata(input).taxBasis = "unspecified"; metadata(input).taxPercent = null; blocked(input, "tax");
  metadata(input).taxBasis = "exclusive"; blocked(input, "tax");
  metadata(input).taxPercent = 0; assert.equal(snapshot(input).baseTotal.taxMinor, 0);
});
test("SC10-06 currencies stay explicit and cannot silently mix or convert", () => {
  const input = fixture(); metadata(input).currency = "USD"; blocked(input, "currency");
  input.currency = "USD"; assert.equal(snapshot(input).baseTotal.totalMinor, 5148);
  metadata(input).amountDecimals = 3; blocked(input, "currency");
});
test("SC10-07 missing, archived, future and wrong-unit supplier pins withhold totals", () => {
  const missing = fixture(); missing.rateBook.rates[0].material.sourceLine = 77; blocked(missing, "source");
  const archived = fixture(); archived.priceBooks.books[0].archived = true; blocked(archived, "source");
  const future = fixture(); metadata(future).effectiveDate = "2026-09-20"; blocked(future, "future-rate");
  const incompatible = fixture(); supplierRows(incompatible)[1].unit = "h"; blocked(incompatible, "unit");
});
test("SC10-08 geometry edits, source replacements, missing entity and unbound quantities cannot price", () => {
  for (const mutate of [
    (input: QsCostInput) => { input.items[0].entity!.geometrySha256 = "c".repeat(64); },
    (input: QsCostInput) => { input.items[0].entity!.sourceSha256 = "d".repeat(64); },
    (input: QsCostInput) => { input.items[0].entity = null; },
    (input: QsCostInput) => { input.items[0].binding = null; },
    (input: QsCostInput) => { input.items[0].quantity = "4"; },
    (input: QsCostInput) => { input.items[0].entity!.entityType = "roof-plane"; },
    (input: QsCostInput) => { input.items[0].evidence = "sample"; },
    (input: QsCostInput) => { input.items[0].evidence = "inferred"; },
  ]) { const input = fixture(); mutate(input); blocked(input, "binding"); }
});
test("SC10-09 source-less and other-project bindings are rejected at the pricing boundary", () => {
  const noSource = fixture(); noSource.items[0].binding!.sourceSha256 = null; noSource.items[0].entity!.sourceSha256 = null; blocked(noSource, "binding");
  const other = fixture(); other.items[0].binding!.projectId = "other-project"; blocked(other, "binding");
});
test("SC10-10 decimal contract rejects exponents, signed values, floats and excess precision", () => {
  for (const value of ["1e3", "-0", "+1", "01", ".5", "NaN", "Infinity", "1.0000001", "1000000000000", 1.2]) assert.equal(qsDecimalSchema.safeParse(value).success, false);
  assert.equal(qsDecimalSchema.parse("18.500000"), "18.5");
  assert.equal(qsDecimalSchema.parse("0.000001"), "0.000001");
  const input = fixture(); input.rateBook.rates[0].markupPercent = "1001"; blocked(input, "invalid-input");
});
test("SC10-11 overflow fails closed instead of returning an unsafe amount", () => {
  const input = fixture(); setQuantity(input, "999999999999"); supplierRows(input)[0].rate = 1000000000;
  blocked(input, "overflow");
});
test("SC10-12 append preserves frozen history and rejects stale or replacement revisions", () => {
  const original = createQsRateBook(fixture().rateBook), serialized = canonicalQsJson(original);
  const revisedRate = { ...original.rates[0], revision: 2, markupPercent: "25" };
  const next = appendQsRateRevision(original, revisedRate, 1);
  assert.equal(next.revision, 2); assert.equal(next.rates[0].markupPercent, "20");
  assert.equal(canonicalQsJson(original), serialized);
  assert.ok(Object.isFrozen(next.rates[0].material));
  assert.throws(() => appendQsRateRevision(original, revisedRate, 0), /changed/);
  assert.throws(() => appendQsRateRevision(original, original.rates[0], 1), /historical/);
});
test("SC10-13 supplier revision pins remain historical until an explicit contractor revision selects the new source", () => {
  const input = fixture(), old = input.priceBooks.books[0].revisions[0];
  const next = structuredClone(old); next.revision = 2; next.rows[0].rate = 20;
  input.priceBooks.books[0].revisions.push(next); input.priceBooks.revision = 2;
  assert.equal(snapshot(input).baseTotal.totalMinor, 5148);
  const revision = { ...input.rateBook.rates[0], revision: 2, material: { bookId: BOOK, bookRevision: 2, sourceLine: 2 } };
  input.rateBook = appendQsRateRevision(input.rateBook, revision, 1); input.items[0].rateRevision = 2;
  const priced = snapshot(input); assert.equal(priced.baseTotal.totalMinor, 9504);
  assert.equal(priced.items[0].materialSource.bookRevision, 2);
});
test("SC10-14 strict input, unknown options and duplicate item identities cannot enter pricing", () => {
  const input = fixture(); blocked({ ...input, verified: true }, "invalid-input");
  blocked({ ...input, activeOptionIds: ["invented"] }, "invalid-input");
  blocked({ ...input, items: [...input.items, input.items[0]] }, "invalid-input");
  assert.equal(qsRateBookSchema.safeParse({ ...input.rateBook, rates: [{ ...input.rateBook.rates[0], material: { ...input.rateBook.rates[0].material, guessedRate: "1" } }] }).success, false);
});
test("SC10-15 snapshot is immutable, round-trips exactly, and rejects altered totals or unknown fields", () => {
  const value = snapshot(), bytes = canonicalQsJson(value);
  assert.equal(canonicalQsJson(parseQsCostSnapshot(JSON.parse(bytes))), bytes);
  assert.ok(Object.isFrozen(value.input.priceBooks.books[0].revisions[0].rows[0]));
  assert.throws(() => { value.baseTotal.totalMinor = 1; }, TypeError);
  const changed = JSON.parse(bytes); changed.items[0].totalMinor++;
  assert.throws(() => parseQsCostSnapshot(changed), /reconcile/);
  assert.throws(() => parseQsCostSnapshot({ ...value, issued: true }), /reconcile/);
});
test("SC10-16 deterministic supplier row order, canonical decimal input and zero amounts", () => {
  const a = fixture(), b = fixture(); supplierRows(b).reverse(); setQuantity(b, "3.000000");
  assert.equal(canonicalQsJson(snapshot(a)), canonicalQsJson(snapshot(b)));
  setQuantity(a, "0"); assert.deepEqual(snapshot(a).baseTotal, { materialMinor: 0, labourMinor: 0, markupMinor: 0, netMinor: 0, taxMinor: 0, totalMinor: 0 });
});
test("SC10-17 labour exclusion requires a declared assumption rather than a silent zero", () => {
  const input = fixture(); input.rateBook.rates[0].labour = null; input.rateBook.rates[0].labourAssumption = "";
  blocked(input, "invalid-input");
  input.rateBook.rates[0].labourAssumption = "Labour excluded from this supply-only allowance.";
  assert.equal(snapshot(input).baseTotal.labourMinor, 0);
});
test("SC10-18 a reviewed direct FX pair normalizes currency exactly and preserves both currency identities", () => {
  const input = fixture(); metadata(input).currency = "USD";
  input.fxRates = [{ id: "fx-usd-aud", revision: 1, fromCurrency: "USD", toCurrency: "AUD", rate: "1.5",
    sourceReference: "Estimator-reviewed conversion quotation FX-01", effectiveAt: "2026-09-18T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z", reviewedAt: "2026-09-18T01:00:00.000Z", reviewedBy: "Estimator" }];
  const value = snapshot(input);
  assert.deepEqual(value.baseTotal, { materialMinor: 4950, labourMinor: 900, markupMinor: 1170, netMinor: 7020, taxMinor: 702, totalMinor: 7722 });
  assert.equal(value.items[0].materialSource.currency, "USD"); assert.equal(value.items[0].materialSource.normalizedCurrency, "AUD");
  assert.equal(value.items[0].materialSource.exchangeRate?.sourceReference, "Estimator-reviewed conversion quotation FX-01");
});
test("SC10-19 future, expired, inverse-only and ambiguous FX records cannot normalize a rate", () => {
  const input = fixture(); metadata(input).currency = "USD";
  const fx = { id: "fx", revision: 1, fromCurrency: "USD" as const, toCurrency: "AUD" as const, rate: "1.5", sourceReference: "Reviewed FX-01",
    effectiveAt: "2026-09-18T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z", reviewedAt: "2026-09-18T01:00:00.000Z", reviewedBy: "Estimator" };
  input.fxRates = [{ ...fx, validUntil: input.createdAt }]; blocked(input, "currency");
  input.fxRates = [{ ...fx, effectiveAt: "2026-09-19T05:00:00.000Z" }]; blocked(input, "currency");
  input.fxRates = [{ ...fx, reviewedAt: "2026-09-19T05:00:00.000Z" }]; blocked(input, "currency");
  input.fxRates = [{ ...fx, fromCurrency: "AUD", toCurrency: "USD" }]; blocked(input, "currency");
  input.fxRates = [fx, { ...fx, id: "another" }]; blocked(input, "currency");
  input.fxRates = [{ ...fx, rate: "0" }]; blocked(input, "invalid-input");
});
test("SC10-20 exact FX conversion rounds only after extension, and explicit area aliases preserve measurement units", () => {
  const input = fixture(); setQuantity(input, "3"); input.rateBook.rates[0].labour = null; input.rateBook.rates[0].wastagePercent = "0"; input.rateBook.rates[0].markupPercent = "0";
  metadata(input).currency = "USD"; metadata(input).taxPercent = 0; supplierRows(input)[0].rate = 0.01;
  input.fxRates = [{ id: "fx", revision: 1, fromCurrency: "USD", toCurrency: "AUD", rate: "1.5", sourceReference: "Reviewed FX-01",
    effectiveAt: "2026-09-18T00:00:00.000Z", validUntil: null, reviewedAt: "2026-09-18T01:00:00.000Z", reviewedBy: "Estimator" }];
  assert.equal(snapshot(input).baseTotal.totalMinor, 5); // 3 × .01 × 1.5 = .045, not 3 × .02.
  input.items[0].unit = "m²"; input.items[0].binding!.unit = "m²"; input.items[0].entity!.unit = "m²";
  input.rateBook.rates[0].unit = "m2"; supplierRows(input)[0].unit = "m2";
  const value = snapshot(input); assert.equal(value.items[0].unit, "m²"); assert.equal(value.items[0].materialSource.unit, "m2"); assert.equal(value.baseTotal.totalMinor, 5);
});
test("SC10-21 effective/import instants accept equality across equivalent timestamp precision", () => {
  const input = fixture(); input.priceBooks.books[0].revisions[0].importedAt = "2026-09-19T04:00:00Z";
  assert.equal(snapshot(input).baseTotal.totalMinor, 5148);
});
