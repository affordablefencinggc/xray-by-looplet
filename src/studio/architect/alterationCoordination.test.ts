import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import {
  calculateStageOpeningSchedule,
  calculateStageRoomSchedule,
  verifyAnnotationCoordination,
  stageOpeningScheduleCsv,
  stageRoomScheduleCsv,
} from "./alterationCoordination.ts";

function fixtureCoordinationProject() {
  const p = emptyProject("alteration-coordination-test");
  const levelId = p.levels[0].id;

  // External envelope 8000 x 6000
  // Wall 1: South [0, 0] -> [8000, 0]
  p.walls.push({
    ...newWall(p, levelId, [0, 0], [8000, 0], [{
      id: "w1-layer", name: "Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-south",
    name: "South External Wall",
    lifecycle: { status: "existing" as const, reference: "Survey S01" },
  });

  // Wall 2: North [0, 6000] -> [8000, 6000]
  p.walls.push({
    ...newWall(p, levelId, [0, 6000], [8000, 6000], [{
      id: "w2-layer", name: "Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-north",
    name: "North External Wall",
    lifecycle: { status: "existing" as const, reference: "Survey S01" },
  });

  // Wall 3: West [0, 0] -> [0, 6000]
  p.walls.push({
    ...newWall(p, levelId, [0, 0], [0, 6000], [{
      id: "w3-layer", name: "Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-west",
    name: "West External Wall",
    lifecycle: { status: "existing" as const, reference: "Survey S01" },
  });

  // Wall 4: East [8000, 0] -> [8000, 6000]
  p.walls.push({
    ...newWall(p, levelId, [8000, 0], [8000, 6000], [{
      id: "w4-layer", name: "Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 120, supplierReference: "SUP-01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-east",
    name: "East External Wall",
    lifecycle: { status: "existing" as const, reference: "Survey S01" },
  });

  // Wall 5: Demolished Internal Partition [4000, 0] -> [4000, 6000]
  p.walls.push({
    ...newWall(p, levelId, [4000, 0], [4000, 6000], [{
      id: "w5-layer", name: "Timber Stud", thickness: 90, kind: "solid", hatch: "timber",
      densityKgM3: 500, rateM2: 70, supplierReference: "SUP-02", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-partition-demo",
    name: "Demolished Partition",
    lifecycle: { status: "demolished" as const, reference: "Demolition D01" },
  });

  // Openings on South Wall:
  // 1. Demolished door with full infill
  p.openings.push({
    id: "door-demo-infill",
    revision: 1,
    wallId: "wall-south",
    tag: "D01",
    kind: "door",
    offset: 2000,
    width: 900,
    height: 2100,
    sill: 0,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "demolished" as const, reference: "Demolition D01" },
    demolitionDisposition: { kind: "infill", reference: "Infill Door D01" },
  });

  // 2. Demolished window with partial infill
  p.openings.push({
    id: "win-demo-partial",
    revision: 1,
    wallId: "wall-south",
    tag: "W01",
    kind: "window",
    offset: 6000,
    width: 1500,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "demolished" as const, reference: "Demolition D02" },
    demolitionDisposition: {
      kind: "partial-infill",
      reference: "Reduce Window W01",
      remainingVoid: { offset: 6000, width: 900, height: 1200, sill: 900 },
    },
  });

  // Openings on North Wall:
  // Proposed new window
  p.openings.push({
    id: "win-proposed-new",
    revision: 1,
    wallId: "wall-north",
    tag: "W02",
    kind: "window",
    offset: 4000,
    width: 1800,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "new" as const, reference: "New Work N01" },
  });

  // Room tags:
  // Before alteration: West room and East room
  p.roomTags.push({
    id: "room-tag-west",
    name: "Lounge",
    point: [2000, 3000],
    levelId,
    revision: 1,
  });
  p.roomTags.push({
    id: "room-tag-east",
    name: "Dining",
    point: [6000, 3000],
    levelId,
    revision: 1,
  });

  // Dimensions
  p.dimensions.push({
    id: "dim-south-wall",
    wallId: "wall-south",
    offset: 500,
    revision: 1,
  });
  p.dimensions.push({
    id: "dim-demo-partition",
    wallId: "wall-partition-demo",
    offset: 500,
    revision: 1,
  });

  return validateProject(p);
}

test("stage opening schedule accurately reflects before vs proposed openings and dispositions", () => {
  const p = fixtureCoordinationProject();
  const basis = createAlterationBasis(p, "Reviewed Survey S01");

  // 1. Before stage
  const beforeSched = calculateStageOpeningSchedule(p, basis, "before");
  assert.equal(beforeSched.ready, true);
  assert.equal(beforeSched.stage, "before");
  // Before stage has D01 (demolished door) and W01 (demolished window)
  assert.equal(beforeSched.rows.length, 2);
  const d01Before = beforeSched.rows.find((r) => r.tag === "D01");
  assert.ok(d01Before);
  assert.equal(d01Before.disposition, "scheduled-for-demolition");
  assert.equal(d01Before.width, 900);

  // 2. Proposed stage
  const propSched = calculateStageOpeningSchedule(p, basis, "proposed");
  assert.equal(propSched.ready, true);
  assert.equal(propSched.stage, "proposed");
  // Proposed stage has:
  // - D01 is infilled (excluded from proposed openings)
  // - W01 is partial-infill (retained as VOID of reduced width 900)
  // - W02 is new work window
  assert.equal(propSched.rows.length, 2);

  const d01Prop = propSched.rows.find((r) => r.tag === "D01");
  assert.equal(d01Prop, undefined); // Infilled opening is absent

  const w01Prop = propSched.rows.find((r) => r.tag === "W01");
  assert.ok(w01Prop);
  assert.equal(w01Prop.kind, "void");
  assert.equal(w01Prop.width, 900); // reduced width
  assert.equal(w01Prop.disposition, "retained-void");

  const w02Prop = propSched.rows.find((r) => r.tag === "W02");
  assert.ok(w02Prop);
  assert.equal(w02Prop.kind, "window");
  assert.equal(w02Prop.disposition, "new-work");

  // CSV Exporter check
  const csv = stageOpeningScheduleCsv(p, basis, "proposed");
  assert.ok(csv.includes('"Project ID","Revision","Stage","Opening ID","Tag"'));
  assert.ok(csv.includes("W02"));
  assert.ok(csv.includes("retained-void"));
});

test("stage room schedule computes before vs proposed rooms, merge variance, and detects orphan tags", () => {
  const p = fixtureCoordinationProject();
  const basis = createAlterationBasis(p, "Reviewed Survey S01");

  // 1. Before stage: 2 rooms (Lounge and Dining) split by partition
  const beforeRooms = calculateStageRoomSchedule(p, basis, "before");
  assert.equal(beforeRooms.ready, true);
  assert.equal(beforeRooms.rows.length, 2);
  assert.ok(beforeRooms.rows.some((r) => r.name === "Lounge"));
  assert.ok(beforeRooms.rows.some((r) => r.name === "Dining"));

  // 2. Proposed stage: partition demolished -> 1 merged open space
  const propRooms = calculateStageRoomSchedule(p, basis, "proposed");
  assert.equal(propRooms.ready, true);
  assert.equal(propRooms.rows.length, 1);
  const mergedRoom = propRooms.rows[0];
  assert.ok(mergedRoom.areaM2 > 40); // 8m x 6m interior area is approx 44 m2
  assert.equal(mergedRoom.status, "altered");
  assert.ok(mergedRoom.varianceFromBeforeM2! > 0);

  // CSV Exporter check
  const csv = stageRoomScheduleCsv(p, basis, "proposed");
  assert.ok(csv.includes('"Project ID","Revision","Stage","Room ID","Name"'));
  assert.ok(csv.includes("altered"));
});

test("annotation audit catches opening tag collisions and counts excluded dimensions", () => {
  const p = fixtureCoordinationProject();
  const basis = createAlterationBasis(p, "Reviewed Survey S01");

  const auditClean = verifyAnnotationCoordination(p, basis);
  assert.equal(auditClean.valid, true);
  // Dimension on demolished partition is excluded in proposed stage
  assert.equal(auditClean.excludedDimensionsCount.before, 0);
  assert.equal(auditClean.excludedDimensionsCount.proposed, 1);

  // Introduce tag collision
  p.openings.push({
    id: "door-colliding",
    revision: 1,
    wallId: "wall-north",
    tag: "W02", // colliding with existing W02
    kind: "window",
    offset: 2000,
    width: 1200,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "in",
    lifecycle: { status: "new" as const, reference: "New Work N02" },
  });

  const auditCollision = verifyAnnotationCoordination(p, basis);
  assert.equal(auditCollision.valid, false);
  assert.ok(auditCollision.tagCollisions.some((c) => c.tag === "W02"));
});

test("orphaned room tag is detected when located outside closed room boundary", () => {
  const p = fixtureCoordinationProject();
  // Place tag outside building footprint
  p.roomTags.push({
    id: "tag-outside",
    name: "Courtyard",
    point: [15000, 15000],
    levelId: p.levels[0].id,
    revision: 1,
  });
  const validP = validateProject(p);
  const basis = createAlterationBasis(validP, "Reviewed Survey S01");

  const audit = verifyAnnotationCoordination(validP, basis);
  assert.equal(audit.valid, false);
  assert.ok(audit.orphanedRoomTags.some((t) => t.tagName === "Courtyard"));
});

test("room split created by new partition wall increases room count and calculates negative variance", () => {
  const p = emptyProject("room-split-test");
  const levelId = p.levels[0].id;
  // External envelope 6000 x 4000
  p.walls.push(
    { ...newWall(p, levelId, [0, 0], [6000, 0], [{ id: "l1", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w1", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, levelId, [6000, 0], [6000, 4000], [{ id: "l2", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w2", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, levelId, [6000, 4000], [0, 4000], [{ id: "l3", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w3", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, levelId, [0, 4000], [0, 0], [{ id: "l4", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w4", lifecycle: { status: "existing" as const, reference: "S01" } },
  );
  // New dividing partition dividing the 6m length in half
  p.walls.push({
    ...newWall(p, levelId, [3000, 0], [3000, 4000], [{ id: "l5", name: "Stud", thickness: 100, kind: "solid", hatch: "timber", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]),
    id: "w-new-partition",
    lifecycle: { status: "new" as const, reference: "N01" },
  });

  // Tag for original large room
  p.roomTags.push({ id: "t1", name: "Open Hall", point: [1500, 2000], levelId, revision: 1 });
  // Tag for second newly created half
  p.roomTags.push({ id: "t2", name: "Office", point: [4500, 2000], levelId, revision: 1 });

  const validP = validateProject(p);
  const basis = createAlterationBasis(validP, "Reviewed Survey S01");

  // Before stage: 1 room (Open Hall) spanning full 6x4 space
  const beforeSched = calculateStageRoomSchedule(validP, basis, "before");
  assert.equal(beforeSched.rows.length, 1);
  assert.ok(beforeSched.rows[0].areaM2 > 20);

  // Proposed stage: 2 rooms (Open Hall and Office)
  const propSched = calculateStageRoomSchedule(validP, basis, "proposed");
  assert.equal(propSched.rows.length, 2);
  const openHallProp = propSched.rows.find((r) => r.name === "Open Hall");
  assert.ok(openHallProp);
  assert.equal(openHallProp.status, "altered");
  assert.ok(openHallProp.varianceFromBeforeM2! < 0); // Reduced in size because partition split it
  const officeProp = propSched.rows.find((r) => r.name === "Office");
  assert.ok(officeProp);
  assert.equal(officeProp.status, "new");
});

test("calculateStageRoomSchedule isolates untagged rooms across multiple levels", () => {
  const p = emptyProject("multi-level-room-test");
  const l1 = p.levels[0].id;
  const l2 = "level-2";
  p.levels.push({ id: l2, name: "Level 2", elevation: 3000, height: 3000 });

  // Level 1: 4m x 4m untagged room (will be named "ROOM 1")
  p.walls.push(
    { ...newWall(p, l1, [0, 0], [4000, 0], [{ id: "l1-1", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l1-1", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l1, [4000, 0], [4000, 4000], [{ id: "l1-2", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l1-2", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l1, [4000, 4000], [0, 4000], [{ id: "l1-3", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l1-3", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l1, [0, 4000], [0, 0], [{ id: "l1-4", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l1-4", lifecycle: { status: "existing" as const, reference: "S01" } },
  );

  // Level 2: 8m x 8m untagged room (will also be named "ROOM 1")
  p.walls.push(
    { ...newWall(p, l2, [0, 0], [8000, 0], [{ id: "l2-1", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l2-1", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l2, [8000, 0], [8000, 8000], [{ id: "l2-2", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l2-2", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l2, [8000, 8000], [0, 8000], [{ id: "l2-3", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l2-3", lifecycle: { status: "existing" as const, reference: "S01" } },
    { ...newWall(p, l2, [0, 8000], [0, 0], [{ id: "l2-4", name: "Brick", thickness: 200, kind: "solid", hatch: "brick", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]), id: "w-l2-4", lifecycle: { status: "existing" as const, reference: "S01" } },
  );

  const validP = validateProject(p);
  const basis = createAlterationBasis(validP, "Survey S01");
  const propSched = calculateStageRoomSchedule(validP, basis, "proposed");

  // Both levels should have their own ROOM 1 retained-unchanged with variance 0
  assert.equal(propSched.rows.length, 2);
  for (const r of propSched.rows) {
    assert.equal(r.status, "retained-unchanged");
    assert.equal(r.varianceFromBeforeM2, 0);
  }
});

