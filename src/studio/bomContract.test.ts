import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  bomBuildRequestSchema,
  bomBuildResponseSchema,
  canonicalBomInputJson,
  computeBomInputDigest,
} from "./bomContract.ts";
import { compileBomRequest } from "./bomCompiler.ts";
import { createDefaultJob, createRunSpecification } from "./domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "./calibration.ts";

const ROOT = new URL("../../engine/fixtures/bom-contract/", import.meta.url);

describe("SC-07 BOM contract", () => {
  it("strictly rejects unknown fields and non-canonical decimals", async () => {
    const fixture = JSON.parse(await readFile(new URL("colorbond.request.json", ROOT), "utf8"));
    assert.equal(bomBuildRequestSchema.safeParse({ ...fixture, surprise: true }).success, false);
    const response = JSON.parse(await readFile(new URL("colorbond.response.json", ROOT), "utf8"));
    response.bom.lines[0].quantity.value = "3.0";
    assert.equal(bomBuildResponseSchema.safeParse(response).success, false);
  });

  it("accepts every frozen request, response and blocker fixture", async () => {
    for (const name of ["colorbond", "timber-paling", "chain-wire", "concrete-allowance"]) {
      const request = JSON.parse(await readFile(new URL(`${name}.request.json`, ROOT), "utf8"));
      const response = JSON.parse(await readFile(new URL(`${name}.response.json`, ROOT), "utf8"));
      assert.equal(bomBuildRequestSchema.safeParse(request).success, true, `${name} request`);
      assert.equal(bomBuildResponseSchema.safeParse(response).success, true, `${name} response`);
      assert.equal(await computeBomInputDigest(bomBuildRequestSchema.parse(request)), request.inputDigest, `${name} digest`);
    }
    const blocked = JSON.parse(await readFile(new URL("blocked-overlap.response.json", ROOT), "utf8"));
    assert.equal(bomBuildResponseSchema.safeParse(blocked).success, true);
    const jsonSchema = JSON.parse(await readFile(new URL("../../contracts/xray-job-bom-v1.schema.json", import.meta.url), "utf8"));
    assert.equal(jsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  });

  it("excludes requestId and inputDigest from the canonical digest", async () => {
    const fixture = bomBuildRequestSchema.parse(JSON.parse(await readFile(new URL("colorbond.request.json", ROOT), "utf8")));
    const changed = { ...fixture, requestId: "retry-two", inputDigest: "f".repeat(64) };
    assert.equal(canonicalBomInputJson(fixture), canonicalBomInputJson(changed));
    assert.equal(await computeBomInputDigest(fixture), await computeBomInputDigest(changed));
  });

  it("rejects overlapping gate openings at the contract boundary", async () => {
    const fixture = JSON.parse(await readFile(new URL("colorbond.request.json", ROOT), "utf8"));
    fixture.gates.push({ ...fixture.gates[0], id: "gate-overlap", centreOffsetMm: 4500 });
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);
  });

  it("requires a calibration on every used run sheet", async () => {
    const fixture = JSON.parse(await readFile(new URL("colorbond.request.json", ROOT), "utf8"));
    fixture.calibrations = [];
    fixture.evidence = fixture.evidence.filter((entry: { kind: string }) => entry.kind !== "calibration");
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);
  });

  it("freezes the audited A-I worked quantities rather than old global formulas", async () => {
    const manifest = JSON.parse(await readFile(new URL("worked-cases.json", ROOT), "utf8"));
    const byId = new Map(manifest.cases.map((entry: { id: string }) => [entry.id, entry]));
    assert.deepEqual((byId.get("A-short-span") as any).expected, { residualSpanMm: [2500], bayLengthsMm: [1250, 1250], bays: 2, postSites: 3 });
    assert.equal((byId.get("B-l-corner") as any).expected.postSites, 5);
    assert.equal((byId.get("C-t-junction") as any).expected.postSites, 4);
    const colorbond = (byId.get("D-colorbond-gated") as any).expected;
    assert.deepEqual([colorbond.netMm, colorbond.bays, colorbond.postSites, colorbond.endPosts, colorbond.ordinaryPosts, colorbond.gatePosts, colorbond.infillSheets, colorbond.railCuts, colorbond.railLm], [8000, 5, 7, 2, 3, 2, 13, 10, "16"]);
    assert.equal((byId.get("E-timber-gated") as any).expected.palings, 91);
    const chain = (byId.get("E-chain-wire-gated") as any).expected;
    assert.deepEqual([chain.bays, chain.postSites, chain.strainerPosts, chain.linePosts, chain.incidentStrainerEnds, chain.meshLm, chain.meshM2, chain.topRailLm], [3, 5, 4, 1, 4, "8", "14.4", "8"]);
    const gate = (byId.get("G-double-gate") as any).expected;
    assert.deepEqual([gate.openings, gate.leaves, gate.boundaryPosts, gate.hingeSets, gate.latches, gate.dropBolts], [1, 2, 2, 2, 1, 1]);
    const concrete = (byId.get("H-role-footings") as any).expected;
    assert.deepEqual([concrete.rawFullPrecisionM3, concrete.rawDisplayM3, concrete.allowedFullPrecisionM3, concrete.allowedDisplayM3, concrete.orderM3], ["0.201454628911445476125", "0.201455", "0.2216000918025900237375", "0.221600", "0.23"]);
    assert.equal((byId.get("I-order-boundary") as any).expected.orderQuantity, null);
  });

  it("requires typed gate hardware counts and explicit material capabilities", async () => {
    const fixture = JSON.parse(await readFile(new URL("colorbond.request.json", ROOT), "utf8"));
    assert.deepEqual([fixture.gates[0].leafCount, fixture.gates[0].boundaryPostCount, fixture.gates[0].hingeSetCount, fixture.gates[0].latchCount, fixture.gates[0].dropBoltCount], [2, 2, 2, 1, 1]);
    delete fixture.gates[0].dropBoltCount;
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);
  });

  it("rejects ambiguous, zero-increment and unit-mismatched allowances", async () => {
    const fixture = JSON.parse(await readFile(new URL("concrete-allowance.request.json", ROOT), "utf8"));
    const recipe = fixture.recipeSet.recipes[0];
    recipe.allowances.push({ ...recipe.allowances[0], id: "allowance-second" });
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);

    recipe.allowances = [{ ...recipe.allowances[0], roundingIncrement: "0" }];
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);

    recipe.allowances = [{ ...recipe.allowances[0], roundingIncrement: "1", roundingUnit: "ea" }];
    assert.equal(bomBuildRequestSchema.safeParse(fixture).success, false);
  });

  it("never admits pricing or Looplet fields on BOM lines", async () => {
    const response = JSON.parse(await readFile(new URL("colorbond.response.json", ROOT), "utf8"));
    response.bom.lines[0].rate = 20;
    assert.equal(bomBuildResponseSchema.safeParse(response).success, false);
    response.bom.lines[0].loopletReceipt = "fake";
    assert.equal(bomBuildResponseSchema.safeParse(response).success, false);
  });

  it("retains an import-safe compiler API", async () => {
    assert.equal(typeof compileBomRequest, "function");
    assert.equal(typeof createDefaultJob, "function");
    assert.equal(typeof createRunSpecification, "function");
    assert.equal(typeof createTwoPointCalibrationCandidate, "function");
    assert.equal(typeof lockCalibration, "function");
  });
});
