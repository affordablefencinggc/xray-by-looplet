import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { classificationInputSchema, type ClassificationInput } from "./classification.ts";
import { execute, inputSchema, name } from "./assistantTool.ts";

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
