import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, revise, validateProject, type ArchitectProject } from "./model.ts";
import { setElementLifecycle, setOpeningDemolitionDisposition, alterationSchedule } from "./lifecycle.ts";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage.ts";
import { wallSolids } from "./geometry.ts";
import { prepareArchitectEdits } from "../assistant/architectBridge.ts";
import { loadArchitect, saveArchitect } from "./persistence.ts";
import { exportDxf, importDxf } from "./exchange.ts";

function fixture(): ArchitectProject {
  const p = emptyProject("retained-opening-life");
  const wall = newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{ id: "solid", name: "Authored wall", thickness: 200,
    kind: "solid", hatch: "concrete", densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0 }]);
  wall.lifecycle = { status: "existing", reference: "Survey A" };
  p.walls.push(wall);
  p.openings.push({ id: "removed-door", revision: 1, wallId: wall.id, tag: "D01", kind: "door", offset: 2000, width: 900,
    height: 2100, sill: 0, hinge: "left", swing: "in", lifecycle: { status: "demolished", reference: "Remove door under brief A" } });
  return p;
}
const disposition = { kind: "retain-void" as const, reference: "Keep authored aperture; survey A" };
const volume = (p: ArchitectProject) => wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);

test("retain-void preserves the authored cut in both stages without inventing solid, infill or fixture quantities", () => {
  const source = fixture(), p = setOpeningDemolitionDisposition(source, "removed-door", disposition);
  const original = structuredClone(p), basis = createAlterationBasis(p, "Reviewed unchanged retained wall");
  const before = resolveAlterationStage(p, basis, "before"), proposed = resolveAlterationStage(p, basis, "proposed");
  if (!before.ready || !proposed.ready) throw Error("Both reviewed stages must resolve.");
  assert.equal(before.model.openings[0].kind, "door");
  assert.equal(proposed.model.openings[0].kind, "void");
  assert.equal(proposed.model.openings[0].demolitionDisposition, undefined);
  assert.ok(Math.abs(volume(before.model) - 1.782) < 1e-9);
  assert.ok(Math.abs(volume(proposed.model) - 1.782) < 1e-9);
  assert.equal(volume(before.model) - volume(proposed.model), 0);
  assert.equal(proposed.model.walls.length, 1);
  assert.deepEqual(proposed.model.walls[0].layers, source.walls[0].layers);
  assert.equal(proposed.excludedIds.includes("removed-door"), false);
  assert.deepEqual(p, original);
  assert.deepEqual(alterationSchedule(p).rows.find((row) => row.id === "removed-door")?.demolitionDisposition, disposition);
});

test("missing or cleared disposition blocks retained-host stages and invalidates a previously reviewed basis", () => {
  const p = fixture();
  assert.equal(resolveAlterationStage(p, createAlterationBasis(p, "Review A"), "proposed").ready, false);
  const retained = setOpeningDemolitionDisposition(p, "removed-door", disposition), basis = createAlterationBasis(retained, "Review B");
  const cleared = setOpeningDemolitionDisposition(retained, "removed-door", null);
  const result = resolveAlterationStage(cleared, basis, "proposed");
  assert.equal(result.ready, false);
  if (!result.ready) assert.ok(result.blockers.some((blocker) => /stale/.test(blocker.reason)));
  assert.equal("model" in result, false);
});

test("disposition rejects invalid reference, unsupported kind, wrong lifecycle and missing identities atomically", () => {
  const p = fixture(), original = structuredClone(p);
  for (const value of [undefined, { ...disposition, reference: " " }, { ...disposition, reference: "x".repeat(501) },
    { ...disposition, reference: 42 }, { kind: "infill", reference: "No authored infill" }, { ...disposition, approved: true }]) {
    assert.throws(() => setOpeningDemolitionDisposition(p, "removed-door", value as typeof disposition));
  }
  assert.throws(() => setOpeningDemolitionDisposition(p, "missing", disposition));
  assert.throws(() => setOpeningDemolitionDisposition(p, p.walls[0].id, disposition));
  for (const status of ["existing", "new", "repaired"] as const) {
    const changed = setElementLifecycle(p, "removed-door", { status, reference: "Brief B" });
    assert.throws(() => setOpeningDemolitionDisposition(changed, "removed-door", disposition), /demolished/);
  }
  const alreadyVoid = structuredClone(p); alreadyVoid.openings[0].kind = "void";
  assert.throws(() => setOpeningDemolitionDisposition(alreadyVoid, "removed-door", disposition), /door or window/);
  const malformed = structuredClone(p); malformed.openings[0].demolitionDisposition = disposition; malformed.openings[0].kind = "void";
  assert.throws(() => validateProject(malformed), /demolished door or window/);
  assert.deepEqual(p, original);
  const maximum = setOpeningDemolitionDisposition(p, "removed-door", { kind: "retain-void", reference: "x".repeat(500) });
  assert.equal(maximum.openings[0].demolitionDisposition?.reference.length, 500);
});

