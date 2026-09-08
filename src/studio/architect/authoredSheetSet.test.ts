import { test } from "node:test";
import assert from "node:assert/strict";
import { authoredSheets, changeAuthoredSheets, editActiveSheet, resizeSheetPaper, reviewAuthoredSheetArchive } from "./authoredSheetSet.ts";
import { demonstration, revise, validateProject } from "./model.ts";
import { architectKey, loadArchitect, saveArchitect } from "./persistence.ts";
import { exportDxf, importDxf } from "./exchange.ts";
import { exportDrawingPdf } from "./sheets.ts";
import { PDFDocument } from "pdf-lib";

function storage() {
  const map = new Map<string, string>();
  return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
}

test("legacy design read and validation preserve the old record and implicit layout", () => {
  const p = demonstration("sheet-test"), s = storage(), raw = JSON.stringify(p);
  s.setItem(architectKey(p.id), raw);
  assert.deepEqual(validateProject(p), p);
  const loaded = loadArchitect(p.id, s);
  assert.equal(loaded.raw, raw); assert.equal(loaded.value.sheetSet, undefined);
  assert.equal(authoredSheets(loaded.value).activeId, "legacy-sheet");
  assert.deepEqual(authoredSheets(loaded.value).sheets[0].layout, p.sheet);
  assert.equal(s.getItem(architectKey(p.id)), raw);
});

test("duplicate materializes the implicit viewport with fresh identity and independent layout", () => {
  const p = demonstration("sheet-test"), original = structuredClone(p);
  const q = changeAuthoredSheets(p, { type: "duplicate", sheetId: "legacy-sheet" });
  assert.equal(q.sheetSet!.sheets.length, 2);
  assert.notEqual(q.sheetSet!.activeId, "legacy-sheet");
  assert.notEqual(q.sheet.viewports[0].id, "default-plan");
  assert.deepEqual(q.sheetSet!.sheets[0].layout, p.sheet);
  const edited = editActiveSheet(q, layout => { layout.scale = "200"; layout.viewports[0].x = 42; layout.viewports[0].scale = "100"; });
  assert.equal(edited.sheet.scale, "200");
  assert.equal(q.sheet.scale, "50");
  assert.equal(edited.sheetSet!.sheets[0].layout.scale, "50");
  assert.deepEqual(p, original);
  const duplicate = changeAuthoredSheets(edited, { type: "duplicate", sheetId: edited.sheetSet!.activeId });
  assert.notEqual(duplicate.sheet.viewports[0].id, edited.sheet.viewports[0].id);
  assert.equal(duplicate.sheet.viewports[0].x, 42);
  assert.equal(duplicate.sheet.viewports[0].scale, "100");
});

test("save/reopen preserves selected sheet, names, ordering and per-viewport scales", () => {
  const s = storage(), initial = loadArchitect("sheet-test", s);
  let p = changeAuthoredSheets(initial.value, { type: "add" });
  const id = p.sheetSet!.activeId;
  p = changeAuthoredSheets(p, { type: "rename", sheetId: id, name: "Structural framing" });
  p = editActiveSheet(p, layout => { layout.scale = "100"; layout.viewports[0].scale = "200"; layout.northAngle = 27; });
  p = changeAuthoredSheets(p, { type: "move", sheetId: id, direction: -1 });
  const saved = saveArchitect(initial, revise(initial.value, p), s);
  assert.equal(saved.error, null);
  const loaded = loadArchitect(initial.value.id, s);
  assert.deepEqual(loaded.value, saved.value);
  assert.equal(loaded.value.sheetSet!.sheets[0].name, "Structural framing");
  assert.equal(loaded.value.sheetSet!.activeId, id);
  assert.equal(loaded.value.sheet.viewports[0].scale, "200");
});

