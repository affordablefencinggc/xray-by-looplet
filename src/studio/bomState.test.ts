import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import type { BomBuildRequest, BomBuildResponse } from "./bomContract.ts";
import {
  BOM_STATE_SCHEMA,
  beginBomBuild,
  bindingForBomRequest,
  bomStateEnvelopeSchema,
  completeBomBuild,
  createBomState,
  deserializeBomState,
  failBomBuild,
  invalidationReasons,
  reconcileBomBinding,
  serializeBomState,
  type BomSourceBinding,
  type BomStateEnvelope,
} from "./bomState.ts";

const FIXTURES = new URL("../../engine/fixtures/bom-contract/", import.meta.url);
const T0 = "2026-09-04T00:00:00.000Z";
const T1 = "2026-09-04T00:00:01.000Z";
const T2 = "2026-09-04T00:00:02.000Z";

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, FIXTURES), "utf8"));
}

async function buildPair() {
  const request = await fixture<BomBuildRequest>("colorbond.request.json");
  const response = await fixture<BomBuildResponse>("colorbond.response.json");
  return { request, response };
}

function differentHash(value: string): string {
  return `${value[0] === "f" ? "e" : "f"}${value.slice(1)}`;
}

function commit(
  state: BomStateEnvelope,
  request: BomBuildRequest,
  response: BomBuildResponse,
  startedAt = T0,
  completedAt = T1,
) {
  const pending = beginBomBuild(state, request, startedAt);
  const result = completeBomBuild(pending, {
    expectedRequestId: request.requestId,
    expectedJobRevision: request.job.revision,
    completedAt,
    response,
  });
  assert.equal(result.ok, true);
  return result.state;
}

