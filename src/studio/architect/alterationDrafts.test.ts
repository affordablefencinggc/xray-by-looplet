import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { exportDxf, importDxf } from "./exchange.ts";
import { demonstration, revise, validateProject } from "./model.ts";
import { loadArchitect, saveArchitect, architectKey } from "./persistence.ts";
import { sha256Hex } from "./designedScene.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import {
  createAlterationDraft, appendAlterationDraft, retrieveAlterationDraft, removeAlterationDraft,
  exportSavedAlterationDraftPdf, alterationDraftRecordSchema, validateAlterationDrafts,
} from "./alterationDrafts.ts";

function fixture() {
  const p = demonstration("saved-stage-project");
  for (const element of [...p.walls, ...p.openings, ...p.slabs, ...p.roofs]) element.lifecycle = { status: "existing", reference: "Survey A" };
  p.notes = "Original current annotations";
  return p;
}
function record(p = fixture(), id = "draft-1") {
  return createAlterationDraft(p, createAlterationBasis(p, "Reviewed survey A"), "before", { levelId: p.levels[0].id, view: "plan" }, { id, savedAt: "2026-09-14T08:00:00.000Z" });
}

test("DXF keeps same-project drafts but excludes archives when importing into another project", async () => {
  const p = fixture(), saved = appendAlterationDraft(p, record(p));
  const dxf = await exportDxf(saved);
  const same = await importDxf(dxf, p.id);
  assert.deepEqual(same.project.alterationDrafts, saved.alterationDrafts);
  const other = await importDxf(dxf, "different-project");
  assert.equal(other.project.id, "different-project");
  assert.equal(other.project.alterationDrafts, undefined);
  assert.ok(other.warnings.some((warning) => warning.includes("original project")));
  assert.deepEqual(validateProject(other.project), other.project);
  assert.equal(saved.alterationDrafts?.length, 1);
});

test("saved draft freezes full annotations and geometry while excluding recursive histories", () => {
  const p = fixture();
  p.issues = [];
  const original = structuredClone(p), draft = record(p), next = appendAlterationDraft(p, draft);
  assert.deepEqual(p, original);
  const source = JSON.parse(draft.sourceJson);
  assert.equal(source.notes, p.notes); assert.deepEqual(source.section, p.section);
  assert.deepEqual(source.roomTags, p.roomTags); assert.deepEqual(source.sheet, p.sheet);
  assert.equal("issues" in source, false); assert.equal("alterationDrafts" in source, false);
  assert.equal(draft.sourceSha256, sha256Hex(draft.sourceJson));
  assert.equal(draft.issued, false); assert.equal(draft.quoteEligible, false);
  draft.basis.reference = "Caller changed its copy";
  assert.equal(next.alterationDrafts![0].basis.reference, "Reviewed survey A");
  const retrieved = retrieveAlterationDraft(next, "draft-1");
  retrieved.source.notes = "Mutated retrieved copy";
  retrieved.record.basis.reference = "Mutated record copy";
  assert.equal(retrieveAlterationDraft(next, "draft-1").source.notes, p.notes);
  assert.equal(next.alterationDrafts![0].basis.reference, "Reviewed survey A");
});

test("retrieval and PDF regeneration remain bound to frozen source after live geometry and annotation edits", async () => {
  const original = fixture();
  const saved = revise(original, appendAlterationDraft(original, record(original)));
  saved.name = "Live name changed"; saved.notes = "Live notes changed";
  saved.walls[0].height += 100; saved.section.a[1] += 100;
  saved.roomTags[0].name = "Live room label";
  const { source, record: frozen } = retrieveAlterationDraft(saved, "draft-1");
  assert.equal(source.name, original.name); assert.equal(source.notes, original.notes);
  assert.deepEqual(source.walls, original.walls); assert.deepEqual(source.section, original.section);
  assert.equal(frozen.projectRevision, original.revision);
  const pdf = await PDFDocument.load(await exportSavedAlterationDraftPdf(saved, "draft-1"));
  assert.ok(pdf.getTitle()?.includes(original.name));
  assert.equal(pdf.getTitle()?.includes(saved.name), false);
  assert.ok(pdf.getSubject()?.includes("model revision 1"));
});

test("append rejects stale source, duplicate identity and a sixth retained draft", () => {
  const p = fixture(), draft = record(p);
  p.notes = "Changed after review capture";
  assert.throws(() => appendAlterationDraft(p, draft), /changed/);
  let next = fixture();
  for (let i = 0; i < 5; i++) next = appendAlterationDraft(next, record(next, "draft-" + i));
  assert.equal(next.alterationDrafts?.length, 5);
  assert.throws(() => appendAlterationDraft(next, record(next, "sixth")), /Five/);
  const one = fixture(), withOne = appendAlterationDraft(one, record(one));
  assert.throws(() => appendAlterationDraft(withOne, record(withOne)), /already exists/);
});

