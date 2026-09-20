import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { evaluateHvacNetwork, type HvacNetwork } from "./hvacNetwork.ts";
import { fittingSurfacePositions } from "./hvacFittings.ts";
import { calculateHvacSchedules, createHvacPackage, hvacPackageCsv, verifyHvacPackage } from "./hvacSchedules.ts";

function fixture(): HvacNetwork {
  const node = (id: string, kind: HvacNetwork["nodes"][number]["kind"], x: number, z: number) => ({ id, kind, x, y: 0, z, zone: id === "A" ? "Plant" : "East", designAirflowLs: null, equipmentTag: "", ...(kind === "elbow" || kind === "tee" || kind === "reducer" ? { fitting: { reference: "Synthetic fitting sheet", radiusM: 1, lengthM: kind === "tee" ? .5 : 1 } } : {}) });
  const edge = (id: string, from: string, to: string, widthM = .4) => ({ id, from, to, shape: "rectangular" as const, widthM, heightM: .3, insulationM: .025, availablePlenumM: 10, airflowLs: 100, pressureAllowancePaPerM: null });
  return { reference: "Synthetic fitting topology only", evidence: "sample", occupancy: "residential", nodes: [node("A", "equipment", -4, 0), node("E", "elbow", 0, 0), node("T", "tee", 0, 4), node("R", "reducer", 4, 4), node("Z", "diffuser", 8, 4), node("B", "diffuser", 0, 8)], edges: [edge("AE", "A", "E"), edge("ET", "E", "T"), edge("TR", "T", "R"), edge("RZ", "R", "Z", .2), edge("TB", "T", "B")], beams: [] };
}
const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} differs from ${b}`));

test("declared elbow, tee and reducer form a connected multi-zone network with trimmed straight lengths", () => {
  const r = evaluateHvacNetwork(fixture()); assert.deepEqual(r.issues, []); assert.deepEqual(r.fittings.map(f => f.kind), ["elbow", "tee", "reducer"]);
  const run = r.runs.find(e => e.id === "ET")!; near(run.start!, [0, 0, 1]); near(run.end!, [0, 0, 3.5]); assert.ok(Math.abs(run.straightLengthM! - 2.5) < 1e-12); assert.equal(run.lengthM, 4);
  assert.equal(r.verifiedQuoteEligible, false); assert.equal(r.fittings[0].reference, "Synthetic fitting sheet");
});
test("elbow arc has the declared radius, tangent ports and finite geometry", () => {
  const f = evaluateHvacNetwork(fixture()).fittings[0], rings = f.surfaces[0]; near(rings[0].center, [-1, 0, 0]); near(rings.at(-1)!.center, [0, 0, 1]);
  for (const ring of rings) assert.ok(Math.abs(Math.hypot(ring.center[0] + 1, ring.center[2] - 1) - 1) < 1e-12);
  for (const f of evaluateHvacNetwork(fixture()).fittings) for (const surface of f.surfaces) for (const insulated of [false, true]) {
    const values = fittingSurfacePositions(surface, insulated); assert.ok(values.length > 0 && values.length % 9 === 0 && values.every(Number.isFinite));
    for (let i = 0; i < values.length; i++) assert.ok(values[i] >= f.bounds.min[i % 3] - 1e-9 && values[i] <= f.bounds.max[i % 3] + 1e-9);
  }
});
test("rotating the complete network into a vertical plane keeps ports joined and geometry finite", () => {
  const n = fixture(); for (const node of n.nodes) { node.y = node.z; node.z = 0; }
  const r = evaluateHvacNetwork(n); assert.deepEqual(r.issues, []); near(r.runs[1].start!, [0, 1, 0]); near(r.runs[1].end!, [0, 3.5, 0]);
  for (const f of r.fittings) for (const s of f.surfaces) assert.ok(fittingSurfacePositions(s, true).every(Number.isFinite));
});
test("round pipe fittings retain pipe service and do not enter air commissioning schedules", () => {
  const n = fixture(); for (const node of n.nodes) { if (node.kind === "equipment") node.kind = "pump"; if (node.kind === "diffuser") node.kind = "pipe-terminal"; }
  for (const edge of n.edges) Object.assign(edge, { service: "pipe", shape: "round", widthM: edge.id === "RZ" ? .1 : .2, innerDiameterM: edge.id === "RZ" ? .08 : .18, pipeFlowLs: 2 });
  const r = calculateHvacSchedules(n); assert.deepEqual(r.issues, []); assert.ok(r.fittings.every(f => f.service === "pipe")); assert.equal(r.airflow.length, 0); assert.equal(r.commissioning.length, 3);
});
test("missing source or declared fitting size is an explicit issue, never invented geometry", () => {
  for (const field of ["reference", "radiusM"] as const) { const n = fixture(); Object.assign(n.nodes[1].fitting!, { [field]: field === "reference" ? "" : null }); const r = evaluateHvacNetwork(n); assert.ok(r.issues.some(i => i.code === "fitting" && i.target === "E")); assert.ok(!r.fittings.some(f => f.id === "E")); }
  const n = fixture(); n.nodes[3].fitting = undefined; assert.ok(evaluateHvacNetwork(n).issues.some(i => i.code === "fitting" && i.target === "R"));
});
test("elbow radius cannot fold through its own insulated section or consume a run", () => {
  for (const radiusM of [.1, 5]) { const n = fixture(); n.nodes[1].fitting!.radiusM = radiusM; assert.ok(!evaluateHvacNetwork(n).fittings.some(f => f.id === "E")); }
});
test("collinear elbow, non-collinear reducer and skew tee ports fail closed", () => {
  const elbow = fixture(); elbow.nodes[0].x = 0; elbow.nodes[0].z = -4; assert.ok(!evaluateHvacNetwork(elbow).fittings.some(f => f.id === "E"));
  const reducer = fixture(); reducer.nodes[4].z = 5; assert.ok(!evaluateHvacNetwork(reducer).fittings.some(f => f.id === "R"));
  const tee = fixture(); tee.nodes[5].x = 1; assert.ok(!evaluateHvacNetwork(tee).fittings.some(f => f.id === "T"));
});
test("elbow and tee require matching sections and the expected number of distinct runs", () => {
  const n = fixture(); n.edges[1].widthM = .7; const r = evaluateHvacNetwork(n); assert.ok(!r.fittings.some(f => f.id === "E" || f.id === "T"));
  const missing = fixture(); missing.edges.pop(); assert.ok(!evaluateHvacNetwork(missing).fittings.some(f => f.id === "T"));
});
test("reducer loft joins different section sizes and round-to-rectangular profiles", () => {
  const n = fixture(); n.edges[3].shape = "round"; const r = evaluateHvacNetwork(n), f = r.fittings.find(f => f.id === "R")!;
  assert.equal(f.surfaces[0][0].round, false); assert.equal(f.surfaces[0][1].round, true); assert.equal(f.surfaces[0][1].width, .2); assert.ok(fittingSurfacePositions(f.surfaces[0], true).every(Number.isFinite));
});
test("overlapping cutbacks withhold both fittings and restore untrimmed diagnostic runs", () => {
  const n = fixture(); n.nodes[2].z = 1.2; n.nodes[3].z = 1.2; n.nodes[4].z = 1.2;
  const r = evaluateHvacNetwork(n); assert.ok(r.issues.some(i => i.code === "fitting" && i.message.includes("overlap"))); assert.ok(!r.fittings.some(f => f.id === "E" || f.id === "T")); near(r.runs[1].start!, [0, 0, 0]);
});
test("fitting-only beam intersection is highlighted while shortened straight runs remain clear", () => {
  const n = fixture(); n.beams = [{ id: "BEND-BEAM", min: [-.31, -.05, .28], max: [-.27, .05, .32] }]; const r = evaluateHvacNetwork(n);
  assert.ok(r.issues.some(i => i.code === "fitting-beam" && i.target === "E")); assert.ok(!r.issues.some(i => i.code === "beam")); assert.equal(r.fittings[0].clash, true);
});
test("fitting clearance preserves unknown voids and flags conservative height conflicts", () => {
  const n = fixture(); n.edges[0].availablePlenumM = null; n.edges[1].availablePlenumM = .1; const r = evaluateHvacNetwork(n);
  assert.ok(r.issues.some(i => i.code === "unknown-plenum" && i.target === "E")); assert.ok(r.issues.some(i => i.code === "fitting-plenum" && i.target === "E"));
});
test("fitting surface end profiles contain declared rectangular corners", () => {
  const f = evaluateHvacNetwork(fixture()).fittings.find(f => f.id === "R")!, ring = f.surfaces[0][0];
  const corner = new Vector3(...ring.center).addScaledVector(new Vector3(...ring.right), ring.width / 2).addScaledVector(new Vector3(...ring.up), ring.height / 2);
  const values = fittingSurfacePositions(f.surfaces[0], false); assert.ok(values.some((_, i) => i % 3 === 0 && Math.hypot(values[i] - corner.x, values[i + 1] - corner.y, values[i + 2] - corner.z) < 1e-10));
});
test("sealed fitting schedule preserves source references and detects fitting tampering", async () => {
  const p = await createHvacPackage(fixture(), "fitting-project", null); await verifyHvacPackage(p); const csv = await hvacPackageCsv(p);
  for (const token of ["Fitting node", "elbow", "tee", "reducer", "Synthetic fitting sheet"]) assert.ok(csv.includes(token));
  assert.equal(p.content.schedules.commissioning.length, 3); const bad = structuredClone(p); bad.content.network.nodes[1].fitting!.radiusM = 2; await assert.rejects(verifyHvacPackage(bad));
});
