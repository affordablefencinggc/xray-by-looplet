import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newWall, validateProject } from "./model.ts";
import { primitives } from "./drawing.ts";
import { wallSolids } from "./geometry.ts";
import { buildDesignedScene } from "./designedScene.ts";
import { exportIfc } from "./ifc.ts";

function aperture(sill = 0, height = 2100) {
  const p = emptyProject("retained-aperture");
  p.walls.push({ ...newWall(p, p.levels[0].id, [0, 0], [4000, 0], [{
    id: "solid", name: "Concrete", thickness: 200, kind: "solid", hatch: "concrete",
    densityKgM3: null, rateM2: null, supplierReference: "", rateRevision: "", wastePercent: 0,
  }]), lifecycle: { status: "existing", reference: "Survey S01" } });
  p.openings.push({ id: "retained-hole", revision: 1, wallId: p.walls[0].id, tag: "D01", kind: "void", offset: 2000,
    width: 900, height, sill, hinge: "left", swing: "in", lifecycle: { status: "demolished", reference: "Remove fixture / retain hole" } });
  p.section = { a: [2000, -1000], b: [2000, 1000] };
  return validateProject(p);
}

test("retained aperture plan has jamb boundaries and explicit void label without fixture swing or glazing bars", () => {
  const p = aperture(), bytes = JSON.stringify(p);
  const items = primitives(p, p.levels[0].id, "plan").filter(item => item.id === "retained-hole");
  assert.equal(items.filter(item => item.kind === "line").length, 2);
  assert.equal(items.some(item => item.kind === "arc"), false);
  assert.deepEqual(items.filter(item => item.kind === "text").map(item => item.text), ["VOID D01"]);
  assert.equal(JSON.stringify(p), bytes);
});

test("retained aperture elevation is visibly unfilled and labelled instead of a door/window fixture", () => {
  const p = aperture(900, 1200);
  for (const view of ["north", "south"] as const) {
    const items = primitives(p, p.levels[0].id, view).filter(item => item.id === "retained-hole");
    assert.ok(items.some(item => item.kind === "path" && item.fill === "#ffffff"));
    assert.ok(items.some(item => item.kind === "text" && item.text === "VOID D01"));
    assert.equal(items.some(item => item.fill === "#b5c6c8" || item.fill === "#d3d7d2"), false);
  }
});

test("door-height and elevated window apertures retain exact solid cuts with no fixture mesh", () => {
  for (const [sill, height, expected] of [[0, 2100, 1.782], [900, 1200, 1.944]]) {
    const p = aperture(sill, height), bytes = JSON.stringify(p);
    const volume = wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);
    assert.ok(Math.abs(volume - expected) < 1e-8);
    const scene = buildDesignedScene(p);
    assert.equal(scene.summary.openings, 0);
    assert.equal(scene.summary.apertures, 1);
    assert.equal(scene.objects.some(part => part.category === "door" || part.category === "window"), false);
    assert.equal(scene.objects.some(part => part.id === "retained-hole" || part.id === "retained-hole-frame"), false);
    assert.ok(scene.objects.some(part => part.category === "wall"));
    assert.equal(JSON.stringify(p), bytes);
  }
});

test("IFC aperture emits a semantic wall void without any fixture or fill relation", () => {
  const p = aperture(), bytes = JSON.stringify(p), ifc = exportIfc(p);
  assert.equal((ifc.match(/=IFCOPENINGELEMENT\(/g) ?? []).length, 1);
  assert.equal((ifc.match(/=IFCRELVOIDSELEMENT\(/g) ?? []).length, 1);
  assert.equal((ifc.match(/=IFCRELFILLSELEMENT\(/g) ?? []).length, 0);
  assert.equal((ifc.match(/=IFCDOOR\(/g) ?? []).length, 0);
  assert.equal((ifc.match(/=IFCWINDOW\(/g) ?? []).length, 0);
  assert.equal(JSON.stringify(p), bytes);
});

test("legacy doors continue to have fixtures, swing annotations and IFC fill relations", () => {
  const p = aperture(); p.openings[0].kind = "door";
  const scene = buildDesignedScene(p);
  assert.equal(scene.summary.openings, 1);
  assert.equal(scene.summary.apertures, undefined);
  assert.ok(scene.objects.some(part => part.id === "retained-hole" && part.category === "door"));
  assert.ok(primitives(p, p.levels[0].id, "plan").some(item => item.id === "retained-hole" && item.kind === "arc"));
  assert.equal((exportIfc(p).match(/=IFCRELFILLSELEMENT\(/g) ?? []).length, 1);
});
