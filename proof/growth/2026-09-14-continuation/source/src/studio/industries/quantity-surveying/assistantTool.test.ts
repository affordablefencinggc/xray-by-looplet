import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { classificationInputSchema, classifyQuantities, type ClassificationInput } from "./classification.ts";
import { quantityReportCsv } from "./report.ts";
import { description, execute, inputSchema, name } from "./assistantTool.ts";

function example(): ClassificationInput {
  return {
    hierarchyId: "user-defined", hierarchyRevision: "A",
    nodes: [
      { id: "building", label: "Building", parentId: null },
      { id: "wall", label: "Wall package", parentId: "building" },
    ],
    items: [
      { id: "a", quantity: "0.10", unit: "m2", evidence: "sample", source: null },
      { id: "b", quantity: "0.20", unit: "m2", evidence: "sample", source: null },
      { id: "c", quantity: "2", unit: "lm", evidence: "sample", source: null },
      { id: "d", quantity: "3", unit: "m2", evidence: "unverified", source: null },
    ],
    assignments: [{ itemId: "a", nodeId: "wall" }, { itemId: "b", nodeId: "wall" }, { itemId: "c", nodeId: "building" }],
  };
}

test("assistant boundary reconciles exact hierarchy quantities, units and residue without mutating inputs", () => {
  const input=example(), before=structuredClone(input), result=execute(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.totals, [
    { unit: "m2", evidence: "sample", quantity: "0.3", itemCount: 2 },
    { unit: "lm", evidence: "sample", quantity: "2", itemCount: 1 },
    { unit: "m2", evidence: "unverified", quantity: "3", itemCount: 1 },
  ]);
  assert.equal(result.nodes[1].direct[0].quantity, "0.3");
  assert.equal(result.nodes[0].rollup[0].quantity, "0.3");
  assert.deepEqual(result.unclassifiedItemIds, ["d"]);
  assert.equal(result.classificationComplete, false);
  assert.equal(result.status, "draft-classification");
  assert.equal(result.verifiedQuoteEligible, false);
});

test("complete assignment and declared source evidence never enable verified quoting", () => {
  const input=example();
  input.assignments.push({ itemId: "d", nodeId: "wall" });
  input.items[0].evidence="measured";
  input.items[0].source={ documentId: "synthetic-reference", sha256: "a".repeat(64), revision: "1", sheet: 3, regionId: "region", calibrationId: "declared-only" };
  const result=execute(input);
  assert.equal(result.classificationComplete, true);
  assert.equal(result.verifiedQuoteEligible, false);
  assert.deepEqual(result.rows[0].source,input.items[0].source);
  assert.equal(result.totals.filter(row=>row.unit==="m2").length,3);
});

test("tool accepts unknown inputs only after strict validation and rejects graph duplication/cycles", () => {
  assert.throws(()=>execute({ ...example(), currency: "AUD" }));
  const extra=example(); (extra.items[0] as unknown as Record<string,unknown>).rate="10";
  assert.throws(()=>execute(extra));
  const duplicate=example();duplicate.assignments.push(duplicate.assignments[0]);
  assert.throws(()=>execute(duplicate),/Duplicate item assignment/);
  const cycle=example();cycle.nodes[0].parentId="wall";
  assert.throws(()=>execute(cycle),/cycle/);
  const missing=example();missing.assignments[0].nodeId="missing";
  assert.throws(()=>execute(missing),/Unknown classification/);
  assert.throws(()=>execute(null));
});

test("strict tool JSON schema is generated from the actual input boundary", () => {
  assert.equal(name,"classify_draft_quantities");
  assert.deepEqual(inputSchema,z.toJSONSchema(classificationInputSchema,{io:"input"}));
  assert.equal(inputSchema.additionalProperties,false);
  assert.deepEqual([...inputSchema.required!].sort(),["assignments","hierarchyId","hierarchyRevision","items","nodes"]);
  const json=JSON.stringify(inputSchema);
  assert.ok(json.includes('"maxLength":80'));
  assert.ok(json.includes('"pattern"'));
  assert.ok(!json.includes('"currency"'));
  assert.ok(!json.includes('"rate"'));
});

