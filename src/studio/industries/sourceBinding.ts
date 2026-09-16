import { z } from "zod";

/** Shared source binding for the industry worksheets (SH-02).
 *
 * An industry worksheet may bind its supplied inputs to one identified source revision so that
 * later editing or replacing of that source invalidates the dependent result instead of leaving a
 * stale number looking current. A binding records what the user pointed at; it never establishes
 * that the number is right, and it never promotes a typed reference into measured evidence.
 */

export const INDUSTRY_SOURCE_BINDING_SCHEMA = "xray.industry-source-binding/1" as const;

const id = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => value.trim() === value, "Identifiers cannot have surrounding whitespace.");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** The user's own wording, so surrounding whitespace is trimmed rather than rejected. */
const reference = z.string().trim().min(1).max(1000);
const point = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();

export const industryLengthUnitSchema = z.enum(["mm", "cm", "m", "in", "ft"]);

/** `traced` and `dimensioned` describe source-derived geometry; `declared` is the user's own typed
 * reference and stays authored however it is bound; `inferred` is a reconstruction.
 */
export const industryEvidenceClassSchema = z.enum(["traced", "dimensioned", "inferred", "declared"]);

export const industrySourceLocatorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("page"),
      pageIndex: z.number().int().nonnegative(),
      region: z.array(point).min(1).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("model"), elementId: id }).strict(),
  z.object({ kind: z.literal("document"), section: id }).strict(),
]);

