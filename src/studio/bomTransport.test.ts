import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { computeBomInputDigest, type BomBuildRequest, type BomBuildResponse } from "./bomContract.ts";
import {
  BOM_TRANSPORT_LIMITS,
  bindingForBomRequest,
  bomTransportErrorCodeSchema,
  bomTransportResultSchema,
  getBomTransportStatus,
  isBomResponseBoundToRequest,
  runBomTransport,
  sameBomSourceBinding,
  type BomTransportAdapter,
  type BomTransportLimits,
} from "./bomTransport.ts";

const fixtureRoot = new URL("../../engine/fixtures/bom-contract/", import.meta.url);

async function fixtures(): Promise<{ request: BomBuildRequest; response: BomBuildResponse }> {
  return {
    request: JSON.parse(await readFile(new URL("colorbond.request.json", fixtureRoot), "utf8")),
    response: JSON.parse(await readFile(new URL("colorbond.response.json", fixtureRoot), "utf8")),
  };
}

function success(request: BomBuildRequest, response: BomBuildResponse): { ok: true; requestId: string; response: BomBuildResponse } {
  return { ok: true, requestId: request.requestId, response };
}

function fake(
  invoke: BomTransportAdapter["invoke"],
  host: BomTransportAdapter["host"] = "tauri",
): BomTransportAdapter & { calls: number } {
  return {
    host,
    calls: 0,
    async status() {
      return { available: true, host, requestSchemas: ["xray.job-to-bom/v1"], responseSchemas: ["xray.bom/v1"], rulesets: [{ id: "fencing-v1", version: 1 }] };
    },
    async invoke(requestJson, options) {
      this.calls += 1;
      return invoke(requestJson, options);
    },
  };
}

test("BR-001 BR-002 BR-004 rejects wrong schema, unknown fields, and changed input before invoking the adapter", async () => {
  const { request, response } = await fixtures();
  for (const candidate of [
    { ...request, schema: "xray.job-to-bom/v2" },
    { ...request, surprise: true },
    { ...request, job: { ...request.job, revision: request.job.revision + 1 } },
  ]) {
    const adapter = fake(async () => success(request, response));
    const result = await runBomTransport(candidate, adapter);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "invalid-request");
    assert.equal(adapter.calls, 0);
  }
});

test("BR-005 BR-006 BR-007 validates exact request, digest, document, job, recipe, and ruleset identity", async () => {
  const { request, response } = await fixtures();
  const mutations: Array<[string, (value: any) => void]> = [
    ["request-id-mismatch", (value) => { value.requestId = "another-request"; }],
    ["input-digest-mismatch", (value) => { value.response.bom.inputDigest = "f".repeat(64); }],
    ["source-binding-mismatch", (value) => { value.response.bom.documentSha256 = "f".repeat(64); }],
    ["source-binding-mismatch", (value) => { value.response.bom.jobRevision += 1; }],
    ["source-binding-mismatch", (value) => { value.response.bom.recipeSet.revision += 1; }],
    ["source-binding-mismatch", (value) => { value.response.bom.ruleset.version += 1; }],
  ];
  for (const [expected, mutate] of mutations) {
    const envelope: any = structuredClone(success(request, response));
    mutate(envelope);
    const result = await runBomTransport(request, fake(async () => envelope));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, expected);
  }
  assert.equal(isBomResponseBoundToRequest(response, request), true);
  assert.deepEqual(bindingForBomRequest(request), {
    jobId: request.job.id,
    jobRevision: request.job.revision,
    documentSha256: request.document.sha256,
    recipeSetId: request.recipeSet.id,
    recipeSetRevision: request.recipeSet.revision,
    recipeSetDigest: request.recipeSet.digest,
    ruleset: { id: "fencing-v1", version: 1 },
    inputDigest: request.inputDigest,
  });

  const unboundDomainError: BomBuildResponse = {
    schema: "xray.bom/v1",
    ok: false,
    requestId: request.requestId,
    inputDigest: null,
    issues: [{ code: "contract", message: "Pre-validation failed.", entityId: null, path: null }],
  };
  const unbound = await runBomTransport(request, fake(async () => success(request, unboundDomainError)));
  assert.equal(unbound.ok, false);
  if (!unbound.ok) assert.equal(unbound.error.code, "input-digest-mismatch");
  assert.equal(isBomResponseBoundToRequest(unboundDomainError, request), false);
});

