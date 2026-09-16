import { z } from "zod";
import { calculateDraftRoofArea, roofAreaInputSchema } from "./roofArea.ts";
import { sheetCoverageFormSchema } from "./sheetCoverage.ts";
import {
  INDUSTRY_SOURCE_BINDING_SCHEMA,
  createIndustrySourceBinding,
  evaluateIndustryBinding,
  industrySourceBindingSchema,
  isVerifiedEvidenceClass,
  type IndustryBindingEvaluation,
  type IndustrySourceBinding,
  type IndustrySourceState,
} from "../sourceBinding.ts";

const text = z.string().max(1000);
const numericText = z.string().max(80);
const opening = z.object({ id: text, planAreaM2: numericText, measurementReference: text }).strict();
const plane = z.object({ id: text, grossPlanAreaM2: numericText, pitchDegrees: numericText,
  measurementReference: text, pitchReference: text, openings: z.array(opening) }).strict();
export const roofFormSchema = z.object({ planes: z.array(plane), calculated: z.boolean(), sheetCoverage: sheetCoverageFormSchema.optional(),
  // Optional so drafts saved before source binding existed still open; `null` is an explicit unbound worksheet.
  binding: industrySourceBindingSchema.nullable().optional() }).strict();
export type RoofForm = z.infer<typeof roofFormSchema>;
export type RoofPlaneForm = RoofForm["planes"][number];
export const createEmptyRoofPlane = (): RoofPlaneForm => ({ id: "", grossPlanAreaM2: "", pitchDegrees: "", measurementReference: "", pitchReference: "", openings: [] });
export const createEmptyRoofForm = (): RoofForm => ({ planes: [createEmptyRoofPlane()], calculated: false, binding: null });

function number(text: string, label: string): number {
  const trimmed = text.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) throw Error(`${label}: enter an explicit non-negative decimal value.`);
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw Error(`${label}: value is outside the supported numeric range.`);
  return value;
}

/** Empty fields never silently become zero. The existing domain boundary retains
 * all pitch, area, reference and cross-field validation; no new measurement rules.
 */
export function roofFormInput(raw: unknown) {
  const form = roofFormSchema.parse(raw);
  return roofAreaInputSchema.parse({ planes: form.planes.map((plane, index) => ({
    ...plane,
    grossPlanAreaM2: number(plane.grossPlanAreaM2, `Plane ${index + 1} horizontal area`),
    pitchDegrees: number(plane.pitchDegrees, `Plane ${index + 1} pitch`),
    openings: plane.openings.map((opening, openingIndex) => ({ ...opening,
      planAreaM2: number(opening.planAreaM2, `Plane ${index + 1}, opening ${openingIndex + 1} horizontal area`),
    })),
  })) });
}
export const calculateRoofForm = (form: unknown) => calculateDraftRoofArea(roofFormInput(form));
/** Any input edit hides the previous result until the user explicitly recalculates. */
export const editRoofForm = (planes: RoofForm["planes"]): RoofForm => ({ planes, calculated: false });

export function roofFormError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return error instanceof Error ? error.message : "Check the roof inputs.";
}

/** What the user types to bind. Identity, hash, units and calibration are read from the live source
 * state, never from these fields, so a typed value can never masquerade as source identity.
 */
export type RoofBindingDraft = { pageIndexText: string; evidenceClass: string; reference: string };
export const createEmptyRoofBindingDraft = (): RoofBindingDraft => ({ pageIndexText: "", evidenceClass: "", reference: "" });

/** Build a binding from the live source state plus the user's explicit inputs. A blank page index or
 * evidence class is refused rather than defaulted to a plausible-looking page zero or class.
 */
export function createRoofBinding(source: IndustrySourceState, draft: RoofBindingDraft, boundAt: string): IndustrySourceBinding {
  const revision = source.sourceRevision;
  if (revision === null) throw Error("This project has no current source revision. Open or add a source before binding.");
  const pageIndexText = draft.pageIndexText.trim();
  if (!/^\d+$/.test(pageIndexText)) throw Error("Page index: enter the page you measured from as a whole number.");
  const evidenceClass = draft.evidenceClass.trim();
  if (evidenceClass === "") throw Error("Evidence class: choose how the source evidence was obtained.");
  if (draft.reference.trim() === "") throw Error("Reference: describe where this evidence came from.");
  return createIndustrySourceBinding({
    schema: INDUSTRY_SOURCE_BINDING_SCHEMA,
    projectId: source.projectId,
    sourceRevisionId: revision.id,
    sha256: revision.sha256,
    // The document's own label when the project supplies one; otherwise its revision id.
    sourceName: revision.name ?? revision.id,
    locator: { kind: "page", pageIndex: Number(pageIndexText) },
    calibrationId: source.calibrationId,
    // Roof plan areas are supplied in square metres, so the source length unit is the metre.
    units: "m",
    evidenceClass,
    reference: draft.reference,
    boundAt,
  });
}

export type RoofFormBindingEvaluation = {
  evaluation: IndustryBindingEvaluation;
  result: ReturnType<typeof calculateRoofForm> | null;
  error: string | null;
};

/** Pair the form with the live project state. A stale binding withholds the total entirely: the
 * worksheet must never present a current-looking number once its source has changed underneath it.
 * An unbound or current worksheet still calculates, exactly as a manual worksheet always has.
 */
export function evaluateRoofFormBinding(form: RoofForm, source: IndustrySourceState): RoofFormBindingEvaluation {
  const evaluation = evaluateIndustryBinding(form.binding ?? null, source);
  if (!form.calculated || evaluation.status === "stale") return { evaluation, result: null, error: null };
  try { return { evaluation, result: calculateRoofForm(form), error: null }; }
  catch (cause) { return { evaluation, result: null, error: roofFormError(cause) }; }
}

const ROOF_EVIDENCE_TEXT: Record<IndustrySourceBinding["evidenceClass"], string> = {
  traced: "traced source geometry",
  dimensioned: "dimensioned source geometry",
  inferred: "an inferred reconstruction",
  declared: "a typed reference",
};

/** Evidence classes are never promoted. Only traced and dimensioned evidence is source-derived; a
 * declared or inferred binding stays supplied and unverified, even while its binding is current.
 */
export function describeRoofBindingEvidence(binding: IndustrySourceBinding | null | undefined): string {
  if (!binding) return "Not bound: totals use the supplied inputs only and are not verified against any source.";
  return isVerifiedEvidenceClass(binding.evidenceClass)
    ? `Source-derived ${binding.evidenceClass} evidence from “${binding.sourceName}”. Totals remain a draft calculation and are not eligible for verified quotes.`
    : `Supplied evidence (${binding.evidenceClass}): ${ROOF_EVIDENCE_TEXT[binding.evidenceClass]} from “${binding.sourceName}”, not verified against the source.`;
}
