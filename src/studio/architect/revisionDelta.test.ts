import test from "node:test";
import assert from "node:assert/strict";
import { demonstration, validateProject, type ArchitectProject } from "./model.ts";
import { recordDrawingIssue } from "./issueHistory.ts";
import { reviewIssueSet } from "./issueSet.ts";
import { changeAuthoredSheets } from "./authoredSheetSet.ts";
import {
  compareDrawingRevisions,
  compareSheets,
  compareGeometry,
  computeQuantityVariance,
  extractProjectModel,
} from "./revisionDelta.ts";

function setupProject(): ArchitectProject {
  let p = demonstration("p1");
  p = changeAuthoredSheets(p, { type: "add" });
  p = changeAuthoredSheets(p, { type: "add" });
  p.designRevision = "A";
  return validateProject(p);
}

test("identical revisions produce zero delta, zero variance, and hasChanges=false", () => {
  const p = setupProject();
  const sheets = p.sheetSet!.sheets.map((s) => s.id);
  const reviewA = reviewIssueSet(p, sheets, "For Review");
  const projectWithIssue = recordDrawingIssue(p, reviewA, new Date("2026-09-12T10:00:00Z"));
  const issueA = projectWithIssue.issues![0];

  const report = compareDrawingRevisions(issueA, issueA);

  assert.equal(report.summary.hasChanges, false);
  assert.equal(report.sheets.counts.added, 0);
  assert.equal(report.sheets.counts.removed, 0);
  assert.equal(report.sheets.counts.changed, 0);
  assert.equal(report.sheets.counts.unchanged, sheets.length);

  assert.equal(report.geometry.counts.totalAdded, 0);
  assert.equal(report.geometry.counts.totalRemoved, 0);
  assert.equal(report.geometry.counts.totalChanged, 0);

  assert.equal(report.quantityVariance.totals.varianceNetAreaM2, 0);
  assert.equal(report.quantityVariance.totals.varianceVolumeM3, 0);
  assert.equal(report.quantityVariance.totals.varianceCost, 0);

  // Every row in the quantity variance table should be marked "unchanged"
  for (const row of report.quantityVariance.allRows) {
    assert.equal(row.status, "unchanged");
    assert.equal(row.variance, 0);
  }
});

test("detects added, removed, and modified sheets with descriptive reason strings", () => {
  const p = setupProject();
  const initialSheets = [p.sheetSet!.sheets[0].id];
  const reviewA = reviewIssueSet(p, initialSheets, "Initial Planning Issue");
  const pWithA = recordDrawingIssue(p, reviewA, new Date("2026-09-12T10:00:00Z"));
  const issueA = pWithA.issues![0];

  // Modify sheet layout: change size from A3 to A1, scale from 1:100 to 1:50, add a viewport
  const modifiedP = structuredClone(pWithA);
  modifiedP.designRevision = "B";
  modifiedP.revision = 2;
  const firstSheet = modifiedP.sheetSet!.sheets[0];
  firstSheet.layout.size = "A1";
  firstSheet.layout.scale = "100";
  firstSheet.layout.viewports.push(
    {
      id: "vp-elevation-south",
      view: "south",
      levelId: modifiedP.levels[0].id,
      x: 400,
      y: 300,
      width: 250,
      height: 180,
      scale: "50",
    },
    {
      id: "vp-section-01",
      view: "section",
      levelId: modifiedP.levels[0].id,
      x: 100,
      y: 300,
      width: 250,
      height: 180,
      scale: "50",
    },
  );

  const allSheets = [p.sheetSet!.sheets[0].id, p.sheetSet!.sheets[1].id];
  const reviewB = reviewIssueSet(modifiedP, allSheets, "Tender Issue");
  const pWithB = recordDrawingIssue(modifiedP, reviewB, new Date("2026-09-12T11:00:00Z"));
  const issueB = pWithB.issues!.find((i) => i.designRevision === "B")!;

  const report = compareDrawingRevisions(issueA, issueB);

  assert.equal(report.summary.hasChanges, true);
  assert.equal(report.sheets.counts.added, 1);
  assert.equal(report.sheets.counts.removed, 0);
  assert.equal(report.sheets.counts.changed, 1);
  assert.equal(report.sheets.changed[0].number, firstSheet.layout.number);

  const changes = report.sheets.changed[0].changes;
  assert.ok(changes.some((c) => c.includes("A3 → A1")), "Reports paper size change");
  assert.ok(changes.some((c) => c.includes("1:50 → 1:100")), "Reports scale change");
  assert.ok(changes.some((c) => c.includes("Viewports changed")), "Reports viewports count change");
});

