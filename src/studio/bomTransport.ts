import { z } from "zod";

import {
  BOM_RULESET_VERSION,
  bomBuildRequestSchema,
  bomBuildResponseSchema,
  computeBomInputDigest,
  type BomBuildRequest,
  type BomBuildResponse,
} from "./bomContract.ts";
import {
  bindingForBomRequest,
  invalidationReasons,
  type BomSourceBinding,
} from "./bomState.ts";

export { bindingForBomRequest } from "./bomState.ts";
export type { BomSourceBinding } from "./bomState.ts";

export const BOM_TRANSPORT_LIMITS = Object.freeze({
  requestBytes: 1_048_576,
  responseBytes: 4_194_304,
  executionMs: 30_000,
} as const);

export const bomTransportErrorCodeSchema = z.enum([
  "invalid-request",
  "unsupported-contract",
  "engine-unavailable",
  "spawn-failed",
  "request-write-failed",
  "timeout",
  "cancelled",
  "nonzero-exit",
  "stdout-limit",
  "stderr-limit",
  "response-limit",
  "missing-result",
  "unsafe-result",
  "malformed-result",
  "response-contract",
  "request-id-mismatch",
  "input-digest-mismatch",
  "source-binding-mismatch",
  "stale-response",
]);

export const bomTransportStageSchema = z.enum([
  "preflight",
  "encode",
  "spawn",
  "write",
  "execute",
  "read",
  "parse",
  "validate",
  "bind",
  "cleanup",
]);

const safeMessageSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "Control characters are forbidden.")
  .refine((value) => !/(?:[a-z]:\\|\/(?:users|home|tmp|var|workspace)\/|traceback|backtrace|stack trace)/iu.test(value), "Paths and stack details are forbidden.")
  .refine((value) => !/(?:api[_-]?key|secret|token|password)\s*[:=]|\b(?:sk|xai)-[A-Za-z0-9_-]{8,}/iu.test(value), "Secrets-shaped details are forbidden.");

export const bomTransportErrorSchema = z
  .object({
    code: bomTransportErrorCodeSchema,
    stage: bomTransportStageSchema,
    retryable: z.boolean(),
    safeMessage: safeMessageSchema,
    diagnosticId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/u).nullable(),
  })
  .strict();

export const bomTransportResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), requestId: z.string().min(1).max(160), response: bomBuildResponseSchema }).strict(),
  z.object({ ok: z.literal(false), requestId: z.string().min(1).max(160).nullable(), error: bomTransportErrorSchema }).strict(),
]);

export const bomTransportStatusSchema = z
  .object({
    available: z.boolean(),
    host: z.enum(["tauri", "electron", "web"]),
    requestSchemas: z.array(z.literal("xray.job-to-bom/v1")),
    responseSchemas: z.array(z.literal("xray.bom/v1")),
    rulesets: z.array(z.object({ id: z.literal(BOM_RULESET_VERSION), version: z.number().int().positive() }).strict()),
  })
  .strict()
  .superRefine((status, context) => {
    if (!status.available) {
      if (status.requestSchemas.length !== 0 || status.responseSchemas.length !== 0 || status.rulesets.length !== 0) {
        context.addIssue({ code: "custom", message: "An unavailable engine cannot advertise supported contracts or rulesets." });
      }
      return;
    }
    if (status.requestSchemas.length !== 1 || status.responseSchemas.length !== 1 || status.rulesets.length !== 1 || status.rulesets[0]?.version !== 1) {
      context.addIssue({ code: "custom", message: "An available engine must advertise the exact compatible contract and ruleset." });
    }
  });

export type BomTransportError = z.infer<typeof bomTransportErrorSchema>;
export type BomTransportResult = z.infer<typeof bomTransportResultSchema>;
export type BomTransportStatus = z.infer<typeof bomTransportStatusSchema>;
export type BomTransportLimits = Readonly<{
  requestBytes: number;
  responseBytes: number;
  executionMs: number;
}>;

export interface BomTransportAdapter {
  readonly host: "tauri" | "electron" | "web";
  status(signal?: AbortSignal): Promise<unknown>;
  invoke(requestJson: string, options: Readonly<{ signal: AbortSignal; limits: BomTransportLimits }>): Promise<unknown>;
}

export type RunBomTransportOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  limits?: BomTransportLimits;
  rulesetVersion?: number;
  isCurrent?: (binding: BomSourceBinding) => boolean | Promise<boolean>;
  onStaleResponse?: (binding: BomSourceBinding) => void;
}>;

