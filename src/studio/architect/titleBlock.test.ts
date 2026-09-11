import { test } from "node:test";
import assert from "node:assert/strict";
import { fitText, textWidth, titleBlockFields, titleBlockField } from "./titleBlock.ts";

const A1_WIDTH = 841;
const A3_WIDTH = 420;

const project = {
  name: "Courtyard studio",
  address: "12 Example Street, Suburb",
  revision: 4,
  designRevision: "A",
};
const layout = { number: "S-001", size: "A1" as const };

test("short fields are drawn untouched", () => {
  const block = titleBlockFields(project, layout, A1_WIDTH);
  assert.equal(block.anyTruncated, false);
  assert.equal(titleBlockField(block, "name").text, "Courtyard studio");
  assert.equal(titleBlockField(block, "address").text, "12 Example Street, Suburb");
  assert.equal(titleBlockField(block, "number").text, "S-001 / REV A / A1");
});

test("an empty address falls back rather than drawing nothing", () => {
  const block = titleBlockFields({ ...project, address: "" }, layout, A1_WIDTH);
  assert.equal(titleBlockField(block, "address").text, "Project address not specified");
});

test("a maximum-length address is truncated on A3, the narrow sheet", () => {
  // The schema allows 500 characters. Measured: that needs ~702 paper mm, which
  // fits A1's 721 mm left column but overflows A3's 300 mm. A3 is the real case.
  const address = "x".repeat(500);
  const block = titleBlockFields({ ...project, address }, { ...layout, size: "A3" }, A3_WIDTH);
  const field = titleBlockField(block, "address");
  assert.equal(field.truncated, true);
  assert.equal(block.anyTruncated, true);
  assert.ok(field.required > field.available, "a 500 character address must exceed the A3 column");
  assert.ok(
    textWidth(field.text, 2.7) <= field.available,
    `drawn width ${textWidth(field.text, 2.7)} must fit ${field.available}`,
  );
  assert.ok(field.text.endsWith("…"), "truncation must be visible to the reader");
  assert.equal(field.full, address, "the untruncated value is preserved for the caller");
});

test("A1 has room for a maximum-length address, and says so honestly", () => {
  // Recording the measured fact rather than assuming every long value clips.
  const address = "x".repeat(500);
  const block = titleBlockFields({ ...project, address }, layout, A1_WIDTH);
  const field = titleBlockField(block, "address");
  assert.equal(field.truncated, false);
  assert.equal(field.text, address);
  assert.ok(field.required <= field.available);
});

test("a long project name is truncated at the larger font size", () => {
  // 4.5 mm text on A3: the name column is 300 mm, so ~128 characters fit.
  const name = "Redevelopment of the former industrial site at ".repeat(6);
  const block = titleBlockFields({ ...project, name }, { ...layout, size: "A3" }, A3_WIDTH);
  const field = titleBlockField(block, "name");
  assert.equal(field.truncated, true);
  assert.ok(textWidth(field.text, 4.5) <= field.available);
});

test("A3 offers a narrower left column than A1", () => {
  const address = "y".repeat(400);
  const a1 = titleBlockField(titleBlockFields({ ...project, address }, layout, A1_WIDTH), "address");
  const a3 = titleBlockField(
    titleBlockFields({ ...project, address }, { ...layout, size: "A3" }, A3_WIDTH),
    "address",
  );
  assert.ok(a3.available < a1.available, "A3 must offer less room");
  assert.equal(a3.truncated, true, "400 characters overflow A3");
  assert.equal(a1.truncated, false, "400 characters still fit A1");
});

test("the right column truncates a long design revision", () => {
  // designRevision allows 40 characters and shares the column with the number.
  const block = titleBlockFields({ ...project, designRevision: "R".repeat(40) }, layout, A1_WIDTH);
  const field = titleBlockField(block, "number");
  assert.equal(field.truncated, true);
  assert.ok(textWidth(field.text, 3.5) <= field.available);
});

test("fitText never returns text wider than the space allowed", () => {
  for (const size of [2.7, 3.5, 4.5]) {
    for (const available of [0, 1, 5, 20, 100]) {
      const { text } = fitText("z".repeat(300), size, available);
      assert.ok(
        textWidth(text, size) <= Math.max(available, 0),
        `size ${size} available ${available} produced ${textWidth(text, size)}`,
      );
    }
  }
});

test("zero or negative space yields no text rather than throwing", () => {
  assert.deepEqual(fitText("anything", 3, 0), { text: "", truncated: true });
  assert.deepEqual(fitText("", 3, 0), { text: "", truncated: false });
});

test("an unknown field key is refused rather than returning undefined", () => {
  const block = titleBlockFields(project, layout, A1_WIDTH);
  // @ts-expect-error deliberately invalid key
  assert.throws(() => titleBlockField(block, "nope"), /Unknown title block field/);
});
