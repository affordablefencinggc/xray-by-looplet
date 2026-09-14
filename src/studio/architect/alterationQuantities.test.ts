import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, type ArchitectProject } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import { calculateAlterationQuantities } from "./alterationQuantities.ts";

function single() {
  const p = emptyProject("quantity-stages");
  p.walls.push({ ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }]), id: "first", lifecycle: { status: "existing", reference: "Survey S01" } });
  return p;
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function report(p: ArchitectProject) {
  const result = calculateAlterationQuantities(p, createAlterationBasis(p, "Reviewed unchanged geometry / S01"));
  assert.equal(result.ready, true, JSON.stringify(result));
  if (!result.ready) throw Error("Expected ready fixture");
  assert.equal(result.quoteEligible, false);
  return result;
}
function newDoor(p: ArchitectProject) {
  p.openings.push({ id: "opening", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door", offset: 2000,
    width: 900, height: 2100, sill: 0, hinge: "left", swing: "in", lifecycle: { status: "new", reference: "Brief D01" } });
}

test("coincident replacement has 2.16 m3 in each stage and zero geometry delta", () => {
  const p = single();
  p.walls[0].lifecycle!.status = "demolished";
  p.walls.push({ ...structuredClone(p.walls[0]), id: "replacement", lifecycle: { status: "new", reference: "Brief N01" } });
  const bytes = JSON.stringify(p), result = report(p);
  close(result.beforeWallSolidVolumeM3, 2.16); close(result.proposedWallSolidVolumeM3, 2.16); close(result.deltaWallSolidVolumeM3, 0);
  assert.equal(JSON.stringify(p), bytes);
  assert.match(result.notes.join(" "), /not a demolition/);
});

test("new opening yields signed geometry delta without treating it as disposal", () => {
  const p = single(); newDoor(p);
  const result = report(p);
  close(result.beforeWallSolidVolumeM3, 2.16); close(result.proposedWallSolidVolumeM3, 1.782); close(result.deltaWallSolidVolumeM3, -0.378);
});

test("unequal-height crossing walls with a host-only opening give ID-invariant exact union totals", () => {
  const p = single();
  p.walls.push({ ...structuredClone(p.walls[0]), id: "second", a: [2000, -2000], b: [2000, 2000], height: 2000 });
  newDoor(p);
  const first = report(p);
  close(first.beforeWallSolidVolumeM3, 3.68); close(first.proposedWallSolidVolumeM3, 3.382); close(first.deltaWallSolidVolumeM3, -0.298);
  p.walls[0].id = "z-first"; p.walls[1].id = "a-second"; p.openings[0].wallId = "z-first"; p.walls.reverse();
  const reordered = report(p);
  close(reordered.beforeWallSolidVolumeM3, first.beforeWallSolidVolumeM3);
  close(reordered.proposedWallSolidVolumeM3, first.proposedWallSolidVolumeM3);
});

test("solid over another wall's void is retained independently of wall ownership ordering", () => {
  const p = single();
  const mixed = { ...structuredClone(p.walls[0]), id: "a-mixed" };
  mixed.layers = [{ ...mixed.layers[0], thickness: 100 }, { ...mixed.layers[0], id: "void", kind: "void", thickness: 100 }];
  p.walls.push(mixed);
  close(report(p).beforeWallSolidVolumeM3, 2.16);
  p.walls[0].id = "a-solid"; p.walls[1].id = "z-mixed";
  close(report(p).beforeWallSolidVolumeM3, 2.16);
});

test("overlapping absolute elevations count common solid geometry once across levels", () => {
  const p = single();
  p.levels.push({ id: "upper", name: "Upper", elevation: 1000, height: 2700 });
  p.walls.push({ ...structuredClone(p.walls[0]), id: "upper-wall", levelId: "upper" });
  close(report(p).beforeWallSolidVolumeM3, 2.96);
});

test("empty stages return finite zero totals", () => {
  const result = report(emptyProject("empty-stages"));
  close(result.beforeWallSolidVolumeM3, 0); close(result.proposedWallSolidVolumeM3, 0); close(result.deltaWallSolidVolumeM3, 0);
});

test("unknown assembly contents and unresolved classifications expose blockers without numbers", () => {
  for (const variant of ["assembly", "unassigned", "missing-basis", "stale-basis"] as const) {
    const p = single(), basis = createAlterationBasis(p, "S01");
    if (variant === "assembly") p.walls[0].layers[0].kind = "assembly";
    if (variant === "unassigned") delete p.walls[0].lifecycle;
    if (variant === "stale-basis") p.walls[0].height += 100;
    const reviewed = variant === "missing-basis" ? null : variant === "stale-basis" ? basis : createAlterationBasis(p, "S01");
    const result = calculateAlterationQuantities(p, reviewed);
    assert.equal(result.ready, false, variant); assert.equal(result.quoteEligible, false);
    assert.equal("beforeWallSolidVolumeM3" in result, false);
    if (!result.ready) assert.ok(result.blockers.length);
  }
});

test("sub-tolerance height bands block instead of silently missing an opening cut", () => {
  const p = single(); newDoor(p); p.openings[0].height = 0.001;
  const result = calculateAlterationQuantities(p, createAlterationBasis(p, "S01"));
  assert.equal(result.ready, false);
  if (!result.ready) assert.match(result.blockers[0].reason, /opening-cut tolerance/);
});

test("excessive layer-band work is refused without a partial total", () => {
  const p = single();
  p.walls = Array.from({ length: 320 }, (_, i) => ({ ...structuredClone(p.walls[0]), id: `wall-${i}`, height: 1000 + i * 2 }));
  const result = calculateAlterationQuantities(p, createAlterationBasis(p, "S01"));
  assert.equal(result.ready, false);
  if (!result.ready) assert.match(result.blockers[0].reason, /calculation limit/);
});
