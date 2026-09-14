import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject, type ArchitectProject } from "./model.ts";
import { setElementLifecycle, setOpeningDemolitionDisposition, setWallRepairBasis, alterationSchedule, alterationScheduleCsv } from "./lifecycle.ts";
import { createAlterationBasis, resolveAlterationStage, type AlterationStage } from "./alterationStage.ts";
import { wallSolids } from "./geometry.ts";
import { primitives } from "./drawing.ts";
import { buildDesignedScene } from "./designedScene.ts";
import { exportIfc } from "./ifc.ts";

/** Independent analytic expectations, computed from the authored dimensions
 * rather than captured from resolver output.
 * Host wall 4000 x 2700 x 200 mm solid = 4.0 * 2.7 * 0.2 = 2.16 m3.
 * Door 900 x 2100 cut  = 0.9 * 2.1 * 0.2 = 0.378 m3 -> 1.782 m3 remaining.
 * Window 900 x 1200 cut = 0.9 * 1.2 * 0.2 = 0.216 m3 -> 1.944 m3 remaining.
 * Repair before height 2400 = 4.0 * 2.4 * 0.2 = 1.92 m3.
 */
const UNCUT = 2.16, DOOR_CUT = 0.378, WINDOW_CUT = 0.216, REPAIR_BEFORE = 1.92;

function host(): ArchitectProject {
  const p = emptyProject("infill-fixture");
  const wall = newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid", name: "Authored concrete", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }]);
  wall.lifecycle = { status: "existing", reference: "Survey A" };
  p.walls.push(wall);
  return p;
}
function withOpening(kind: "door" | "window", sill: number, height: number): ArchitectProject {
  const p = host();
  p.openings.push({
    id: "removed-fixture", revision: 1, wallId: p.walls[0].id, tag: "D01", kind,
    offset: 2000, width: 900, height, sill, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Remove fixture under brief A" },
  });
  return validateProject(p);
}
const infill = { kind: "infill" as const, reference: "Brief A: close aperture in existing wall" };
const retainVoid = { kind: "retain-void" as const, reference: "Brief A: keep aperture" };
const volume = (p: ArchitectProject) => wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function resolved(p: ArchitectProject, stage: AlterationStage, label = "Reviewed unchanged geometry") {
  const result = resolveAlterationStage(p, createAlterationBasis(p, label), stage);
  assert.equal(result.ready, true, JSON.stringify(result));
  if (!result.ready) throw Error("stage did not resolve");
  return result;
}

test("F2 explicit infill closes the door aperture using only the host wall's authored layers", () => {
  const source = withOpening("door", 0, 2100);
  const p = setOpeningDemolitionDisposition(source, "removed-fixture", infill);
  const original = structuredClone(p);
  const before = resolved(p, "before"), proposed = resolved(p, "proposed");

  // Before keeps the authored fixture and its exact cut.
  assert.equal(before.model.openings.length, 1);
  assert.equal(before.model.openings[0].kind, "door");
  close(volume(before.model), UNCUT - DOOR_CUT);

  // Proposed closes the hole: the opening is absent, not relabelled as a void.
  assert.deepEqual(proposed.model.openings, []);
  close(volume(proposed.model), UNCUT);
  close(volume(proposed.model) - volume(before.model), DOOR_CUT);
  assert.ok(proposed.excludedIds.includes("removed-fixture"));

  // Restored solid is the host's own authored layer stack, byte for byte.
  assert.equal(proposed.model.walls.length, 1);
  assert.deepEqual(proposed.model.walls[0].layers, source.walls[0].layers);
  assert.equal(proposed.model.walls[0].height, source.walls[0].height);
  assert.deepEqual(p, original);
});

test("F3 elevated window infill restores its own volume and preserves the authored sill in before", () => {
  const p = setOpeningDemolitionDisposition(withOpening("window", 900, 1200), "removed-fixture", infill);
  const before = resolved(p, "before"), proposed = resolved(p, "proposed");
  assert.equal(before.model.openings[0].sill, 900);
  assert.equal(before.model.openings[0].height, 1200);
  close(volume(before.model), UNCUT - WINDOW_CUT);
  close(volume(proposed.model), UNCUT);
  close(volume(proposed.model) - volume(before.model), WINDOW_CUT);
  // Sill/offset/height of the authored record are never rewritten by the disposition.
  assert.equal(p.openings[0].sill, 900);
  assert.equal(p.openings[0].offset, 2000);
});

