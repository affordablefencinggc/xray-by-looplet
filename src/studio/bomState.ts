import { z } from "zod";
import {
  BOM_RULESET_VERSION,
  bomBuildRequestSchema,
  bomBuildResponseSchema,
  bomIssueSchema,
  type BomBuildRequest,
  type BomBuildResponse,
  type BomIssue,
} from "./bomContract.ts";

export const BOM_STATE_SCHEMA = "xray.bom-state/v1" as const;
export const BOM_SNAPSHOT_SCHEMA = "xray.bom-snapshot/v1" as const;

const isoDateTime = z.string().datetime({ offset: true });
const id = z.string().min(1).max(240);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const positiveInt = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeInt = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const bomRulesetBindingSchema = z
  .object({ id: z.literal(BOM_RULESET_VERSION), version: positiveInt })
  .strict();

export const bomSourceBindingSchema = z
  .object({
    jobId: id,
    jobRevision: positiveInt,
    documentSha256: sha256,
    recipeSetId: id,
    recipeSetRevision: positiveInt,
    recipeSetDigest: sha256,
    ruleset: bomRulesetBindingSchema,
    inputDigest: sha256,
  })
  .strict();

export const bomInvalidationReasonSchema = z.enum([
  "source-changed",
  "recipe-changed",
  "ruleset-changed",
  "job-changed",
]);

const successfulResponseSchema = bomBuildResponseSchema.refine(
  (response): response is Extract<BomBuildResponse, { ok: true }> => response.ok,
  "A durable BOM snapshot requires a successful xray.bom/v1 response.",
);

export const bomSnapshotSchema = z
  .object({
    schema: z.literal(BOM_SNAPSHOT_SCHEMA),
    commitRevision: positiveInt,
    committedAt: isoDateTime,
    requestId: id,
    binding: bomSourceBindingSchema,
    response: successfulResponseSchema,
  })
  .strict();

const pendingBuildSchema = z
  .object({
    requestId: id,
    expectedJobRevision: positiveInt,
    startedAt: isoDateTime,
    binding: bomSourceBindingSchema,
  })
  .strict();

const invalidationSchema = z
  .object({
    invalidatedAt: isoDateTime,
    reasons: z.array(bomInvalidationReasonSchema).min(1),
    observedBinding: bomSourceBindingSchema,
  })
  .strict();

const failureSchema = z
  .object({
    kind: z.enum(["domain", "transport", "contract"]),
    failedAt: isoDateTime,
    requestId: id,
    expectedJobRevision: positiveInt,
    message: z.string().min(1).max(1000),
    issues: z.array(bomIssueSchema),
  })
  .strict();

