import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoofForm, createEmptyRoofForm, editRoofForm, roofFormInput, roofFormSchema } from "./roofForm.ts";

const qa = () => ({ calculated: false, planes: [{ id: "QA synthetic roof", grossPlanAreaM2: "80", pitchDegrees: "36.86989764584402",
  measurementReference: "QA supplied 10 by 8 horizontal plane", pitchReference: "QA supplied rise 3 / run 4",
  openings: [{ id: "QA synthetic opening", planAreaM2: "4", measurementReference: "QA supplied 2 by 2 horizontal opening" }],
}] });

test("empty draft persists empty strings without fabricating a zero area or flat pitch", () => {
  const empty = createEmptyRoofForm();
  assert.deepEqual(roofFormSchema.parse(JSON.parse(JSON.stringify(empty))), empty);
  assert.equal(empty.planes[0].pitchDegrees, "");
  assert.equal(empty.planes[0].measurementReference, "");
  assert.throws(() => calculateRoofForm(empty), /explicit non-negative decimal/);
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchDegrees: " " }] }), /explicit non-negative decimal/);
});

test("form converts explicit QA areas/pitch through actual helper to 100 gross, 5 opening, 95 net", () => {
  const form = qa();
  const before = structuredClone(form);
  const result = calculateRoofForm(form);
  assert.deepEqual(result.totals, { grossTrueAreaM2: 100, openingTrueAreaM2: 5, netTrueAreaM2: 95 });
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.planes[0].measurementReference, form.planes[0].measurementReference);
  assert.deepEqual(form, before);
});

test("multiple planes develop with separate pitches and edits require explicit recalculation", () => {
  const form = qa();
  form.calculated = true;
  form.planes.push({ ...form.planes[0], id: "QA flat roof", grossPlanAreaM2: "20", pitchDegrees: "0", openings: [] });
  assert.equal(calculateRoofForm(form).totals.netTrueAreaM2, 115);
  const changed = editRoofForm(form.planes.map((plane, index) => index === 0 ? { ...plane, grossPlanAreaM2: "84" } : plane));
  assert.equal(changed.calculated, false);
  assert.equal(form.calculated, true);
  assert.equal(calculateRoofForm(changed).totals.netTrueAreaM2, 120);
});

test("form rejects coercion traps and retains existing domain validation", () => {
  for (const bad of ["", " ", "0x50", "80 m2", "1,000", "Infinity", "NaN", "-1"]) {
    assert.throws(() => roofFormInput({ ...qa(), planes: [{ ...qa().planes[0], grossPlanAreaM2: bad }] }));
  }
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchDegrees: "90" }] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchReference: "" }] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [qa().planes[0], qa().planes[0]] }), /Duplicate roof plane/);
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], openings: [{ ...qa().planes[0].openings[0], planAreaM2: "81" }] }] }), /exceed gross/);
  assert.throws(() => roofFormSchema.parse({ ...qa(), verified: true }));
});