export async function getBomTransportStatus(adapter: BomTransportAdapter, signal?: AbortSignal): Promise<BomTransportStatus> {
  if (adapter.host === "web") return unavailableWebTransportStatus;
  try {
    const status = bomTransportStatusSchema.parse(await adapter.status(signal));
    return status.host === adapter.host ? status : unavailableStatus(adapter.host);
  } catch {
    return unavailableStatus(adapter.host);
  }
}

export const unavailableWebTransportStatus: BomTransportStatus = Object.freeze(unavailableStatus("web"));

export async function runBomTransport(
  input: unknown,
  adapter: BomTransportAdapter,
  options: RunBomTransportOptions = {},
): Promise<BomTransportResult> {
  const parsed = bomBuildRequestSchema.safeParse(input);
  if (!parsed.success) return failure(null, "invalid-request", "preflight", false, "The BOM request did not match the supported contract.");
  const request = parsed.data;

  if ((await computeBomInputDigest(request)) !== request.inputDigest) {
    return failure(request.requestId, "invalid-request", "preflight", false, "The BOM request digest does not match its content.");
  }

  const limits = options.limits ?? BOM_TRANSPORT_LIMITS;
  const limitsProblem = validateLimits(limits, options.timeoutMs);
  if (limitsProblem) return failure(request.requestId, "invalid-request", "preflight", false, limitsProblem);
  const timeoutMs = options.timeoutMs ?? limits.executionMs;
  const requestJson = JSON.stringify(request);
  if (byteLength(requestJson) > limits.requestBytes) {
    return failure(request.requestId, "invalid-request", "encode", false, "The BOM request exceeds the transport size limit.");
  }
  if (options.signal?.aborted) return failure(request.requestId, "cancelled", "execute", true, "BOM generation was cancelled.");
  if (adapter.host === "web") return failure(request.requestId, "engine-unavailable", "preflight", true, "Local BOM generation is unavailable in this browser.");

  const controller = new AbortController();
  let terminal: "pending" | "cancelled" | "timeout" = "pending";
  let resolveAbort!: () => void;
  const aborted = new Promise<void>((resolve) => { resolveAbort = resolve; });
  const cancel = () => {
    if (terminal !== "pending") return;
    terminal = "cancelled";
    controller.abort("cancelled");
    resolveAbort();
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    if (terminal !== "pending") return;
    terminal = "timeout";
    controller.abort("timeout");
    resolveAbort();
  }, timeoutMs);

  try {
    const invocation = Promise.resolve().then(() => adapter.invoke(requestJson, { signal: controller.signal, limits }));
    const settled = await Promise.race([
      invocation.then((value) => ({ kind: "value" as const, value }), () => ({ kind: "rejected" as const })),
      aborted.then(() => ({ kind: "aborted" as const })),
    ]);
    if (settled.kind === "aborted") {
      return controller.signal.reason === "timeout"
        ? failure(request.requestId, "timeout", "execute", true, "BOM generation exceeded its deadline.")
        : failure(request.requestId, "cancelled", "execute", true, "BOM generation was cancelled.");
    }
    if (settled.kind === "rejected") return failure(request.requestId, "engine-unavailable", "execute", true, "The BOM engine could not be reached.");
    const validation = validateTransportResult(settled.value, request, options, limits, controller.signal);
    const validated = await Promise.race([
      validation.then((value) => ({ kind: "value" as const, value }), () => ({ kind: "rejected" as const })),
      aborted.then(() => ({ kind: "aborted" as const })),
    ]);
    if (validated.kind === "aborted") {
      return controller.signal.reason === "timeout"
        ? failure(request.requestId, "timeout", "execute", true, "BOM generation exceeded its deadline.")
        : failure(request.requestId, "cancelled", "execute", true, "BOM generation was cancelled.");
    }
    if (validated.kind === "rejected") return failure(request.requestId, "engine-unavailable", "bind", true, "The BOM result could not be checked against current state.");
    return validated.value;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

async function validateTransportResult(
  raw: unknown,
  request: BomBuildRequest,
  options: RunBomTransportOptions,
  limits: BomTransportLimits,
  signal: AbortSignal,
): Promise<BomTransportResult> {
  let candidate = raw;
  if (typeof raw === "string") {
    if (byteLength(raw) > limits.responseBytes) return failure(request.requestId, "response-limit", "read", false, "The BOM engine response exceeds the transport size limit.");
    try {
      candidate = JSON.parse(raw);
    } catch {
      return failure(request.requestId, "malformed-result", "parse", false, "The BOM engine returned malformed data.");
    }
  } else {
    let encoded: string;
    try {
      encoded = JSON.stringify(raw);
    } catch {
      return failure(request.requestId, "malformed-result", "parse", false, "The BOM engine returned malformed data.");
    }
    if (encoded === undefined) return failure(request.requestId, "missing-result", "read", false, "The BOM engine returned no result.");
    if (byteLength(encoded) > limits.responseBytes) return failure(request.requestId, "response-limit", "read", false, "The BOM engine response exceeds the transport size limit.");
  }

  const envelope = bomTransportResultSchema.safeParse(candidate);
  if (!envelope.success) return failure(request.requestId, "response-contract", "validate", false, "The BOM engine returned an invalid transport result.");
  const result = envelope.data;
  if (result.requestId !== null && result.requestId !== request.requestId) {
    return failure(request.requestId, "request-id-mismatch", "bind", false, "The BOM response belongs to a different request.");
  }
  if (!result.ok) return result;
  if (result.response.requestId !== request.requestId) {
    return failure(request.requestId, "request-id-mismatch", "bind", false, "The BOM response belongs to a different request.");
  }

  const responseDigest = result.response.ok ? result.response.bom.inputDigest : result.response.inputDigest;
  if (responseDigest !== request.inputDigest) {
    return failure(request.requestId, "input-digest-mismatch", "bind", false, "The BOM response belongs to different source content.");
  }
  if (!result.response.ok) return result;

  const binding = bindingForBomRequest(request, { id: BOM_RULESET_VERSION, version: options.rulesetVersion ?? 1 });
  const bom = result.response.bom;
  if (
    bom.jobId !== binding.jobId ||
    bom.jobRevision !== binding.jobRevision ||
    bom.documentSha256 !== binding.documentSha256 ||
    bom.recipeSet.id !== binding.recipeSetId ||
    bom.recipeSet.revision !== binding.recipeSetRevision ||
    bom.recipeSet.digest !== binding.recipeSetDigest ||
    bom.ruleset.id !== binding.ruleset.id ||
    bom.ruleset.version !== binding.ruleset.version
  ) {
    return failure(request.requestId, "source-binding-mismatch", "bind", false, "The BOM response does not match the requested source revision.");
  }
  if (options.isCurrent && !(await options.isCurrent(binding))) {
    if (!signal.aborted) options.onStaleResponse?.(binding);
    return failure(request.requestId, "stale-response", "bind", true, "A newer source revision replaced this BOM request.");
  }
  return result;
}

/** @deprecated Use the canonical `bindingForBomRequest` name. */
export const sourceBinding = bindingForBomRequest;

export function sameBomSourceBinding(left: BomSourceBinding, right: BomSourceBinding): boolean {
  return invalidationReasons(left, right).length === 0;
}

export function isBomResponseBoundToRequest(response: BomBuildResponse, request: BomBuildRequest, rulesetVersion = 1): boolean {
  if (response.requestId !== request.requestId) return false;
  const digest = response.ok ? response.bom.inputDigest : response.inputDigest;
  if (digest !== request.inputDigest) return false;
  if (!response.ok) return true;
  const binding = bindingForBomRequest(request, { id: BOM_RULESET_VERSION, version: rulesetVersion });
  return response.bom.jobId === binding.jobId && response.bom.jobRevision === binding.jobRevision &&
    response.bom.documentSha256 === binding.documentSha256 && response.bom.recipeSet.id === binding.recipeSetId &&
    response.bom.recipeSet.revision === binding.recipeSetRevision && response.bom.recipeSet.digest === binding.recipeSetDigest &&
    response.bom.ruleset.id === binding.ruleset.id && response.bom.ruleset.version === binding.ruleset.version;
}

function unavailableStatus(host: BomTransportAdapter["host"]): BomTransportStatus {
  return { available: false, host, requestSchemas: [], responseSchemas: [], rulesets: [] };
}

function validateLimits(limits: BomTransportLimits, override: number | undefined): string | null {
  if (![limits.requestBytes, limits.responseBytes, limits.executionMs].every((value) => Number.isSafeInteger(value) && value > 0)) return "The BOM transport limits are invalid.";
  if (override !== undefined && (!Number.isSafeInteger(override) || override <= 0 || override > limits.executionMs)) return "The BOM transport deadline is invalid.";
  return null;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function failure(
  requestId: string | null,
  code: BomTransportError["code"],
  stage: BomTransportError["stage"],
  retryable: boolean,
  safeMessage: string,
): BomTransportResult {
  return { ok: false, requestId, error: { code, stage, retryable, safeMessage, diagnosticId: null } };
}
