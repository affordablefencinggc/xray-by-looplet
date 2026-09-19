import { z } from "zod";
import type { StraightDuctSchedule } from "./straightDuct.ts";

const label = z.string().trim().min(1).max(240);
const reference = z.string().trim().min(1).max(1000);
const positive = z.number().finite().positive().max(Number.MAX_SAFE_INTEGER);
export const ductMaterialSchema = z.enum(["galvanized-steel", "aluminum", "stainless-steel"]);
export const ductMaterialSourceIdentitySchema = z.object({
  sourceId: label,
  sourceRevision: label,
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type DuctMaterialSourceIdentity = z.infer<typeof ductMaterialSourceIdentitySchema>;

const thicknessSchema = z.object({ value: positive, unit: z.enum(["mm", "m"]), sourceReference: reference }).strict();
const densitySchema = z.object({ value: positive, unit: z.literal("kg/m3"), sourceReference: reference }).strict();
const provenanceSchema = ductMaterialSourceIdentitySchema.extend({
  sourceReference: reference,
  evidenceClass: z.enum(["declared", "inferred", "sample"]),
}).strict();

/** One user-supplied table row. Gauge labels do not select a normative thickness.
 * Bulk density is kg/m3; the derived areal mass is kg/m2. There is no database,
 * design-velocity prerequisite, source-byte authentication or certification here. */
export const ductMaterialValuesSchema = z.object({
  material: ductMaterialSchema,
  gaugeLabel: label,
  thickness: thicknessSchema,
  bulkDensity: densitySchema,
  provenance: provenanceSchema,
}).strict();
export type DuctMaterialValues = z.infer<typeof ductMaterialValuesSchema>;
const reviewerSchema = z.object({ reviewedBy: label, reviewedAt: z.string().datetime({ offset: true }) }).strict();
const reviewSchema = reviewerSchema.extend({ values: ductMaterialValuesSchema }).strict();

/** Nullable/omitted inputs mean unknown, never an assumed gauge or density.
 * The review preserves exact values so subsequent edits require another review. */
export const ductMaterialBasisSchema = z.object({
  material: ductMaterialSchema.nullish(),
  gaugeLabel: label.nullish(),
  thickness: thicknessSchema.nullish(),
  bulkDensity: densitySchema.nullish(),
  provenance: provenanceSchema.nullish(),
  review: reviewSchema.nullish(),
}).strict();
export type DuctMaterialBasis = z.infer<typeof ductMaterialBasisSchema>;
export type DuctMaterialUnknownReason =
  | "invalid-input" | "missing-material" | "missing-gauge" | "missing-thickness"
  | "missing-density" | "missing-provenance" | "unreviewed" | "ineligible-evidence"
  | "review-outdated" | "source-unavailable" | "source-mismatch" | "outside-numeric-range";
type SheetMassOperand = NonNullable<StraightDuctSchedule["sections"][number]["sheetMassKgPerM2"]>;
type CommonResult = {
  ruleset: "hvac-declared-material-basis-v1";
  evidenceStatus: "draft-unverified";
  verifiedQuoteEligible: false;
  sourceAuthenticated: false;
  basis: DuctMaterialBasis | null;
};
export type DuctMaterialBasisResult = CommonResult & ({
  status: "unknown";
  reasons: DuctMaterialUnknownReason[];
  validationIssues: string[];
  sheetMassKgPerM2: null;
  calculation: null;
} | {
  status: "declared";
  reasons: DuctMaterialUnknownReason[];
  validationIssues: string[];
  sheetMassKgPerM2: SheetMassOperand;
  calculation: { formula: "thicknessM * bulkDensityKgPerM3"; thicknessM: number; bulkDensityKgPerM3: number; value: number; unit: "kg/m2" };
});

const common = {
  ruleset: "hvac-declared-material-basis-v1" as const,
  evidenceStatus: "draft-unverified" as const,
  verifiedQuoteEligible: false as const,
  sourceAuthenticated: false as const,
};
function unknown(basis: DuctMaterialBasis | null, reasons: DuctMaterialUnknownReason[], validationIssues: string[] = []): DuctMaterialBasisResult {
  return { ...common, basis, status: "unknown", reasons, validationIssues, sheetMassKgPerM2: null, calculation: null };
}
function valuesOf(basis: DuctMaterialBasis) {
  return ductMaterialValuesSchema.safeParse({ material: basis.material, gaugeLabel: basis.gaugeLabel,
    thickness: basis.thickness, bulkDensity: basis.bulkDensity, provenance: basis.provenance });
}
function valuesKey(values: DuctMaterialValues): string {
  // Schemas create keys in a fixed order. This is an equality key, NOT a seal.
  return JSON.stringify(ductMaterialValuesSchema.parse(values));
}

/** Records the caller's explicit review declaration against exact inputs.
 * It does not independently verify the reviewer, source bytes or engineering use. */
export function recordDuctMaterialReview(input: unknown, reviewer: unknown): DuctMaterialBasis {
  const values = ductMaterialValuesSchema.parse(input);
  if (values.provenance.evidenceClass !== "declared") throw new Error("Sample or inferred material data cannot be recorded as a reviewed declaration.");
  const review = reviewerSchema.parse(reviewer);
  return { ...values, review: { ...review, values: structuredClone(values) } };
}

/** Re-evaluate whenever values or a known live source identity change. Supplying
 * null for currentSource means the source is unavailable. Omitting it performs
 * only internal reconciliation; the result still explicitly says unauthenticated.
 * A declared operand fits the existing straightDuct/wrap schedule contract, but
 * consumers must retain this full result alongside it and never promote it. */
export function evaluateDuctMaterialBasis(input: unknown, currentSource?: DuctMaterialSourceIdentity | null): DuctMaterialBasisResult {
  const parsed = ductMaterialBasisSchema.safeParse(input);
  if (!parsed.success) return unknown(null, ["invalid-input"], parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`));
  const basis = parsed.data;
  const reasons: DuctMaterialUnknownReason[] = [];
  if (!basis.material) reasons.push("missing-material");
  if (!basis.gaugeLabel) reasons.push("missing-gauge");
  if (!basis.thickness) reasons.push("missing-thickness");
  if (!basis.bulkDensity) reasons.push("missing-density");
  if (!basis.provenance) reasons.push("missing-provenance");
  else if (basis.provenance.evidenceClass !== "declared") reasons.push("ineligible-evidence");
  if (!basis.review) reasons.push("unreviewed");
  const values = valuesOf(basis);
  if (basis.review && values.success && valuesKey(values.data) !== valuesKey(basis.review.values)) reasons.push("review-outdated");
  if (currentSource === null) reasons.push("source-unavailable");
  else if (currentSource !== undefined) {
    const live = ductMaterialSourceIdentitySchema.safeParse(currentSource);
    if (!live.success) reasons.push("source-unavailable");
    else if (basis.provenance && (live.data.sourceId !== basis.provenance.sourceId || live.data.sourceRevision !== basis.provenance.sourceRevision || live.data.sourceSha256 !== basis.provenance.sourceSha256)) reasons.push("source-mismatch");
  }
  if (reasons.length || !values.success) return unknown(basis, reasons.length ? reasons : ["invalid-input"]);
  const data = values.data;
  const thicknessM = data.thickness.unit === "mm" ? data.thickness.value / 1000 : data.thickness.value;
  const value = thicknessM * data.bulkDensity.value;
  if (!Number.isFinite(thicknessM) || thicknessM <= 0 || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER)
    return unknown(basis, ["outside-numeric-range"]);
  const sourceReference = [
    "Declared reviewed material basis; not source-authenticated or verified",
    `${data.material}; gauge ${data.gaugeLabel}`,
    `thickness ${data.thickness.value} ${data.thickness.unit} (${data.thickness.sourceReference})`,
    `bulk density ${data.bulkDensity.value} kg/m3 (${data.bulkDensity.sourceReference})`,
    `${data.provenance.sourceReference}; source ${data.provenance.sourceId}; revision ${data.provenance.sourceRevision}; SHA-256 ${data.provenance.sourceSha256}`,
    `review declared by ${basis.review!.reviewedBy} at ${basis.review!.reviewedAt}`,
  ].join("; ");
  return { ...common, basis, status: "declared", reasons: [], validationIssues: [],
    sheetMassKgPerM2: { value, sourceReference },
    calculation: { formula: "thicknessM * bulkDensityKgPerM3", thicknessM, bulkDensityKgPerM3: data.bulkDensity.value, value, unit: "kg/m2" } };
}
