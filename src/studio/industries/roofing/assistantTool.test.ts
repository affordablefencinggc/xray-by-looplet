import assert from "node:assert/strict";
import test from "node:test";
import { name, description, inputSchema, execute } from "./assistantTool.ts";

/** QA-only 3:4:5 roof plane, not an imported/measured source. */
const explicitQaPlane = () => ({ planes: [{
  id: "qa-roof-3-4-5", grossPlanAreaM2: 80,
  measurementReference: "QA user fixture: 10 m × 8 m horizontal projection; not measured",
  pitchDegrees: Math.atan(3 / 4) * 180 / Math.PI,
  pitchReference: "QA user fixture: explicit 3 m rise / 4 m horizontal run",
  openings: [{ id: "qa-skylight", planAreaM2: 4, measurementReference: "QA user fixture: 2 m × 2 m horizontal opening" }],
}] });

test("assistant adapter exposes strict generated schema and explicit draft boundaries", () => {
  assert.equal(name, "calculate_draft_roof_area");
  assert.match(description, /never invent/);
  assert.match(description, /verifiedQuoteEligible:false/);
  assert.equal(inputSchema.type, "object");
  assert.equal(inputSchema.additionalProperties, false);
  assert.deepEqual(inputSchema.required, ["planes"]);
  const planes = inputSchema.properties!.planes;
  assert.ok(planes && typeof planes === "object");
  assert.equal(planes.type, "array");
  const plane = planes.items;
  assert.ok(plane && typeof plane === "object" && !Array.isArray(plane));
  assert.equal(plane.additionalProperties, false);
  assert.deepEqual(plane.required, ["id", "grossPlanAreaM2", "measurementReference", "pitchDegrees", "pitchReference", "openings"]);
});

test("actual adapter returns 100 gross, 5 opening and 95 net from explicit QA fixture", () => {
  const input = explicitQaPlane();
  const before = structuredClone(input);
  const result = execute(input);
  assert.ok(Math.abs(result.totals.grossTrueAreaM2 - 100) < 1e-10);
  assert.ok(Math.abs(result.totals.openingTrueAreaM2 - 5) < 1e-10);
  assert.ok(Math.abs(result.totals.netTrueAreaM2 - 95) < 1e-10);
  assert.equal(result.status, "draft-calculation");
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.planes[0].measurementReference, input.planes[0].measurementReference);
  assert.equal(result.planes[0].pitchReference, input.planes[0].pitchReference);
  assert.deepEqual(result.planes[0].openings, input.planes[0].openings);
  assert.deepEqual(input, before);
  assert.match(result.limitations.join(" "), /not validated/);
  assert.match(result.limitations.join(" "), /overlap or containment/);
});

test("adapter fails closed on missing values, fabricated verification flags and cross-field errors", () => {
  const input = explicitQaPlane();
  assert.throws(() => execute({ planes: [{ ...input.planes[0], pitchDegrees: undefined }] }));
  assert.throws(() => execute({ ...input, verifiedQuoteEligible: true }));
  assert.throws(() => execute({ ...input, expectedJobId: "outside-domain-wrapper" }));
  assert.throws(() => execute({ planes: [{ ...input.planes[0], measurementReference: "" }] }));
  assert.throws(() => execute({ planes: [input.planes[0], input.planes[0]] }), /Duplicate roof plane/);
  assert.throws(() => execute({ planes: [{ ...input.planes[0], openings: [{ ...input.planes[0].openings[0], planAreaM2: 81 }] }] }), /exceed gross/);
  assert.deepEqual(input, explicitQaPlane());
});
