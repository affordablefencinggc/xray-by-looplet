import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aiResultSchema,
  aiRunSchema,
  AI_RESULT_JSON_SCHEMA,
  scoreMaterialBenchmark,
  type AiMaterialRun,
} from "./aiMaterials.ts";
import {
  createProjectMaterials,
  attachMaterialSource,
  putProjectMaterial,
  projectMaterialsSchema,
  projectMaterialsExport,
  previewMaterialsBackup,
  materialCoverage,
} from "./projectMaterials.ts";
import { appendAiRun, aiProposalDraft, resolveAiProposal } from "./aiMaterialReview.ts";
const result = aiResultSchema.parse(
  JSON.parse(readFileSync("proof/audit/IW-AI-MATERIALS/fixture-result.json", "utf8")),
);
const source = {
  sha256: "a".repeat(64),
  name: "QA plans.pdf",
  pageCount: 2,
  discipline: "Architectural" as const,
};
const start = () => attachMaterialSource(createProjectMaterials("qa"), source);
const run = (revision = 2): AiMaterialRun =>
  aiRunSchema.parse({
    schema: "xray.ai-materials/v1",
    id: "5c806de6-124e-4232-925b-0196c1258646",
    sourceSha256: source.sha256,
    page: 1,
    inventoryRevision: revision,
    provider: "QA fixture",
    model: "not-live-ai",
    createdAt: "2026-09-06T00:00:00.000Z",
    requestDigest: "b".repeat(64),
    imageHashes: ["c".repeat(64)],
    result,
    decisions: [],
  });
