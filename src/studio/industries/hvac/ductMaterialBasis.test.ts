import assert from "node:assert/strict";
import test from "node:test";
import { ductMaterialBasisSchema, ductMaterialValuesSchema, evaluateDuctMaterialBasis, recordDuctMaterialReview, type DuctMaterialBasis, type DuctMaterialValues } from "./ductMaterialBasis.ts";
import { calculateStraightDuctDraft } from "./straightDuct.ts";
import { calculateStraightDuctWrapDraft } from "./straightDuctWrap.ts";

// Arithmetic-only synthetic fixture; these numbers are not a normative gauge table.
const values = (): DuctMaterialValues => ({ material: "galvanized-steel", gaugeLabel: "Synthetic G-01 (not a standard)",
  thickness: { value: 0.5, unit: "mm", sourceReference: "Synthetic thickness row" },
  bulkDensity: { value: 8000, unit: "kg/m3", sourceReference: "Synthetic density row" },
  provenance: { sourceId: "fixture-sheet", sourceRevision: "R1", sourceSha256: "a".repeat(64), sourceReference: "Synthetic arithmetic fixture only", evidenceClass: "declared" } });
const reviewer = () => ({ reviewedBy: "Synthetic test reviewer", reviewedAt: "2026-09-19T12:00:00.000Z" });
const reviewed = () => recordDuctMaterialReview(values(), reviewer());
const operand = (value: number) => ({ value, sourceReference: "Explicit synthetic geometry" });

test("SC12-M01 reviewed explicit mm and kg/m3 produce declared kg/m2, never verified", () => {
  const result = evaluateDuctMaterialBasis(reviewed());
  assert.equal(result.status, "declared");
  assert.equal(result.sheetMassKgPerM2?.value, 4);
  assert.deepEqual(result.calculation, { formula: "thicknessM * bulkDensityKgPerM3", thicknessM: 0.0005, bulkDensityKgPerM3: 8000, value: 4, unit: "kg/m2" });
  assert.equal(result.evidenceStatus, "draft-unverified");
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.sourceAuthenticated, false);
  assert.match(result.sheetMassKgPerM2!.sourceReference, /not source-authenticated or verified/);
  assert.match(result.sheetMassKgPerM2!.sourceReference, /Synthetic thickness row/);
  assert.match(result.sheetMassKgPerM2!.sourceReference, /Synthetic density row/);
  assert.match(result.sheetMassKgPerM2!.sourceReference, /revision R1/);
});

test("SC12-M02 mm/m are equivalent and material/gauge labels do not infer any numeric value", () => {
  for (const material of ["galvanized-steel", "aluminum", "stainless-steel"] as const) {
    const input = values(); input.material = material; input.gaugeLabel = "User-defined label";
    input.thickness = { ...input.thickness, value: .0005, unit: "m" };
    assert.equal(evaluateDuctMaterialBasis(recordDuctMaterialReview(input, reviewer())).sheetMassKgPerM2?.value, 4);
  }
});

test("SC12-M03 missing inputs remain unknown with specific reasons and no mass operand", () => {
  const result = evaluateDuctMaterialBasis({});
  assert.equal(result.status, "unknown");
  assert.deepEqual(result.reasons, ["missing-material", "missing-gauge", "missing-thickness", "missing-density", "missing-provenance", "unreviewed"]);
  assert.equal(result.sheetMassKgPerM2, null);
  for (const [key, reason] of [["material", "missing-material"], ["gaugeLabel", "missing-gauge"], ["thickness", "missing-thickness"], ["bulkDensity", "missing-density"], ["provenance", "missing-provenance"]] as const) {
    const input = reviewed(); delete input[key];
    const missing = evaluateDuctMaterialBasis(input);
    assert.equal(missing.status, "unknown"); assert.ok(missing.reasons.includes(reason)); assert.equal(missing.sheetMassKgPerM2, null);
  }
});

test("SC12-M04 a complete unreviewed row does not become a usable material basis", () => {
  const result = evaluateDuctMaterialBasis(values());
  assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["unreviewed"]);
  assert.equal(result.sheetMassKgPerM2, null); assert.equal(result.verifiedQuoteEligible, false);
});