test("archive and recover after reopening retain identity, original slot and complete layout", () => {
  const s = storage(), initial = loadArchitect("sheet-test", s);
  let p = changeAuthoredSheets(initial.value, { type: "add" });
  const id = p.sheetSet!.activeId;
  p = editActiveSheet(p, layout => { layout.number = "M-201"; layout.northAngle = 90; layout.viewports[0].view = "section"; });
  p = changeAuthoredSheets(p, { type: "add" });
  const before = structuredClone(p.sheetSet!.sheets[1]);
  p = changeAuthoredSheets(p, { type: "select", sheetId: id });
  p = changeAuthoredSheets(p, { type: "archive", review: reviewAuthoredSheetArchive(p, id) });
  assert.notEqual(p.sheetSet!.activeId, id);
  const saved = saveArchitect(initial, revise(initial.value, p), s);
  assert.equal(saved.error, null);
  const reopened = loadArchitect(initial.value.id, s);
  const restored = changeAuthoredSheets(reopened.value, { type: "recover", sheetId: id });
  assert.deepEqual(restored.sheetSet!.sheets[1], before);
  assert.deepEqual(restored.walls, p.walls);
  assert.deepEqual(restored.dimensions, p.dimensions);
  assert.deepEqual(restored.roomTags, p.roomTags);
  const persisted = saveArchitect(reopened, revise(reopened.value, restored), s);
  assert.equal(persisted.error, null);
  assert.deepEqual(loadArchitect(initial.value.id, s).value.sheetSet!.sheets[1], before);
});

test("archive rejects stale review even when a caller changes the design without incrementing revision", () => {
  const p = changeAuthoredSheets(demonstration("sheet-test"), { type: "add" });
  const review = reviewAuthoredSheetArchive(p, p.sheetSet!.activeId);
  const changed = structuredClone(p); changed.notes = "New coordination note";
  assert.throws(() => changeAuthoredSheets(changed, { type: "archive", review }), /changed after this review/);
  assert.equal(changed.sheetSet!.sheets.filter(sheet => sheet.archived).length, 0);
});

test("failed archive and recovery saves leave last saved layout and archive state intact; retry succeeds", () => {
  const s = storage(), initial = loadArchitect("sheet-test", s);
  const first = saveArchitect(initial, revise(initial.value, changeAuthoredSheets(initial.value, { type: "add" })), s);
  const id = first.value.sheetSet!.activeId;
  const archive = revise(first.value, changeAuthoredSheets(first.value, { type: "archive", review: reviewAuthoredSheetArchive(first.value, id) }));
  const denied = { getItem: s.getItem, setItem: () => { throw Error("Quota exceeded"); } };
  const failed = saveArchitect(first, archive, denied);
  assert.match(failed.error!, /Quota exceeded/); assert.equal(failed.raw, first.raw); assert.deepEqual(failed.value, first.value);
  const saved = saveArchitect(failed, archive, s); assert.equal(saved.error, null);
  const recovery = revise(saved.value, changeAuthoredSheets(saved.value, { type: "recover", sheetId: id }));
  const failedRecovery = saveArchitect(saved, recovery, denied);
  assert.equal(loadArchitect(initial.value.id, s).value.sheetSet!.sheets.find(sheet => sheet.id === id)!.archived, true);
  assert.equal(failedRecovery.raw, saved.raw);
  assert.equal(saveArchitect(failedRecovery, recovery, s).error, null);
  assert.equal(loadArchitect(initial.value.id, s).value.sheetSet!.sheets.find(sheet => sheet.id === id)!.archived, false);
});

test("stale session cannot archive over another window's renamed drawing sheet", () => {
  const s = storage(), initial = loadArchitect("sheet-test", s);
  const first = saveArchitect(initial, revise(initial.value, changeAuthoredSheets(initial.value, { type: "add" })), s);
  const other = loadArchitect(initial.value.id, s), id = first.value.sheetSet!.activeId;
  const archive = changeAuthoredSheets(first.value, { type: "archive", review: reviewAuthoredSheetArchive(first.value, id) });
  const rename = saveArchitect(other, revise(other.value, changeAuthoredSheets(other.value, { type: "rename", sheetId: id, name: "Electrical coordination" })), s);
  const rejected = saveArchitect(first, revise(first.value, archive), s);
  assert.equal(rejected.blocked, true);
  assert.equal(s.getItem(architectKey(initial.value.id)), rename.raw);
});

