import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { bomBuildRequestSchema, bomBuildResponseSchema, computeBomInputDigest } from "./bomContract.ts";
import { buildBom, deriveBomFacts, distributeSpanMm } from "./bomRules.ts";

const fixtureRoot = new URL("../../engine/fixtures/bom-contract/", import.meta.url);

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
}

for (const stem of ["colorbond", "timber-paling", "chain-wire", "concrete-allowance"]) {
  test(`SC-07B emits the frozen ${stem} golden response`, async () => {
    const request = await fixture(`${stem}.request.json`);
    const expected = await fixture(`${stem}.response.json`);
    const actual = await buildBom(request);
    assert.deepEqual(actual, expected);
    assert.equal(bomBuildResponseSchema.safeParse(actual).success, true);
  });
}

test("SC-07B distributes A, D and E spans deterministically before cover rounding", async () => {
  assert.deepEqual(distributeSpanMm(2500, 2400), [1250, 1250]);
  assert.deepEqual(distributeSpanMm(4800, 2400), [2400, 2400]);

  const colorbond = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));
  const timber = bomBuildRequestSchema.parse(await fixture("timber-paling.request.json"));
  const chain = bomBuildRequestSchema.parse(await fixture("chain-wire.request.json"));
  const cb = deriveBomFacts(colorbond).get("recipe-colorbond-good-neighbour")!;
  const tp = deriveBomFacts(timber).get("recipe-timber-standard")!;
  const cw = deriveBomFacts(chain).get("recipe-chain-standard")!;
  assert.deepEqual(cb.bayLengthsMm, [1500, 1500, 1667, 1667, 1666]);
  assert.deepEqual({ bays: cb.bays, sites: Object.values(cb.postRoles).reduce((a, b) => a + b), sheets: cb.infillSheets }, { bays: 5, sites: 7, sheets: 13 });
  assert.equal(tp.palings, 91);
  assert.deepEqual({ bays: cw.bays, strainer: cw.postRoles.strainer, line: cw.postRoles.ordinary, braces: cw.incidentStrainerEnds, lm: cw.meshLm, m2: cw.meshM2 }, { bays: 3, strainer: 4, line: 1, braces: 4, lm: 8, m2: 14.4 });
});

test("SC-07B preserves exact H rational stages before display and increment rounding", async () => {
  const response = await buildBom(await fixture("concrete-allowance.request.json"));
  assert.equal(response.ok, true);
  if (!response.ok) return;
  const operands = Object.fromEntries(response.bom.lines[0].calculation.operands.map((operand) => [operand.name, operand.value]));
  assert.deepEqual(operands, {
    "raw-full-precision": "0.201454628911445476125",
    "raw-display-round-half-up-6": "0.201455",
    "allowed-full-precision": "0.2216000918025900237375",
    "allowed-display-round-half-up-6": "0.2216",
  });
  assert.equal(response.bom.lines[0].quantity.value, "0.23");
});

