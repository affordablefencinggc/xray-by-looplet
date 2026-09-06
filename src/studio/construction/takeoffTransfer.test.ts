import { test } from "node:test";
import assert from "node:assert/strict";
import { createAltitudeTakeoff, restoreTakeoff, takeoffKey } from "./altitudeTakeoff.ts";
import { materialRegisterCsv, materialLineSchema, newMaterialLine } from "./materialRegister.ts";
import { applyTakeoffTransfer, materialCsvTemplate, parseCsv, parseMaterialCsv, parseTakeoffBackup, previewBackupRestore, previewMaterialImport, takeoffBackup, TRANSFER_LIMIT_BYTES } from "./takeoffTransfer.ts";

const line = (code = "A") => ({ ...newMaterialLine("id-" + code), stockCode: code, description: 'QA "part"', quantity: 23, unit: "each" as const, reference: "QA reference\nline 2" });
function fixture() {
  const value = { ...createAltitudeTakeoff("job-a"), materials: [line()] }, data = new Map([[takeoffKey(value.projectId), JSON.stringify(value)]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, text: string) => { data.set(key, text); } };
  return { value, data, storage, session: restoreTakeoff(storage, value.projectId) };
}
test("CSV parser handles BOM, CRLF, embedded commas/newlines and doubled quotes", () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"one,two","three\n""four"""\r\n'), [["a", "b"], ["one,two", 'three\n"four"']]);
  for (const csv of ['a\n"unfinished', 'a\nx"x', 'a\n"x"junk']) assert.throws(() => parseCsv(csv));
});
test("new exported CSV round-trips formula escapes and literal apostrophes losslessly", () => {
  const { value } = fixture();
  const lines = ["=sum(1)", "'literal", "'=literal", " plain"].map(code => materialLineSchema.parse({ ...line(code.trim()), description: "  +formula", reference: "'quoted reference\nline 2" }));
  const imported = parseMaterialCsv(materialRegisterCsv(lines, value));
  assert.deepEqual(imported.map(({ id: _id, ...v }) => v), lines.map(({ id: _id, ...v }) => v));
});
test("template, unknowns and all supported units import without inferring numbers", () => {
  const csv = materialCsvTemplate() + ["each", "m", "m²", "m³", "kg"].map((u, i) => `${i},QA,,${u},,,,,,,QA`).join("\n");
  const lines = parseMaterialCsv(csv); assert.deepEqual(lines.map(l => l.unit), ["each", "m", "m2", "m3", "kg"]);
  assert.ok(lines.every(l => l.quantity === null && l.specifiedWeightKg === null));
  assert.throws(() => parseMaterialCsv(materialCsvTemplate()), /at least one/);
});
test("CSV rejects duplicate codes/headers, unknown columns and other drawing identity", () => {
  const { value } = fixture();
  assert.throws(() => parseMaterialCsv(materialRegisterCsv([line("A"), line(" a ")], value)), /Duplicate/);
  assert.throws(() => parseMaterialCsv('Stock code,stock CODE\nA,B'), /duplicate column/);
  assert.throws(() => parseMaterialCsv('Stock code,price\nA,5'), /Unknown CSV column/);
  assert.throws(() => parseMaterialCsv(materialRegisterCsv([line()], { ...value, sourceSha256: "wrong" })), /another drawing/);
});
test("invalid CSV fails the entire import with record-specific errors", () => {
  const head = "Stock code,Description,Unit,Source reference,Stock quantity\n";
  for (const quantity of ["0x20", "Infinity", "23 kg", "-2", "1.5"]) assert.throws(() => parseMaterialCsv(head + `A,QA,each,QA,${quantity}`), /Record 1/);
  assert.throws(() => parseMaterialCsv(head + 'A,QA,each,QA,2\nB,QA,each,,2'), /Record 2/);
  assert.throws(() => parseMaterialCsv(head + 'A,QA,each,QA'), /Column count/);
  assert.throws(() => parseCsv("a".repeat(TRANSFER_LIMIT_BYTES + 1)), /5 MB/);
  assert.throws(() => parseCsv("a\n" + "x\n".repeat(5001)), /5,000/);
});
test("CSV additions preserve counts; explicit updates retain IDs and advance changed revisions", () => {
  const { session } = fixture();
  assert.throws(() => previewMaterialImport(session, [line()], false), /already exists/);
  const incoming = { ...line(), id: "new-id", quantity: 25 };
  const preview = previewMaterialImport(session, [incoming, line("B")], true);
  assert.equal(preview.value.materials[0].id, "id-A"); assert.equal(preview.value.materials[0].revision, 2);
  assert.deepEqual(preview.value.rows, session.value.rows); assert.deepEqual(preview.changes.map(c => c.action), ["Update", "Add"]);
  assert.equal(previewMaterialImport(session, [line()], true).changes[0].action, "Keep");
  const withPackaging = { ...session, value: { ...session.value, materials: [{ ...line(), lengthM: 2 }] } };
  const cleared = previewMaterialImport(withPackaging, [line()], true);
  assert.equal(cleared.value.materials[0].lengthM, null); assert.equal(cleared.value.materials[0].revision, 2);
});
test("a changed local session or stored snapshot cannot be overwritten by an old CSV preview", () => {
  const { session, storage, data } = fixture(); const preview = previewMaterialImport(session, [line("B")], false);
  assert.match(applyTakeoffTransfer(storage, { ...session, value: { ...session.value, revision: 9 } }, preview, "test").error!, /changed since preview/);
  data.set(takeoffKey(session.value.projectId), "newer saved bytes");
  const result = applyTakeoffTransfer(storage, session, preview, "test"); assert.equal(result.blocked, true); assert.equal(storage.getItem(takeoffKey(session.value.projectId)), "newer saved bytes");
});
test("backup roundtrip and legacy exports retain notes, counts, references and IDs", () => {
  const { value } = fixture(); value.rows[0].note = "Reviewed QA note"; value.rows[0].review = "reviewed";
  assert.deepEqual(parseTakeoffBackup(takeoffBackup(value)), value);
  assert.deepEqual(parseTakeoffBackup(JSON.stringify({ ...value, status: "Preliminary", groups: [], stock: {}, sourceDocument: "plan.pdf" })), value);
  const { materials: _materials, ...old } = value; const migrated = parseTakeoffBackup(JSON.stringify({ ...old, schema: "xray.source-takeoff/v1" }));
  assert.deepEqual(migrated.rows, value.rows); assert.deepEqual(migrated.materials, []);
  // Formatted backups can exceed the compact CSV limit without exceeding the backup limit.
  assert.deepEqual(parseTakeoffBackup(" ".repeat(TRANSFER_LIMIT_BYTES) + takeoffBackup(value)), value);
});
test("unsupported, foreign, extra or corrupt backup data is rejected", () => {
  const { value } = fixture();
  for (const invalid of [{ ...value, schema: "xray.source-takeoff/v99" }, { ...value, sourceSha256: "other" }, { ...value, unexpected: true }, { ...value, materials: [line(), line()] }]) assert.throws(() => parseTakeoffBackup(JSON.stringify(invalid)));
  assert.throws(() => parseTakeoffBackup("invalid json"));
});
test("restore preview remaps same-drawing project, resets review and shows removals", () => {
  const { session } = fixture(); const backup = createAltitudeTakeoff("other-project"); backup.rows[0].note = "reviewed"; backup.rows[0].review = "reviewed";
  const preview = previewBackupRestore(session, backup); assert.equal(preview.fromProject, "other-project"); assert.equal(preview.value.projectId, session.value.projectId);
  assert.equal(preview.value.rows[0].review, "pending"); assert.equal(preview.value.rows[0].note, "reviewed"); assert.equal(preview.changes[0].action, "Remove");
});
test("explicit backup restore archives unreadable saved bytes before releasing recovery lock", () => {
  const { storage, data, value } = fixture(); const key = takeoffKey(value.projectId), unreadable = '{"schema":"future"}'; data.set(key, unreadable);
  const session = restoreTakeoff(storage, value.projectId); assert.equal(session.blocked, true);
  assert.throws(() => previewMaterialImport(session, [line("B")], false), /Recover/);
  const result = applyTakeoffTransfer(storage, session, previewBackupRestore(session, value), "archive-1");
  assert.equal(result.blocked, false); assert.equal(result.error, null); assert.equal(storage.getItem(result.archiveKey!), unreadable);
  assert.equal(restoreTakeoff(storage, value.projectId).value.materials.length, 1);
});
test("archive write failure prevents restore, and primary write failure preserves saved bytes", () => {
  for (const failArchive of [true, false]) {
    const { session, storage, data, value } = fixture(), original = session.raw;
    const failing = { ...storage, setItem: (key: string, text: string) => { if (key.includes(":recovery:") === failArchive) throw Error("Quota failure"); data.set(key, text); } };
    const result = applyTakeoffTransfer(failing, session, previewBackupRestore(session, value), "archive-1");
    assert.match(result.error!, /Quota/); assert.equal(storage.getItem(takeoffKey(value.projectId)), original);
    if (!failArchive) assert.equal(storage.getItem(takeoffKey(value.projectId) + ":recovery:archive-1"), original);
  }
});
test("restore refuses changed saved bytes and existing recovery archive IDs", () => {
  const { session, storage, data, value } = fixture(); const preview = previewBackupRestore(session, value), key = takeoffKey(value.projectId);
  data.set(key + ":recovery:taken", "old archive"); assert.match(applyTakeoffTransfer(storage, session, preview, "taken").error!, /archive already exists/);
  data.set(key, "changed bytes"); assert.match(applyTakeoffTransfer(storage, session, preview, "fresh").error!, /changed since preview/); assert.equal(storage.getItem(key), "changed bytes");
});