test("AI append persists proposals without counting stock or approving coverage", () => {
  const v = appendAiRun(start(), run());
  assert.equal(v.materials.length, 0);
  assert.equal(materialCoverage(v).pendingAiProposals, 2);
  assert.equal(v.sheets[0].reviewed, false);
});
test("AI rejects response against a stale inventory revision, wrong source or nonexistent page", () => {
  assert.throws(() => appendAiRun(start(), run(1)), /changed/);
  assert.throws(
    () => appendAiRun(start(), { ...run(), sourceSha256: "f".repeat(64) }),
    /unavailable/,
  );
  assert.throws(() => appendAiRun(start(), { ...run(), page: 3 }), /unavailable/);
});
test("AI backup retains run, regions, source, decisions and material provenance", () => {
  let v = appendAiRun(start(), run());
  const m = aiProposalDraft(v, run().id, 0, "door");
  v = putProjectMaterial(v, m);
  v = resolveAiProposal(v, run().id, 0, "material", "door", "Checked draft creation");
  const restored = previewMaterialsBackup(JSON.stringify(projectMaterialsExport(v)), "qa");
  assert.deepEqual(restored.aiRuns, v.aiRuns);
  assert.equal(restored.materials[0].review, "pending");
  assert.match(restored.materials[0].stock.reference, /unverified/);
});
test("old backups without AI field load as an empty queue", () => {
  const { aiRuns, ...v } = start();
  assert.deepEqual(projectMaterialsSchema.parse(v).aiRuns, []);
});
test("AI material draft preserves null dimensions and unsupported storage", () => {
  const v = appendAiRun(start(), run()),
    m = aiProposalDraft(v, run().id, 1, "unknown");
  assert.equal(m.stock.quantity, null);
  assert.equal(m.stock.lengthM, null);
  assert.equal(m.materialVolumePerUnitM3, null);
  assert.equal(m.review, "pending");
});
test("linking another AI observation never doubles a physical quantity", () => {
  let v = appendAiRun(start(), run());
  v = putProjectMaterial(v, aiProposalDraft(v, run().id, 0, "door"));
  v = resolveAiProposal(v, run().id, 0, "material", "door", "Draft");
  v = resolveAiProposal(
    v,
    run().id,
    1,
    "linked",
    "door",
    "Same physical item, additional observation",
  );
  assert.equal(v.materials.length, 1);
  assert.equal(v.materials[0].stock.quantity, 2);
  assert.throws(
    () => resolveAiProposal(v, run().id, 1, "linked", "door", "Repeated click"),
    /already/,
  );
});
test("duplicate tagged physical scopes cannot be added under different record IDs", () => {
  let v = appendAiRun(start(), run());
  v = putProjectMaterial(v, aiProposalDraft(v, run().id, 0, "door"));
  assert.throws(
    () => putProjectMaterial(v, aiProposalDraft(v, run().id, 0, "other")),
    /Duplicate physical/,
  );
});
test("AI exclusions require reason and pending proposals block sheet signoff", () => {
  const v = appendAiRun(start(), run());
  assert.throws(() => resolveAiProposal(v, run().id, 0, "excluded", null, ""), /why/);
  assert.throws(
    () =>
      projectMaterialsSchema.parse({
        ...v,
        sheets: v.sheets.map((s) => ({
          ...s,
          scan: "text",
          reviewed: true,
          reviewNote: "Checked",
        })),
      }),
    /Resolve AI/,
  );
});
test("AI decisions must reference existing materials with matching source evidence", () => {
  const v = appendAiRun(start(), run());
  assert.throws(
    () =>
      projectMaterialsSchema.parse({
        ...v,
        aiRuns: [
          {
            ...run(),
            decisions: [{ index: 0, action: "linked", materialId: "missing", reason: "test" }],
          },
        ],
      }),
    /unavailable/,
  );
});
test("malformed AI properties, unsupported mass, fractional each and off-page regions rejected", () => {
  const p = result.proposals[0];
  for (const patch of [
    { quantity: 1.5 },
    { specifiedWeightKg: 10 },
    { dimensionsM: { ...p.dimensionsM, width: 2 } },
    { evidence: { ...p.evidence, box: { x: 0.9, y: 0, width: 0.2, height: 0.1 } } },
  ])
    assert.equal(
      aiResultSchema.safeParse({ ...result, proposals: [{ ...p, ...patch }] }).success,
      false,
    );
});
test("desktop structured-output schema stays identical to validated web schema", () => {
  assert.deepEqual(
    JSON.parse(readFileSync("src-tauri/resources/ai-materials-result.schema.json", "utf8")),
    AI_RESULT_JSON_SCHEMA,
  );
});
test("benchmark penalizes misses, duplicates, wrong quantities and unquantified detections", () => {
  const score = scoreMaterialBenchmark(
    [
      { key: "A", quantity: 2, unit: "each" },
      { key: "B", quantity: 3, unit: "each" },
      { key: "C", quantity: 4, unit: "each" },
    ],
    [
      { key: "A", quantity: 1, unit: "each" },
      { key: "a", quantity: 2, unit: "each" },
      { key: "B", quantity: null, unit: "each" },
      { key: "extra", quantity: 4, unit: "each" },
    ],
  );
  assert.equal(score.precision, 0.5);
  assert.equal(score.recall, 2 / 3);
  assert.equal(score.exactQuantityRecall, 0);
  assert.equal(score.missed, 1);
  assert.equal(score.falsePositive, 2);
  assert.deepEqual(score.absoluteQuantityErrorByUnit, { each: 1 });
});
test("benchmark never adds metres to kilograms; empty denominators remain unmeasured", () => {
  const items = [
    { key: "length", quantity: 2, unit: "m" as const },
    { key: "weight", quantity: 10, unit: "kg" as const },
  ];
  const s = scoreMaterialBenchmark(items, [
    { ...items[0], quantity: 1 },
    { ...items[1], quantity: 8 },
  ]);
  assert.deepEqual(s.absoluteQuantityErrorByUnit, { m: 1, kg: 2 });
  assert.equal(scoreMaterialBenchmark([], []).precision, null);
  assert.equal(scoreMaterialBenchmark(items, []).recall, 0);
  assert.throws(() => scoreMaterialBenchmark([items[0], items[0]], []), /duplicate/);
});
