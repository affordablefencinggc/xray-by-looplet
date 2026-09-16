import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, type ArchitectProject } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import { calculateAlterationQuantities } from "./alterationQuantities.ts";

const close = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}${msg ? ` (${msg})` : ""}`);

function baseProject() {
  const p = emptyProject("lifecycle-quantities-test");
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
      id: "solid", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "wall-1",
    lifecycle: { status: "existing", reference: "Survey S01" },
  });
  return p;
}

function report(p: ArchitectProject) {
  const basis = createAlterationBasis(p, "Reviewed Survey / S01");
  const result = calculateAlterationQuantities(p, basis);
  assert.equal(result.ready, true, JSON.stringify(result));
  if (!result.ready) throw Error("Expected ready calculation");
  return result;
}

test("coincident replacement exposes demolished and new volume with zero geometry delta", () => {
  const p = baseProject();
  p.walls[0].lifecycle!.status = "demolished";
  p.walls.push({
    ...structuredClone(p.walls[0]),
    id: "replacement",
    lifecycle: { status: "new", reference: "Brief N01" },
  });

  const result = report(p);
  close(result.beforeWallSolidVolumeM3, 2.16);
  close(result.proposedWallSolidVolumeM3, 2.16);
  close(result.deltaWallSolidVolumeM3, 0);

  close(result.breakdown.demolishedVolumeM3, 2.16);
  close(result.breakdown.newVolumeM3, 2.16);
  close(result.breakdown.existingBeforeVolumeM3, 0);
  close(result.breakdown.existingProposedVolumeM3, 0);
  close(result.breakdown.beforeSharedJunctionVolumeM3, 0);
  close(result.breakdown.proposedSharedJunctionVolumeM3, 0);
  assert.equal(result.breakdown.hasUnresolvedSharedAllocation, false);
});

test("T-junction crossing allocates pure categories and discloses cross-lifecycle shared volume with ID-invariance", () => {
  const p1 = emptyProject("t-junction-id-1");
  p1.walls.push({
    ...newWall(p1, p1.levels[0].id, [-2000, 0], [2000, 0], [{
      id: "solid-1", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "existing-first",
    lifecycle: { status: "existing", reference: "Survey S01" },
  });
  p1.walls.push({
    ...newWall(p1, p1.levels[0].id, [0, 0], [0, 3000], [{
      id: "solid-2", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "new-second",
    lifecycle: { status: "new", reference: "Brief N01" },
  });

  const res1 = report(p1);
  close(res1.beforeWallSolidVolumeM3, 2.16);
  close(res1.proposedWallSolidVolumeM3, 3.726);
  close(res1.breakdown.existingProposedVolumeM3, 2.106);
  close(res1.breakdown.newVolumeM3, 1.566);
  close(res1.breakdown.proposedSharedJunctionVolumeM3, 0.054);
  assert.equal(res1.breakdown.hasUnresolvedSharedAllocation, true);

  // Exact volume conservation in proposed
  const proposedSum = res1.breakdown.existingProposedVolumeM3 +
    res1.breakdown.newVolumeM3 +
    res1.breakdown.repairedProposedVolumeM3 +
    res1.breakdown.proposedSharedJunctionVolumeM3;
  close(proposedSum, res1.proposedWallSolidVolumeM3, "Proposed sum conservation");

  // Inverted ID test: new wall has lexicographically earlier ID and reversed array index
  const p2 = emptyProject("t-junction-id-2");
  p2.walls.push({
    ...newWall(p2, p2.levels[0].id, [0, 0], [0, 3000], [{
      id: "solid-2", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "a-new-wall",
    lifecycle: { status: "new", reference: "Brief N01" },
  });
  p2.walls.push({
    ...newWall(p2, p2.levels[0].id, [-2000, 0], [2000, 0], [{
      id: "solid-1", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "z-existing-wall",
    lifecycle: { status: "existing", reference: "Survey S01" },
  });

  const res2 = report(p2);
  close(res2.proposedWallSolidVolumeM3, res1.proposedWallSolidVolumeM3, "ID-invariance: proposed total");
  close(res2.breakdown.existingProposedVolumeM3, res1.breakdown.existingProposedVolumeM3, "ID-invariance: pure existing");
  close(res2.breakdown.newVolumeM3, res1.breakdown.newVolumeM3, "ID-invariance: pure new");
  close(res2.breakdown.proposedSharedJunctionVolumeM3, res1.breakdown.proposedSharedJunctionVolumeM3, "ID-invariance: shared junction");
  assert.equal(res2.breakdown.hasUnresolvedSharedAllocation, true);
});

test("unequal-thickness corner without mitre isolates shared junction volume symmetrically", () => {
  const p = emptyProject("unequal-corner");
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
      id: "solid-1", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "existing-wall",
    lifecycle: { status: "existing", reference: "Survey S01" },
  });
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 0], [0, 3000], [{
      id: "solid-2", name: "Timber", thickness: 150, kind: "solid", hatch: "timber",
      densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
    }]),
    id: "new-wall",
    lifecycle: { status: "new", reference: "Brief N01" },
  });

  const res = report(p);
  close(res.beforeWallSolidVolumeM3, 2.16);
  close(res.proposedWallSolidVolumeM3, 3.35475);
  close(res.breakdown.proposedSharedJunctionVolumeM3, 0.02025);
  assert.equal(res.breakdown.hasUnresolvedSharedAllocation, true);

  const proposedSum = res.breakdown.existingProposedVolumeM3 +
    res.breakdown.newVolumeM3 +
    res.breakdown.repairedProposedVolumeM3 +
    res.breakdown.proposedSharedJunctionVolumeM3;
  close(proposedSum, res.proposedWallSolidVolumeM3, "Unequal corner sum conservation");
});

test("demolished opening with infill, retain-void, and partial-infill track pure existing volume", () => {
  // Test full infill
  const pInfill = baseProject();
  pInfill.openings.push({
    id: "door-infill", revision: 1, wallId: pInfill.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Survey S01" },
    demolitionDisposition: { kind: "infill", reference: "Brief Infill I01" },
  });
  const resInfill = report(pInfill);
  close(resInfill.beforeWallSolidVolumeM3, 1.782);
  close(resInfill.proposedWallSolidVolumeM3, 2.16);
  close(resInfill.deltaWallSolidVolumeM3, 0.378);
  close(resInfill.breakdown.existingBeforeVolumeM3, 1.782);
  close(resInfill.breakdown.existingProposedVolumeM3, 2.16);

  // Test retain-void
  const pVoid = baseProject();
  pVoid.openings.push({
    id: "door-void", revision: 1, wallId: pVoid.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Survey S01" },
    demolitionDisposition: { kind: "retain-void", reference: "Brief Void V01" },
  });
  const resVoid = report(pVoid);
  close(resVoid.beforeWallSolidVolumeM3, 1.782);
  close(resVoid.proposedWallSolidVolumeM3, 1.782);
  close(resVoid.deltaWallSolidVolumeM3, 0);
  close(resVoid.breakdown.existingBeforeVolumeM3, 1.782);
  close(resVoid.breakdown.existingProposedVolumeM3, 1.782);

  // Test partial-infill
  const pPartial = baseProject();
  pPartial.openings.push({
    id: "door-partial", revision: 1, wallId: pPartial.walls[0].id, tag: "D01", kind: "door",
    offset: 2000, width: 900, height: 2100, sill: 0, hinge: "left", swing: "in",
    lifecycle: { status: "demolished", reference: "Survey S01" },
    demolitionDisposition: {
      kind: "partial-infill",
      reference: "Brief Partial P01",
      remainingVoid: { offset: 2000, width: 600, height: 1800, sill: 300 },
    },
  });
  const resPartial = report(pPartial);
  close(resPartial.beforeWallSolidVolumeM3, 1.782);
  // Partial void cut = 600 * 1800 * 200 = 0.216 m3 void, so proposed = 2.16 - 0.216 = 1.944 m3
  close(resPartial.proposedWallSolidVolumeM3, 1.944);
  close(resPartial.deltaWallSolidVolumeM3, 0.162);
  close(resPartial.breakdown.existingBeforeVolumeM3, 1.782);
  close(resPartial.breakdown.existingProposedVolumeM3, 1.944);
});

test("changed-repair before vs proposed wall heights allocate to repaired category", () => {
  const p = baseProject();
  p.walls[0].lifecycle!.status = "repaired";
  p.walls[0].repairBasis = { height: 2400, reference: "Survey C01" };
  p.walls[0].height = 2700;

  const res = report(p);
  close(res.beforeWallSolidVolumeM3, 1.92);
  close(res.proposedWallSolidVolumeM3, 2.16);
  close(res.deltaWallSolidVolumeM3, 0.24);

  close(res.breakdown.repairedBeforeVolumeM3, 1.92);
  close(res.breakdown.repairedProposedVolumeM3, 2.16);
  close(res.breakdown.existingBeforeVolumeM3, 0);
  close(res.breakdown.existingProposedVolumeM3, 0);
  close(res.breakdown.beforeSharedJunctionVolumeM3, 0);
  close(res.breakdown.proposedSharedJunctionVolumeM3, 0);
  assert.equal(res.breakdown.hasUnresolvedSharedAllocation, false);
});

test("three-category junction (existing, new, repaired) preserves volume conservation under ID permutations", () => {
  const createProject = (ids: [string, string, string]) => {
    const p = emptyProject("three-way-junction");
    p.walls.push({
      ...newWall(p, p.levels[0].id, [-2000, 0], [2000, 0], [{
        id: "solid-1", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
        densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
      }]),
      id: ids[0],
      lifecycle: { status: "existing", reference: "Survey S01" },
    });
    p.walls.push({
      ...newWall(p, p.levels[0].id, [0, 0], [0, 3000], [{
        id: "solid-2", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
        densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
      }]),
      id: ids[1],
      lifecycle: { status: "new", reference: "Brief N01" },
    });
    p.walls.push({
      ...newWall(p, p.levels[0].id, [0, -3000], [0, 0], [{
        id: "solid-3", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
        densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
      }]),
      id: ids[2],
      lifecycle: { status: "repaired", reference: "Brief R01" },
    });
    return p;
  };

  const pStandard = createProject(["existing-1", "new-2", "repaired-3"]);
  const resStandard = report(pStandard);

  const sumProposed = resStandard.breakdown.existingProposedVolumeM3 +
    resStandard.breakdown.newVolumeM3 +
    resStandard.breakdown.repairedProposedVolumeM3 +
    resStandard.breakdown.proposedSharedJunctionVolumeM3;
  close(sumProposed, resStandard.proposedWallSolidVolumeM3, "Three-way proposed sum conservation");
  assert.equal(resStandard.breakdown.hasUnresolvedSharedAllocation, true);

  // Permuted IDs and reverse array order
  const pPermuted = createProject(["z-existing", "a-new", "m-repaired"]);
  pPermuted.walls.reverse();
  const resPermuted = report(pPermuted);

  close(resPermuted.proposedWallSolidVolumeM3, resStandard.proposedWallSolidVolumeM3, "Permuted total proposed");
  close(resPermuted.breakdown.existingProposedVolumeM3, resStandard.breakdown.existingProposedVolumeM3, "Permuted pure existing");
  close(resPermuted.breakdown.newVolumeM3, resStandard.breakdown.newVolumeM3, "Permuted pure new");
  close(resPermuted.breakdown.repairedProposedVolumeM3, resStandard.breakdown.repairedProposedVolumeM3, "Permuted pure repaired");
  close(resPermuted.breakdown.proposedSharedJunctionVolumeM3, resStandard.breakdown.proposedSharedJunctionVolumeM3, "Permuted shared junction");
});