test("SC12-M05 sample/inferred provenance cannot yield mass even with forged matching review metadata", () => {
  for (const evidenceClass of ["sample", "inferred"] as const) {
    const input = values(); input.provenance.evidenceClass = evidenceClass;
    assert.throws(() => recordDuctMaterialReview(input, reviewer()), /Sample or inferred/);
    const result = evaluateDuctMaterialBasis({ ...input, review: { ...reviewer(), values: input } });
    assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["ineligible-evidence"]);
    assert.equal(result.sheetMassKgPerM2, null); assert.equal(result.verifiedQuoteEligible, false);
  }
});

test("SC12-M06 malformed provenance, unit substitutions and extra verified flags fail closed", () => {
  const base = reviewed();
  for (const input of [null, [], { ...base, verified: true }, { ...base, material: "steel" }, { ...base, gaugeLabel: " " },
    { ...base, thickness: { ...base.thickness, unit: "in" } },
    { ...base, bulkDensity: { ...base.bulkDensity, unit: "kg/m2" } },
    { ...base, provenance: { ...base.provenance, sourceSha256: "not-a-hash" } },
    { ...base, provenance: { ...base.provenance, sourceReference: " " } },
    { ...base, provenance: { ...base.provenance, evidenceClass: "verified" } },
    { ...base, review: { ...base.review, reviewedBy: " " } },
    { ...base, review: { ...base.review, reviewedAt: "yesterday" } }]) {
    const result = evaluateDuctMaterialBasis(input);
    assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["invalid-input"]);
    assert.equal(result.sheetMassKgPerM2, null); assert.equal(result.verifiedQuoteEligible, false);
  }
});

test("SC12-M07 only finite positive numeric operands are accepted without coercion", () => {
  for (const field of ["thickness", "bulkDensity"] as const) for (const value of [0, -1, NaN, Infinity, -Infinity, "0.5", null, Number.MAX_SAFE_INTEGER + 1]) {
    const input = reviewed();
    const result = evaluateDuctMaterialBasis({ ...input, [field]: { ...input[field], value } });
    assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["invalid-input"]); assert.equal(result.sheetMassKgPerM2, null);
  }
});

test("SC12-M08 conversion underflow and derived overflow are unknown rather than zero/infinite mass", () => {
  const underflow = values(); underflow.thickness.value = Number.MIN_VALUE;
  const overflow = values(); overflow.thickness = { ...overflow.thickness, value: Number.MAX_SAFE_INTEGER, unit: "m" };
  for (const input of [underflow, overflow]) {
    const result = evaluateDuctMaterialBasis(recordDuctMaterialReview(input, reviewer()));
    assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["outside-numeric-range"]); assert.equal(result.sheetMassKgPerM2, null);
  }
});

test("SC12-M09 changing any reviewed material, gauge, value or provenance invalidates the review", () => {
  const mutations: Array<(input: DuctMaterialBasis) => void> = [
    input => { input.material = "aluminum"; }, input => { input.gaugeLabel = "Different gauge"; },
    input => { input.thickness!.value = .6; }, input => { input.bulkDensity!.value = 7000; },
    input => { input.thickness!.sourceReference = "Different thickness source"; },
    input => { input.provenance!.sourceRevision = "R2"; }, input => { input.provenance!.sourceSha256 = "b".repeat(64); },
  ];
  for (const mutate of mutations) {
    const input = reviewed(); mutate(input);
    const result = evaluateDuctMaterialBasis(input);
    assert.equal(result.status, "unknown"); assert.ok(result.reasons.includes("review-outdated")); assert.equal(result.sheetMassKgPerM2, null);
  }
});