test("invalid active projection, identities and archived viewport references block restore without overwriting bytes", () => {
  const p = changeAuthoredSheets(demonstration("sheet-test"), { type: "add" });
  const malformed = [
    (q: typeof p) => { q.sheet.scale = "200"; },
    (q: typeof p) => { q.sheetSet!.activeId = "missing"; },
    (q: typeof p) => { q.sheetSet!.sheets[1].archived = true; },
    (q: typeof p) => { q.sheetSet!.sheets[0].id = q.sheetSet!.sheets[1].id; },
    (q: typeof p) => { q.sheetSet!.sheets[0].archived = true; q.sheetSet!.sheets[0].layout.viewports = [{ ...q.sheet.viewports[0], id: "archive-viewport", levelId: "missing-level" }]; },
    (q: typeof p) => { q.sheetSet!.sheets[0].layout.viewports = structuredClone(q.sheet.viewports); },
  ];
  for (const mutate of malformed) {
    const q = structuredClone(p); mutate(q);
    const raw = JSON.stringify(q), s = storage(); s.setItem(architectKey(q.id), raw);
    assert.throws(() => validateProject(q));
    assert.equal(loadArchitect(q.id, s).blocked, true);
    assert.equal(s.getItem(architectKey(q.id)), raw);
  }
});

test("keep one active sheet, refuse invalid names and skip archived positions when ordering", () => {
  const p = demonstration("sheet-test");
  assert.throws(() => reviewAuthoredSheetArchive(p, "legacy-sheet"), /at least one/);
  let q = changeAuthoredSheets(p, { type: "add" }); const archived = q.sheetSet!.activeId;
  q = changeAuthoredSheets(q, { type: "archive", review: reviewAuthoredSheetArchive(q, archived) });
  q = changeAuthoredSheets(q, { type: "add" }); const last = q.sheetSet!.activeId;
  q = changeAuthoredSheets(q, { type: "move", sheetId: last, direction: -1 });
  assert.deepEqual(q.sheetSet!.sheets.map(sheet => sheet.id), [last, archived, "legacy-sheet"]);
  assert.throws(() => changeAuthoredSheets(q, { type: "select", sheetId: archived }), /Recover/);
  assert.throws(() => changeAuthoredSheets(q, { type: "rename", sheetId: last, name: " " }));
  assert.throws(() => changeAuthoredSheets(q, { type: "rename", sheetId: last, name: "x".repeat(121) }));
});

test("paper resizing fits frames exactly, retains identities and scales and survives reopening", () => {
  const s = storage(), initial = loadArchitect("sheet-test", s);
  let p = changeAuthoredSheets(initial.value, { type: "add" });
  p = editActiveSheet(p, layout => { layout.size = "A1"; layout.viewports[0].x = 500; layout.viewports[0].y = 400; layout.viewports[0].width = 800; layout.viewports[0].height = 500; layout.viewports[0].scale = "200"; });
  const before = structuredClone(p.sheet), id = before.viewports[0].id;
  p = editActiveSheet(p, layout => Object.assign(layout, resizeSheetPaper(layout, "A3")));
  assert.deepEqual(p.sheet.viewports[0], { ...before.viewports[0], x: 8, y: 8, width: 404, height: 245 });
  assert.equal(before.viewports[0].width, 800);
  const saved = saveArchitect(initial, revise(initial.value, p), s);
  assert.equal(saved.error, null);
  const reopened = loadArchitect(initial.value.id, s);
  assert.equal(reopened.value.sheet.viewports[0].id, id);
  assert.equal(reopened.value.sheet.viewports[0].scale, "200");
  assert.deepEqual(reopened.value.sheet, p.sheet);
});

test("parametric DXF preserves all sheets and active PDF exports the selected layout", async () => {
  let p = changeAuthoredSheets(demonstration("sheet-test"), { type: "add" });
  p = editActiveSheet(p, layout => { layout.number = "C-220"; layout.size = "A1"; layout.viewports[0].scale = "200"; });
  const restored = await importDxf(await exportDxf(p), p.id);
  assert.deepEqual(restored.project, p);
  const pdf = await PDFDocument.load(await exportDrawingPdf(p));
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), p.name + " / C-220");
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 841 * 72 / 25.4) < 0.001);
});