export const bomStateEnvelopeSchema = z
  .object({
    schema: z.literal(BOM_STATE_SCHEMA),
    stateRevision: nonNegativeInt,
    jobId: id,
    pending: pendingBuildSchema.nullable(),
    snapshot: bomSnapshotSchema.nullable(),
    invalidation: invalidationSchema.nullable(),
    lastFailure: failureSchema.nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.pending && state.pending.binding.jobId !== state.jobId) {
      context.addIssue({ code: "custom", path: ["pending", "binding", "jobId"], message: "Pending BOM job identity must match its envelope." });
    }
    if (state.pending && state.pending.expectedJobRevision !== state.pending.binding.jobRevision) {
      context.addIssue({ code: "custom", path: ["pending", "expectedJobRevision"], message: "Pending BOM revision must match its immutable binding." });
    }
    if (state.snapshot) {
      if (state.snapshot.binding.jobId !== state.jobId) {
        context.addIssue({ code: "custom", path: ["snapshot", "binding", "jobId"], message: "Snapshot job identity must match its envelope." });
      }
      if (!successfulResponseMatchesBinding(state.snapshot.response, state.snapshot.requestId, state.snapshot.binding)) {
        context.addIssue({ code: "custom", path: ["snapshot", "response"], message: "Snapshot response does not match its immutable source binding." });
      }
      if (state.snapshot.commitRevision > state.stateRevision) {
        context.addIssue({ code: "custom", path: ["snapshot", "commitRevision"], message: "Snapshot revision cannot exceed the envelope revision." });
      }
    }
    if (state.invalidation && !state.snapshot) {
      context.addIssue({ code: "custom", path: ["invalidation"], message: "An invalidation requires a retained BOM snapshot." });
    }
    if (state.invalidation && state.invalidation.observedBinding.jobId !== state.jobId) {
      context.addIssue({ code: "custom", path: ["invalidation", "observedBinding", "jobId"], message: "Invalidation job identity must match its envelope." });
    }
    if (state.invalidation && state.snapshot) {
      const expected = invalidationReasons(state.snapshot.binding, state.invalidation.observedBinding);
      if (JSON.stringify(expected) !== JSON.stringify(state.invalidation.reasons)) {
        context.addIssue({ code: "custom", path: ["invalidation", "reasons"], message: "Invalidation reasons must exactly describe the changed immutable bindings." });
      }
    }
    if (state.pending && state.snapshot) {
      const reasons = invalidationReasons(state.snapshot.binding, state.pending.binding);
      if (reasons.length === 0 && state.invalidation !== null) {
        context.addIssue({ code: "custom", path: ["invalidation"], message: "A matching pending build cannot retain stale invalidation state." });
      }
      if (reasons.length > 0 && (!state.invalidation || JSON.stringify(state.invalidation.reasons) !== JSON.stringify(reasons))) {
        context.addIssue({ code: "custom", path: ["invalidation"], message: "A changed pending build must invalidate the retained snapshot." });
      }
    }
  });

export type BomRulesetBinding = z.infer<typeof bomRulesetBindingSchema>;
export type BomSourceBinding = z.infer<typeof bomSourceBindingSchema>;
export type BomInvalidationReason = z.infer<typeof bomInvalidationReasonSchema>;
export type BomStateEnvelope = z.infer<typeof bomStateEnvelopeSchema>;
export type BomSnapshot = z.infer<typeof bomSnapshotSchema>;

export type BomStateTransition =
  | { ok: true; state: BomStateEnvelope }
  | { ok: false; state: BomStateEnvelope; reason: "no-pending-build" | "stale-request" | "stale-job-revision" | "binding-mismatch" };

export type BomStateLoadResult =
  | { ok: true; state: BomStateEnvelope }
  | { ok: false; reason: "invalid-json" | "unsupported-version" | "invalid-state" };

export function createBomState(jobId: string): BomStateEnvelope {
  return bomStateEnvelopeSchema.parse({
    schema: BOM_STATE_SCHEMA,
    stateRevision: 0,
    jobId,
    pending: null,
    snapshot: null,
    invalidation: null,
    lastFailure: null,
  });
}

export function bindingForBomRequest(
  input: BomBuildRequest,
  ruleset: BomRulesetBinding = { id: BOM_RULESET_VERSION, version: 1 },
): BomSourceBinding {
  const request = bomBuildRequestSchema.parse(input);
  return bomSourceBindingSchema.parse({
    jobId: request.job.id,
    jobRevision: request.job.revision,
    documentSha256: request.document.sha256,
    recipeSetId: request.recipeSet.id,
    recipeSetRevision: request.recipeSet.revision,
    recipeSetDigest: request.recipeSet.digest,
    ruleset,
    inputDigest: request.inputDigest,
  });
}

/** Start or replace a build as one validated immutable state transition. */
export function beginBomBuild(
  current: BomStateEnvelope,
  input: BomBuildRequest,
  startedAt: string,
  ruleset: BomRulesetBinding = { id: BOM_RULESET_VERSION, version: 1 },
): BomStateEnvelope {
  const state = bomStateEnvelopeSchema.parse(current);
  const binding = bindingForBomRequest(input, ruleset);
  if (binding.jobId !== state.jobId) throw new Error("A BOM request cannot cross the envelope job boundary.");
  const snapshotInvalidationReasons = state.snapshot
    ? invalidationReasons(state.snapshot.binding, binding)
    : [];
  return bomStateEnvelopeSchema.parse({
    ...state,
    stateRevision: state.stateRevision + 1,
    pending: {
      requestId: input.requestId,
      expectedJobRevision: input.job.revision,
      startedAt,
      binding,
    },
    invalidation: state.snapshot
      ? snapshotInvalidationReasons.length > 0
        ? { invalidatedAt: startedAt, reasons: snapshotInvalidationReasons, observedBinding: binding }
        : null
      : null,
    lastFailure: null,
  });
}