test("strict record fields, byte/codeunit limits and timestamps reject invalid data", () => {
  const draft = record();
  for (const change of [
    { id: " " }, { savedAt: "yesterday" }, { issued: true }, { quoteEligible: true },
    { approved: true }, { sourceJson: "a".repeat(256001) }, { sourceJson: "漢".repeat(180000) },
  ]) assert.throws(() => alterationDraftRecordSchema.parse({ ...draft, ...change }));
  assert.throws(() => createAlterationDraft(fixture(), null, "before", { levelId: "absent", view: "plan" }, { id: "x", savedAt: draft.savedAt }), /basis/);
  const p = fixture();
  for (let i = 0; i < 3000; i++) p.lines.push({ id: `large-line-${i}-` + "x".repeat(60), revision: 1, levelId: p.levels[0].id, a: [i, 0], b: [i, 1000] });
  assert.throws(() => record(p), /too large/);
});

test("hash mismatch, metadata mismatch, stale frozen basis and nested history fail closed", () => {
  const p = fixture(), saved = appendAlterationDraft(p, record(p));
  for (const mutate of [
    (value: typeof saved) => { value.alterationDrafts![0].sourceSha256 = "0".repeat(64); },
    (value: typeof saved) => { value.alterationDrafts![0].projectRevision += 1; },
    (value: typeof saved) => { value.alterationDrafts![0].basis.fingerprint = "incorrect"; },
    (value: typeof saved) => {
      const draft = value.alterationDrafts![0], source = JSON.parse(draft.sourceJson);
      source.alterationDrafts = [];
      draft.sourceJson = JSON.stringify(source); draft.sourceSha256 = sha256Hex(draft.sourceJson);
    },
    (value: typeof saved) => {
      const draft = value.alterationDrafts![0], source = JSON.parse(draft.sourceJson);
      source.issues = [];
      draft.sourceJson = JSON.stringify(source); draft.sourceSha256 = sha256Hex(draft.sourceJson);
    },
  ]) {
    const bad = structuredClone(saved); mutate(bad);
    assert.throws(() => validateAlterationDrafts(bad));
    assert.throws(() => retrieveAlterationDraft(bad, "draft-1"));
    assert.throws(() => validateProject(bad));
  }
});

test("save/reload preserves frozen drafts, isolates projects and blocks corrupted bytes without overwriting", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const p = fixture(), saved = appendAlterationDraft(p, record(p));
  const result = saveArchitect(loadArchitect(p.id, storage), saved, storage);
  assert.equal(result.error, null);
  const loaded = loadArchitect(p.id, storage);
  assert.equal(loaded.blocked, false);
  assert.deepEqual(retrieveAlterationDraft(loaded.value, "draft-1"), retrieveAlterationDraft(saved, "draft-1"));
  const other = { ...saved, id: "other-project" };
  assert.throws(() => retrieveAlterationDraft(other, "draft-1"), /another project/);
  assert.equal(loadArchitect("other-project", storage).value.alterationDrafts, undefined);
  const corrupt = structuredClone(saved); corrupt.alterationDrafts![0].sourceSha256 = "f".repeat(64);
  const bytes = JSON.stringify(corrupt); storage.setItem(architectKey(p.id), bytes);
  const blocked = loadArchitect(p.id, storage);
  assert.equal(blocked.blocked, true); assert.equal(blocked.raw, bytes);
  assert.equal(saveArchitect(blocked, saved, storage).blocked, true);
  assert.equal(storage.getItem(architectKey(p.id)), bytes);
});

test("removal is pure and undo can restore the exact frozen record", () => {
  const p = fixture(), saved = appendAlterationDraft(p, record(p)), before = structuredClone(saved);
  const removed = removeAlterationDraft(saved, "draft-1");
  assert.deepEqual(saved, before); assert.deepEqual(removed.alterationDrafts, []);
  assert.equal(removed.revision, saved.revision);
  assert.throws(() => retrieveAlterationDraft(removed, "draft-1"), /no longer exists/);
  assert.throws(() => removeAlterationDraft(removed, "draft-1"), /no longer exists/);
  const restored = validateProject(before);
  assert.deepEqual(retrieveAlterationDraft(restored, "draft-1").record, before.alterationDrafts![0]);
});
