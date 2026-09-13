import assert from "node:assert/strict";
import test from "node:test";
import { calculateStraightDuctDraft } from "./straightDuct.ts";

const value = (value: number, sourceReference = "Synthetic test schedule, revision A") => ({ value, sourceReference });
const rectangular = () => ({ id: "D-1", shape: "rectangular", lengthM: value(10), widthM: value(0.5), heightM: value(0.3) });
const round = () => ({ id: "D-2", shape: "round", lengthM: value(2), diameterM: value(0.4) });

test("10 m of 500 × 300 mm duct has 16 m² lateral area without end caps", () => {
  const result = calculateStraightDuctDraft({ sections: [rectangular()] });
  assert.equal(result.developedAreaM2, 16);
  assert.equal(result.sections[0].perimeterM, 1.6);
  assert.equal(result.sheetMassKg, null);
  assert.equal(result.status, "draft-unverified");
  assert.equal(result.verifiedQuoteEligible, false);
  assert.ok(result.exclusions.includes("end caps"));
});

test("round section retains π precision and adds to rectangular area", () => {
  const result = calculateStraightDuctDraft({ sections: [rectangular(), round()] });
  assert.equal(result.sections[1].developedAreaM2, 0.8 * Math.PI);
  assert.equal(result.developedAreaM2, 16 + 0.8 * Math.PI);
});

test("mass requires an explicit kg/m² operand for every section", () => {
  const section = { ...rectangular(), sheetMassKgPerM2: value(4, "Synthetic sheet mass declaration") };
  assert.equal(calculateStraightDuctDraft({ sections: [section] }).sheetMassKg, 64);
  const partial = calculateStraightDuctDraft({ sections: [section, round()] });
  assert.equal(partial.sections[0].sheetMassKg, 64);
  assert.equal(partial.sections[1].sheetMassKg, null);
  assert.equal(partial.sheetMassKg, null);
});

test("each operand and its reference survive without mutating or aliasing input", () => {
  const input = { sections: [{ ...rectangular(), sheetMassKgPerM2: value(4) }] };
  const before = structuredClone(input);
  const result = calculateStraightDuctDraft(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.sections[0].inputs, input.sections[0]);
  result.sections[0].inputs.lengthM.value = 99;
  assert.equal(input.sections[0].lengthM.value, 10);
});

test("zero, negative, non-finite and numeric-string operands are rejected", () => {
  for (const invalid of [0, -1, NaN, Infinity, "10", null]) {
    assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...rectangular(), lengthM: { value: invalid, sourceReference: "Test" } }] }));
  }
});

test("all dimensions and sheet mass require positive numbers and references", () => {
  for (const field of ["widthM", "heightM", "sheetMassKgPerM2"]) {
    assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...rectangular(), [field]: value(0) }] }));
  }
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...round(), diameterM: value(-1) }] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...rectangular(), lengthM: value(10, "  ") }] }));
});

test("missing, duplicate and whitespace-equivalent IDs cannot double-count silently", () => {
  assert.throws(() => calculateStraightDuctDraft({ sections: [] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [rectangular(), { ...round(), id: " D-1 " }] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...rectangular(), id: "" }] }));
});

test("unsupported fittings, mixed dimension shapes and implicit unit overrides are rejected", () => {
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...round(), shape: "elbow" }] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...round(), widthM: value(1) }] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [rectangular()], unit: "mm" }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...round(), verified: true }] }));
});

test("overflow and positive-area underflow fail rather than emitting invalid quantities", () => {
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...rectangular(), lengthM: value(Number.MAX_SAFE_INTEGER) }] }));
  assert.throws(() => calculateStraightDuctDraft({ sections: [{ ...round(), lengthM: value(Number.MIN_VALUE), diameterM: value(Number.MIN_VALUE) }] }));
});

test("doubling length doubles developed area and supplied sheet mass", () => {
  const first = { ...rectangular(), sheetMassKgPerM2: value(3.75) };
  const second = { ...first, lengthM: value(first.lengthM.value * 2) };
  const a = calculateStraightDuctDraft({ sections: [first] });
  const b = calculateStraightDuctDraft({ sections: [second] });
  assert.equal(b.developedAreaM2, a.developedAreaM2 * 2);
  assert.equal(b.sheetMassKg, a.sheetMassKg! * 2);
});
