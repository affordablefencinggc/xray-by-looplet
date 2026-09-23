import test from "node:test";
import assert from "node:assert/strict";
import { calculateHvacSchedules, createHvacPackage, hvacPackageCsv, hvacPackagePdf, verifyHvacPackage } from "./hvacSchedules.ts";
import { hvacNetworkSchema, type HvacNetwork } from "./hvacNetwork.ts";
import { HVAC_ESTIMATE_LABEL } from "./hvacPolicy.ts";

const fixture = (): HvacNetwork => ({ reference: "Synthetic arithmetic, not design values", evidence: "sample", occupancy: "residential", beams: [],
  nodes: [{ id: "A", kind: "equipment", zone: "Plant", x: 0, y: 0, z: 0, designAirflowLs: null, equipmentTag: "" },
    { id: "B", kind: "diffuser", zone: "East", x: 5, y: 0, z: 0, designAirflowLs: null, equipmentTag: "" }],
  edges: [{ id: "AB", from: "A", to: "B", shape: "rectangular", widthM: .2, heightM: .1, insulationM: 0, availablePlenumM: null,
    airflowLs: 140, pressureAllowancePaPerM: 1.5, fluidDensityKgM3: 1.2, darcyFrictionFactor: .02, pressureSourceReference: "Synthetic fluid and Darcy f" }] });
const near = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const pressure = (n: HvacNetwork) => calculateHvacSchedules(n).pressureLoss;
const fitting = (): HvacNetwork => {
  const n = fixture(); n.nodes[1].kind = "elbow"; n.nodes[1].fitting = { reference: "Synthetic bend", radiusM: 1, lengthM: null };
  n.nodes[1].lossPaths = [{ inletEdgeId: "AB", outletEdgeId: "BC", velocityEdgeId: "AB", coefficientK: .5, reference: "Synthetic K based on upstream velocity" }];
  n.nodes.push({ ...n.nodes[0], id: "C", kind: "diffuser", x: 5, z: 5 }); n.edges.push({ ...n.edges[0], id: "BC", from: "B", to: "C" }); return n;
};
test("Darcy estimate converts L/s, uses rectangular hydraulic diameter and keeps entered allowance separate", () => {
  const result = calculateHvacSchedules(fixture()), r = result.pressureLoss.straight[0];
  near(r.velocityMs, 7); near(r.hydraulicDiameterM, .13333333333333333); near(r.lossPa, 22.05);
  assert.deepEqual(r.reasons, []); assert.equal(result.airflow[0].pressureAllowancePa, 7.5); assert.equal(result.estimateLabel, HVAC_ESTIMATE_LABEL);
});
test("round duct uses diameter and pipe uses inside diameter and liquid flow", () => {
  const n = fixture(); Object.assign(n.edges[0], { shape: "round", widthM: .4, airflowLs: Math.PI * .4 ** 2 / 4 * 7 * 1000 }); near(pressure(n).straight[0].lossPa, 7.35);
  n.nodes[0].kind = "pump"; n.nodes[1].kind = "pipe-terminal";
  Object.assign(n.edges[0], { service: "pipe", widthM: .12, innerDiameterM: .1, pipeFlowLs: 2, fluidDensityKgM3: 1000, darcyFrictionFactor: .03 });
  const r = pressure(n).straight[0]; near(r.hydraulicDiameterM, .1); near(r.lossPa, .03 * 5 / .1 * 1000 * (.002 / (Math.PI * .1 ** 2 / 4)) ** 2 / 2);
  n.edges[0].innerDiameterM = null; assert.equal(pressure(n).straight[0].lossPa, null);
});
test("missing pressure operands stay unknown; a Pa/m allowance never supplies a friction factor", () => {
  for (const field of ["fluidDensityKgM3", "darcyFrictionFactor", "airflowLs", "pressureSourceReference"] as const) {
    const n = fixture(); Object.assign(n.edges[0], { [field]: field === "pressureSourceReference" ? "" : null });
    const r = pressure(n).straight[0]; assert.equal(r.lossPa, null); assert.ok(r.reasons.length);
  }
});
test("fitting K uses its selected velocity basis and straight losses exclude fitting cutbacks", () => {
  const n = fitting(), result = pressure(n); near(result.straight[0].straightLengthM, 4); near(result.straight[0].lossPa, 17.64); near(result.fittings[0].lossPa, 14.7);
  n.edges[1].airflowLs = 70; n.nodes[1].lossPaths![0].velocityEdgeId = "BC"; near(pressure(n).fittings[0].lossPa, 3.675);
  n.nodes[1].lossPaths![0].coefficientK = 0; near(pressure(n).fittings[0].lossPa, 0);
  assert.ok(!("totalLossPa" in result), "Parallel branches must not be summed as a series circuit");
});
test("bad paths, duplicate IDs, missing K/source and unreviewable fitting geometry never imply zero loss", () => {
  for (const mutate of [
    (n: HvacNetwork) => { n.nodes[1].lossPaths = []; },
    (n: HvacNetwork) => { n.nodes[1].lossPaths![0].coefficientK = null; },
    (n: HvacNetwork) => { n.nodes[1].lossPaths![0].reference = ""; },
    (n: HvacNetwork) => { n.nodes[1].lossPaths![0].velocityEdgeId = "missing"; },
    (n: HvacNetwork) => { n.nodes[1].lossPaths![0].inletEdgeId = "BC"; },
    (n: HvacNetwork) => { n.nodes[1].lossPaths!.push(structuredClone(n.nodes[1].lossPaths![0])); },
    (n: HvacNetwork) => { n.edges.push(structuredClone(n.edges[0])); },
    (n: HvacNetwork) => { n.nodes[1].fitting!.radiusM = null; },
    (n: HvacNetwork) => { n.edges[0].fluidDensityKgM3 = null; },
  ]) { const n = fitting(); mutate(n); const r = pressure(n).fittings[0]; assert.equal(r.lossPa, null); assert.ok(r.reasons.length); }
});
test("invalid coefficients are rejected and overflow is withheld", () => {
  for (const field of ["fluidDensityKgM3", "darcyFrictionFactor"] as const) for (const value of [0, -1, NaN, Infinity]) {
    const n = fixture(); n.edges[0][field] = value; assert.throws(() => hvacNetworkSchema.parse(n));
  }
  const n = fitting(); n.nodes[1].lossPaths![0].coefficientK = -1; assert.throws(() => hvacNetworkSchema.parse(n));
  const huge = fixture(); huge.edges[0].widthM = Number.MIN_VALUE; assert.equal(pressure(huge).straight[0].lossPa, null);
});
test("pressure inputs, results, labels and sources survive the sealed exports and tampering fails", async () => {
  const pack = await createHvacPackage(fitting(), "pressure-proof", null); await verifyHvacPackage(pack);
  const csv = await hvacPackageCsv(pack); for (const text of [HVAC_ESTIMATE_LABEL, "Darcy f", "Fitting pressure loss estimate", "Synthetic K based on upstream velocity", "Velocity basis run"]) assert.ok(csv.includes(text), text);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: await hvacPackagePdf(pack), useSystemFonts: true }).promise; let text = "";
  for (let page = 1; page <= document.numPages; page++) text += (await (await document.getPage(page)).getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
  for (const expected of ["Estimate - not engineering sign-off", "14.700 Pa", "17.640 Pa", "declared Darcy", "velocity basis AB"]) assert.ok(text.includes(expected), expected);
  const tampered = structuredClone(pack); tampered.content.network.nodes[1].lossPaths![0].coefficientK = 1; await assert.rejects(verifyHvacPackage(tampered));
});
