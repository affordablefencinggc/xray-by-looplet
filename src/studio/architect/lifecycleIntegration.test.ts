import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareArchitectEdits } from "../assistant/architectBridge.ts";
import { demonstration, revise, type ArchitectProject } from "./model.ts";
import { issuableSheets, reviewIssueSet, assertIssueReviewCurrent } from "./issueSet.ts";
import { recordDrawingIssue } from "./issueHistory.ts";
import { extractProjectModel } from "./revisionDelta.ts";
import { exportDxf, importDxf } from "./exchange.ts";

const classification = { status: "existing" as const, reference: "Survey S01 / brief A02" };
const input = (p: ArchitectProject, operations: unknown[]) => ({ expectedJobId: p.id, expectedRevision: p.revision, operations });
const assign = (id: string, lifecycle: unknown = classification) => ({ kind: "set-lifecycle", id, lifecycle });

test("assistant lifecycle edits preserve geometry and independently classify physical entities", () => {
  const p = demonstration("lifecycle-integration"), before = JSON.stringify(p);
  const operations = ["walls", "openings", "slabs", "roofs"].map(key => {
    const collection = key as "walls" | "openings" | "slabs" | "roofs";
    return assign(p[collection][0].id);
  });
  const result = prepareArchitectEdits(p, input(p, operations));
  assert.equal(JSON.stringify(p), before);
  assert.equal(result.changed.length, 4);
  assert.equal(result.removed.length, 0);
  assert.ok(result.notices.every(notice => notice.includes("not verified survey evidence")));
  const stripped = structuredClone(result.draft);
  for (const collection of ["walls", "openings", "slabs", "roofs"] as const) {
    assert.deepEqual(stripped[collection][0].lifecycle, classification);
    delete stripped[collection][0].lifecycle;
  }
  assert.deepEqual(stripped, p);
  const committed = revise(p, result.draft);
  assert.equal(committed.revision, p.revision + 1);
  assert.equal(committed.walls[0].revision, p.walls[0].revision + 1);
  assert.equal(committed.walls[1].revision, p.walls[1].revision);
});

test("clearing lifecycle restores unassigned without removing the object or its hosted opening", () => {
  const p = demonstration("lifecycle-clear");
  p.walls[0].lifecycle = classification;
  const result = prepareArchitectEdits(p, input(p, [assign(p.walls[0].id, null)]));
  assert.equal(Object.hasOwn(result.draft.walls[0], "lifecycle"), false);
  assert.deepEqual(result.draft.openings, p.openings);
  assert.deepEqual(p.walls[0].lifecycle, classification);
  assert.match(result.notices[0], /unassigned/);
});

for (const binding of ["project", "revision"] as const) {
  test(`lifecycle edit refuses stale ${binding} binding atomically`, () => {
    const p = demonstration("lifecycle-bound"), before = JSON.stringify(p);
    const args = input(p, [assign(p.walls[0].id)]);
    if (binding === "project") args.expectedJobId = "another-project";
    else args.expectedRevision++;
    assert.throws(() => prepareArchitectEdits(p, args), /changed/);
    assert.equal(JSON.stringify(p), before);
  });
}

for (const invalid of [
  { label: "status", value: { status: "approved", reference: "S01" } },
  { label: "blank reference", value: { status: "new", reference: "   " } },
  { label: "oversized reference", value: { status: "new", reference: "x".repeat(501) } },
]) {
  test(`invalid lifecycle ${invalid.label} rejects the whole batch`, () => {
    const p = demonstration("lifecycle-invalid"), before = JSON.stringify(p);
    assert.throws(() => prepareArchitectEdits(p, input(p, [assign(p.walls[0].id), assign(p.walls[1].id, invalid.value)])));
    assert.equal(JSON.stringify(p), before);
  });
}

test("missing and nonphysical identities reject an earlier valid lifecycle operation atomically", () => {
  const p = demonstration("lifecycle-identity"), before = JSON.stringify(p);
  for (const id of ["missing-element", p.levels[0].id]) {
    assert.throws(() => prepareArchitectEdits(p, input(p, [assign(p.walls[0].id), assign(id)])), /existing wall, opening, slab or roof/);
    assert.equal(JSON.stringify(p), before);
  }
});

test("issue review invalidates on lifecycle-only change and issued classifications remain frozen", () => {
  const p = demonstration("lifecycle-issue");
  p.walls[0].lifecycle = classification;
  const review = reviewIssueSet(p, issuableSheets(p).map(sheet => sheet.id), "Alteration review");
  const recorded = recordDrawingIssue(p, review, new Date("2026-09-14T01:00:00Z"), () => "lifecycle-issue-a");
  const issueBytes = JSON.stringify(recorded.issues);
  const edited = prepareArchitectEdits(recorded, input(recorded, [assign(p.walls[0].id, { status: "demolished", reference: "Brief D01" })])).draft;
  assert.equal(JSON.stringify(edited.issues), issueBytes);
  const frozen = extractProjectModel(edited.issues![0]);
  assert.deepEqual(frozen.walls[0].lifecycle, classification);
  assert.equal(edited.walls[0].lifecycle?.status, "demolished");
  // Keep the model revision identical to prove metadata, rather than a revision number alone, invalidates review.
  const changed = prepareArchitectEdits(p, input(p, [assign(p.walls[0].id, null)])).draft;
  assert.equal(changed.revision, p.revision);
  assert.throws(() => assertIssueReviewCurrent(changed, review), /design changed/);
  assert.throws(() => recordDrawingIssue(changed, review, new Date()), /design changed/);
});

test("hash-bound parametric DXF roundtrip preserves lifecycle references and unassigned legacy elements", async () => {
  const p = demonstration("lifecycle-dxf");
  p.walls[0].lifecycle = classification;
  p.openings[0].lifecycle = { status: "repaired", reference: "Condition survey CS01" };
  p.slabs[0].lifecycle = { status: "new", reference: "Brief A02" };
  p.roofs[0].lifecycle = { status: "demolished", reference: "Brief D01" };
  const result = await importDxf(await exportDxf(p), p.id);
  assert.equal(result.parametric, true);
  assert.deepEqual(result.project, p);
  assert.equal(result.project.walls[1].lifecycle, undefined);
});