test("BR-005 response_request_id_must_match rejects both outer and inner correlation mismatches", async () => {
  const { request, response } = await fixtures();
  for (const candidate of [
    { ...success(request, response), requestId: "wrong-outer-request" },
    { ...success(request, response), response: { ...response, requestId: "wrong-inner-request" } },
  ]) {
    const result = await runBomTransport(request, fake(async () => candidate));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.requestId, request.requestId);
      assert.equal(result.error.code, "request-id-mismatch");
      assert.equal(result.error.stage, "bind");
    }
  }
});

test("BR-007 source_bindings_round_trip rejects every changed immutable binding field", async () => {
  const { request, response } = await fixtures();
  const mutations: Array<[string, (candidate: any) => void]> = [
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.jobId = "different-job"; }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.jobRevision += 1; }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.documentSha256 = "f".repeat(64); }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.recipeSet.id = "different-recipes"; }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.recipeSet.revision += 1; }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.recipeSet.digest = "f".repeat(64); }],
    ["response-contract", (candidate) => { candidate.response.bom.ruleset.id = "different-ruleset"; }],
    ["source-binding-mismatch", (candidate) => { candidate.response.bom.ruleset.version += 1; }],
  ];
  for (const [expectedCode, mutate] of mutations) {
    const candidate: any = structuredClone(success(request, response));
    mutate(candidate);
    const result = await runBomTransport(request, fake(async () => candidate));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, expectedCode);
  }

  let observed: ReturnType<typeof bindingForBomRequest> | null = null;
  const accepted = await runBomTransport(request, fake(async () => success(request, response)), {
    isCurrent(binding) {
      observed = binding;
      return true;
    },
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(observed, bindingForBomRequest(request));
});

test("BR-003 BR-015 BR-016 BR-020 validates a closed, strict, sanitised transport envelope", async () => {
  const { request, response } = await fixtures();
  const invalid: unknown[] = [
    null,
    "{",
    { ...success(request, response), extra: true },
    { ok: true, requestId: request.requestId, response: { ...(response as object), extra: true } },
    { ok: false, requestId: request.requestId, error: { code: "mystery", stage: "execute", retryable: false, safeMessage: "No", diagnosticId: null } },
    { ok: false, requestId: request.requestId, error: { code: "spawn-failed", stage: "execute", retryable: false, safeMessage: "C:\\Users\\person\\secret.txt\nTraceback", diagnosticId: null } },
    { ok: false, requestId: request.requestId, error: { code: "spawn-failed", stage: "execute", retryable: false, safeMessage: "api_key=do-not-expose", diagnosticId: null } },
  ];
  for (const value of invalid) {
    const result = await runBomTransport(request, fake(async () => value));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(["missing-result", "malformed-result", "response-contract"].includes(result.error.code));
    assert.doesNotMatch(JSON.stringify(result), /secret|traceback|C:\\\\Users/iu);
  }
  assert.equal(bomTransportResultSchema.safeParse({ ok: false, requestId: null, error: { code: "timeout", stage: "execute", retryable: true, safeMessage: "Timed out.", diagnosticId: "opaque_42" } }).success, true);
  for (const code of bomTransportErrorCodeSchema.options) {
    assert.equal(bomTransportResultSchema.safeParse({ ok: false, requestId: null, error: { code, stage: "execute", retryable: false, safeMessage: "Engine operation failed safely.", diagnosticId: null } }).success, true, code);
  }
});

test("BR-015 typed_error_parser_is_exhaustive and preserves each valid IPC error distinctly", async () => {
  const { request } = await fixtures();
  for (const code of bomTransportErrorCodeSchema.options) {
    const expected = {
      ok: false as const,
      requestId: request.requestId,
      error: {
        code,
        stage: code === "request-write-failed" ? "write" as const : "execute" as const,
        retryable: code === "timeout" || code === "cancelled" || code === "engine-unavailable",
        safeMessage: `Safe ${code} failure.`,
        diagnosticId: `diag_${code.replaceAll("-", "_")}`,
      },
    };
    assert.deepEqual(await runBomTransport(request, fake(async () => expected)), expected, code);
  }

  const rejected = await runBomTransport(request, fake(async () => Promise.reject(new Error("C:\\Users\\person\\secret token=xai-hidden"))));
  assert.deepEqual(rejected, {
    ok: false,
    requestId: request.requestId,
    error: {
      code: "engine-unavailable",
      stage: "execute",
      retryable: true,
      safeMessage: "The BOM engine could not be reached.",
      diagnosticId: null,
    },
  });
  assert.doesNotMatch(JSON.stringify(rejected), /Users|secret|token|xai-hidden/iu);
});