/**
 * Commit only the response for the current request and caller-observed job revision.
 * Rejections return the original state object content unchanged: there is no partial write.
 */
export function completeBomBuild(
  current: BomStateEnvelope,
  completion: {
    expectedRequestId: string;
    expectedJobRevision: number;
    completedAt: string;
    response: unknown;
  },
): BomStateTransition {
  const state = bomStateEnvelopeSchema.parse(current);
  if (!state.pending) return rejected(state, "no-pending-build");
  if (completion.expectedRequestId !== state.pending.requestId) return rejected(state, "stale-request");
  if (completion.expectedJobRevision !== state.pending.expectedJobRevision) return rejected(state, "stale-job-revision");

  const parsed = bomBuildResponseSchema.safeParse(completion.response);
  if (!parsed.success) {
    return {
      ok: true,
      state: finishFailure(state, {
        kind: "contract",
        failedAt: completion.completedAt,
        requestId: state.pending.requestId,
        expectedJobRevision: state.pending.expectedJobRevision,
        message: "BOM response failed strict xray.bom/v1 validation.",
        issues: [],
      }),
    };
  }
  const response = parsed.data;
  if (response.requestId !== state.pending.requestId) return rejected(state, "stale-request");
  if (!response.ok) {
    // This transition always represents an already validated, digest-bound
    // request. A null digest is reserved for failures before such a binding
    // exists and cannot be attributed to this pending build.
    if (response.inputDigest !== state.pending.binding.inputDigest) return rejected(state, "binding-mismatch");
    return {
      ok: true,
      state: finishFailure(state, {
        kind: "domain",
        failedAt: completion.completedAt,
        requestId: response.requestId,
        expectedJobRevision: state.pending.expectedJobRevision,
        message: "The BOM rules kernel rejected the bound request.",
        issues: response.issues,
      }),
    };
  }
  if (!successfulResponseMatchesBinding(response, state.pending.requestId, state.pending.binding)) {
    return rejected(state, "binding-mismatch");
  }

  const commitRevision = (state.snapshot?.commitRevision ?? 0) + 1;
  return {
    ok: true,
    state: bomStateEnvelopeSchema.parse({
      ...state,
      stateRevision: state.stateRevision + 1,
      pending: null,
      snapshot: {
        schema: BOM_SNAPSHOT_SCHEMA,
        commitRevision,
        committedAt: completion.completedAt,
        requestId: response.requestId,
        binding: state.pending.binding,
        response,
      },
      invalidation: null,
      lastFailure: null,
    }),
  };
}

/** Record a host/transport failure without erasing or revising the last valid snapshot. */
export function failBomBuild(
  current: BomStateEnvelope,
  failure: {
    expectedRequestId: string;
    expectedJobRevision: number;
    failedAt: string;
    message: string;
  },
): BomStateTransition {
  const state = bomStateEnvelopeSchema.parse(current);
  if (!state.pending) return rejected(state, "no-pending-build");
  if (failure.expectedRequestId !== state.pending.requestId) return rejected(state, "stale-request");
  if (failure.expectedJobRevision !== state.pending.expectedJobRevision) return rejected(state, "stale-job-revision");
  return {
    ok: true,
    state: finishFailure(state, {
      kind: "transport",
      failedAt: failure.failedAt,
      requestId: state.pending.requestId,
      expectedJobRevision: state.pending.expectedJobRevision,
      message: failure.message,
      issues: [],
    }),
  };
}

