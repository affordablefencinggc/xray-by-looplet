import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject, type ArchitectProject } from "./model.ts";
import { setOpeningDemolitionDisposition, alterationSchedule, alterationScheduleCsv } from "./lifecycle.ts";
import { createAlterationBasis, resolveAlterationStage, type AlterationStage } from "./alterationStage.ts";
import { wallSolids } from "./geometry.ts";
import { primitives } from "./drawing.ts";
import { buildDesignedScene } from "./designedScene.ts";
import { exportIfc } from "./ifc.ts";

/** Independent analytic expectations:
 * Host wall: 4000 x 2700 x 200 mm solid = 4.0 * 2.7 * 0.2 = 2.16 m3.
 * Full door: 900 x 2100 cut = 0.9 * 2.1 * 0.2 = 0.378 m3 -> wall volume 1.782 m3.
 * Partial infill: remaining void 900 x 1200 at sill 900 = 0.9 * 1.2 * 0.2 = 0.216 m3 -> wall volume 1.944 m3.
 * Delta restored: 0.378 - 0.216 = 0.162 m3.
 */
const UNCUT = 2.16;
const FULL_DOOR_CUT = 0.378;
const PARTIAL_VOID_CUT = 0.216;
const RESTORED_DELTA = 0.162;

function host(): ArchitectProject {
  const p = emptyProject("partial-infill-test");
  const wall = newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid", name: "Solid masonry", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }]);
  wall.lifecycle = { status: "existing", reference: "Existing survey E1" };
  p.walls.push(wall);
  return p;
}

function withDemolishedDoor(): ArchitectProject {
  const p = host();
  p.openings.push({
    id: "door-d01", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Demolition brief D1" },
  });
  return validateProject(p);
}

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

const volume = (p: ArchitectProject) =>
  wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);

function resolved(p: ArchitectProject, stage: AlterationStage, label = "Reviewed unchanged geometry") {
  const result = resolveAlterationStage(p, createAlterationBasis(p, label), stage);
  assert.equal(result.ready, true, JSON.stringify(result));
  if (!result.ready) throw Error("stage did not resolve");
  return result;
}

test("analytic volume: partial infill of door to window-height void restores exact solid difference", () => {
  const source = withDemolishedDoor();
  const partialDisposition = {
    kind: "partial-infill" as const,
    reference: "Architect brief: reduce door to 900x1200 window aperture at sill 900",
    remainingVoid: { offset: 2000, width: 900, height: 1200, sill: 900 },
  };
  const p = setOpeningDemolitionDisposition(source, "door-d01", partialDisposition);
  const before = resolved(p, "before");
  const proposed = resolved(p, "proposed");

  // Before stage: complete door fixture present with full cut
  assert.equal(before.model.openings.length, 1);
  assert.equal(before.model.openings[0].kind, "door");
  assert.equal(before.model.openings[0].height, 2100);
  assert.equal(before.model.openings[0].sill, 0);
  close(volume(before.model), UNCUT - FULL_DOOR_CUT);

  // Proposed stage: door replaced by void of remaining dimensions; wall layers close the lower portion
  assert.equal(proposed.model.openings.length, 1);
  assert.equal(proposed.model.openings[0].kind, "void");
  assert.equal(proposed.model.openings[0].offset, 2000);
  assert.equal(proposed.model.openings[0].width, 900);
  assert.equal(proposed.model.openings[0].height, 1200);
  assert.equal(proposed.model.openings[0].sill, 900);
  assert.equal(proposed.model.openings[0].demolitionDisposition, undefined);
  close(volume(proposed.model), UNCUT - PARTIAL_VOID_CUT);

  // Exact net infill volume restored across stages
  close(volume(proposed.model) - volume(before.model), RESTORED_DELTA);
});

test("out-of-bounds remaining void boundaries are strictly rejected by project validation", () => {
  const source = withDemolishedDoor();
  const base = {
    kind: "partial-infill" as const,
    reference: "Ref",
    remainingVoid: { offset: 2000, width: 900, height: 1200, sill: 900 },
  };

  // Valid boundary fits exactly
  assert.doesNotThrow(() => setOpeningDemolitionDisposition(source, "door-d01", base));

  // Excess width: 950 mm > 900 mm opening
  assert.throws(
    () => setOpeningDemolitionDisposition(source, "door-d01", {
      ...base,
      remainingVoid: { offset: 2000, width: 950, height: 1200, sill: 900 },
    }),
    /Partial infill remaining void must fit within the opening/
  );

  // Offset shifts void outside horizontal boundary
  assert.throws(
    () => setOpeningDemolitionDisposition(source, "door-d01", {
      ...base,
      remainingVoid: { offset: 2100, width: 900, height: 1200, sill: 900 },
    }),
    /Partial infill remaining void must fit within the opening/
  );

  // Negative sill
  assert.throws(
    () => setOpeningDemolitionDisposition(source, "door-d01", {
      ...base,
      remainingVoid: { offset: 2000, width: 900, height: 1200, sill: -10 },
    })
  );

  // Height + sill exceeds top of opening: 900 + 1300 = 2200 > 2100
  assert.throws(
    () => setOpeningDemolitionDisposition(source, "door-d01", {
      ...base,
      remainingVoid: { offset: 2000, width: 900, height: 1300, sill: 900 },
    }),
    /Partial infill remaining void must fit within the opening/
  );
});