test("SC-07B merges exact B/C topology nodes while keeping separate sheet identities", async () => {
  const base = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));
  const withoutGate = structuredClone(base);
  withoutGate.requestId = "topology-proof";
  withoutGate.gates = [];
  withoutGate.runs[0].segments = [{ index: 0, lengthMm: 4800 }, { index: 1, lengthMm: 3000 }];
  withoutGate.runs[0].vertices = [
    { index: 0, topologyNodeId: "sheet:0:x:0:y:0", cornerTreatment: "end", postOverride: null },
    { index: 1, topologyNodeId: "sheet:0:x:4.8:y:0", cornerTreatment: "standard", postOverride: null },
    { index: 2, topologyNodeId: "sheet:0:x:4.8:y:3", cornerTreatment: "end", postOverride: null },
  ];
  withoutGate.runs[0].storedLengths = { grossMm: 7800, gateDeductionMm: 0, netMm: 7800 };
  withoutGate.recipeSet.recipes[0].components = [withoutGate.recipeSet.recipes[0].components.find((component) => component.basis === "per-bay") ?? {
    id: "bay", itemCode: "BAY", description: "Bay", unit: "ea", basis: "per-bay", factor: "1", assumptionIds: ["a-spacing"],
  }];
  withoutGate.inputDigest = await computeBomInputDigest(withoutGate);
  const facts = deriveBomFacts(bomBuildRequestSchema.parse(withoutGate)).get("recipe-colorbond-good-neighbour")!;
  assert.equal(facts.bays, 4);
  assert.equal(Object.values(facts.postRoles).reduce((a, b) => a + b), 5);
  assert.equal(facts.postRoles.corner, 1);

  const straight = structuredClone(withoutGate);
  straight.runs[0].segments = [{ index: 0, lengthMm: 2400 }, { index: 1, lengthMm: 2400 }];
  straight.runs[0].vertices = [
    { index: 0, topologyNodeId: "sheet:0:x:0:y:0", cornerTreatment: "end", postOverride: null },
    { index: 1, topologyNodeId: "sheet:0:x:2.4:y:0", cornerTreatment: "standard", postOverride: null },
    { index: 2, topologyNodeId: "sheet:0:x:4.8:y:0", cornerTreatment: "end", postOverride: null },
  ];
  straight.runs[0].storedLengths = { grossMm: 4800, gateDeductionMm: 0, netMm: 4800 };
  straight.inputDigest = await computeBomInputDigest(straight);
  const straightFacts = deriveBomFacts(bomBuildRequestSchema.parse(straight)).get("recipe-colorbond-good-neighbour")!;
  assert.deepEqual(straightFacts.postRoles, { ordinary: 1, end: 2, corner: 0, junction: 0, strainer: 0, gate: 0 });

  const uTurn = structuredClone(straight);
  uTurn.runs[0].segments[1].lengthMm = 1400;
  uTurn.runs[0].vertices[2].topologyNodeId = "sheet:0:x:1:y:0";
  uTurn.runs[0].storedLengths = { grossMm: 3800, gateDeductionMm: 0, netMm: 3800 };
  uTurn.inputDigest = await computeBomInputDigest(uTurn);
  const uTurnFacts = deriveBomFacts(bomBuildRequestSchema.parse(uTurn)).get("recipe-colorbond-good-neighbour")!;
  assert.equal(uTurnFacts.postRoles.corner, 1);
  assert.equal(uTurnFacts.postRoles.ordinary, 0);

  const t = structuredClone(withoutGate);
  t.runs = [
    makeStraightRun(t.runs[0], "r-a", "n0", "n1"),
    makeStraightRun(t.runs[0], "r-b", "n1", "n2"),
    makeStraightRun(t.runs[0], "r-c", "n1", "n3"),
  ].sort((a, b) => a.id.localeCompare(b.id));
  t.inputDigest = await computeBomInputDigest(t);
  const tFacts = deriveBomFacts(bomBuildRequestSchema.parse(t)).get("recipe-colorbond-good-neighbour")!;
  assert.equal(tFacts.bays, 3);
  assert.equal(Object.values(tFacts.postRoles).reduce((a, b) => a + b), 4);
  assert.equal(tFacts.postRoles.junction, 1);
});

test("SC-07B fails closed on a changed digest, overlap and unknown fields", async () => {
  const valid = await fixture("colorbond.request.json") as Record<string, unknown>;
  const digestMismatch = structuredClone(valid);
  (digestMismatch.job as { revision: number }).revision += 1;
  const digestResult = await buildBom(digestMismatch);
  assert.equal(digestResult.ok, false);
  if (!digestResult.ok) assert.equal(digestResult.issues[0].path, "inputDigest");

  const overlap = structuredClone(valid) as any;
  overlap.gates.push({ ...overlap.gates[0], id: "gate-person", revision: 1, centreOffsetMm: 5000, widthMm: 1000, hardwareModelId: overlap.gates[0].hardwareModelId });
  const overlapResult = await buildBom(overlap);
  assert.equal(overlapResult.ok, false);
  if (!overlapResult.ok) assert.equal(overlapResult.issues[0].code, "gate-overlap");

  const unknown = structuredClone(valid) as Record<string, unknown>;
  unknown.rate = 123;
  const unknownResult = await buildBom(unknown);
  assert.equal(unknownResult.ok, false);
  if (!unknownResult.ok) assert.equal(unknownResult.issues[0].code, "contract");
});

test("SC-07B marks gate boundaries at segment starts, ends and across a full segment", async () => {
  const base = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));

  for (const [label, centreOffsetMm, widthMm, expected] of [
    ["start", 1000, 2000, { gate: 2, end: 1, ordinary: 3, bays: 4 }],
    ["end", 9000, 2000, { gate: 2, end: 1, ordinary: 3, bays: 4 }],
    ["full", 5000, 10000, { gate: 2, end: 0, ordinary: 0, bays: 0 }],
  ] as const) {
    const request = structuredClone(base);
    request.requestId = `gate-${label}`;
    request.gates[0].centreOffsetMm = centreOffsetMm;
    request.gates[0].widthMm = widthMm;
    request.runs[0].storedLengths = { grossMm: 10000, gateDeductionMm: widthMm, netMm: 10000 - widthMm };
    const model = request.recipeSet.recipes[0].gateHardwareModels[0];
    model.widthMm = widthMm;
    request.inputDigest = await computeBomInputDigest(request);
    const facts = deriveBomFacts(bomBuildRequestSchema.parse(request)).get("recipe-colorbond-good-neighbour")!;
    assert.deepEqual(
      { gate: facts.postRoles.gate, end: facts.postRoles.end, ordinary: facts.postRoles.ordinary, bays: facts.bays },
      expected,
    );
  }
});