test("BR-020 error_ui_does_not_render_sensitive_detail rejects every unsafe IPC detail class", async () => {
  const { request } = await fixtures();
  const unsafeMessages = [
    "C:\\Users\\person\\plan.pdf",
    "/workspace/private/result.json",
    "Traceback (most recent call last)",
    "stack trace follows",
    "api_key=do-not-expose",
    "token: do-not-expose",
    "Control\u0000character",
    "xai-abcdefghijk",
  ];
  for (const safeMessage of unsafeMessages) {
    const result = await runBomTransport(request, fake(async () => ({
      ok: false,
      requestId: request.requestId,
      error: { code: "spawn-failed", stage: "spawn", retryable: true, safeMessage, diagnosticId: null },
    })));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "response-contract");
      assert.equal(result.error.safeMessage, "The BOM engine returned an invalid transport result.");
    }
    assert.doesNotMatch(JSON.stringify(result), /Users|workspace|Traceback|stack trace|api_key|do-not-expose|xai-abcdefghijk/iu);
  }
});

test("BR-008 accepts exact request-byte boundary and rejects boundary-minus-one before invocation", async () => {
  const { request, response } = await fixtures();
  const bytes = new TextEncoder().encode(JSON.stringify(request)).byteLength;
  const exact = fake(async () => success(request, response));
  assert.equal((await runBomTransport(request, exact, { limits: limits({ requestBytes: bytes }) })).ok, true);
  assert.equal(exact.calls, 1);
  const small = fake(async () => success(request, response));
  const rejected = await runBomTransport(request, small, { limits: limits({ requestBytes: bytes - 1 }) });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "invalid-request");
  assert.equal(small.calls, 0);
});

test("BR-009 accepts exact response-byte boundary and rejects boundary-plus-one", async () => {
  const { request, response } = await fixtures();
  const encoded = JSON.stringify(success(request, response));
  const bytes = new TextEncoder().encode(encoded).byteLength;
  assert.equal((await runBomTransport(request, fake(async () => encoded), { limits: limits({ responseBytes: bytes }) })).ok, true);
  const rejected = await runBomTransport(request, fake(async () => `${encoded} `), { limits: limits({ responseBytes: bytes }) });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "response-limit");
});

test("BR-011 timeout aborts the adapter and returns a typed timeout", async () => {
  const { request } = await fixtures();
  let observedAbort = false;
  const adapter = fake(async (_json, { signal }) => new Promise((resolve) => signal.addEventListener("abort", () => {
    observedAbort = true;
    resolve(null);
  }, { once: true })));
  const result = await runBomTransport(request, adapter, { timeoutMs: 10, limits: limits({ executionMs: 50 }) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "timeout");
  assert.equal(observedAbort, true);
});

test("BR-012 cancellation is distinct from timeout and aborts the adapter", async () => {
  const { request } = await fixtures();
  const controller = new AbortController();
  let observedAbort = false;
  let announceStart!: () => void;
  const started = new Promise<void>((resolve) => { announceStart = resolve; });
  const adapter = fake(async (_json, { signal }) => {
    announceStart();
    return new Promise((resolve) => signal.addEventListener("abort", () => {
      observedAbort = true;
      resolve(null);
    }, { once: true }));
  });
  const pending = runBomTransport(request, adapter, { signal: controller.signal, timeoutMs: 100, limits: limits({ executionMs: 200 }) });
  await started;
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "cancelled");
  assert.equal(observedAbort, true);
});

