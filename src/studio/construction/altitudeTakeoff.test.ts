import { test } from "node:test";
import assert from "node:assert/strict";
import { createAltitudeTakeoff, persistTakeoff, restoreTakeoff, rowQuantity, stockTotals, takeoffKey, takeoffSchema, updateTakeoffRow } from "./altitudeTakeoff.ts";

test("source floor ranges yield 252/209 entrance allowances and unknown windows/structure", () => {
  const value = createAltitudeTakeoff("job-a");
  assert.deepEqual(value.rows.map(rowQuantity), [252, 209, null, null, null]);
  assert.equal(stockTotals(value).knownVolumeM3, null);
  assert.equal(stockTotals(value).knownWeightKg, null);
});
test("pack count rounds up while specified weight uses actual items, with incomplete coverage", () => {
  const value = createAltitudeTakeoff("job-a");
  const row = { ...value.rows[0], stock: { unitsPerPackage: 10, lengthM: 2, widthM: 1, heightM: .5, unitWeightKg: 12, reference: "Test supplier - complete assembly per opening" } };
  const result = stockTotals(updateTakeoffRow(value, row));
  assert.equal(result.rows[0].packageCount, 26);
  assert.equal(result.knownVolumeM3, 26);
  assert.equal(result.knownWeightKg, 3024);
  assert.equal(result.volumeCoverage, 1);
  assert.equal(result.weightCoverage, 1);
  assert.equal(result.totalGroups, 5);
});
test("weight can be known independently of dimensions; unknown is distinct from explicit zero", () => {
  let value = createAltitudeTakeoff("job-a");
  value = updateTakeoffRow(value, { ...value.rows[1], stock: { ...value.rows[1].stock, unitWeightKg: 2, reference: "Specified" } });
  assert.equal(stockTotals(value).knownWeightKg, 418);
  assert.equal(stockTotals(value).knownVolumeM3, null);
  value = updateTakeoffRow(value, { ...value.rows[1], countPerFloor: 0, note: "Schedule says no separate supply" });
  assert.equal(stockTotals(value).knownWeightKg, 0);
});
test("changed quantities/specifications invalidate review and advance revisions", () => {
  let value = createAltitudeTakeoff("job-a");
  value = updateTakeoffRow(value, { ...value.rows[0], review: "reviewed", note: "Checked source" });
  assert.equal(value.rows[0].review, "reviewed");
  value = updateTakeoffRow(value, { ...value.rows[0], countPerFloor: 8 });
  assert.equal(value.rows[0].review, "pending");
  assert.equal(value.rows[0].revision, 3);
  assert.equal(value.revision, 3);
});
test("invalid counts, duplicate groups and undocumented stock inputs fail validation", () => {
  const value = createAltitudeTakeoff("job-a");
  assert.throws(() => updateTakeoffRow(value, { ...value.rows[2], countPerFloor: 50 }));
  assert.throws(() => updateTakeoffRow(value, { ...value.rows[0], countPerFloor: -1 }));
  assert.throws(() => updateTakeoffRow(value, { ...value.rows[0], stock: { ...value.rows[0].stock, unitWeightKg: 10 } }));
  assert.equal(takeoffSchema.safeParse({ ...value, rows: value.rows.map(() => value.rows[0]) }).success, false);
  assert.throws(() => updateTakeoffRow(value, { ...value.rows[2], review: "reviewed", note: "Still unknown" }));
});
function storage() {
  const data = new Map<string, string>();
  let rejected = false;
  return { data, reject() { rejected = true; }, allow() { rejected = false; },
    getItem(key: string) { return data.get(key) ?? null; }, setItem(key: string, value: string) { if (rejected) throw Error("Quota exceeded"); data.set(key, value); } };
}
test("save and restore preserve edits and isolate projects", () => {
  const db = storage(), session = restoreTakeoff(db, "job-a");
  const edited = updateTakeoffRow(session.value, { ...session.value.rows[0], note: "Source checked" });
  assert.equal(persistTakeoff(db, session, edited).error, null);
  assert.equal(restoreTakeoff(db, "job-a").value.rows[0].note, "Source checked");
  assert.equal(restoreTakeoff(db, "job-b").raw, null);
});
test("unreadable/future/foreign snapshots remain byte-identical under ordinary save", () => {
  for (const raw of ["{bad", JSON.stringify({ ...createAltitudeTakeoff("job-a"), schema: "xray.source-takeoff/v99" }), JSON.stringify(createAltitudeTakeoff("job-b"))]) {
    const db = storage(); db.data.set(takeoffKey("job-a"), raw);
    const session = restoreTakeoff(db, "job-a");
    assert.equal(session.blocked, true);
    assert.equal(persistTakeoff(db, session, createAltitudeTakeoff("job-a")).blocked, true);
    assert.equal(db.data.get(takeoffKey("job-a")), raw);
  }
});
test("concurrent edits block stale overwrites; failed writes preserve original and can retry", () => {
  const db = storage(), first = restoreTakeoff(db, "job-a"), stale = restoreTakeoff(db, "job-a");
  const saved = persistTakeoff(db, first, first.value);
  const raw = db.data.get(takeoffKey("job-a"));
  assert.equal(persistTakeoff(db, stale, stale.value).blocked, true);
  db.reject();
  const edited = updateTakeoffRow(saved.value, { ...saved.value.rows[0], note: "Pending write" });
  const failed = persistTakeoff(db, saved, edited);
  assert.match(failed.error!, /not saved/);
  assert.equal(db.data.get(takeoffKey("job-a")), raw);
  db.allow();
  assert.equal(persistTakeoff(db, failed, edited).error, null);
});