test("replacement openings: mutually exclusive lifecycle openings overlap is permitted, concurrent is rejected", () => {
  const p = host();
  // Demolished door at offset 2000, width 900, height 2100, sill 0 with infill disposition
  p.openings.push({
    id: "demolished-door", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Remove old door" },
    demolitionDisposition: { kind: "infill", reference: "Replaced by new window" },
  });
  // New replacement window at the exact same offset 2000, width 900, height 1200, sill 900
  p.openings.push({
    id: "new-window", revision: 1, wallId: p.walls[0].id, tag: "W01", kind: "window",
    offset: 2000, width: 900, height: 1200, sill: 900, hinge: "left", swing: "in",
    lifecycle: { status: "new", reference: "Install new high-performance window" },
  });

  // validateProject must permit non-concurrent replacement (demolished vs new)
  assert.doesNotThrow(() => validateProject(p));

  // Before stage: only demolished door exists, new window is excluded
  const basis = createAlterationBasis(p, "Review replacement");
  const before = resolveAlterationStage(p, basis, "before");
  assert.equal(before.ready, true);
  if (!before.ready) throw Error("before not ready");
  assert.equal(before.model.openings.length, 1);
  assert.equal(before.model.openings[0].id, "demolished-door");

  // Proposed stage: only new window exists, demolished door is excluded
  const proposed = resolveAlterationStage(p, basis, "proposed");
  assert.equal(proposed.ready, true);
  if (!proposed.ready) throw Error("proposed not ready");
  assert.equal(proposed.model.openings.length, 1);
  assert.equal(proposed.model.openings[0].id, "new-window");

  // CONCURRENT overlaps must be strictly rejected:
  // 1. Two new openings overlapping
  const concurrentNew = structuredClone(p);
  concurrentNew.openings[0].lifecycle = { status: "new", reference: "Concurrent 1" };
  delete concurrentNew.openings[0].demolitionDisposition;
  assert.throws(() => validateProject(concurrentNew), /Hosted openings overlap/);

  // 2. Existing and new overlapping
  const concurrentExisting = structuredClone(p);
  concurrentExisting.openings[0].lifecycle = { status: "existing", reference: "Existing 1" };
  delete concurrentExisting.openings[0].demolitionDisposition;
  assert.throws(() => validateProject(concurrentExisting), /Hosted openings overlap/);

  // 3. Two demolished openings overlapping
  const concurrentDemolished = structuredClone(p);
  concurrentDemolished.openings[1].lifecycle = { status: "demolished", reference: "Demolished 2" };
  concurrentDemolished.openings[1].demolitionDisposition = { kind: "infill", reference: "Infill 2" };
  assert.throws(() => validateProject(concurrentDemolished), /Hosted openings overlap/);
});

test("drawings, 3D scene, and IFC export correctly represent the resolved partial infill void", () => {
  const source = withDemolishedDoor();
  const p = setOpeningDemolitionDisposition(source, "door-d01", {
    kind: "partial-infill",
    reference: "Reduce door to void",
    remainingVoid: { offset: 2000, width: 900, height: 1200, sill: 900 },
  });
  const propModel = resolved(p, "proposed").model;

  // 2D primitives: plan has void opening, south elevation labels VOID
  const planItems = primitives(propModel, p.levels[0].id, "plan");
  assert.ok(planItems.some((item) => item.id === "door-d01"));
  const southItems = primitives(propModel, p.levels[0].id, "south");
  assert.ok(southItems.some((item) => typeof item.text === "string" && item.text.includes("VOID")));

  // 3D scene summary records aperture for the void
  const scene = buildDesignedScene(propModel);
  assert.equal(scene.summary.openings, 0);
  assert.equal(scene.summary.apertures, 1);

  // IFC export includes IFCOPENINGELEMENT for the remaining void
  const ifc = exportIfc(propModel);
  assert.ok(ifc.includes("IFCOPENINGELEMENT"));
});

test("alteration schedule and CSV export include partial-infill with 14-column spreadsheet layout", () => {
  const source = withDemolishedDoor();
  const p = setOpeningDemolitionDisposition(source, "door-d01", {
    kind: "partial-infill",
    reference: "Brief partial infill reference",
    remainingVoid: { offset: 2000, width: 900, height: 1200, sill: 900 },
  });

  const schedule = alterationSchedule(p);
  const row = schedule.rows.find((r) => r.id === "door-d01");
  assert.ok(row);
  assert.equal(row.demolitionDisposition?.kind, "partial-infill");
  if (row.demolitionDisposition?.kind === "partial-infill") {
    assert.deepEqual(row.demolitionDisposition.remainingVoid, { offset: 2000, width: 900, height: 1200, sill: 900 });
  }

  const csv = alterationScheduleCsv(p);
  const lines = csv.trim().split("\r\n");
  const headers = lines[0].split(",");
  assert.equal(headers.length, 14);
  assert.equal(headers[10], '"demolitionDisposition"');

  const doorLine = lines.find((l) => l.includes('"door-d01"'));
  assert.ok(doorLine);
  assert.ok(doorLine.includes('"partial-infill"'));
  assert.ok(doorLine.includes('"Brief partial infill reference"'));
});