test("BR-012 BR-028 cancellation wins over a late success while current-binding validation is pending", async () => {
  const { request, response } = await fixtures();
  const controller = new AbortController();
  let releaseCurrent!: (current: boolean) => void;
  let announceCurrentCheck!: () => void;
  const currentCheckStarted = new Promise<void>((resolve) => { announceCurrentCheck = resolve; });
  const pending = runBomTransport(request, fake(async () => success(request, response)), {
    signal: controller.signal,
    timeoutMs: 100,
    limits: limits({ executionMs: 200 }),
    isCurrent: async () => {
      announceCurrentCheck();
      return new Promise<boolean>((resolve) => { releaseCurrent = resolve; });
    },
  });
  await currentCheckStarted;
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "cancelled");
  releaseCurrent(true);
});

test("BR-011 timeout wins promptly while current-binding validation is pending", async () => {
  const { request, response } = await fixtures();
  let releaseCurrent!: (current: boolean) => void;
  let announceCurrentCheck!: () => void;
  const currentCheckStarted = new Promise<void>((resolve) => { announceCurrentCheck = resolve; });
  const pending = runBomTransport(request, fake(async () => success(request, response)), {
    timeoutMs: 10,
    limits: limits({ executionMs: 100 }),
    isCurrent: async () => {
      announceCurrentCheck();
      return new Promise<boolean>((resolve) => { releaseCurrent = resolve; });
    },
  });
  await currentCheckStarted;
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "timeout");
  releaseCurrent(true);
});

test("BR-014 pending invocation does not block the event-loop heartbeat", async () => {
  const { request } = await fixtures();
  const controller = new AbortController();
  let heartbeat = 0;
  let announceStart!: () => void;
  const started = new Promise<void>((resolve) => { announceStart = resolve; });
  const adapter = fake(async (_json, { signal }) => {
    announceStart();
    return new Promise((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }));
  });
  const pending = runBomTransport(request, adapter, { signal: controller.signal, timeoutMs: 100, limits: limits({ executionMs: 200 }) });
  await started;
  await new Promise<void>((resolve) => setTimeout(() => { heartbeat += 1; resolve(); }, 0));
  assert.equal(heartbeat, 1);
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "cancelled");
});

test("BR-021 BR-025 BR-026 runtime status and web behavior are truthful", async () => {
  const { request, response } = await fixtures();
  const web = fake(async () => success(request, response), "web");
  assert.deepEqual(await getBomTransportStatus(web), { available: false, host: "web", requestSchemas: [], responseSchemas: [], rulesets: [] });
  const webResult = await runBomTransport(request, web);
  assert.equal(webResult.ok, false);
  if (!webResult.ok) assert.equal(webResult.error.code, "engine-unavailable");
  assert.equal(web.calls, 0);

  const lyingElectron = fake(async () => success(request, response), "electron");
  lyingElectron.status = async () => ({ available: true, host: "tauri", requestSchemas: ["xray.job-to-bom/v1"], responseSchemas: ["xray.bom/v1"], rulesets: [{ id: "fencing-v1", version: 1 }] });
  assert.equal((await getBomTransportStatus(lyingElectron)).available, false);
  const incompatible = fake(async () => success(request, response), "tauri");
  incompatible.status = async () => ({ available: true, host: "tauri", requestSchemas: [], responseSchemas: [], rulesets: [] });
  assert.equal((await getBomTransportStatus(incompatible)).available, false);

  for (const dishonestStatus of [
    { available: false, host: "tauri", requestSchemas: ["xray.job-to-bom/v1"], responseSchemas: [], rulesets: [] },
    { available: true, host: "tauri", requestSchemas: ["xray.job-to-bom/v1"], responseSchemas: ["xray.bom/v1"], rulesets: [{ id: "fencing-v1", version: 1 }, { id: "fencing-v1", version: 1 }] },
  ]) {
    const dishonest = fake(async () => success(request, response), "tauri");
    dishonest.status = async () => dishonestStatus;
    assert.deepEqual(await getBomTransportStatus(dishonest), { available: false, host: "tauri", requestSchemas: [], responseSchemas: [], rulesets: [] });
  }
});

