import { z } from "zod";
import { ductMaterialBasisSchema, evaluateDuctMaterialBasis, recordDuctMaterialReview } from "./ductMaterialBasis.ts";

const text = z.string().max(1000);
export const ductMaterialRowSchema = z.object({
  id: z.string().min(1).max(120), material: z.enum(["", "galvanized-steel", "aluminum", "stainless-steel"]),
  gauge: text, thickness: text, thicknessUnit: z.enum(["mm", "m"]), density: text,
  reference: text, sourceId: text, sourceRevision: text, sourceSha256: text,
  evidence: z.enum(["declared", "inferred", "sample"]), reviewer: text,
  reviewedBasis: ductMaterialBasisSchema.nullable(),
}).strict();
export type DuctMaterialRow = z.infer<typeof ductMaterialRowSchema>;
export const ductMaterialTableSchema = z.array(ductMaterialRowSchema).max(100).refine(rows => new Set(rows.map(r => r.id)).size === rows.length, "Material row IDs must be unique.");
export function emptyDuctMaterialRow(id: string): DuctMaterialRow {
  return { id, material: "", gauge: "", thickness: "", thicknessUnit: "mm", density: "", reference: "", sourceId: "", sourceRevision: "", sourceSha256: "", evidence: "declared", reviewer: "", reviewedBasis: null };
}
function number(text: string) {
  const trimmed = text.trim();
  return /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
}
function currentBasis(row: DuctMaterialRow) {
  return { material: row.material || null, gaugeLabel: row.gauge.trim() || null,
    thickness: row.thickness.trim() ? { value: number(row.thickness), unit: row.thicknessUnit, sourceReference: row.reference } : null,
    bulkDensity: row.density.trim() ? { value: number(row.density), unit: "kg/m3", sourceReference: row.reference } : null,
    provenance: row.reference.trim() || row.sourceId.trim() || row.sourceRevision.trim() || row.sourceSha256.trim() ? {
      sourceId: row.sourceId, sourceRevision: row.sourceRevision, sourceSha256: row.sourceSha256, sourceReference: row.reference, evidenceClass: row.evidence,
    } : null,
    review: row.reviewedBasis?.review ?? null,
  };
}
export function evaluateDuctMaterialRow(input: unknown) {
  const row = ductMaterialRowSchema.parse(input);
  return evaluateDuctMaterialBasis(currentBasis(row));
}
export function reviewDuctMaterialRow(input: unknown, reviewedAt = new Date().toISOString()): DuctMaterialRow {
  const row = ductMaterialRowSchema.parse(input), { review: _review, ...values } = currentBasis(row);
  return { ...row, reviewedBasis: recordDuctMaterialReview(values, { reviewedBy: row.reviewer, reviewedAt }) };
}
