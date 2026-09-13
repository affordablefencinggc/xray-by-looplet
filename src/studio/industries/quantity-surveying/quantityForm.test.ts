import { test } from "node:test";
import assert from "node:assert/strict";
import { assignQuantityItem, calculateQuantityForm, createEmptyQuantityForm, quantityFormInput, quantityFormSchema, type QuantityForm } from "./quantityForm.ts";

function fixture(): QuantityForm {
  return {
    hierarchyId: "User hierarchy", hierarchyRevision: "A", calculated: false,
    nodes: [
      { key: "root-key", code: "Building", label: "Building works", parentKey: "" },
      { key: "wall-key", code: "Walls", label: "Wall finishes", parentKey: "root-key" },
    ],
    items: [
      { key: "a-key", reference: "a", quantity: "0.10", unit: "m2", evidence: "unverified", nodeKey: "wall-key" },
      { key: "b-key", reference: "b", quantity: "0.20", unit: "m2", evidence: "unverified", nodeKey: "" },
    ],
  };
}

test("empty controlled form contains no invented quantities or source references", () => {
  const empty = createEmptyQuantityForm();
  assert.deepEqual(quantityFormSchema.parse(JSON.parse(JSON.stringify(empty))), empty);
  assert.deepEqual(empty.nodes, []); assert.deepEqual(empty.items, []);
  assert.equal(empty.calculated, false);
  assert.throws(() => calculateQuantityForm(empty), /hierarchy name/);
});

test("manual form resolves hierarchy keys while keeping source null and exact decimal quantities", () => {
  const form = fixture(), before = structuredClone(form);
  const input = quantityFormInput(form), report = calculateQuantityForm(form);
  assert.deepEqual(form, before);
  assert.deepEqual(input.nodes, [
    { id: "Building", label: "Building works", parentId: null },
    { id: "Walls", label: "Wall finishes", parentId: "Building" },
  ]);
  assert.deepEqual(input.assignments, [{ itemId: "a", nodeId: "Walls" }]);
  assert.ok(input.items.every(item => item.source === null && item.evidence === "unverified"));
  assert.equal(report.totals[0].quantity, "0.3");
  assert.equal(report.classifiedTotals[0].quantity, "0.1");
  assert.equal(report.unclassifiedTotals[0].quantity, "0.2");
  assert.deepEqual(report.unclassifiedItemIds, ["b"]);
  assert.equal(report.verifiedQuoteEligible, false);
});

test("reassignment clears the calculated flag and conserves exact totals and source evidence", () => {
  const form = { ...fixture(), calculated: true }, before = structuredClone(form);
  const first = calculateQuantityForm(form);
  const changed = assignQuantityItem(form, "b-key", "wall-key");
  assert.equal(changed.calculated, false);
  assert.deepEqual(form, before);
  const next = calculateQuantityForm(changed);
  assert.deepEqual(next.totals, first.totals);
  assert.equal(next.classifiedTotals[0].quantity, "0.3");
  assert.deepEqual(next.unclassifiedItemIds, []);
  assert.deepEqual(next.unclassifiedTotals, []);
  assert.ok(next.rows.every(row => row.source === null && row.evidence === "unverified"));
  assert.equal(next.classificationComplete, true);
  assert.equal(next.verifiedQuoteEligible, false);
  const unassigned = calculateQuantityForm(assignQuantityItem(changed, "a-key", ""));
  assert.equal(unassigned.unclassifiedTotals[0].quantity, "0.1");
});

test("editing classification codes preserves parent and item identity through stable form keys", () => {
  const form = fixture(); form.nodes[1].code = "Wall-package";
  const report = calculateQuantityForm(form);
  assert.equal(report.rows[0].nodeId, "Wall-package");
  assert.equal(report.nodes[1].parentId, "Building");
  assert.equal(report.nodes[0].rollup[0].quantity, "0.1");
});

test("form quantities never blend units or evidence and cannot promote manual inputs to measured", () => {
  const form = fixture();
  form.items.push({ key: "c-key", reference: "c", quantity: "10", unit: "lm", evidence: "sample", nodeKey: "wall-key" });
  form.items[1].evidence = "inferred";
  const report = calculateQuantityForm(form);
  assert.equal(report.totals.length, 3);
  assert.deepEqual(report.totals.map(row => [row.unit, row.evidence, row.quantity]), [["m2", "unverified", "0.1"], ["m2", "inferred", "0.2"], ["lm", "sample", "10"]]);
  assert.throws(() => quantityFormSchema.parse({ ...form, items: [{ ...form.items[0], evidence: "measured" }] }));
  assert.throws(() => quantityFormSchema.parse({ ...form, items: [{ ...form.items[0], source: { sha256: "a".repeat(64) } }] }));
});

test("invalid references, duplicate codes/items, cycles and invalid decimals fail without partial totals", () => {
  const mutations: Array<(form: QuantityForm) => void> = [
    form => { form.items[0].nodeKey = "missing"; },
    form => { form.nodes[0].parentKey = "missing"; },
    form => { form.nodes[0].parentKey = "wall-key"; },
    form => { form.nodes[1].code = "Building"; },
    form => { form.items[1].reference = "a"; },
    form => { form.items[1].key = "a-key"; },
    form => { form.items[0].quantity = "-1"; },
    form => { form.items[0].quantity = "1,5"; },
    form => { form.items[0].quantity = ""; },
    form => { form.items[0].unit = " "; },
  ];
  for (const change of mutations) { const form = fixture(); change(form); assert.throws(() => calculateQuantityForm(form)); }
  assert.throws(() => assignQuantityItem(fixture(), "missing", "wall-key"));
  assert.throws(() => assignQuantityItem(fixture(), "a-key", "missing"));
});

test("JSON draft roundtrip retains unassigned items and recomputes the same report", () => {
  const form = { ...fixture(), calculated: true };
  const restored = quantityFormSchema.parse(JSON.parse(JSON.stringify(form)));
  assert.deepEqual(calculateQuantityForm(restored), calculateQuantityForm(form));
  assert.equal(restored.items[1].nodeKey, "");
});