/** Retain the last snapshot but mark it stale and cancel any now-obsolete pending build. */
export function reconcileBomBinding(
  current: BomStateEnvelope,
  observedBinding: BomSourceBinding,
  invalidatedAt: string,
): BomStateEnvelope {
  const state = bomStateEnvelopeSchema.parse(current);
  const observed = bomSourceBindingSchema.parse(observedBinding);
  if (observed.jobId !== state.jobId) throw new Error("A BOM binding cannot cross the envelope job boundary.");
  const reference = state.pending?.binding ?? state.snapshot?.binding;
  if (!reference) return state;
  const reasons = invalidationReasons(reference, observed);
  if (reasons.length === 0) return state;
  return bomStateEnvelopeSchema.parse({
    ...state,
    stateRevision: state.stateRevision + 1,
    pending: null,
    invalidation: state.snapshot ? { invalidatedAt, reasons, observedBinding: observed } : null,
  });
}

export function invalidationReasons(
  previous: BomSourceBinding,
  observed: BomSourceBinding,
): BomInvalidationReason[] {
  const before = bomSourceBindingSchema.parse(previous);
  const after = bomSourceBindingSchema.parse(observed);
  const reasons: BomInvalidationReason[] = [];
  if (before.documentSha256 !== after.documentSha256) reasons.push("source-changed");
  if (
    before.recipeSetId !== after.recipeSetId ||
    before.recipeSetRevision !== after.recipeSetRevision ||
    before.recipeSetDigest !== after.recipeSetDigest
  ) reasons.push("recipe-changed");
  if (before.ruleset.id !== after.ruleset.id || before.ruleset.version !== after.ruleset.version) reasons.push("ruleset-changed");
  if (
    before.jobId !== after.jobId ||
    before.jobRevision !== after.jobRevision ||
    (before.inputDigest !== after.inputDigest && reasons.length === 0)
  ) reasons.push("job-changed");
  return reasons;
}

export function serializeBomState(state: BomStateEnvelope): string {
  return JSON.stringify(bomStateEnvelopeSchema.parse(state));
}

/** V1 has no implicit migration. Unknown versions and malformed snapshots fail closed. */
export function deserializeBomState(serialized: string): BomStateLoadResult {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!value || typeof value !== "object" || (value as { schema?: unknown }).schema !== BOM_STATE_SCHEMA) {
    return { ok: false, reason: "unsupported-version" };
  }
  const parsed = bomStateEnvelopeSchema.safeParse(value);
  return parsed.success ? { ok: true, state: parsed.data } : { ok: false, reason: "invalid-state" };
}

function finishFailure(
  state: BomStateEnvelope,
  failure: {
    kind: "domain" | "transport" | "contract";
    failedAt: string;
    requestId: string;
    expectedJobRevision: number;
    message: string;
    issues: BomIssue[];
  },
): BomStateEnvelope {
  return bomStateEnvelopeSchema.parse({
    ...state,
    stateRevision: state.stateRevision + 1,
    pending: null,
    lastFailure: failure,
  });
}

function successfulResponseMatchesBinding(
  response: Extract<BomBuildResponse, { ok: true }>,
  requestId: string,
  binding: BomSourceBinding,
): boolean {
  return (
    response.requestId === requestId &&
    response.bom.jobId === binding.jobId &&
    response.bom.jobRevision === binding.jobRevision &&
    response.bom.inputDigest === binding.inputDigest &&
    response.bom.documentSha256 === binding.documentSha256 &&
    response.bom.recipeSet.id === binding.recipeSetId &&
    response.bom.recipeSet.revision === binding.recipeSetRevision &&
    response.bom.recipeSet.digest === binding.recipeSetDigest &&
    response.bom.ruleset.id === binding.ruleset.id &&
    response.bom.ruleset.version === binding.ruleset.version
  );
}

function rejected(state: BomStateEnvelope, reason: Exclude<BomStateTransition, { ok: true }>["reason"]): BomStateTransition {
  return { ok: false, state, reason };
}