test("SC-07B counts only residual-span incidences whose winning chain-wire role is strainer", async () => {
  const request = bomBuildRequestSchema.parse(await fixture("chain-wire.request.json"));
  request.requestId = "chain-t-incidences";
  request.gates = [];
  request.runs = [
    makeStraightRun(request.runs[0], "r-a", "sheet:0:x:0:y:0", "sheet:0:x:2.4:y:0"),
    makeStraightRun(request.runs[0], "r-b", "sheet:0:x:2.4:y:0", "sheet:0:x:4.8:y:0"),
    makeStraightRun(request.runs[0], "r-c", "sheet:0:x:2.4:y:0", "sheet:0:x:2.4:y:2.4"),
  ].sort((a, b) => a.id.localeCompare(b.id));
  request.inputDigest = await computeBomInputDigest(request);
  const facts = deriveBomFacts(bomBuildRequestSchema.parse(request)).get("recipe-chain-standard")!;
  assert.deepEqual(
    { strainers: facts.postRoles.strainer, junctions: facts.postRoles.junction, sites: Object.values(facts.postRoles).reduce((a, b) => a + b), incidences: facts.incidentStrainerEnds },
    { strainers: 3, junctions: 1, sites: 4, incidences: 3 },
  );
});

test("SC-07B applies decimal factors and a single typed allowance exactly to non-concrete components", async () => {
  const request = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));
  request.requestId = "decimal-factor-allowance";
  const recipe = request.recipeSet.recipes[0];
  const component = recipe.components.find((candidate) => candidate.id === "cb-rail-lm")!;
  component.factor = "0.125";
  const allowanceAssumption = { ...recipe.assumptions.find((assumption) => assumption.id === "a-rails")!, id: "a-allowance", key: "rail-allowance", label: "Rail allowance" };
  recipe.assumptions.push(allowanceAssumption);
  recipe.allowances.push({
    id: "rail-allowance",
    componentIds: [component.id],
    percent: "10",
    roundingIncrement: "0.01",
    roundingUnit: "lm",
    source: "Approved test schedule",
    effectiveAt: "2026-09-04T00:00:00.000Z",
    status: "accepted",
    acceptedBy: "Estimator",
    acceptedAt: "2026-09-04T00:00:00.000Z",
    assumptionIds: [allowanceAssumption.id],
  });
  request.inputDigest = await computeBomInputDigest(request);
  const response = await buildBom(bomBuildRequestSchema.parse(request));
  assert.equal(response.ok, true);
  if (!response.ok) return;
  const rail = response.bom.lines.find((line) => line.itemCode === "CB-RAIL-LM")!;
  assert.equal(rail.quantity.value, "2.2");
  assert.deepEqual(
    Object.fromEntries(rail.calculation.operands.map((operand) => [operand.name, operand.value])),
    { "basis-quantity": "16", "component-factor": "0.125", "factored-base": "2", "allowance-percent": "10", "rounding-increment": "0.01" },
  );
  assert.match(rail.calculation.expression, /ROUND_UP_INCREMENT/);
  assert.match(rail.calculation.expression, /8 lm net fence × 2 rail rows = 16 lm/);
  assert.deepEqual(rail.assumptionRefs, ["a-rails", "a-allowance"]);
});

test("SC-07B independently rejects unresolved referenced assumptions and allowances", async () => {
  for (const [label, fixtureName, mutate] of [
    ["material", "colorbond.request.json", (request: any) => unresolved(request.recipeSet.recipes[0].assumptions, "a-cover")],
    ["component", "colorbond.request.json", (request: any) => unresolved(request.recipeSet.recipes[0].assumptions, "a-spacing")],
    ["footing", "colorbond.request.json", (request: any) => unresolved(request.recipeSet.recipes[0].assumptions, "a-footing")],
    ["gate", "colorbond.request.json", (request: any) => unresolved(request.recipeSet.recipes[0].assumptions, "a-gate")],
    ["allowance", "concrete-allowance.request.json", (request: any) => {
      const allowance = request.recipeSet.recipes[0].allowances[0];
      allowance.status = "unresolved";
      allowance.acceptedBy = null;
      allowance.acceptedAt = null;
    }],
  ] as const) {
    const request = structuredClone(await fixture(fixtureName)) as any;
    mutate(request);
    request.requestId = `unresolved-${label}`;
    request.inputDigest = await computeBomInputDigest(bomBuildRequestSchema.parse(request));
    const response = await buildBom(request);
    assert.equal(response.ok, false, label);
    if (!response.ok) assert.equal(response.issues[0].code, "assumption", label);
  }
});

