import test from "node:test";
import assert from "node:assert/strict";
import { drawingRegister, drawingRegisterSchema, paperScaleLabel, scaleBarMm } from "./drawingRegister.ts";
import type { IssueSetReview } from "./issueSet.ts";

function review(sheets: IssueSetReview["sheets"]): IssueSetReview {
  return {
    sheets,
    projectSnapshot: "{}",
    purpose: "For Construction",
    designRevision: "B",
    modelRevision: 4,
    projectName: "Register test project",
  };
}

const sheet = (over: Partial<IssueSetReview["sheets"][number]>) => ({
  sheetId: "s1",
  number: "A-101",
  name: "Ground Floor Plan",
  size: "A1" as const,
  scale: "100",
  viewports: 1,
  ...over,
});

const ISSUED_AT = new Date("2026-09-18T02:00:00.000Z");

test("the register prints each sheet's scale qualified by the paper it is drawn on", () => {
  const register = drawingRegister(
    review([
      sheet({ sheetId: "s1", number: "A-101", size: "A1", scale: "100" }),
      sheet({ sheetId: "s2", number: "A-102", size: "A3", scale: "50", name: "Sections" }),
    ]),
    ISSUED_AT,
  );

  assert.equal(register.sheets[0].scaleLabel, "1:100 @ A1");
  assert.equal(register.sheets[1].scaleLabel, "1:50 @ A3");
  assert.equal(register.sheetCount, 2);
  assert.equal(register.issuedAt, "2026-09-18T02:00:00.000Z");
  assert.deepEqual(register.sheets.map((row) => row.position), [1, 2]);
});

test("the same ratio on two paper sizes is two register entries, not one", () => {
  const register = drawingRegister(
    review([
      sheet({ sheetId: "s1", number: "A-101", size: "A1", scale: "100" }),
      sheet({ sheetId: "s2", number: "A-102", size: "A3", scale: "100", name: "Ground Floor Plan (reduced)" }),
    ]),
    ISSUED_AT,
  );

  assert.equal(register.scales.length, 2);
  assert.deepEqual(register.scales.map((entry) => entry.label), ["1:100 @ A1", "1:100 @ A3"]);
  assert.deepEqual(register.scales.map((entry) => entry.sheets), [1, 1]);
});

test("repeated paper-scales are counted once in the scale summary", () => {
  const register = drawingRegister(
    review([
      sheet({ sheetId: "s1", number: "A-101", scale: "100" }),
      sheet({ sheetId: "s2", number: "A-102", name: "First Floor Plan", scale: "100" }),
      sheet({ sheetId: "s3", number: "A-201", name: "Sections", scale: "50" }),
    ]),
    ISSUED_AT,
  );

  assert.equal(register.scales.length, 2);
  assert.deepEqual(register.scales.map((entry) => [entry.label, entry.sheets]), [
    ["1:100 @ A1", 2],
    ["1:50 @ A1", 1],
  ]);
});

test("a scale bar is the same length on paper whatever the paper size, which is why the label carries it", () => {
  // 5 m at 1:100 is 50 mm of paper; at 1:50 it is 100 mm. Neither depends on A1 or A3.
  assert.equal(scaleBarMm("100"), 50);
  assert.equal(scaleBarMm("50"), 100);
  assert.equal(scaleBarMm("200"), 25);
  assert.equal(scaleBarMm(100, 10), 100);

  const register = drawingRegister(review([sheet({ scale: "50" })]), ISSUED_AT);
  assert.equal(register.scales[0].barMm, 100);
  // Every bar the register draws fits inside the narrowest paper the set supports (A3 portrait: 297 mm).
  for (const entry of register.scales) assert.ok(entry.barMm < 297, `${entry.label} bar does not fit an A3 sheet`);
});

test("a register refuses a scale and a paper size the sheet set does not define", () => {
  assert.equal(paperScaleLabel("100", "A3"), "1:100 @ A3");
  assert.throws(() => paperScaleLabel("75", "A3"), /one of the sheet set's scales/);
  assert.throws(() => paperScaleLabel("100", "A0"), /one of the sheet sizes/);
  assert.throws(() => scaleBarMm("0"), /positive scale/);
});

test("the register is a closed shape: a stored register with an unknown field is refused", () => {
  const register = drawingRegister(review([sheet({})]), ISSUED_AT);
  drawingRegisterSchema.parse(register);
  assert.throws(
    () => drawingRegisterSchema.parse({ ...register, sheets: [{ ...register.sheets[0], extra: 1 }] }),
    /unrecognized key/i,
  );
  assert.throws(() => drawingRegisterSchema.parse({ ...register, extra: 1 }), /unrecognized key/i);
  // A register with no sheets, or a sheet count that disagrees with the rows, cannot be constructed.
  assert.throws(() => drawingRegisterSchema.parse({ ...register, sheets: [] }), /at least|too small|>=1/i);
  assert.throws(
    () => drawingRegisterSchema.parse({ ...register, sheets: register.sheets.slice(0, 0) }),
    /at least|too small|>=1/i,
  );
});
