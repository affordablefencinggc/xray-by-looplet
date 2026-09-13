import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyQuantities, type ClassificationInput } from "./classification.ts";

function fixture(): ClassificationInput {
  return {
    hierarchyId: "firm-defined", hierarchyRevision: "1",
    nodes: [
      { id: "building", label: "Building", parentId: null },
      { id: "walls", label: "Walls", parentId: "building" },
      { id: "roof", label: "Roof", parentId: "building" },
    ],
    items: [
      { id: "a", quantity: "0.1", unit: "m2", evidence: "measured", source: {
        documentId: "synthetic-test-source", sha256: "a".repeat(64), revision: "B", sheet: 3,
        regionId: "region-a", calibrationId: "declared-test-calibration",
      } },
      { id: "b", quantity: "0.2", unit: "m2", evidence: "measured", source: null },
    ],
    assignments: [{ itemId: "a", nodeId: "walls" }, { itemId: "b", nodeId: "roof" }],
  };
}

test("exact quantities reconcile once at report and parent levels", () => {
  const result = classifyQuantities(fixture());
  assert.equal(result.classificationComplete, true);
  assert.deepEqual(result.totals, [{ unit: "m2", evidence: "measured", quantity: "0.3", itemCount: 2 }]);
  assert.deepEqual(result.nodes[0].rollup, result.totals);
  assert.deepEqual(result.nodes[0].direct, []);
  assert.equal(result.nodes[1].direct[0].quantity, "0.1");
  assert.equal(result.nodes[2].direct[0].quantity, "0.2");
  assert.deepEqual(result.classifiedTotals, result.totals);
});

test("missing assignment remains explicit residue, with no silent quantity loss", () => {
  const input = fixture();
  input.assignments.pop();
  const result = classifyQuantities(input);
  assert.equal(result.classificationComplete, false);
  assert.deepEqual(result.unclassifiedItemIds, ["b"]);
  assert.equal(result.unclassifiedTotals[0].quantity, "0.2");
  assert.equal(result.classifiedTotals[0].quantity, "0.1");
  assert.equal(result.totals[0].quantity, "0.3");
  assert.equal(result.rows[1].nodeId, null);
});

test("units and evidence categories cannot be blended into a measured subtotal", () => {
  const input = fixture();
  input.items.push(
    { id: "c", quantity: "3", unit: "lm", evidence: "measured", source: null },
    { id: "d", quantity: "100", unit: "m2", evidence: "sample", source: null },
    { id: "e", quantity: "7", unit: "m2", evidence: "inferred", source: null },
    { id: "f", quantity: "2", unit: "m2", evidence: "unverified", source: null },
  );
  input.assignments = input.items.map(item => ({ itemId: item.id, nodeId: "walls" }));
  const result = classifyQuantities(input);
  assert.equal(result.totals.length, 5);
  assert.equal(result.totals.find(row => row.unit === "m2" && row.evidence === "measured")!.quantity, "0.3");
  assert.deepEqual(result.nodes[0].rollup, result.totals);
  assert.equal(result.rows[3].evidence, "sample");
});

test("reclassification preserves every quantity and source without mutating input", () => {
  const input = fixture();
  const snapshot = structuredClone(input);
  const original = classifyQuantities(input);
  const changed = classifyQuantities({ ...input, assignments: input.items.map(item => ({ itemId: item.id, nodeId: "walls" })) });
  assert.deepEqual(input, snapshot);
  assert.deepEqual(changed.totals, original.totals);
  assert.deepEqual(changed.rows.map(({ nodeId: _node, ...item }) => item), input.items);
  assert.equal(changed.nodes[1].direct[0].quantity, "0.3");
  assert.deepEqual(changed.nodes[2].direct, []);
  changed.rows[0].source!.revision = "mutated-output";
  assert.equal(input.items[0].source!.revision, "B");
});

test("large and fine decimal values do not lose precision", () => {
  const input = fixture();
  input.items[0].quantity = "9007199254740993.000000000000000001";
  input.items[1].quantity = "0.999999999999999999";
  assert.equal(classifyQuantities(input).totals[0].quantity, "9007199254740994");
});

test("zero quantities and direct parent assignments are accounted for once", () => {
  const input = fixture();
  input.items[1].quantity = "0";
  input.assignments[0].nodeId = "building";
  const result = classifyQuantities(input);
  assert.equal(result.nodes[0].direct[0].quantity, "0.1");
  assert.equal(result.nodes[0].rollup[0].quantity, "0.1");
  assert.equal(result.nodes[0].rollup[0].itemCount, 2);
});

test("invalid graphs, duplicate identities and unresolved assignments fail closed", () => {
  const cases: Array<(input: ClassificationInput) => void> = [
    input => { input.nodes.push(input.nodes[0]); },
    input => { input.nodes[0].parentId = "walls"; },
    input => { input.nodes[1].parentId = "walls"; },
    input => { input.nodes[1].parentId = "absent"; },
    input => { input.items.push(input.items[0]); },
    input => { input.assignments.push(input.assignments[0]); },
    input => { input.assignments.push({ itemId: "a", nodeId: "roof" }); },
    input => { input.assignments[0].itemId = "absent"; },
    input => { input.assignments[0].nodeId = "absent"; },
  ];
  for (const mutate of cases) {
    const input = fixture(); mutate(input);
    assert.throws(() => classifyQuantities(input));
  }
});

test("invalid quantities and malformed source metadata are rejected at runtime", () => {
  for (const quantity of ["-1", "NaN", "Infinity", "1e3", "00", ".1", "1.", "", "1".repeat(81)]) {
    const input = fixture(); input.items[0].quantity = quantity;
    assert.throws(() => classifyQuantities(input));
  }
  const input = fixture(); input.items[0].source!.sha256 = "not-a-hash";
  assert.throws(() => classifyQuantities(input));
});

test("empty hierarchy exposes all items as unclassified; empty report has no totals", () => {
  const input = fixture(); input.nodes = []; input.assignments = [];
  const result = classifyQuantities(input);
  assert.equal(result.classificationComplete, false);
  assert.deepEqual(result.unclassifiedTotals, result.totals);
  input.items = [];
  const empty = classifyQuantities(input);
  assert.equal(empty.classificationComplete, true);
  assert.deepEqual(empty.totals, []);
});

test("declared measurement status does not confer source verification or issue authority", () => {
  const result = classifyQuantities(fixture());
  assert.equal(result.rows[1].source, null);
  assert.equal(result.rows[1].evidence, "measured");
  assert.equal("verified" in result, false);
  assert.equal("readyToIssue" in result, false);
  assert.equal(result.classificationComplete, true);
  assert.equal(result.status, "draft-classification");
  assert.equal(result.verifiedQuoteEligible, false);
});

test("ordinary fractional zeroes are normalised without changing the quantity", () => {
  const input = fixture();
  input.items[0].quantity = "1.20";
  input.items[1].quantity = "1.0";
  const result = classifyQuantities(input);
  assert.deepEqual(result.rows.map(row => row.quantity), ["1.2", "1"]);
  assert.equal(result.totals[0].quantity, "2.2");
  assert.equal(input.items[0].quantity, "1.20");
  input.items[0].quantity = "0.0";
  assert.equal(classifyQuantities(input).rows[0].quantity, "0");
});