test("unused unresolved recipes do not block selected work or bypass library integrity", async () => {
  const request = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));
  const baseline = await buildBom(request);
  assert.equal(baseline.ok, true);
  const unused = bomBuildRequestSchema.parse(await fixture("timber-paling.request.json")).recipeSet.recipes[0];
  for (const assumption of unused.assumptions) unresolved(unused.assumptions, assumption.id);
  for (const allowance of unused.allowances) {
    allowance.status = "unresolved";
    allowance.acceptedBy = null;
    allowance.acceptedAt = null;
  }
  request.recipeSet.recipes.push(unused);
  request.inputDigest = await computeBomInputDigest(request);
  const actual = await buildBom(request);
  assert.equal(actual.ok, true);
  if (actual.ok && baseline.ok) {
    assert.deepEqual(actual.bom.lines, baseline.bom.lines);
    assert.deepEqual(actual.bom.assumptions, baseline.bom.assumptions);
  }
  const malformed = structuredClone(request);
  malformed.recipeSet.recipes[1].components[0].assumptionIds = ["missing-assumption"];
  const rejected = await buildBom(malformed);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.issues[0].code, "contract");
  unresolved(request.recipeSet.recipes[0].assumptions, "a-cover");
  request.inputDigest = await computeBomInputDigest(request);
  const selectedRejected = await buildBom(request);
  assert.equal(selectedRejected.ok, false);
  if (!selectedRejected.ok) assert.equal(selectedRejected.issues[0].code, "assumption");
});

test("SC-07B calculation prose reconciles aggregate multi-run and multi-gate facts", async () => {
  const request = bomBuildRequestSchema.parse(await fixture("colorbond.request.json"));
  request.requestId = "aggregate-formula-proof";
  const secondRun = structuredClone(request.runs[0]);
  secondRun.id = "run-boundary-2";
  secondRun.label = "Boundary 2";
  secondRun.vertices[0].topologyNodeId = "sheet:0:x:0:y:20";
  secondRun.vertices[1].topologyNodeId = "sheet:0:x:10:y:20";
  const secondGate = structuredClone(request.gates[0]);
  secondGate.id = "gate-double-2";
  secondGate.label = "Double gate 2";
  secondGate.runId = secondRun.id;
  request.runs.push(secondRun);
  request.gates.push(secondGate);
  request.inputDigest = await computeBomInputDigest(request);
  const response = await buildBom(bomBuildRequestSchema.parse(request));
  assert.equal(response.ok, true);
  if (!response.ok) return;
  const expression = (itemCode: string) => response.bom.lines.find((line) => line.itemCode === itemCode)!.calculation.expression;
  assert.equal(expression("CB-POST-END"), "4 physical sites resolved to end role = 4 end posts");
  assert.equal(expression("CB-POST-GATE"), "4 gate boundaries resolve to 4 gate posts");
  assert.equal(expression("CB-POST-ORD"), "14 physical sites - 8 higher-role sites = 6 ordinary posts");
  assert.equal(expression("CB-RAIL-LM"), "16 lm net fence × 2 rail rows = 32 lm");
  assert.equal(expression("GATE-OPENING"), "2 approved gate openings = 2");
  assert.equal(expression("GATE-LEAF"), "typed gate models (2×double) = 4 leaves");
});

function makeStraightRun(base: any, id: string, from: string, to: string) {
  return {
    ...structuredClone(base), id, revision: 1, label: id,
    segments: [{ index: 0, lengthMm: 2400 }],
    vertices: [
      { index: 0, topologyNodeId: from, cornerTreatment: "end", postOverride: null },
      { index: 1, topologyNodeId: to, cornerTreatment: "end", postOverride: null },
    ],
    storedLengths: { grossMm: 2400, gateDeductionMm: 0, netMm: 2400 },
    approval: { ...base.approval, entityRevision: 1 },
  };
}

function unresolved(assumptions: any[], id: string) {
  const assumption = assumptions.find((candidate) => candidate.id === id);
  assumption.status = "unresolved";
  assumption.acceptedBy = null;
  assumption.acceptedAt = null;
}
