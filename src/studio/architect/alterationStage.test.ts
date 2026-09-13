import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, type ArchitectProject } from "./model.ts";
import { wallSolids } from "./geometry.ts";
import { createAlterationBasis, resolveAlterationStage, type AlterationStage } from "./alterationStage.ts";

function single(): ArchitectProject {
  const p = emptyProject("stage-fixture");
  const wall = newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid-layer", name: "Explicit solid", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }]);
  wall.lifecycle = { status: "existing", reference: "Survey A" };
  p.walls.push(wall);
  return p;
}
function resolved(p: ArchitectProject, stage: AlterationStage) {
  const result = resolveAlterationStage(p, createAlterationBasis(p, "Survey A: existing geometry unchanged"), stage);
  assert.equal(result.ready, true);
  if (!result.ready) throw Error("Stage fixture did not resolve");
  return result;
}
const volume = (p: ArchitectProject) => wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("replacement wall is independently 2.16 m3 in each stage regardless of ID ordering", () => {
  for (const reverse of [false, true]) {
    const p = single();
    p.walls[0].id = reverse ? "z-demolished" : "a-demolished";
    p.walls[0].lifecycle!.status = "demolished";
    p.walls.push({ ...structuredClone(p.walls[0]), id: reverse ? "a-new" : "z-new", lifecycle: { status: "new", reference: "Brief A" } });
    const before = structuredClone(p);
    const existing = resolved(p, "before"), proposed = resolved(p, "proposed");
    close(volume(existing.model), 2.16); close(volume(proposed.model), 2.16);
    assert.deepEqual(existing.model.walls.map((wall) => wall.id), [p.walls[0].id]);
    assert.deepEqual(proposed.model.walls.map((wall) => wall.id), [p.walls[1].id]);
    assert.deepEqual(p, before);
  }
});

test("a new opening cuts retained geometry only in proposed, with geometric delta 0.378 m3", () => {
  const p = single();
  p.openings.push({ id: "new-door", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "new", reference: "Brief A" } });
  const before = volume(resolved(p, "before").model), after = volume(resolved(p, "proposed").model);
  close(before, 2.16); close(after, 1.782); close(before - after, 0.378);
});

test("basis requires a bounded reference and is exact across property and physical array ordering", () => {
  const p = single();
  for (const reference of ["", " \t", "x".repeat(501), undefined, 42]) {
    assert.throws(() => createAlterationBasis(p, reference as string));
  }
  const basis = createAlterationBasis(p, "  Review A  ");
  assert.equal(basis.reference, "Review A");
  const reordered = { ...p, walls: p.walls.map((wall) => Object.fromEntries(Object.entries(wall).reverse())) } as ArchitectProject;
  assert.equal(createAlterationBasis(reordered, "Other label").fingerprint, basis.fingerprint);
  p.notes = "Annotation only";
  assert.equal(resolveAlterationStage(p, basis, "before").ready, true);
  p.walls[0].height += 1;
  const stale = resolveAlterationStage(p, basis, "before");
  assert.equal(stale.ready, false);
  if (!stale.ready) assert.match(stale.blockers[0].reason, /stale/);
});

test("missing review and unassigned geometry return no partial model", () => {
  const p = single();
  delete p.walls[0].lifecycle;
  for (const basis of [null, createAlterationBasis(p, "Survey A")]) {
    for (const stage of ["before", "proposed"] as const) {
      const result = resolveAlterationStage(p, basis, stage);
      assert.equal(result.ready, false);
      assert.equal("model" in result, false);
      if (!result.ready) assert.ok(result.blockers.some((blocker) => blocker.elementId === p.walls[0].id));
    }
  }
});

test("opening disposition ambiguities and contradictory hosts block both stages", () => {
  for (const [wallStatus, openingStatus] of [["existing", "demolished"], ["repaired", "demolished"], ["demolished", "new"], ["new", "existing"], ["new", "repaired"], ["new", "demolished"]] as const) {
    const p = single();
    p.walls[0].lifecycle!.status = wallStatus;
    p.openings.push({ id: "door", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door",
      offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
      lifecycle: { status: openingStatus, reference: "Brief A" } });
    for (const stage of ["before", "proposed"] as const) {
      const result = resolveAlterationStage(p, createAlterationBasis(p, "Review A"), stage);
      assert.equal(result.ready, false);
      assert.equal("model" in result, false);
      if (!result.ready) assert.equal(result.blockers[0].elementId, "door");
    }
  }
});

test("demolished hosts remove dependent openings/dimensions and retain levels without input mutation", () => {
  const p = single();
  p.walls[0].lifecycle!.status = "demolished";
  p.openings.push({ id: "door", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "existing", reference: "Survey A" } });
  p.dimensions.push({ id: "dimension", revision: 1, wallId: p.walls[0].id, offset: 100 });
  const before = structuredClone(p), result = resolved(p, "proposed");
  assert.deepEqual(result.model.walls, []); assert.deepEqual(result.model.openings, []);
  assert.deepEqual(result.model.dimensions, []);
  assert.deepEqual(result.model.levels, p.levels);
  assert.deepEqual(new Set(result.excludedIds), new Set([p.walls[0].id, "door", "dimension"]));
  assert.deepEqual(p, before);
});

test("review binding rejects project substitution, lifecycle edits and changed repaired geometry", () => {
  const original = single();
  original.walls[0].lifecycle!.status = "repaired";
  const basis = createAlterationBasis(original, "Retained shape explicitly reviewed");
  close(volume(resolveReady(original, basis, "before")), 2.16);
  for (const mutate of [
    (p: ArchitectProject) => { p.id = "other"; },
    (p: ArchitectProject) => { p.walls[0].lifecycle!.status = "new"; },
    (p: ArchitectProject) => { p.walls[0].layers[0].thickness = 220; },
    (p: ArchitectProject) => { p.levels[0].elevation = 100; },
  ]) {
    const p = structuredClone(original); mutate(p);
    assert.equal(resolveAlterationStage(p, basis, "proposed").ready, false);
  }
  function resolveReady(p: ArchitectProject, review: ReturnType<typeof createAlterationBasis>, stage: AlterationStage) {
    const result = resolveAlterationStage(p, review, stage);
    assert.equal(result.ready, true);
    if (!result.ready) throw Error("Expected reviewed geometry");
    return result.model;
  }
});