test("infill is not a retained void in drawings, scene or IFC", () => {
  const p = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", infill);
  const proposed = resolved(p, "proposed").model;
  // No VOID label or aperture is produced anywhere by a closed aperture.
  assert.equal(primitives(proposed, p.levels[0].id, "plan").some(item => item.id === "removed-fixture"), false);
  for (const view of ["north", "south"] as const) {
    assert.equal(primitives(proposed, p.levels[0].id, view).some(item => typeof item.text === "string" && item.text.includes("VOID")), false);
  }
  const scene = buildDesignedScene(proposed);
  assert.equal(scene.summary.apertures, undefined);
  assert.equal(scene.summary.openings, 0);
  const ifc = exportIfc(proposed);
  assert.equal((ifc.match(/=IFCOPENINGELEMENT\(/g) ?? []).length, 0);
  assert.equal((ifc.match(/=IFCRELVOIDSELEMENT\(/g) ?? []).length, 0);
  assert.equal((ifc.match(/=IFCRELFILLSELEMENT\(/g) ?? []).length, 0);
});

test("F1 retain-void behaviour is unchanged beside the new infill member", () => {
  const p = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", retainVoid);
  const before = resolved(p, "before"), proposed = resolved(p, "proposed");
  assert.equal(proposed.model.openings[0].kind, "void");
  close(volume(before.model), UNCUT - DOOR_CUT);
  close(volume(proposed.model), UNCUT - DOOR_CUT);
  assert.equal(volume(proposed.model) - volume(before.model), 0);
});

test("F4 a demolished opening with no disposition still blocks both stages", () => {
  const p = withOpening("door", 0, 2100);
  for (const stage of ["before", "proposed"] as const) {
    const result = resolveAlterationStage(p, createAlterationBasis(p, "Review A"), stage);
    assert.equal(result.ready, false);
    assert.equal("model" in result, false);
    if (!result.ready) assert.ok(result.blockers.some(blocker => /retain-void or authored infill/.test(blocker.reason)));
  }
});

test("F5 a demolished host wall is never resurrected by an infill disposition", () => {
  const p = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", infill);
  p.walls[0].lifecycle!.status = "demolished";
  const proposed = resolved(p, "proposed");
  assert.deepEqual(proposed.model.walls, []);
  assert.deepEqual(proposed.model.openings, []);
  assert.equal(volume(proposed.model), 0);
});

test("infill rejects invalid references, wrong lifecycle and non-openings atomically", () => {
  const p = withOpening("door", 0, 2100), original = structuredClone(p);
  for (const value of [
    { kind: "infill", reference: " " },
    { kind: "infill", reference: "x".repeat(501) },
    { kind: "infill", reference: 42 },
    { kind: "infill" },
    { kind: "infill", reference: "ok", approved: true },
    { kind: "partial-infill", reference: "Not supported in this contract" },
  ]) {
    assert.throws(() => setOpeningDemolitionDisposition(p, "removed-fixture", value as typeof infill));
  }
  assert.throws(() => setOpeningDemolitionDisposition(p, "missing", infill));
  assert.throws(() => setOpeningDemolitionDisposition(p, p.walls[0].id, infill));
  for (const status of ["existing", "new", "repaired"] as const) {
    const changed = setElementLifecycle(p, "removed-fixture", { status, reference: "Brief B" });
    assert.throws(() => setOpeningDemolitionDisposition(changed, "removed-fixture", infill), /demolished/);
  }
  assert.deepEqual(p, original);
  const maximum = setOpeningDemolitionDisposition(p, "removed-fixture", { kind: "infill", reference: "x".repeat(500) });
  assert.equal(maximum.openings[0].demolitionDisposition?.reference.length, 500);
});

test("clearing or reclassifying removes the infill intent without deleting geometry", () => {
  const p = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", infill);
  assert.equal(setOpeningDemolitionDisposition(p, "removed-fixture", null).openings[0].demolitionDisposition, undefined);
  for (const lifecycle of [null, { status: "existing" as const, reference: "Keep fixture" }]) {
    const changed = setElementLifecycle(p, "removed-fixture", lifecycle);
    assert.equal(changed.openings[0].demolitionDisposition, undefined);
    assert.equal(changed.openings[0].kind, "door");
    assert.equal(changed.openings[0].width, 900);
  }
  assert.deepEqual(p.openings[0].demolitionDisposition, infill);
});

test("F6/F7 changed repair resolves independent before and proposed shapes", () => {
  const base = host();
  base.walls[0].lifecycle = { status: "repaired", reference: "Condition survey C01" };
  const unchanged = validateProject(structuredClone(base));

  // F6 no authored before state: repaired keeps identical geometry in both stages.
  close(volume(resolved(unchanged, "before").model), UNCUT);
  close(volume(resolved(unchanged, "proposed").model), UNCUT);

  // F7 authored before state: independent shapes, current geometry stays proposed.
  const changed = setWallRepairBasis(base, base.walls[0].id, { reference: "Survey C01: original 2400 head height", height: 2400 });
  const before = resolved(changed, "before"), proposed = resolved(changed, "proposed");
  assert.equal(before.model.walls[0].height, 2400);
  assert.equal(proposed.model.walls[0].height, 2700);
  close(volume(before.model), REPAIR_BEFORE);
  close(volume(proposed.model), UNCUT);
  close(volume(proposed.model) - volume(before.model), UNCUT - REPAIR_BEFORE);
  // The derived stage never leaks the authoring record, and the source is untouched.
  assert.equal("repairBasis" in before.model.walls[0], false);
  assert.equal(changed.walls[0].height, 2700);
  assert.deepEqual(changed.walls[0].repairBasis, { reference: "Survey C01: original 2400 head height", height: 2400 });
});

test("repair basis requires a repaired wall and is cleared by reclassification", () => {
  const p = host(), original = structuredClone(p);
  assert.throws(() => setWallRepairBasis(p, p.walls[0].id, { reference: "No repaired status", height: 2400 }), /repaired/);
  assert.throws(() => setWallRepairBasis(p, "missing", { reference: "Absent wall", height: 2400 }));
  const repaired = setElementLifecycle(p, p.walls[0].id, { status: "repaired", reference: "Survey C01" });
  for (const value of [
    { reference: " ", height: 2400 },
    { reference: "ok", height: 0 },
    { reference: "ok", height: -10 },
    { reference: "ok", height: Number.NaN },
    { reference: "ok" },
    { reference: "ok", height: 2400, approved: true },
  ]) {
    assert.throws(() => setWallRepairBasis(repaired, p.walls[0].id, value as { reference: string; height: number }));
  }
  const authored = setWallRepairBasis(repaired, p.walls[0].id, { reference: "Survey C01", height: 2400 });
  // Reclassifying away from repaired drops the now-meaningless before state.
  const demolished = setElementLifecycle(authored, p.walls[0].id, { status: "demolished", reference: "Brief D01" });
  assert.equal(demolished.walls[0].repairBasis, undefined);
  assert.equal(demolished.walls[0].height, 2700);
  assert.equal(setWallRepairBasis(authored, p.walls[0].id, null).walls[0].repairBasis, undefined);
  assert.deepEqual(p, original);
  // A hand-edited project cannot smuggle a before state onto an unrepaired wall.
  const smuggled = structuredClone(authored);
  smuggled.walls[0].lifecycle = { status: "existing", reference: "Survey A" };
  assert.throws(() => validateProject(smuggled), /classified as repaired/);
});

test("infill and repair outcomes are invariant under identity renaming and array order", () => {
  const volumes: number[] = [];
  for (const [wallId, openingId] of [["a-wall", "z-opening"], ["z-wall", "a-opening"]] as const) {
    const p = withOpening("door", 0, 2100);
    p.walls[0].id = wallId;
    p.openings[0].id = openingId;
    p.openings[0].wallId = wallId;
    const authored = setOpeningDemolitionDisposition(validateProject(p), openingId, infill);
    volumes.push(volume(resolved(authored, "proposed").model));
  }
  close(volumes[0], UNCUT);
  assert.equal(volumes[0], volumes[1]);
});

test("schedule and CSV carry explicit infill and changed-repair records", () => {
  const p = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", infill);
  const row = alterationSchedule(p).rows.find(item => item.id === "removed-fixture");
  assert.deepEqual(row?.demolitionDisposition, infill);
  const csv = alterationScheduleCsv(p);
  assert.ok(csv.includes("repairBasisReference"));
  assert.ok(csv.includes("infill"));
  assert.ok(csv.includes(infill.reference));

  const base = host();
  base.walls[0].lifecycle = { status: "repaired", reference: "Condition survey C01" };
  const repaired = setWallRepairBasis(validateProject(base), base.walls[0].id,
    { reference: "Survey C01: original 2400 head height", height: 2400 });
  const repairRow = alterationSchedule(repaired).rows.find(item => item.id === base.walls[0].id);
  assert.deepEqual(repairRow?.repairBasis, { reference: "Survey C01: original 2400 head height", height: 2400 });
  const repairCsv = alterationScheduleCsv(repaired);
  assert.ok(repairCsv.includes("Survey C01: original 2400 head height"));
  assert.ok(repairCsv.includes("2400"));
});

test("a saved project carrying only retain-void stays valid and readable", () => {
  // Backward compatibility: the pre-existing disposition shape is unchanged.
  const legacy = setOpeningDemolitionDisposition(withOpening("door", 0, 2100), "removed-fixture", retainVoid);
  const reparsed = validateProject(JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(reparsed.openings[0].demolitionDisposition, retainVoid);
  assert.equal("repairBasis" in reparsed.walls[0], false);
});