test("explicit root/source nulls remain valid and the declaration explains their meaning", () => {
  const input = example();
  input.nodes = [{ id: "wall", label: "Walls", parentId: null }];
  input.items = input.items.slice(0, 2);
  input.assignments = input.assignments.slice(0, 2);
  const result = execute(input);
  assert.equal(result.totals[0].quantity, "0.3");
  assert.equal(result.classifiedTotals[0].quantity, "0.3");
  assert.deepEqual(result.unclassifiedItemIds, []);
  assert.equal(result.nodes[0].parentId, null);
  assert.deepEqual(result.rows.map(row => row.source), [null, null]);
  assert.equal(result.verifiedQuoteEligible, false);
  const schema = inputSchema as any;
  assert.ok(schema.properties.nodes.items.properties.parentId.anyOf.some((part: any) => part.type === "null"));
  assert.match(schema.properties.nodes.items.properties.parentId.description, /JSON null.*top-level/);
  assert.ok(schema.properties.items.items.properties.source.anyOf.some((part: any) => part.type === "null"));
  assert.match(schema.properties.items.items.properties.source.description, /Do not replace null/);
});

// QS-01: both recorded answer failures were inferences the payload never supplied.
// These bind the explanation to the actual export instead of the model's guess.
test("result carries the real CSV columns so an explanation never has to infer them", () => {
  const result = execute(example());
  const header = quantityReportCsv(classifyQuantities(example())).split("\r\n")[0]
    .split('","').map(cell => cell.replace(/^"|"$/g, ""));
  assert.deepEqual(result.reportContract.csvColumns, header,
    "assistant-visible CSV columns must match the bytes quantityReportCsv actually writes");
  assert.ok(result.reportContract.csvColumns.includes("Classification path"),
    "the ancestor path column is the fact the failed answer denied existed");
  assert.ok(result.reportContract.csvColumns.includes("Classification"));
});

test("result states item-once aggregation, not disjoint evidence, as why inclusive totals are safe", () => {
  const contract = execute(example()).reportContract;
  assert.match(contract.rollupOverlapRule, /INCLUSIVE/);
  assert.match(contract.rollupOverlapRule, /never be added together/i);
  assert.match(contract.rollupOverlapRule, /not from units or evidence classes being disjoint/i);
  assert.match(contract.totalsRule, /exactly once/);
  assert.match(contract.csvRowRule, /no rollup, subtotal or ancestor records/i);
  assert.match(contract.csvHierarchyRule, /Classification path/);
});

// The overlap the explanation must describe: building.rollup re-counts wall's two items.
test("inclusive rollup demonstrably re-counts descendant items rather than adding new ones", () => {
  const result = execute(example());
  const building = result.nodes.find(node => node.id === "building")!;
  const wall = result.nodes.find(node => node.id === "wall")!;
  const area = (rows: typeof building.rollup) => rows.find(row => row.unit === "m2")!;
  assert.equal(area(wall.direct).quantity, "0.3");
  assert.equal(area(building.rollup).quantity, "0.3");
  assert.equal(building.direct.some(row => row.unit === "m2"), false,
    "building holds no direct m2 item, so its 0.3 m2 is entirely wall's items re-counted");
  assert.equal(result.totals.find(row => row.unit === "m2" && row.evidence === "sample")!.quantity, "0.3",
    "summing wall 0.3 + building 0.3 would double-count; the item-once total stays 0.3");
});

test("tool description explains the CSV and overlap mechanism it previously only asserted", () => {
  assert.match(description, /one record per actual item/i);
  assert.match(description, /no rollup records/i);
  assert.match(description, /classification path/i);
  assert.match(description, /never be added together/i);
  assert.match(description, /counted exactly once, not because units or evidence classes are disjoint/i);
});

test("failed live placeholder arguments are rejected with nullable alternatives, never repaired silently", () => {
  const input: any = example();
  input.nodes[0].parentId = "";
  input.items[0].source = {};
  const before = structuredClone(input);
  assert.throws(() => execute(input), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /nodes.0.parentId/);
    assert.match(error.message, /items.0.source.documentId/);
    assert.match(error.message, /parentId: null/);
    assert.match(error.message, /source: null/);
    assert.match(error.message, /do not invent parent nodes, source IDs, hashes or calibration metadata/);
    return true;
  });
  assert.deepEqual(input, before);
  const invalidGraph = example(); invalidGraph.nodes[0].parentId = "imaginary";
  assert.throws(() => execute(invalidGraph), /Missing classification parent: imaginary/);
});
