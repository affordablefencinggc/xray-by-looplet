import test from "node:test";
import assert from "node:assert/strict";
import { evaluateHvacNetwork, type HvacNetwork } from "./hvacNetwork.ts";
import { hvacRunFrame, hvacRunIntersectsBeam } from "./hvacRunGeometry.ts";
import { Vector3 } from "three";
export function fixture(): HvacNetwork { return { reference: "M-101 revision A", evidence: "sample", occupancy: "residential", nodes: [
  { id: "AHU", zone: "Plant", kind: "equipment", x: 0, y: 2.8, z: 0, designAirflowLs: 300, equipmentTag: "AHU-1" },
  { id: "J1", zone: "East", kind: "junction", x: 4, y: 2.8, z: 0, designAirflowLs: null, equipmentTag: "" },
  { id: "D1", zone: "West", kind: "diffuser", x: 4, y: 2.8, z: 3, designAirflowLs: 150, equipmentTag: "GR-1" }],
  edges: [{ id: "S1", from: "AHU", to: "J1", shape: "rectangular", widthM: .4, heightM: .3, insulationM: .025, availablePlenumM: .5, airflowLs: 300, pressureAllowancePaPerM: null },
    { id: "S2", from: "J1", to: "D1", shape: "rectangular", widthM: .4, heightM: .3, insulationM: .025, availablePlenumM: .5, airflowLs: 150, pressureAllowancePaPerM: 1.2 }], beams: [] }; }
test("connected multi-zone network retains reference and draft status", () => { const r = evaluateHvacNetwork(fixture()); assert.deepEqual(r.issues, []); assert.equal(r.runs[0].lengthM, 4); assert.equal(r.verifiedQuoteEligible, false); assert.equal(r.network.reference, "M-101 revision A"); });
test("mismatched dimensions require an explicit reducer", () => { const n = fixture(); n.edges[1].widthM = .2; assert.ok(evaluateHvacNetwork(n).issues.some(i => i.code === "transition")); n.nodes[1].kind = "reducer"; assert.ok(!evaluateHvacNetwork(n).issues.some(i => i.code === "transition")); });
test("plenum includes insulation on both sides and preserves unknown", () => { const n = fixture(); n.edges[0].availablePlenumM = .34; n.edges[1].availablePlenumM = null; const r = evaluateHvacNetwork(n); assert.ok(r.issues.some(i => i.code === "plenum" && i.target === "S1")); assert.ok(r.issues.some(i => i.code === "unknown-plenum")); });
test("beam crossing is detected, separated beam is not", () => { const n = fixture(); n.beams = [{ id: "B1", min: [1, 2.6, -.5], max: [2, 3, .5] }, { id: "B2", min: [10, 1, 10], max: [11, 4, 11] }]; const clashes = evaluateHvacNetwork(n).issues.filter(i => i.code === "beam"); assert.equal(clashes.length, 1); assert.match(clashes[0].message, /B1/); });
test("missing endpoints, islands, zero runs and duplicate identifiers cannot appear clean", () => { const n = fixture(); n.edges[0].to = "missing"; n.edges[1].to = "J1"; n.nodes.push({ ...n.nodes[2], id: "island" }); n.edges.push({ ...n.edges[0] }); const codes = evaluateHvacNetwork(n).issues.map(i => i.code); for (const code of ["missing-node", "disconnected", "zero-length", "duplicate-id"]) assert.ok(codes.includes(code as typeof codes[number])); });
test("round cross-section uses diameter and rejects invalid geometry", () => { const n = fixture(); n.edges[0].shape = "round"; assert.equal(evaluateHvacNetwork(n).runs[0].areaM2, Math.PI * .4 ** 2 / 4); n.edges[0].widthM = 0; assert.throws(() => evaluateHvacNetwork(n)); });
test("missing equipment marks every node disconnected; cyclic graph terminates", () => { const n = fixture(); n.nodes[0].kind = "junction"; n.edges.push({ ...n.edges[0], id: "S3", from: "D1", to: "AHU" }); assert.equal(evaluateHvacNetwork(n).issues.filter(i => i.code === "disconnected").length, 3); });