export const industrySourceBindingSchema = z
  .object({
    schema: z.literal(INDUSTRY_SOURCE_BINDING_SCHEMA),
    projectId: id,
    sourceRevisionId: id,
    sha256: hash,
    sourceName: id,
    locator: industrySourceLocatorSchema,
    calibrationId: id.nullable(),
    units: industryLengthUnitSchema,
    evidenceClass: industryEvidenceClassSchema,
    reference,
    boundAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((binding, context) => {
    if (binding.locator.kind === "document" && binding.calibrationId !== null)
      context.addIssue({
        code: "custom",
        path: ["calibrationId"],
        message: "A document locator has no geometry to calibrate.",
      });
    if (binding.evidenceClass === "declared" && binding.calibrationId !== null)
      context.addIssue({
        code: "custom",
        path: ["calibrationId"],
        message: "A declared reference is not a calibrated measurement.",
      });
    if (binding.locator.kind !== "document" && binding.evidenceClass !== "declared" && binding.calibrationId === null)
      context.addIssue({
        code: "custom",
        path: ["calibrationId"],
        message: "Source-derived evidence requires the calibration it was measured against.",
      });
  });

export type IndustrySourceBinding = z.infer<typeof industrySourceBindingSchema>;

/** The current project state a binding is judged against. A missing revision is `null`, never a guess. */
export type IndustrySourceState = {
  projectId: string;
  /** `name` is the project document's own label for display. Identity stays the id and hash. */
  sourceRevision: { id: string; sha256: string; name?: string } | null;
  calibrationId: string | null;
};

export type IndustryBindingReason =
  | "project-changed"
  | "source-missing"
  | "source-replaced"
  | "source-revised"
  | "calibration-changed";

export type IndustryBindingStatus = "unbound" | "current" | "stale";

export type IndustryBindingEvaluation = {
  status: IndustryBindingStatus;
  reasons: IndustryBindingReason[];
};

export function createIndustrySourceBinding(raw: unknown): IndustrySourceBinding {
  return industrySourceBindingSchema.parse(raw);
}

/** A calibration's identity is its graded content, not its sheet number: re-locking the same sheet at
 * a different scale produces a different identity, so a binding made against the old one reads stale.
 * An unlocked calibration has no identity, so it can never anchor source-derived evidence.
 */
export function calibrationIdentity(calibration: {
  sheet: number;
  locked: boolean;
  source: string;
  metresPerUnit: number;
  selectedCandidateId: string | null;
}): string | null {
  if (!calibration.locked) return null;
  return [
    "cal",
    calibration.sheet,
    calibration.source,
    calibration.metresPerUnit,
    calibration.selectedCandidateId ?? "none",
  ].join(":");
}

/** A binding's `sourceName` is display text, so a document's own label is trimmed and bounded to the
 * contract's identifier length instead of being rejected. Identity stays the revision id and hash, so
 * a blank or overlong label falls back to the id rather than inventing a name.
 */
const SOURCE_LABEL_MAX = 240;
function sourceLabel(name: string, id: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return id;
  return trimmed.length <= SOURCE_LABEL_MAX ? trimmed : trimmed.slice(0, SOURCE_LABEL_MAX).trimEnd();
}

/** Map the open project record onto the binding inputs. Only a document that carries a hash can
 * anchor a binding, and only the active document's sheet calibrations are offered.
 */
export function industrySourceRecordsFrom(job: {
  projectId: string;
  documents: readonly { id: string; name?: string; sha256: string | null }[];
  activeDocumentId: string | null;
  activeSheet: number;
  calibrations: readonly {
    sheet: number;
    locked: boolean;
    source: string;
    metresPerUnit: number;
    selectedCandidateId: string | null;
  }[];
}): { sources: { id: string; sha256: string; name?: string }[]; calibrations: { id: string; sourceRevisionId: string }[]; currentSourceRevisionId: string | null } {
  const sources = job.documents.flatMap((document) =>
    document.sha256 === null
      ? []
      : [{ id: document.id, sha256: document.sha256, ...(document.name === undefined ? {} : { name: document.name }) }],
  );
  const active = sources.find((source) => source.id === job.activeDocumentId) ?? null;
  const calibrations = active === null
    ? []
    : job.calibrations.flatMap((calibration) => {
        const identity = calibrationIdentity(calibration);
        return identity === null ? [] : [{ id: identity, sourceRevisionId: active.id }];
      });
  return { sources, calibrations, currentSourceRevisionId: active?.id ?? null };
}

/** Derive the state a binding is judged against from the live project record. A revision id that the
 * project no longer holds becomes `null` rather than a remembered copy, so the binding reads stale.
 * Callers map their own records onto this shape; the helper reads no store itself.
 */
export function industrySourceStateFrom(
  job: {
    projectId: string;
    sources: readonly { id: string; sha256: string; name?: string }[];
    calibrations: readonly { id: string; sourceRevisionId: string }[];
  },
  sourceRevisionId: string | null,
): IndustrySourceState {
  const source = sourceRevisionId === null ? undefined : job.sources.find((entry) => entry.id === sourceRevisionId);
  const calibration = source === undefined
    ? undefined
    : job.calibrations.find((entry) => entry.sourceRevisionId === source.id);
  return {
    projectId: job.projectId,
    sourceRevision: source
      ? { id: source.id, sha256: source.sha256, ...(source.name === undefined ? {} : { name: sourceLabel(source.name, source.id) }) }
      : null,
    calibrationId: calibration?.id ?? null,
  };
}

/** True only for evidence the source itself established. A `declared` or `inferred` binding is never
 * verified, so a worksheet cannot use this to claim source verification.
 */
export function isVerifiedEvidenceClass(evidenceClass: IndustrySourceBinding["evidenceClass"]): boolean {
  return evidenceClass === "traced" || evidenceClass === "dimensioned";
}

function reasonsFor(binding: IndustrySourceBinding, state: IndustrySourceState): IndustryBindingReason[] {
  const reasons: IndustryBindingReason[] = [];
  if (binding.projectId !== state.projectId) reasons.push("project-changed");
  if (state.sourceRevision === null) reasons.push("source-missing");
  else {
    if (state.sourceRevision.id !== binding.sourceRevisionId) reasons.push("source-replaced");
    else if (state.sourceRevision.sha256 !== binding.sha256) reasons.push("source-revised");
  }
  if (state.calibrationId !== binding.calibrationId) reasons.push("calibration-changed");
  return reasons;
}

/** Evaluate a binding without mutating it. Reasons are ordered so two runs over the same state agree. */
export function evaluateIndustryBinding(
  binding: IndustrySourceBinding | null,
  state: IndustrySourceState,
): IndustryBindingEvaluation {
  if (binding === null) return { status: "unbound", reasons: [] };
  const reasons = reasonsFor(binding, state);
  return { status: reasons.length === 0 ? "current" : "stale", reasons };
}

export const INDUSTRY_BINDING_REASON_TEXT: Record<IndustryBindingReason, string> = {
  "project-changed": "the open project is not the project this was bound to",
  "source-missing": "the bound source revision is no longer in the project",
  "source-replaced": "a different source revision is bound to this worksheet",
  "source-revised": "the bound source revision was edited",
  "calibration-changed": "the calibration changed since this was bound",
};

export function describeIndustryBinding(evaluation: IndustryBindingEvaluation): string {
  if (evaluation.status === "unbound")
    return "Not bound to a project source. Results are the supplied inputs only.";
  if (evaluation.status === "current") return "Bound to the current source revision.";
  const text = evaluation.reasons.map((reason) => INDUSTRY_BINDING_REASON_TEXT[reason]);
  return `Stale: ${text.join("; ")}. Recalculate against the current source.`;
}

/** Refuse to treat a stale binding as current. The message names every reason, in a stable order. */
export function requireCurrentIndustryBinding(
  binding: IndustrySourceBinding | null,
  state: IndustrySourceState,
): IndustrySourceBinding | null {
  const evaluation = evaluateIndustryBinding(binding, state);
  if (evaluation.status === "stale") throw new RangeError(describeIndustryBinding(evaluation));
  return binding;
}
