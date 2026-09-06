import { test } from "node:test";
import assert from "node:assert/strict";
import { materialLineSchema, materialLinesSchema, materialLineTotals, materialRegisterCsv, materialRegisterTotals, newMaterialLine, saveMaterialLine } from "./materialRegister.ts";
import { createAltitudeTakeoff, persistTakeoff, restoreTakeoff, takeoffKey, takeoffSchema, updateTakeoffRow } from "./altitudeTakeoff.ts";

function fixture() {
  return materialLineSchema.parse({ ...newMaterialLine("stock-one"), stockCode: "A-01", description: "QA synthetic material", quantity: 23,
    unitsPerPackage: 10, lengthM: 2, widthM: 1, heightM: .5, specifiedWeightKg: 4, reference: "QA fixture only" });
}
test("stock packages round up; unit weight differs from full-package weight", () => {
  const line = fixture();
  assert.deepEqual(materialLineTotals(line), { packageCount: 3, packageCapacityQuantity: 30, volumeM3: 3, weightKg: 92 });
  assert.equal(materialLineTotals({ ...line, weightBasis: "package", specifiedWeightKg: 50 }).weightKg, 150);
});
test("decimal bulk units avoid spurious extra packs while partial packs still round up", () => {
  const line = { ...fixture(), unit: "m3" as const, quantity: .28, unitsPerPackage: .01 };
  assert.equal(materialLineTotals(line).packageCount, 28);
  assert.equal(materialLineTotals({ ...line, quantity: .281 }).packageCount, 29);
});
test("empty and unknown material list cannot report a complete zero total", () => {
  assert.equal(materialRegisterTotals([]).knownVolumeM3, null);
  assert.equal(materialRegisterTotals([]).volumeComplete, false);
  const unknown = { ...fixture(), id: "unknown", stockCode: "B", quantity: null };
  const totals = materialRegisterTotals([fixture(), unknown]);
  assert.equal(totals.knownVolumeM3, 3);
  assert.equal(totals.volumeCoverage, 1);
  assert.equal(totals.volumeComplete, false);
  assert.equal(materialLineTotals({ ...fixture(), quantity: 0, lengthM: null, specifiedWeightKg: null }).weightKg, 0);
  assert.equal(materialLineTotals({ ...fixture(), quantity: 0, unitsPerPackage: null }).packageCount, 0);
});
test("weight can be specified without packing dimensions; package weights need capacity", () => {
  assert.equal(materialLineTotals({ ...fixture(), lengthM: null }).weightKg, 92);
  assert.equal(materialLineTotals({ ...fixture(), lengthM: null }).volumeM3, null);
  assert.equal(materialLineTotals({ ...fixture(), weightBasis: "package", unitsPerPackage: null }).weightKg, null);
});
test("a stock quantity specified in kg is already a weight; no density is inferred", () => {
  const line = { ...fixture(), unit: "kg" as const, quantity: 125, specifiedWeightKg: null };
  assert.equal(materialLineTotals(line).weightKg, 125);
  assert.equal(materialLineSchema.safeParse({ ...line, specifiedWeightKg: 2 }).success, false);
});
test("duplicate stock codes/IDs, invalid quantities and missing sources are rejected", () => {
  assert.equal(materialLinesSchema.safeParse([fixture(), { ...fixture(), id: "second", stockCode: " a-01 " }]).success, false);
  assert.equal(materialLinesSchema.safeParse([fixture(), { ...fixture(), stockCode: "other" }]).success, false);
  for (const patch of [{ quantity: -1 }, { quantity: 1.5 }, { unitsPerPackage: 0 }, { lengthM: Infinity }, { reference: " " }])
    assert.equal(materialLineSchema.safeParse({ ...fixture(), ...patch }).success, false);
});
test("edits advance revision and reject a stale material editor", () => {
  const next = saveMaterialLine([fixture()], { ...fixture(), quantity: 24 });
  assert.equal(next.length, 1); assert.equal(next[0].revision, 2);
  assert.throws(() => saveMaterialLine(next, { ...fixture(), quantity: 25 }), /changed since/);
});
test("CSV preserves quantities, escaping, unknown blanks and source identity without formulas", () => {
  const csv = materialRegisterCsv([{ ...fixture(), description: '=HYPERLINK("x")', reference: 'Sheet 1, line 2\nQA' }], { projectId: "job", sourceSha256: "source-hash" });
  assert.ok(csv.startsWith('\uFEFF"Stock code"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"Sheet 1, line 2\nQA"'));
  assert.ok(csv.includes('"3","30","3","4","unit","92"'));
  assert.ok(csv.includes('"job","source-hash"'));
});
test("validated v1 upgrade preserves existing rows/reviews/stock and does not write on restore", () => {
  let value = createAltitudeTakeoff("job");
  value = updateTakeoffRow(value, { ...value.rows[0], review: "reviewed", note: "Reviewed legacy count" });
  const { materials: _materials, ...base } = value;
  const legacy = { ...base, schema: "xray.source-takeoff/v1" };
  const raw = JSON.stringify(legacy), data = new Map([[takeoffKey("job"), raw]]);
  const db = { getItem(k: string) { return data.get(k) ?? null; }, setItem(k: string, v: string) { data.set(k, v); } };
  const session = restoreTakeoff(db, "job");
  assert.equal(session.blocked, false); assert.equal(session.value.schema, "xray.source-takeoff/v2");
  assert.deepEqual(session.value.rows, legacy.rows); assert.deepEqual(session.value.materials, []);
  assert.equal(data.get(takeoffKey("job")), raw);
  const saved = persistTakeoff(db, session, { ...session.value, materials: [fixture()] });
  assert.equal(saved.error, null);
  const reloaded = restoreTakeoff(db, "job");
  assert.deepEqual(reloaded.value.materials, [fixture()]); assert.deepEqual(reloaded.value.rows, legacy.rows);
});
test("malformed v1 and invalid v2 material collections fail closed", () => {
  const value = createAltitudeTakeoff("job"), { materials: _materials, ...base } = value;
  assert.equal(takeoffSchema.safeParse({ ...base, schema: "xray.source-takeoff/v1", unrecognisedData: "must not be discarded" }).success, false);
  assert.equal(takeoffSchema.safeParse({ ...value, materials: [fixture(), fixture()] }).success, false);
  assert.equal(takeoffSchema.safeParse({ ...value, schema: "xray.source-takeoff/v99" }).success, false);
});
