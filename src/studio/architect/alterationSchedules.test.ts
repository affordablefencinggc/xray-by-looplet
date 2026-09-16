import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import {
  calculateDemolitionSchedule,
  calculateSalvageDisposalSchedule,
  calculateRepairSchedule,
  calculateAlterationMaterialSchedule,
  demolitionScheduleCsv,
  salvageDisposalScheduleCsv,
  repairScheduleCsv,
  alterationMaterialScheduleCsv,
} from "./alterationSchedules.ts";

function fixtureProject() {
  const p = emptyProject("alteration-schedules-test");
  // 1. Demolished wall
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
      id: "conc-layer", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: 2400, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-demolished",
    name: "Demolished Internal Wall",
    lifecycle: { status: "demolished", reference: "Survey Demolition D01" },
  });

  // 2. Retained existing wall with demolished opening (partial infill)
  const existingWall = {
    ...newWall(p, p.levels[0].id, [0, 2000], [5000, 2000], [{
      id: "brick-layer", name: "Clay Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 150, supplierReference: "SUP-02", rateRevision: "R1", wastePercent: 7,
    }]),
    id: "wall-existing",
    name: "Retained Boundary Wall",
    lifecycle: { status: "existing" as const, reference: "Survey Existing S01" },
  };
  p.walls.push(existingWall);

  p.openings.push({
    id: "door-partial", revision: 1, wallId: existingWall.id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Brief Door Removal" },
    demolitionDisposition: {
      kind: "partial-infill",
      reference: "Brief Partial Window Aperture",
      remainingVoid: { offset: 2000, width: 600, height: 1200, sill: 900 },
    },
  });

  // 3. Repaired wall (raised height from 2400 to 2700)
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 4000], [3000, 4000], [{
      id: "timber-layer", name: "Timber Stud", thickness: 90, kind: "solid", hatch: "timber",
      densityKgM3: 500, rateM2: 80, supplierReference: "SUP-03", rateRevision: "R1", wastePercent: 10,
    }]),
    id: "wall-repaired",
    name: "Repaired Party Wall",
    height: 2700,
    lifecycle: { status: "repaired", reference: "Structural Remediation R01" },
    repairBasis: { height: 2400, reference: "Survey Original 2400 Height" },
  });

  // 4. New wall
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 6000], [4000, 6000], [{
      id: "new-layer", name: "Plasterboard Clad Stud", thickness: 110, kind: "solid", hatch: "insulation",
      densityKgM3: null, // intentionally null to test density unknowns
      rateM2: 65, supplierReference: "SUP-04", rateRevision: "R1", wastePercent: 8,
    }]),
    id: "wall-new",
    name: "New Partition Wall",
    height: 2700,
    lifecycle: { status: "new", reference: "Brief New Partition N01" },
  });

  // 5. Demolished slab
  p.slabs.push({
    id: "slab-demo",
    revision: 1,
    levelId: p.levels[0].id,
    name: "Demolished Porch Slab",
    points: [[0, 0], [2000, 0], [2000, 2000], [0, 2000]],
    thickness: 100,
    offset: 0,
    material: "Concrete",
    lifecycle: { status: "demolished", reference: "Brief Demolish Porch" },
  });

  return p;
}

test("demolition schedule accurately quantifies demolished walls, openings, slabs, and notes unknowns", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Reviewed Survey / S01");
  const sched = calculateDemolitionSchedule(p, basis);

  assert.equal(sched.ready, true);
  assert.equal(sched.rows.length, 3); // 1 wall, 1 opening, 1 slab
  assert.ok(sched.totalDemolishedVolumeM3 > 0);
  assert.ok(sched.totalDemolishedAreaM2 > 0);

  // Check opening disposition
  const openingRow = sched.rows.find((r) => r.kind === "opening");
  assert.ok(openingRow);
  assert.match(openingRow.disposition, /partial-infill/);
  assert.match(openingRow.disposition, /600x1200 at sill 900/);

  // Check unknown conditions
  assert.ok(sched.unknowns.some((u) => u.includes("Hazardous materials")));
  assert.ok(sched.unknowns.some((u) => u.includes("Temporary structural shoring")));

  // Check CSV
  const csv = demolitionScheduleCsv(p, basis);
  assert.ok(csv.includes('"Project ID","Revision","Element ID"'));
  assert.ok(csv.includes("wall-demolished"));
  assert.ok(csv.includes("door-partial"));
  assert.ok(csv.includes("slab-demo"));
});

