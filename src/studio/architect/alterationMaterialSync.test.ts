import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject } from "./model.ts";
import { createProjectMaterials } from "../construction/projectMaterials.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import {
  designMaterialSyncBlockedReason,
  designSyncSummary,
  syncDesignMaterials,
  designPrefix,
} from "./materialBridge.ts";

const source = {
  sha256: "c".repeat(64),
  name: "Alteration Design Set.pdf",
  pageCount: 15,
  discipline: "Architectural" as const,
};

function fixtureAlterationProject() {
  const p = emptyProject("alteration-material-sync-test");

  // 1. Demolished wall
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
      id: "demo-layer", name: "Demolished Brick", thickness: 230, kind: "solid", hatch: "brick",
      densityKgM3: 1900, rateM2: 150, supplierReference: "SUP-D01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-demolished",
    name: "Demolished Internal Wall",
    lifecycle: { status: "demolished", reference: "Survey Demolition D01" },
  });

  // 2. Retained existing wall (no repair)
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 2000], [4000, 2000], [{
      id: "exist-layer", name: "Retained Concrete", thickness: 200, kind: "solid", hatch: "concrete",
      densityKgM3: 2400, rateM2: 120, supplierReference: "SUP-E01", rateRevision: "R1", wastePercent: 5,
    }]),
    id: "wall-existing",
    name: "Retained Party Wall",
    lifecycle: { status: "existing", reference: "Survey Existing S01" },
  });

  // 3. Repaired wall (raised height from 2400 to 2700)
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 4000], [3000, 4000], [{
      id: "repaired-layer", name: "Repaired Stud", thickness: 90, kind: "solid", hatch: "timber",
      densityKgM3: 500, rateM2: 80, supplierReference: "SUP-R01", rateRevision: "R1", wastePercent: 10,
    }]),
    id: "wall-repaired",
    name: "Repaired Wall",
    height: 2700,
    lifecycle: { status: "repaired", reference: "Remediation R01" },
    repairBasis: { height: 2400, reference: "Survey 2400 Height" },
  });

  // 4. New wall
  p.walls.push({
    ...newWall(p, p.levels[0].id, [0, 6000], [4000, 6000], [{
      id: "new-layer", name: "New Timber Partition", thickness: 90, kind: "solid", hatch: "timber",
      densityKgM3: 500, rateM2: 75, supplierReference: "SUP-N01", rateRevision: "R1", wastePercent: 8,
    }]),
    id: "wall-new",
    name: "New Partition Wall",
    height: 2700,
    lifecycle: { status: "new", reference: "Brief New Partition N01" },
  });

  return validateProject(p);
}

test("classified design without reviewed basis strictly blocks sync", () => {
  const p = fixtureAlterationProject();
  const reg = createProjectMaterials(p.id);

  const blockedReason = designMaterialSyncBlockedReason(p, null);
  assert.ok(blockedReason);
  assert.match(blockedReason, /Alteration quantities require phase-aware review/);

  const summary = designSyncSummary(p, reg, null);
  assert.equal(summary.blockedReason, blockedReason);
  assert.deepEqual([summary.add, summary.update, summary.retire], [0, 0, 0]);

  assert.throws(
    () => syncDesignMaterials(p, reg, source, null),
    /Alteration quantities require phase-aware review/,
  );
  assert.equal(reg.materials.length, 0);
});

test("classified design with stale basis blocks sync with specific blocker reason", () => {
  const p = fixtureAlterationProject();
  const reg = createProjectMaterials(p.id);
  const basis = createAlterationBasis(p, "Initial Survey S01");

  // Mutate wall geometry to invalidate the basis fingerprint
  p.walls[0].height += 300;

  const blockedReason = designMaterialSyncBlockedReason(p, basis);
  assert.ok(blockedReason);
  assert.match(blockedReason, /contain blockers/);

  const summary = designSyncSummary(p, reg, basis);
  assert.equal(summary.blockedReason, blockedReason);
  assert.deepEqual([summary.add, summary.update, summary.retire], [0, 0, 0]);

  assert.throws(
    () => syncDesignMaterials(p, reg, source, basis),
    /contain blockers/,
  );
});

test("classified design with valid reviewed basis unblocks sync and synchronizes proposed new and repair materials", () => {
  const p = fixtureAlterationProject();
  const reg = createProjectMaterials(p.id);
  const basis = createAlterationBasis(p, "Approved Survey & Scope S01");

  // Sync is unblocked!
  assert.equal(designMaterialSyncBlockedReason(p, basis), null);

  const summary = designSyncSummary(p, reg, basis);
  assert.equal(summary.blockedReason, undefined);
  // Expect 2 items to add: 1 layer from repaired wall + 1 layer from new wall
  // (Demolished and purely retained existing walls are NOT new material scope)
  assert.equal(summary.add, 2);
  assert.equal(summary.update, 0);
  assert.equal(summary.retire, 0);

  const updatedReg = syncDesignMaterials(p, reg, source, basis);
  assert.equal(updatedReg.materials.length, 2);

  // Check new wall layer material
  const newMat = updatedReg.materials.find((m) => m.physicalKey === designPrefix(p) + "wall-new/new-layer");
  assert.ok(newMat);
  assert.equal(newMat.category, "Wall layer");
  assert.equal(newMat.specification, "SUP-N01");
  assert.match(newMat.stock.reference, /reviewed alteration basis Approved Survey & Scope S01/);
  assert.match(newMat.calculation, /Lifecycle: new/);
  assert.match(newMat.calculation, /8% waste excluded from net register quantity/);

  // Check repaired wall layer material
  const repMat = updatedReg.materials.find((m) => m.physicalKey === designPrefix(p) + "wall-repaired/repaired-layer");
  assert.ok(repMat);
  assert.equal(repMat.category, "Wall layer");
  assert.equal(repMat.specification, "SUP-R01");
  assert.match(repMat.calculation, /Lifecycle: repaired/);

  // Idempotency: re-running designSyncSummary on updatedReg returns no additions
  const postSummary = designSyncSummary(p, updatedReg, basis);
  assert.deepEqual([postSummary.add, postSummary.update, postSummary.retire], [0, 0, 0]);
});

test("legacy unclassified design syncs untouched without requiring basis", () => {
  const p = emptyProject("legacy-sync-test");
  p.walls.push(newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "leg-layer", name: "Standard Stud", thickness: 90, kind: "solid", hatch: "timber",
    densityKgM3: 500, rateM2: 60, supplierReference: "SUP-LEG", rateRevision: "R1", wastePercent: 5,
  }]));
  const validP = validateProject(p);
  const reg = createProjectMaterials(validP.id);

  assert.equal(designMaterialSyncBlockedReason(validP), null);
  const summary = designSyncSummary(validP, reg);
  assert.equal(summary.add, 1);

  const synced = syncDesignMaterials(validP, reg, source);
  assert.equal(synced.materials.length, 1);
  assert.match(synced.materials[0].stock.reference, /authored design, not measured source-plan evidence/);
});