test("BR-023 BR-028 BR-031 stale source hook rejects a valid old completion", async () => {
  const { request, response } = await fixtures();
  let staleBinding: ReturnType<typeof bindingForBomRequest> | null = null;
  const result = await runBomTransport(request, fake(async () => success(request, response)), {
    isCurrent: (binding) => binding.jobRevision === request.job.revision + 1,
    onStaleResponse: (binding) => { staleBinding = binding; },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "stale-response");
  assert.equal((staleBinding as ReturnType<typeof bindingForBomRequest> | null)?.documentSha256, request.document.sha256);

  const original = bindingForBomRequest(request);
  for (const changed of [
    { ...original, jobRevision: original.jobRevision + 1 },
    { ...original, documentSha256: "f".repeat(64) },
    { ...original, recipeSetRevision: original.recipeSetRevision + 1 },
    { ...original, recipeSetDigest: "f".repeat(64) },
    { ...original, ruleset: { ...original.ruleset, version: original.ruleset.version + 1 } },
  ]) assert.equal(sameBomSourceBinding(original, changed), false);
});

test("BR-024 BR-032 preserves a valid kernel-domain failure inside a successful transport", async () => {
  const { request } = await fixtures();
  const domain: BomBuildResponse = {
    schema: "xray.bom/v1",
    ok: false,
    requestId: request.requestId,
    inputDigest: request.inputDigest,
    issues: [{ code: "gate-overlap", message: "Two openings overlap.", entityId: "gate-a", path: "gates" }],
  };
  const result = await runBomTransport(request, fake(async () => success(request, domain)));
  assert.deepEqual(result, success(request, domain));

  const missing = await runBomTransport(request, fake(async () => null));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "response-contract");
  assert.notDeepEqual(missing, success(request, domain));
});

test("BR-030 retry changes request identity but keeps canonical digest and source binding", async () => {
  const { request } = await fixtures();
  const retry = structuredClone(request);
  retry.requestId = "retry-request";
  retry.inputDigest = await computeBomInputDigest(retry);
  assert.equal(retry.inputDigest, request.inputDigest);
  assert.deepEqual({ ...bindingForBomRequest(retry), inputDigest: "same" }, { ...bindingForBomRequest(request), inputDigest: "same" });
});

test("BR-033 BR-034 rejects commercial and path fields before the fake adapter runs", async () => {
  const { request, response } = await fixtures();
  for (const injected of [{ rate: 12 }, { amount: 40 }, { tax: 4 }, { margin: 0.2 }, { inputPath: "C:\\plan.pdf" }, { outputPath: "/tmp/result.json" }, { target: "handoff" }]) {
    const adapter = fake(async () => success(request, response));
    const result = await runBomTransport({ ...request, ...injected }, adapter);
    assert.equal(result.ok, false);
    assert.equal(adapter.calls, 0);
  }
});

test("BR-033 transport_payload_rejects_forbidden_commercial_fields at nested request and response boundaries", async () => {
  const { request, response } = await fixtures();
  const requestMutations: Array<(candidate: any) => void> = [
    (candidate) => { candidate.job.rate = 12; },
    (candidate) => { candidate.document.inputPath = "C:\\plan.pdf"; },
    (candidate) => { candidate.recipeSet.margin = 0.2; },
    (candidate) => { candidate.runs[0].quoteStatus = "draft"; },
  ];
  for (const mutate of requestMutations) {
    const candidate: any = structuredClone(request);
    mutate(candidate);
    const adapter = fake(async () => success(request, response));
    const result = await runBomTransport(candidate, adapter);
    assert.equal(result.ok, false);
    assert.equal(adapter.calls, 0);
  }

  const responseMutations: Array<(candidate: any) => void> = [
    (candidate) => { candidate.response.bom.amount = 99; },
    (candidate) => { candidate.response.bom.lines[0].tax = 9; },
    (candidate) => { candidate.response.bom.lines[0].loopletReceipt = "receipt"; },
  ];
  for (const mutate of responseMutations) {
    const candidate: any = structuredClone(success(request, response));
    mutate(candidate);
    const result = await runBomTransport(request, fake(async () => candidate));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "response-contract");
  }
});

test("BR-035 transport tests use only an injected in-memory adapter", async () => {
  const { request, response } = await fixtures();
  const adapter = fake(async (requestJson) => {
    assert.equal(JSON.parse(requestJson).requestId, request.requestId);
    return success(request, response);
  });
  assert.equal((await runBomTransport(request, adapter)).ok, true);
  assert.equal(adapter.calls, 1);
});

function limits(overrides: Partial<BomTransportLimits>): BomTransportLimits {
  return { ...BOM_TRANSPORT_LIMITS, ...overrides };
}