test("salvage and disposal schedule computes gross disposal volume via bulking factor and flags salvageability", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Reviewed Survey / S01");
  const sched = calculateSalvageDisposalSchedule(p, basis, {
    masonryBulkingFactor: 1.35,
    timberBulkingFactor: 1.25,
    defaultRouting: "recycling",
  });

  assert.equal(sched.ready, true);
  assert.ok(sched.rows.length >= 3);
  assert.ok(sched.totalGrossDisposalVolumeM3 > sched.totalNetVolumeM3);

  // Concrete layer from demolished wall has 1.35 bulking applied
  const concRow = sched.rows.find((r) => r.elementId === "wall-demolished");
  assert.ok(concRow);
  assert.equal(concRow.bulkingFactor, 1.35);
  assert.ok(Math.abs(concRow.grossDisposalVolumeM3! - concRow.netVolumeM3! * 1.35) < 1e-6);

  // Demolished door opening is flagged for architectural salvage
  const doorRow = sched.rows.find((r) => r.elementId === "door-partial");
  assert.ok(doorRow);
  assert.equal(doorRow.salvageable, true);
  assert.equal(doorRow.routing, "salvage");

  // Check CSV
  const csv = salvageDisposalScheduleCsv(p, basis, {
    masonryBulkingFactor: 1.35,
    timberBulkingFactor: 1.25,
    defaultRouting: "recycling",
  });
  assert.ok(csv.includes('"Material Name","Category","Net Volume m3","Bulking Factor"'));
  assert.ok(csv.includes("1.35"));
});

test("salvageable timber items (>0.5 m³) route to salvage rather than default recycling", () => {
  const p = fixtureProject();
  // Add a large timber wall (4m x 2.7m x 0.1m = 1.08 m3 > 0.5 m3)
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 1000], [4000, 1000], [{
      id: "timber-layer", name: "Hardwood Stud", thickness: 100, kind: "solid", hatch: "timber",
      densityKgM3: 600, rateM2: 90, supplierReference: "SUP-03", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-demo-timber",
    name: "Demolished Timber Partition",
    lifecycle: { status: "demolished", reference: "Survey Demolition D02" },
  });
  const validP = validateProject(p);
  const basis = createAlterationBasis(validP, "Reviewed Survey / S01");
  const sched = calculateSalvageDisposalSchedule(validP, basis, {
    masonryBulkingFactor: 1.3,
    timberBulkingFactor: 1.2,
    defaultRouting: "recycling",
  });

  const timberRow = sched.rows.find((r) => r.elementId === "wall-demo-timber");
  assert.ok(timberRow);
  assert.equal(timberRow.category, "timber");
  assert.equal(timberRow.salvageable, true);
  assert.equal(timberRow.routing, "salvage");
});


test("repair schedule calculates height extension volume and captures repair basis references", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Reviewed Survey / S01");
  const sched = calculateRepairSchedule(p, basis);

  assert.equal(sched.ready, true);
  const wallRow = sched.rows.find((r) => r.id === "wall-repaired");
  assert.ok(wallRow);
  assert.match(wallRow.notes, /Wall raised by 300 mm; extension repair/);
  assert.equal(wallRow.repairBasisReference, "Survey Original 2400 Height");

  // Delta volume: length 3.0m, thickness 0.09m, delta height 0.3m = 0.081 m3
  assert.ok(Math.abs(wallRow.deltaVolumeM3 - 0.081) < 1e-4);
  assert.ok(Math.abs(sched.totalRepairVolumeM3 - 0.081) < 1e-4);

  // Unknown conditions
  assert.ok(sched.unknowns.some((u) => u.includes("structural engineer")));

  // Check CSV
  const csv = repairScheduleCsv(p, basis);
  assert.ok(csv.includes('"Before Dimensions","Proposed Dimensions","Delta Volume m3"'));
  assert.ok(csv.includes("Survey Original 2400 Height"));
});

test("alteration material schedule quantifies new work and repair layers with explicit waste allowances", () => {
  const p = fixtureProject();
  const basis = createAlterationBasis(p, "Reviewed Survey / S01");
  const sched = calculateAlterationMaterialSchedule(p, basis);

  assert.equal(sched.ready, true);
  // New wall layer exists in schedule
  const newRow = sched.rows.find((r) => r.sourceElementId === "wall-new");
  assert.ok(newRow);
  assert.equal(newRow.wastePercent, 8);
  // Order area includes 8% waste: orderArea == netArea * 1.08
  assert.ok(Math.abs(newRow.orderAreaM2 - newRow.netAreaM2 * 1.08) < 1e-4);

  // Plasterboard density was null in fixture, so unknown was flagged
  assert.ok(sched.unknowns.some((u) => u.includes("unspecified density")));

  // Check CSV
  const csv = alterationMaterialScheduleCsv(p, basis);
  assert.ok(csv.includes('"Material ID","Source Element","Lifecycle"'));
  assert.ok(csv.includes("New Partition Wall"));
});

test("unreviewed or invalid basis returns non-ready schedules with blockers", () => {
  const p = fixtureProject();
  const demoSched = calculateDemolitionSchedule(p, null);
  assert.equal(demoSched.ready, false);
  assert.ok(demoSched.blockers.length > 0);

  const salvageSched = calculateSalvageDisposalSchedule(p, null);
  assert.equal(salvageSched.ready, false);

  const repairSched = calculateRepairSchedule(p, null);
  assert.equal(repairSched.ready, false);

  const matSched = calculateAlterationMaterialSchedule(p, null);
  assert.equal(matSched.ready, false);
});