test("SC12-M10 a known live source must match id, revision and hash; unavailable remains unknown", () => {
  const input = reviewed(), source = { sourceId: "fixture-sheet", sourceRevision: "R1", sourceSha256: "a".repeat(64) };
  assert.equal(evaluateDuctMaterialBasis(input, source).status, "declared");
  for (const changed of [{ ...source, sourceId: "other" }, { ...source, sourceRevision: "R2" }, { ...source, sourceSha256: "b".repeat(64) }]) {
    const result = evaluateDuctMaterialBasis(input, changed);
    assert.equal(result.status, "unknown"); assert.deepEqual(result.reasons, ["source-mismatch"]); assert.equal(result.sheetMassKgPerM2, null);
  }
  assert.deepEqual(evaluateDuctMaterialBasis(input, null).reasons, ["source-unavailable"]);
  assert.deepEqual(evaluateDuctMaterialBasis(input, { ...source, sourceSha256: "bad" }).reasons, ["source-unavailable"]);
});

test("SC12-M11 explicit review and evaluation are deterministic detached operations", () => {
  const input = values(), original = structuredClone(input), review = reviewer();
  const basis = recordDuctMaterialReview(input, review), result = evaluateDuctMaterialBasis(basis);
  assert.deepEqual(input, original); assert.deepEqual(result, evaluateDuctMaterialBasis(basis));
  input.thickness.value = 9; review.reviewedBy = "Changed";
  assert.equal(basis.thickness!.value, .5); assert.equal(basis.review!.reviewedBy, "Synthetic test reviewer");
  result.basis!.thickness!.value = 8; result.basis!.review!.values.provenance.sourceReference = "Changed";
  assert.equal(basis.thickness!.value, .5); assert.equal(basis.review!.values.provenance.sourceReference, "Synthetic arithmetic fixture only");
  assert.deepEqual(ductMaterialBasisSchema.parse(JSON.parse(JSON.stringify(basis))), basis);
});

test("SC12-M12 existing straight metal and wrap accept the declared operand without changing geometry", () => {
  const result = evaluateDuctMaterialBasis(reviewed()); assert.equal(result.status, "declared");
  if (result.status !== "declared") throw new Error("Expected declared fixture");
  const duct = { sections: [{ id: "D1", shape: "rectangular", lengthM: operand(10), widthM: operand(.5), heightM: operand(.3), sheetMassKgPerM2: result.sheetMassKgPerM2 }] };
  const original = structuredClone(duct), metal = calculateStraightDuctDraft(duct);
  const wrap = calculateStraightDuctWrapDraft({ duct, wraps: [{ sectionId: "D1", insulationThicknessM: operand(.025), longitudinalOverlapM: operand(.05) }] });
  assert.equal(metal.developedAreaM2, 16); assert.equal(metal.sheetMassKg, 64);
  assert.ok(Math.abs(wrap.wrapAreaM2 - 18.5) < 1e-10);
  assert.equal(metal.verifiedQuoteEligible, false); assert.equal(wrap.verifiedQuoteEligible, false); assert.deepEqual(duct, original);
  assert.deepEqual(metal.sections[0].inputs.sheetMassKgPerM2, result.sheetMassKgPerM2);
});

test("SC12-M13 unknown basis leaves legacy mass unknown while metal/wrap geometry remains available", () => {
  const result = evaluateDuctMaterialBasis({}); assert.equal(result.sheetMassKgPerM2, null);
  const duct = { sections: [{ id: "D1", shape: "round", lengthM: operand(10), diameterM: operand(.4) }] };
  const metal = calculateStraightDuctDraft(duct);
  const wrap = calculateStraightDuctWrapDraft({ duct, wraps: [{ sectionId: "D1", insulationThicknessM: operand(.05), longitudinalOverlapM: operand(0) }] });
  assert.equal(metal.sheetMassKg, null); assert.equal(metal.developedAreaM2, Math.PI * .4 * 10);
  assert.equal(wrap.wrapAreaM2, Math.PI * .5 * 10);
});

test("SC12-M14 review metadata and exact source operands roundtrip without dropping provenance", () => {
  const row = reviewed(), parsed = ductMaterialBasisSchema.parse(JSON.parse(JSON.stringify(row)));
  assert.deepEqual(parsed, row); assert.deepEqual(parsed.review!.values, ductMaterialValuesSchema.parse(values()));
  assert.equal(evaluateDuctMaterialBasis(parsed).status, "declared");
});
