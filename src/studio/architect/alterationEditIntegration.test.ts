import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, revise, type ArchitectProject } from "./model.ts";
import { prepareArchitectEdits } from "../assistant/architectBridge.ts";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage.ts";
import { wallSolids } from "./geometry.ts";

function fixture() {
  const p = emptyProject("alteration-edit-qa");
  const w = newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{ id: "solid", name: "QA solid", thickness: 200, kind: "solid", hatch: "concrete", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]);
  w.height = 2700; w.lifecycle = { status: "existing", reference: "QA survey" }; p.walls.push(w);
  p.openings.push({ id: "qa-window", revision: 1, wallId: w.id, tag: "W01", kind: "window", offset: 2000, width: 900, height: 1200, sill: 900, hinge: "left", swing: "in", lifecycle: { status: "demolished", reference: "QA demolition" } });
  return p;
}
function edit(p: ArchitectProject, operations: unknown[]) {
  return prepareArchitectEdits(p, { expectedJobId: p.id, expectedRevision: p.revision, operations });
}
test("assistant full infill preserves the authored elevated opening and resolves a closed proposed wall", () => {
  const p = fixture(), original = structuredClone(p);
  const operation = { kind: "set-opening-disposition", id: "qa-window", disposition: { kind: "infill", reference: "QA infill instruction" } };
  const next = revise(p, edit(p, [operation]).draft);
  assert.deepEqual(p, original);
  assert.equal(next.openings[0].sill, 900);
  assert.equal(next.openings[0].revision, 2);
  const basis = createAlterationBasis(next, "QA review");
  for (const [stage, expected] of [["before", 1.944], ["proposed", 2.16]] as const) {
    const r = resolveAlterationStage(next, basis, stage);
    if (!r.ready) throw Error(JSON.stringify(r.blockers));
    assert.ok(Math.abs(wallSolids(r.model).reduce((sum, solid) => sum + solid.volumeM3, 0) - expected) < 1e-9);
  }
  const cleared = edit(next, [{ ...operation, disposition: null }]).draft;
  assert.equal(cleared.openings[0].demolitionDisposition, undefined);
  assert.equal(resolveAlterationStage(cleared, basis, "proposed").ready, false);
  assert.throws(() => edit(p, [operation, { ...operation, id: "missing" }]));
  assert.deepEqual(p, original);
});
test("assistant before-repair height is explicit, edits independently and clears when status changes", () => {
  const p = fixture(); p.openings = [];
  const id = p.walls[0].id;
  const operation = { kind: "set-wall-repair-basis", id, basis: { heightMm: 2400, reference: "QA earlier height" } };
  assert.throws(() => edit(p, [operation]), /repaired/);
  const next = edit(p, [{ kind: "set-lifecycle", id, lifecycle: { status: "repaired", reference: "QA repair" } }, operation]).draft;
  assert.equal(next.walls[0].height, 2700);
  assert.deepEqual(next.walls[0].repairBasis, { height: 2400, reference: "QA earlier height" });
  const basis = createAlterationBasis(next, "QA review");
  for (const [stage, expected] of [["before", 1.92], ["proposed", 2.16]] as const) {
    const r = resolveAlterationStage(next, basis, stage);
    if (!r.ready) throw Error(JSON.stringify(r.blockers));
    assert.ok(Math.abs(wallSolids(r.model).reduce((sum, solid) => sum + solid.volumeM3, 0) - expected) < 1e-9);
  }
  const changed = edit(next, [{ ...operation, basis: { heightMm: 2500, reference: "QA correction" } }]).draft;
  assert.equal(changed.walls[0].repairBasis?.height, 2500);
  assert.equal(changed.walls[0].height, 2700);
  assert.equal(edit(next, [{ ...operation, basis: null }]).draft.walls[0].repairBasis, undefined);
  for (const lifecycle of [null, { status: "existing", reference: "QA retained" }]) {
    assert.equal(edit(next, [{ kind: "set-lifecycle", id, lifecycle }]).draft.walls[0].repairBasis, undefined);
  }
  for (const bad of [{ heightMm: 0, reference: "QA" }, { heightMm: 2400, reference: " " }, { heightMm: 2400, reference: "QA", approved: true }]) {
    assert.throws(() => edit(next, [{ ...operation, basis: bad }]));
  }
});
