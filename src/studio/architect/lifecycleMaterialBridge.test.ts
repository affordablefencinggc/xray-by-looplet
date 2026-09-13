import { test } from "node:test";
import assert from "node:assert/strict";
import { createProjectMaterials } from "../construction/projectMaterials.ts";
import { demonstration, emptyProject, newWall, validateProject } from "./model.ts";
import { designMaterialSyncBlockedReason, designSyncSummary, syncDesignMaterials } from "./materialBridge.ts";

const source = {
  sha256: "a".repeat(64), name: "Authored design.pdf", pageCount: 20,
  discipline: "Architectural" as const,
};
function singleWall() {
  const p = emptyProject("lifecycle-material-test");
  p.walls = [newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: 2400, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }])];
  return p;
}

test("coincident demolished and replacement walls refuse sync without changing the register or design", () => {
  const p = singleWall();
  const register = syncDesignMaterials(p, createProjectMaterials(p.id), source);
  register.materials[0].review = "reviewed";
  register.materials[0].reviewNote = "Existing reviewed quantity";
  p.walls[0].lifecycle = { status: "demolished", reference: "Alteration brief D01" };
  p.walls.push({ ...structuredClone(p.walls[0]), id: "replacement-wall", lifecycle: { status: "new", reference: "Alteration brief N01" } });
  const beforeRegister = JSON.stringify(register), beforeProject = JSON.stringify(p);
  const summary = designSyncSummary(p, register);
  assert.match(summary.blockedReason!, /Alteration quantities require phase-aware review/);
  assert.deepEqual([summary.add, summary.update, summary.retire], [0, 0, 0]);
  assert.throws(() => syncDesignMaterials(p, register, { ...source, sha256: "b".repeat(64) }), /Phase quantities are not supported yet/);
  assert.equal(JSON.stringify(register), beforeRegister);
  assert.equal(JSON.stringify(p), beforeProject);
});

for (const collection of ["walls", "openings", "slabs", "roofs"] as const) {
  for (const status of ["existing", "new", "demolished", "repaired"] as const) {
    test(`${collection} classified ${status} blocks material sync independently`, () => {
      const p = demonstration("lifecycle-material-test");
      assert.ok(p[collection].length, `${collection} fixture required`);
      p[collection][0].lifecycle = { status, reference: "Survey and alteration brief" };
      const validated = validateProject(p), register = createProjectMaterials(p.id);
      assert.ok(designMaterialSyncBlockedReason(validated));
      assert.throws(() => syncDesignMaterials(validated, register, source), /phase-aware review/);
      assert.equal(register.materials.length, 0);
      assert.equal(register.sources.length, 0);
    });
  }
}

test("unclassified legacy design keeps its exact sync summary and calculated quantity", () => {
  const p = singleWall(), empty = createProjectMaterials(p.id);
  assert.equal(designMaterialSyncBlockedReason(p), null);
  assert.deepEqual(designSyncSummary(p, empty), { add: 1, update: 0, retire: 0 });
  const register = syncDesignMaterials(p, empty, source);
  assert.equal(register.materials.length, 1);
  assert.equal(register.materials[0].stock.quantity, 10.8);
  assert.equal(register.materials[0].review, "pending");
  assert.deepEqual(designSyncSummary(p, register), { add: 0, update: 0, retire: 0 });
  assert.deepEqual(syncDesignMaterials(p, register, source), register);
  assert.equal(empty.materials.length, 0);
});
