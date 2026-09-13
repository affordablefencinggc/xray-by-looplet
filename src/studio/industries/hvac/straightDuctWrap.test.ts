import assert from "node:assert/strict";
import test from "node:test";
import { execute, name, inputSchema } from "./ductWrapTool.ts";
const n = (value: number) => ({ value, sourceReference: "Explicit synthetic schedule" });
const input = () => ({ duct: { sections: [{ id: "D1", shape: "rectangular", lengthM: n(10), widthM: n(.5), heightM: n(.3) }] }, wraps: [{ sectionId: "D1", insulationThicknessM: n(.025), longitudinalOverlapM: n(.05) }] });
test("tool uses declared strict wrap schema and keeps explicit reference provenance", () => {
  assert.equal(name, "calculate_draft_duct_wrap"); assert.equal(inputSchema.type, "object");
  const data = input(); const before = structuredClone(data); const result = execute(data);
  assert.ok(Math.abs(result.wrapAreaM2 - 18.5) < 1e-10); assert.equal(result.verifiedQuoteEligible, false);
  assert.deepEqual(data, before); data.wraps[0].insulationThicknessM.sourceReference = "changed";
  assert.equal(result.sections[0].inputs.insulationThicknessM.sourceReference, "Explicit synthetic schedule");
});
test("wrap rejects unknown or duplicate sections, invalid references and overflow", () => {
  const unknown = input(); unknown.wraps[0].sectionId = "missing"; assert.throws(() => execute(unknown), /unknown/);
  const dup = input(); dup.wraps.push(dup.wraps[0]); assert.throws(() => execute(dup), /unique/);
  const empty = input(); empty.wraps[0].insulationThicknessM.sourceReference = " "; assert.throws(() => execute(empty));
  const overflow = input(); overflow.wraps[0].insulationThicknessM.value = Number.MAX_SAFE_INTEGER; assert.throws(() => execute(overflow));
  assert.throws(() => execute({ ...input(), verified: true }));
});
test("returned rectangular working includes twice thickness on both dimensions", () => {
  const result = execute(input()); const section = result.sections[0]; const steps = section.calculationSteps;
  assert.equal(steps[0].formula, "2 * (widthM + 2 * insulationThicknessM + heightM + 2 * insulationThicknessM)");
  assert.equal(steps[0].substitution, "2 * (0.5 + 2 * 0.025 + 0.3 + 2 * 0.025)");
  assert.equal(steps[0].result, 2 * (.5 + 2 * .025 + .3 + 2 * .025));
  assert.equal(steps[1].result, steps[0].result * 10);
  assert.equal(steps[2].result, .05 * 10);
  assert.equal(steps[3].result, steps[1].result + steps[2].result);
  assert.equal(steps[3].result, section.wrapAreaM2);
});