describe("SC-07F durable BOM state", () => {
  it("commits a successful response with every immutable binding atomically", async () => {
    const { request, response } = await buildPair();
    const initial = createBomState(request.job.id);
    const pending = beginBomBuild(initial, request, T0);
    assert.equal(pending.snapshot, null);
    assert.equal(pending.pending?.requestId, request.requestId);

    const result = completeBomBuild(pending, {
      expectedRequestId: request.requestId,
      expectedJobRevision: request.job.revision,
      completedAt: T1,
      response,
    });
    assert.equal(bomStateEnvelopeSchema.safeParse(pending).success, true, "completion must not mutate its input");
    assert.equal(result.ok, true);
    assert.equal(result.state.pending, null);
    assert.equal(result.state.snapshot?.commitRevision, 1);
    assert.deepEqual(result.state.snapshot?.binding, bindingForBomRequest(request));
    assert.deepEqual(result.state.snapshot?.response, response);
    assert.equal(result.state.invalidation, null);
    assert.equal(result.state.lastFailure, null);
  });

  it("rejects stale request identities and expected job revisions without changing state", async () => {
    const { request, response } = await buildPair();
    const pending = beginBomBuild(createBomState(request.job.id), request, T0);
    for (const completion of [
      { expectedRequestId: "older-request", expectedJobRevision: request.job.revision },
      { expectedRequestId: request.requestId, expectedJobRevision: request.job.revision + 1 },
      { expectedRequestId: request.requestId, expectedJobRevision: request.job.revision, response: { ...response, requestId: "older-response" } },
    ]) {
      const result = completeBomBuild(pending, {
        expectedRequestId: completion.expectedRequestId,
        expectedJobRevision: completion.expectedJobRevision,
        completedAt: T1,
        response: completion.response ?? response,
      });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, pending);
    }
  });

  it("rejects every mismatched success binding without a partial commit", async () => {
    const { request, response } = await buildPair();
    assert.equal(response.ok, true);
    const pending = beginBomBuild(createBomState(request.job.id), request, T0);
    const mutations: Array<(value: Extract<BomBuildResponse, { ok: true }>) => void> = [
      (value) => { value.bom.jobRevision += 1; },
      (value) => { value.bom.documentSha256 = differentHash(value.bom.documentSha256); },
      (value) => { value.bom.recipeSet.revision += 1; },
      (value) => { value.bom.recipeSet.digest = differentHash(value.bom.recipeSet.digest); },
      (value) => { value.bom.ruleset.version += 1; },
      (value) => { value.bom.inputDigest = differentHash(value.bom.inputDigest); },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(response);
      mutate(changed);
      const result = completeBomBuild(pending, {
        expectedRequestId: request.requestId,
        expectedJobRevision: request.job.revision,
        completedAt: T1,
        response: changed,
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "binding-mismatch");
      assert.deepEqual(result.state, pending);
    }
  });

  it("records source, recipe, ruleset and job invalidation reasons deterministically", async () => {
    const { request } = await buildPair();
    const binding = bindingForBomRequest(request);
    const cases: Array<[Partial<BomSourceBinding>, string]> = [
      [{ documentSha256: differentHash(binding.documentSha256) }, "source-changed"],
      [{ recipeSetRevision: binding.recipeSetRevision + 1 }, "recipe-changed"],
      [{ ruleset: { ...binding.ruleset, version: binding.ruleset.version + 1 } }, "ruleset-changed"],
      [{ jobRevision: binding.jobRevision + 1 }, "job-changed"],
      [{ inputDigest: differentHash(binding.inputDigest) }, "job-changed"],
    ];
    for (const [patch, expected] of cases) {
      assert.deepEqual(invalidationReasons(binding, { ...binding, ...patch }), [expected]);
    }
    assert.deepEqual(invalidationReasons(binding, {
      ...binding,
      documentSha256: differentHash(binding.documentSha256),
      recipeSetDigest: differentHash(binding.recipeSetDigest),
      ruleset: { ...binding.ruleset, version: 2 },
      jobRevision: binding.jobRevision + 1,
      inputDigest: differentHash(binding.inputDigest),
    }), ["source-changed", "recipe-changed", "ruleset-changed", "job-changed"]);
  });

  it("cancels an obsolete pending build so out-of-order completion cannot win", async () => {
    const { request, response } = await buildPair();
    const pending = beginBomBuild(createBomState(request.job.id), request, T0);
    const currentBinding = bindingForBomRequest(request);
    const changed = { ...currentBinding, jobRevision: request.job.revision + 1, inputDigest: differentHash(currentBinding.inputDigest) };
    const invalidated = reconcileBomBinding(pending, changed, T1);
    assert.equal(invalidated.pending, null);
    const late = completeBomBuild(invalidated, {
      expectedRequestId: request.requestId,
      expectedJobRevision: request.job.revision,
      completedAt: T2,
      response,
    });
    assert.equal(late.ok, false);
    assert.equal(late.reason, "no-pending-build");
    assert.deepEqual(late.state, invalidated);
  });

  it("lets the newest request identity win regardless of callback completion order", async () => {
    const { request, response } = await buildPair();
    const first = beginBomBuild(createBomState(request.job.id), request, T0);
    const newestRequest = { ...request, requestId: "newest-request" };
    const newest = beginBomBuild(first, newestRequest, T1);
    const late = completeBomBuild(newest, {
      expectedRequestId: request.requestId,
      expectedJobRevision: request.job.revision,
      completedAt: T2,
      response,
    });
    assert.equal(late.ok, false);
    assert.equal(late.reason, "stale-request");
    assert.deepEqual(late.state, newest);
    assert.equal(newest.pending?.requestId, "newest-request");
    assert.equal(newest.pending?.binding.inputDigest, first.pending?.binding.inputDigest);
  });

  it("retains and marks the last snapshot stale when a bound source changes", async () => {
    const { request, response } = await buildPair();
    const committed = commit(createBomState(request.job.id), request, response);
    const currentBinding = bindingForBomRequest(request);
    const observed = { ...currentBinding, documentSha256: differentHash(currentBinding.documentSha256), inputDigest: differentHash(currentBinding.inputDigest) };
    const invalidated = reconcileBomBinding(committed, observed, T2);
    assert.deepEqual(invalidated.snapshot, committed.snapshot);
    assert.deepEqual(invalidated.invalidation?.reasons, ["source-changed"]);
    assert.deepEqual(invalidated.invalidation?.observedBinding, observed);
  });

  it("marks an existing snapshot stale atomically when a changed request begins", async () => {
    const { request, response } = await buildPair();
    const committed = commit(createBomState(request.job.id), request, response);
    const changedRequest = structuredClone(request);
    changedRequest.requestId = "changed-job-request";
    changedRequest.job.revision += 1;
    changedRequest.inputDigest = differentHash(changedRequest.inputDigest);
    const before = structuredClone(committed);
    const pending = beginBomBuild(committed, changedRequest, T2);
    assert.deepEqual(committed, before, "pure transition must not mutate its input");
    assert.deepEqual(pending.snapshot, committed.snapshot);
    assert.deepEqual(pending.invalidation?.reasons, ["job-changed"]);
    assert.equal(pending.pending?.requestId, "changed-job-request");
  });

  it("preserves the previous snapshot across domain, transport and contract failures", async () => {
    const { request, response } = await buildPair();
    const committed = commit(createBomState(request.job.id), request, response);
    const retry = { ...request, requestId: "retry-two" };
    const priorSnapshot = committed.snapshot;

    const domainPending = beginBomBuild(committed, retry, T1);
    const domainResponse = await fixture<BomBuildResponse>("blocked-overlap.response.json");
    const domain = completeBomBuild(domainPending, {
      expectedRequestId: retry.requestId,
      expectedJobRevision: retry.job.revision,
      completedAt: T2,
      response: { ...domainResponse, requestId: retry.requestId, inputDigest: retry.inputDigest },
    });
    assert.equal(domain.ok, true);
    assert.deepEqual(domain.state.snapshot, priorSnapshot);
    assert.equal(domain.state.lastFailure?.kind, "domain");

    const transportPending = beginBomBuild(domain.state, { ...retry, requestId: "retry-three" }, T1);
    const transport = failBomBuild(transportPending, {
      expectedRequestId: "retry-three",
      expectedJobRevision: retry.job.revision,
      failedAt: T2,
      message: "Engine timed out.",
    });
    assert.equal(transport.ok, true);
    assert.deepEqual(transport.state.snapshot, priorSnapshot);
    assert.equal(transport.state.lastFailure?.kind, "transport");

    const contractPending = beginBomBuild(transport.state, { ...retry, requestId: "retry-four" }, T1);
    const contract = completeBomBuild(contractPending, {
      expectedRequestId: "retry-four",
      expectedJobRevision: retry.job.revision,
      completedAt: T2,
      response: { schema: "xray.bom/v1", ok: true, surprise: true },
    });
    assert.equal(contract.ok, true, "the failure transition itself is atomically accepted");
    assert.deepEqual(contract.state.snapshot, priorSnapshot);
    assert.equal(contract.state.lastFailure?.kind, "contract");
    assert.equal(contract.state.snapshot?.commitRevision, committed.snapshot?.commitRevision);
  });

  it("rejects null or wrong domain-failure digests against an active bound request", async () => {
    const { request } = await buildPair();
    const pending = beginBomBuild(createBomState(request.job.id), request, T0);
    const failure = await fixture<BomBuildResponse>("blocked-overlap.response.json");
    assert.equal(failure.ok, false);
    for (const inputDigest of [null, differentHash(request.inputDigest)]) {
      const result = completeBomBuild(pending, {
        expectedRequestId: request.requestId,
        expectedJobRevision: request.job.revision,
        completedAt: T1,
        response: { ...failure, requestId: request.requestId, inputDigest },
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "binding-mismatch");
      assert.deepEqual(result.state, pending);
    }
  });

  it("round-trips the full validated envelope and fails closed on migrations or unknown fields", async () => {
    const { request, response } = await buildPair();
    const committed = commit(createBomState(request.job.id), request, response);
    const serialized = serializeBomState(committed);
    const loaded = deserializeBomState(serialized);
    assert.equal(loaded.ok, true);
    if (loaded.ok) assert.deepEqual(loaded.state, committed);

    const unknownVersion = deserializeBomState(JSON.stringify({ ...committed, schema: "xray.bom-state/v2" }));
    assert.deepEqual(unknownVersion, { ok: false, reason: "unsupported-version" });
    const extra = deserializeBomState(JSON.stringify({ ...committed, surprise: true }));
    assert.deepEqual(extra, { ok: false, reason: "invalid-state" });
    assert.deepEqual(deserializeBomState("not json"), { ok: false, reason: "invalid-json" });
    assert.equal(bomStateEnvelopeSchema.safeParse({ ...committed, snapshot: { ...committed.snapshot, unknown: true } }).success, false);
    assert.equal(bomStateEnvelopeSchema.safeParse({
      ...committed,
      stateRevision: 0,
    }).success, false);
    assert.equal(bomStateEnvelopeSchema.safeParse({
      ...committed,
      pending: {
        requestId: request.requestId,
        expectedJobRevision: request.job.revision + 1,
        startedAt: T2,
        binding: bindingForBomRequest(request),
      },
    }).success, false);
    assert.equal(BOM_STATE_SCHEMA, "xray.bom-state/v1");
  });
});