test("vertical tall rectangular run detects the wide local height missed by horizontal expansion", () => {
  const n = fixture(); n.nodes = n.nodes.slice(0, 2); n.edges = n.edges.slice(0, 1);
  Object.assign(n.nodes[0], { x: 0, y: 0, z: 0 }); Object.assign(n.nodes[1], { x: 0, y: 4, z: 0 });
  Object.assign(n.edges[0], { widthM: .2, heightM: 2, insulationM: 0, availablePlenumM: null });
  n.beams = [{ id: "vertical-hit", min: [-.05, 1, .8], max: [.05, 2, .9] }];
  assert.match(evaluateHvacNetwork(n).issues.find(i => i.code === "beam")!.message, /rectangular envelope/);
});

test("finite end caps do not extend duct length by the section width", () => {
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [4, 0, 0], 2, .2, 0, { min: [4.1, -.05, -.05], max: [4.2, .05, .05] }), false);
});

test("diagonal run rejects a beam outside its oriented cross section", () => {
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [4, 0, 4], .2, .2, 0, { min: [1.8, -.02, 2.15], max: [1.85, .02, 2.2] }), false);
});

test("sloping tall section includes rotated height and insulation", () => {
  const frame = hvacRunFrame([0, 0, 0], [0, 4, 4])!;
  const point = new Vector3(0, .95, 0).applyMatrix4(frame.rotation).add(frame.center);
  const beam = { min: point.clone().addScalar(-.01).toArray() as [number, number, number], max: point.clone().addScalar(.01).toArray() as [number, number, number] };
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [0, 4, 4], .2, 1.6, .2, beam), true);
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [0, 4, 4], .2, 1.6, 0, beam), false);
});

test("touching rectangular faces are clashes while a positive gap is clear", () => {
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [0, 0, 4], 1, 1, 0, { min: [.5, -.1, 1], max: [.6, .1, 2] }), true);
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [0, 0, 4], 1, 1, 0, { min: [.5001, -.1, 1], max: [.6, .1, 2] }), false);
});

test("near-vertical frame is orthonormal and endpoint reversal preserves the occupied box", () => {
  const a: [number, number, number] = [0, 0, 0], b: [number, number, number] = [.000001, 4, .000002];
  const frame = hvacRunFrame(a, b)!;
  const x = new Vector3(), y = new Vector3(), z = new Vector3(); frame.rotation.extractBasis(x, y, z);
  for (const axis of [x, y, z]) assert.ok(Math.abs(axis.length() - 1) < 1e-12);
  for (const dot of [x.dot(y), y.dot(z), z.dot(x)]) assert.ok(Math.abs(dot) < 1e-12);
  const beam = { min: [-.01, 1, .8] as [number, number, number], max: [.01, 2, .9] as [number, number, number] };
  assert.equal(hvacRunIntersectsBeam(a, b, .2, 2, 0, beam), true);
  assert.equal(hvacRunIntersectsBeam(b, a, .2, 2, 0, beam), true);
});

test("round collision remains explicitly conservative and zero-length run creates no phantom solid", () => {
  const n = fixture(); n.edges[0].shape = "round"; n.beams = [{ id: "B", min: [1, 2.7, -.1], max: [2, 2.9, .1] }];
  assert.match(evaluateHvacNetwork(n).issues.find(i => i.code === "beam")!.message, /conservative enclosing box/);
  assert.equal(hvacRunFrame([0, 0, 0], [0, 0, 0]), null);
  assert.equal(hvacRunIntersectsBeam([0, 0, 0], [0, 0, 0], 1, 1, 1, { min: [-1, -1, -1], max: [1, 1, 1] }), false);
});
