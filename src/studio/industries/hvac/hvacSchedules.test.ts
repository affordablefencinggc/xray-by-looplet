import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { calculateHvacSchedules, createHvacPackage, hvacPackageCsv, hvacPackagePdf, verifyHvacPackage } from "./hvacSchedules.ts";
const input = () => ({ reference: "M-102", evidence: "declared", occupancy: "residential", nodes: [
  { id: "AHU", zone: "West", kind: "equipment", x: 0, y: 3, z: 0, designAirflowLs: 100, equipmentTag: "=UNSAFE()" },
  { id: "D1", zone: "East", kind: "diffuser", x: 5, y: 3, z: 0, designAirflowLs: null, equipmentTag: "" }],
  edges: [{ id: "S1", from: "AHU", to: "D1", shape: "rectangular", widthM: .2, heightM: .1, insulationM: 0, availablePlenumM: null, airflowLs: 140, pressureAllowancePaPerM: 1.5 }], beams: [] });
test("airflow conversion and occupancy-specific project thresholds", () => { const n = input(); assert.ok(Math.abs(calculateHvacSchedules(n).airflow[0].velocityMs! - 7) < 1e-12); assert.equal(calculateHvacSchedules(n).airflow[0].velocityStatus, "review-noise"); n.occupancy = "commercial"; assert.equal(calculateHvacSchedules(n).airflow[0].velocityStatus, "within-project-threshold"); });
test("commissioning tolerance and unknowns never fabricate measured results", () => { const s = calculateHvacSchedules(input()); assert.equal(s.commissioning[0].minimumLs, 90); assert.ok(Math.abs(s.commissioning[0].maximumLs! - 110) < 1e-10); assert.equal(s.commissioning[1].minimumLs, null); assert.equal(s.commissioning[0].measuredLs, null); assert.equal(s.airflow[0].pressureAllowancePa, 7.5); });
test("missing airflow and pressure operands remain unknown", () => { const n = input(); const s = calculateHvacSchedules({ ...n, edges: [{ ...n.edges[0], airflowLs: null, pressureAllowancePaPerM: null }] }); assert.equal(s.airflow[0].velocityMs, null); assert.equal(s.airflow[0].pressureAllowancePa, null); });
test("sealed draft rejects tampered network, computed schedule and delivery identity", async () => { const p = await createHvacPackage(input(), "project-test", null); await verifyHvacPackage(p); assert.match(p.delivery.contentSha256, /^[a-f0-9]{64}$/); for (const mutate of [(x: typeof p) => { x.content.network.reference = "other"; }, (x: typeof p) => { x.content.schedules.commissioning[0].designLs = 1; }, (x: typeof p) => { x.delivery.projectId = "other"; }]) { const copy = structuredClone(p); mutate(copy); await assert.rejects(verifyHvacPackage(copy)); } });
test("CSV escapes formula prefixes, retains unknown and seal; PDF is readable", async () => { const p = await createHvacPackage(input(), "project-test", null); const csv = await hvacPackageCsv(p); assert.ok(csv.includes("'=UNSAFE()")); assert.ok(csv.includes('"unknown"')); assert.ok(csv.includes(p.delivery.contentSha256)); const pdf = await PDFDocument.load(await hvacPackagePdf(p)); assert.ok(pdf.getPageCount() > 0); });

const pipeInput = () => { const n = input(); return { ...n, nodes: n.nodes.map((node, i) => ({ ...node, kind: i === 0 ? "pump" : "pipe-terminal", designPipeFlowLs: i === 0 ? 2 : null })), edges: n.edges.map(edge => ({ ...edge, service: "pipe", shape: "round", widthM: .12, innerDiameterM: .1, pipeFlowLs: 2 })) }; };
test("pipe velocity uses bore and separate liquid flow, never inherited airflow or noise thresholds", () => {
  const s = calculateHvacSchedules(pipeInput()); assert.equal(s.airflow.length, 0); assert.equal(s.pipeFlow.length, 1);
  assert.ok(Math.abs(s.pipeFlow[0].velocityMs! - .002 / (Math.PI * .1 ** 2 / 4)) < 1e-12);
  assert.equal(s.pipeFlow[0].status, "no-pipe-design-limit"); assert.equal(s.commissioning[0].designLs, 2); assert.equal(s.commissioning[0].minimumLs, 1.8); assert.equal(s.commissioning[0].service, "pipe");
  assert.equal(s.commissioning[1].designLs, null); assert.equal(s.commissioning[0].measuredLs, null);
});
test("unknown pipe flow or bore withholds velocity even when legacy airflow is populated", () => {
  for (const field of ["pipeFlowLs", "innerDiameterM"] as const) { const n = pipeInput(); const s = calculateHvacSchedules({ ...n, edges: [{ ...n.edges[0], [field]: null }] }); assert.equal(s.pipeFlow[0].velocityMs, null); }
});
test("pipe CSV, sealed JSON and PDF retain service, both diameters and separate unknowns", async () => {
  const p = await createHvacPackage(pipeInput(), "pipe-project", null); await verifyHvacPackage(p);
  const csv = await hvacPackageCsv(p); for (const text of ["Pipe run", "Outside diameter m", "Inside diameter m", "Pipe flow L/s", '"pipe"', "no-pipe-design-limit"]) assert.ok(csv.includes(text));
  assert.ok((await PDFDocument.load(await hvacPackagePdf(p))).getPageCount() > 0);
  const tampered = structuredClone(p); tampered.content.network.edges[0].pipeFlowLs = 9; await assert.rejects(verifyHvacPackage(tampered));
});