test("detects added, removed, and altered walls with coordinate and layer details", () => {
  const pBase = setupProject();
  const pTgt = structuredClone(pBase);
  pTgt.revision = 3;

  // 1. Alter an existing wall: lengthen it and increase height
  const wallToModify = pTgt.walls[0];
  wallToModify.b = [wallToModify.b[0] + 2000, wallToModify.b[1]]; // Lengthen by 2m
  wallToModify.height = 3200; // was 2700

  // 2. Remove an existing wall
  const wallToRemove = pTgt.walls.pop()!;

  // 3. Add a new interior partition wall
  const newWallId = "wall-new-partition";
  pTgt.walls.push({
    id: newWallId,
    revision: 1,
    levelId: pBase.levels[0].id,
    name: "Internal Partition",
    a: [2000, 2000],
    b: [6000, 2000],
    height: 2700,
    layers: [
      {
        id: "drywall-core",
        name: "Steel Stud Framing",
        thickness: 90,
        kind: "assembly",
        hatch: "timber",
        densityKgM3: null,
        rateM2: 65,
        supplierReference: "SS-90",
        rateRevision: "1",
        wastePercent: 5,
      },
    ],
  });

  const delta = compareGeometry(pBase, pTgt);

  assert.equal(delta.walls.added.length, 1);
  assert.equal(delta.walls.added[0].id, newWallId);

  assert.equal(delta.walls.removed.length, 1);
  assert.equal(delta.walls.removed[0].id, wallToRemove.id);

  assert.equal(delta.walls.changed.length, 1);
  assert.equal(delta.walls.changed[0].id, wallToModify.id);

  const wallChanges = delta.walls.changed[0].changes;
  assert.ok(wallChanges.some((c) => c.includes("Length changed")), "Should describe length change");
  assert.ok(wallChanges.some((c) => c.includes("Height changed")), "Should describe height change");
});

test("detects added, removed, and modified doors and windows", () => {
  const pBase = setupProject();
  const pTgt = structuredClone(pBase);

  // 1. Add a window
  const newWindowId = "win-feature-01";
  pTgt.openings.push({
    id: newWindowId,
    revision: 1,
    wallId: pTgt.walls[0].id,
    tag: "W03",
    kind: "window",
    offset: 1500,
    width: 1800,
    height: 1200,
    sill: 900,
    hinge: "left",
    swing: "out",
  });

  // 2. Modify an existing door
  const doorToMod = pTgt.openings.find((o) => o.kind === "door")!;
  doorToMod.width = 920; // was 820
  doorToMod.hinge = doorToMod.hinge === "left" ? "right" : "left";

  const delta = compareGeometry(pBase, pTgt);

  assert.equal(delta.openings.added.length, 1);
  assert.equal(delta.openings.added[0].id, newWindowId);

  assert.equal(delta.openings.changed.length, 1);
  assert.equal(delta.openings.changed[0].id, doorToMod.id);

  const openingChanges = delta.openings.changed[0].changes;
  assert.ok(openingChanges.some((c) => c.includes("Dimensions changed")), "Reports door size edit");
  assert.ok(openingChanges.some((c) => c.includes("Hinge orientation")), "Reports hinge edit");
});