test("changing demolition status clears obsolete void disposition without removing geometry", () => {
  const p = setOpeningDemolitionDisposition(fixture(), "removed-door", disposition);
  for (const lifecycle of [null, { status: "existing" as const, reference: "Reviewed retained door" }, { status: "new" as const, reference: "New work" }]) {
    const changed = setElementLifecycle(p, "removed-door", lifecycle);
    assert.equal(changed.openings[0].demolitionDisposition, undefined);
    assert.equal(changed.openings[0].width, 900); assert.equal(changed.openings[0].kind, "door");
  }
  assert.deepEqual(p.openings[0].demolitionDisposition, disposition);
});

test("assistant edit enforces project/revision bindings, atomic failure and explicit disposition notices", () => {
  const p = fixture(), bytes = JSON.stringify(p);
  const input = { expectedJobId: p.id, expectedRevision: p.revision, operations: [{ kind: "set-opening-disposition", id: "removed-door", disposition }] };
  const prepared = prepareArchitectEdits(p, input);
  assert.deepEqual(prepared.draft.openings[0].demolitionDisposition, disposition);
  assert.deepEqual(prepared.changed, [{ kind: "opening", id: "removed-door" }]);
  assert.match(prepared.notices.join(" "), /retain authored void/);
  assert.match(prepared.notices.join(" "), /No infill/);
  for (const invalid of [{ ...input, expectedJobId: "other" }, { ...input, expectedRevision: p.revision + 1 },
    { ...input, operations: [...input.operations, { kind: "set-opening-disposition", id: "missing", disposition }] }]) {
    assert.throws(() => prepareArchitectEdits(p, invalid));
  }
  assert.equal(JSON.stringify(p), bytes);
  const committed = revise(p, prepared.draft);
  assert.equal(committed.openings[0].revision, p.openings[0].revision + 1);
  const cleared = prepareArchitectEdits(committed, { expectedJobId: p.id, expectedRevision: committed.revision,
    operations: [{ kind: "set-lifecycle", id: "removed-door", lifecycle: { status: "existing", reference: "Keep fixture" } }] });
  assert.equal(cleared.draft.openings[0].demolitionDisposition, undefined);
});

test("authored disposition survives project persistence and parametric DXF exchange", async () => {
  const p = setOpeningDemolitionDisposition(fixture(), "removed-door", disposition);
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(saveArchitect(loadArchitect(p.id, storage), p, storage).error, null);
  assert.deepEqual(loadArchitect(p.id, storage).value.openings[0], p.openings[0]);
  const imported = await importDxf(await exportDxf(p), "imported-retained-opening");
  assert.equal(imported.parametric, true);
  assert.deepEqual(imported.project.openings[0], p.openings[0]);
  assert.equal(imported.project.id, "imported-retained-opening");
  assert.deepEqual(validateProject(imported.project), imported.project);
});

test("a demolished host removes its aperture despite retained-void intent on the removed fixture", () => {
  const p = setOpeningDemolitionDisposition(fixture(), "removed-door", disposition);
  p.walls[0].lifecycle!.status = "demolished";
  const result = resolveAlterationStage(p, createAlterationBasis(p, "Whole wall demolition"), "proposed");
  if (!result.ready) throw Error("Reviewed whole-wall demolition should resolve.");
  assert.deepEqual(result.model.walls, []); assert.deepEqual(result.model.openings, []);
  assert.equal(volume(result.model), 0);
});