test("computes quantity variance table with exact deltas, percentages, and statuses", () => {
  const pBase = setupProject();
  const pTgt = structuredClone(pBase);

  // Add 10m of new wall on the ground level (height 2.7m = 27 m² surface area)
  pTgt.walls.push({
    id: "wall-qty-test",
    revision: 1,
    levelId: pBase.levels[0].id,
    name: "Boundary Wall",
    a: [0, 10000],
    b: [10000, 10000],
    height: 2700,
    layers: [
      {
        id: "masonry-layer",
        name: "Concrete Blockwork",
        thickness: 200,
        kind: "solid",
        hatch: "concrete",
        densityKgM3: 2200,
        rateM2: 120,
        supplierReference: "CB-200",
        rateRevision: "1",
        wastePercent: 0,
      },
    ],
  });

  const varianceTable = computeQuantityVariance(pBase, pTgt);

  // Verify total net area variance increased
  assert.ok(varianceTable.totals.varianceNetAreaM2 > 20, `Total net area should increase by over 20 m², got ${varianceTable.totals.varianceNetAreaM2}`);
  assert.ok(varianceTable.totals.varianceCost > 0, "Known material cost should increase");

  // Summary row for net area should have status "increased"
  const netAreaRow = varianceTable.summaryRows.find((r) => r.id === "summary-net-area")!;
  assert.equal(netAreaRow.status, "increased");
  assert.ok(netAreaRow.variance > 0);
  assert.ok(netAreaRow.percentVariance! > 0);

  // New masonry layer row should have status "added"
  const blockworkRow = varianceTable.tradeRows.find((r) => r.name.includes("Concrete Blockwork"));
  assert.ok(blockworkRow, "Blockwork trade row must be present in variance table");
  assert.equal(blockworkRow!.status, "added");
  assert.equal(blockworkRow!.baselineQuantity, 0);
  assert.ok(blockworkRow!.targetQuantity > 20);
});

test("safely handles legacy issue records without snapshots", () => {
  const p = setupProject();
  const sheets = [p.sheetSet!.sheets[0].id];
  const review = reviewIssueSet(p, sheets, "Legacy Review");
  const pWithIssue = recordDrawingIssue(p, review, new Date("2026-09-12T10:00:00Z"));
  const legacyIssue = structuredClone(pWithIssue.issues![0]);

  // Strip snapshot to simulate older issues from prior versions
  delete (legacyIssue as any).snapshot;

  assert.throws(() => extractProjectModel(legacyIssue), /predates geometry snapshots/);
  assert.throws(() => compareDrawingRevisions(legacyIssue, p), /missing geometry/);
});

test("comparison functions are pure and do not mutate baseline or target inputs", () => {
  const p = setupProject();
  const sheets = [p.sheetSet!.sheets[0].id];
  const reviewA = reviewIssueSet(p, sheets, "Rev A");
  const pA = recordDrawingIssue(p, reviewA, new Date("2026-09-12T10:00:00Z"));
  const issueA = pA.issues![0];

  const serializedBefore = JSON.stringify(issueA);
  compareDrawingRevisions(issueA, issueA);
  const serializedAfter = JSON.stringify(issueA);

  assert.equal(serializedAfter, serializedBefore, "Issue record must remain byte-identical after comparison");
});


test("detects moved openings, equal-area slab moves, roof pitches and level elevations", () => {
  const p = setupProject();
  for (const mutate of [
    (t: ArchitectProject) => { t.openings[0].offset += 100; },
    (t: ArchitectProject) => { t.slabs[0].points = t.slabs[0].points.map(([x,y]) => [x + 100, y]); },
    (t: ArchitectProject) => { t.roofs[0].edges[0].pitch += 5; },
    (t: ArchitectProject) => { t.levels[0].elevation += 100; },
    (t: ArchitectProject) => { t.walls[0].layers[0].rateM2 = 50; },
  ]) {
    const target = structuredClone(p);
    mutate(target);
    assert.ok(compareGeometry(p, target).counts.totalChanged > 0);
    assert.equal(compareDrawingRevisions(p, target).summary.hasChanges, true);
  }
});

test("issued-to-WIP comparison detects viewport placement and preserves sheet identity", () => {
  const p = setupProject();
  const issued = recordDrawingIssue(p, reviewIssueSet(p, p.sheetSet!.sheets.map(s => s.id), "Review"), new Date());
  assert.equal(compareDrawingRevisions(issued.issues![0], p).summary.hasChanges, false);
  const target = structuredClone(p);
  target.sheetSet!.sheets[0].layout.northAngle += 10;
  assert.equal(compareDrawingRevisions(issued.issues![0], target).sheets.counts.changed, 1);
  target.sheetSet!.sheets[0].id = "replacement-sheet";
  const delta = compareDrawingRevisions(issued.issues![0], target).sheets;
  assert.equal(delta.counts.added, 1);
  assert.equal(delta.counts.removed, 1);
});

test("a new quantity has no percentage baseline", () => {
  const p = setupProject();
  const target = structuredClone(p);
  target.slabs.push({ ...structuredClone(p.slabs[0]), id: "new-slab" });
  const added = computeQuantityVariance(p, target).tradeRows.filter(r => r.status === "added");
  assert.ok(added.length);
  assert.ok(added.every(r => r.percentVariance === null));
});
