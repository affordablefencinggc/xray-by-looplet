import { z } from "zod";
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
import { calculateStraightDuctWrapDraft } from "./straightDuctWrap.ts";
import { calculateStraightDuctDraft, straightDuctScheduleSchema } from "./straightDuct.ts";
import { ductMaterialTableSchema, evaluateDuctMaterialRow } from "./ductMaterialTable.ts";

const field = z.object({ value: z.string(), sourceReference: z.string() }).strict();
export const ductSectionFormSchema = z.object({
  id: z.string(), shape: z.enum(["rectangular", "round"]),
  lengthM: field, widthM: field, heightM: field, diameterM: field,
  includeSheetMass: z.boolean(), sheetMassKgPerM2: field,
  materialRowId: z.string().max(120).optional(),
  includeWrap: z.boolean().optional(), insulationThicknessM: field.optional(), longitudinalOverlapM: field.optional(),
}).strict();
export const ductFormSchema = z.object({
  sections: z.array(ductSectionFormSchema).max(100),
  networkJson: z.string().max(500000).optional(),
  packagesJson: z.string().max(1000000).optional(),
  materialRows: ductMaterialTableSchema.optional(),
  binding: industrySourceBindingSchema.nullable().optional(),
}).strict();
export type DuctForm = z.infer<typeof ductFormSchema>;
export type DuctSectionForm = z.infer<typeof ductSectionFormSchema>;
export function createEmptyDuctForm(): DuctForm { return { sections: [], binding: null }; }
export function createEmptyDuctSection(): DuctSectionForm {
  const empty = () => ({ value: "", sourceReference: "" });
  return { id: "", shape: "rectangular", lengthM: empty(), widthM: empty(), heightM: empty(), diameterM: empty(), includeSheetMass: false, sheetMassKgPerM2: empty(), includeWrap: false, insulationThicknessM: empty(), longitudinalOverlapM: empty() };
}
function operand(input: DuctSectionForm["lengthM"], label: string, allowZero = false) {
  const text = input.value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new Error(`${label}: enter a positive number.`);
  if (!input.sourceReference.trim()) throw new Error(`${label}: add its source reference.`);
  const value = Number(text);
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0) || value > Number.MAX_SAFE_INTEGER) throw new Error(`${label}: enter a supported positive number.`);
  return { value, sourceReference: input.sourceReference.trim() };
}
export function ductFormToSchedule(input: DuctForm) {
  const form = ductFormSchema.parse(input);
  if (!form.sections.length) throw new Error("Add a straight section before calculating.");
  return straightDuctScheduleSchema.parse({ sections: form.sections.map((section, index) => {
    const label = `Section ${index + 1}`;
    if (!section.id.trim()) throw new Error(`${label}: enter a section name.`);
    const materialRow = form.materialRows?.find(row => row.id === section.materialRowId);
    const mass = !section.includeSheetMass ? null : section.materialRowId
      ? materialRow ? evaluateDuctMaterialRow(materialRow).sheetMassKgPerM2 : null
      : operand(section.sheetMassKgPerM2, `${label} sheet mass`);
    const common = { id: section.id.trim(), lengthM: operand(section.lengthM, `${label} length`),
      ...(mass ? { sheetMassKgPerM2: mass } : {}) };
    return section.shape === "rectangular"
      ? { ...common, shape: section.shape, widthM: operand(section.widthM, `${label} width`), heightM: operand(section.heightM, `${label} height`) }
      : { ...common, shape: section.shape, diameterM: operand(section.diameterM, `${label} diameter`) };
  }) });
}
export function calculateDuctForm(input: DuctForm) {
  const schedule = ductFormToSchedule(input);
  const selected = input.sections.filter(section => section.includeWrap);
  const wrap = selected.length ? calculateStraightDuctWrapDraft({ duct: schedule, wraps: selected.map(section => ({
    sectionId: section.id.trim(),
    insulationThicknessM: operand(section.insulationThicknessM ?? { value: "", sourceReference: "" }, `${section.id} insulation thickness`),
    longitudinalOverlapM: operand(section.longitudinalOverlapM ?? { value: "", sourceReference: "" }, `${section.id} longitudinal overlap`, true),
  })) }) : null;
  return { ...calculateStraightDuctDraft(schedule), wrap };
}

/** The straight-duct worksheet is defined in metres, so a binding records metres. This is the
 * worksheet's own unit, not a measurement read from the source. */
const DUCT_WORKSHEET_UNITS = "m";

export type DuctBindingInputs = {
  pageIndex: string;
  evidenceClass: IndustrySourceBinding["evidenceClass"] | "";
  reference: string;
};

/** Build a binding from the worksheet's explicit inputs and the live project source. An empty page
 * index or an unchosen evidence class is refused here rather than defaulted, so a click never
 * records page 0 or an evidence class the user did not choose. */
export function createDuctSourceBinding(inputs: DuctBindingInputs, source: IndustrySourceState): IndustrySourceBinding {
  const pageIndex = inputs.pageIndex.trim();
  if (!pageIndex) throw new Error("Enter the source page number before binding.");
  if (!/^\d+$/.test(pageIndex)) throw new Error("Enter the source page number as whole digits.");
  if (inputs.evidenceClass === "") throw new Error("Choose the evidence class before binding.");
  if (source.sourceRevision === null) throw new Error("No project source revision is open to bind to.");
  return createIndustrySourceBinding({
    schema: INDUSTRY_SOURCE_BINDING_SCHEMA,
    projectId: source.projectId,
    sourceRevisionId: source.sourceRevision.id,
    sha256: source.sourceRevision.sha256,
    // The document's own label when the project supplies one; otherwise its revision id.
    sourceName: source.sourceRevision.name ?? source.sourceRevision.id,
    locator: { kind: "page", pageIndex: Number(pageIndex) },
    calibrationId: source.calibrationId,
    units: DUCT_WORKSHEET_UNITS,
    evidenceClass: inputs.evidenceClass,
    reference: inputs.reference,
    boundAt: new Date().toISOString(),
  });
}

export const EVIDENCE_CLASS_LABELS: Record<IndustrySourceBinding["evidenceClass"], string> = {
  traced: "Traced from the source",
  dimensioned: "Dimensioned on the source",
  inferred: "Inferred reconstruction",
  declared: "Declared reference",
};

/** A typed reference stays a typed reference: only traced/dimensioned evidence is source-derived, and
 * even then the quantity remains a draft that cannot enter a verified quote. */
export function describeEvidenceClass(evidenceClass: IndustrySourceBinding["evidenceClass"]): string {
  return isVerifiedEvidenceClass(evidenceClass)
    ? `${EVIDENCE_CLASS_LABELS[evidenceClass]} — source-derived, still draft and not eligible for a verified quote`
    : `${EVIDENCE_CLASS_LABELS[evidenceClass]} — your supplied reference, not source-verified`;
}

export type DuctFormBindingEvaluation = {
  evaluation: IndustryBindingEvaluation;
  result: ReturnType<typeof calculateDuctForm> | null;
};

/** Pair the form with the live project state. A stale binding withholds the calculation entirely, so
 * a stale worksheet cannot present a current-looking total, while an unbound worksheet keeps
 * calculating and stays visibly unverified. */
export function evaluateDuctFormBinding(form: DuctForm, source: IndustrySourceState): DuctFormBindingEvaluation {
  const evaluation = evaluateIndustryBinding(form.binding ?? null, source);
  if (evaluation.status === "stale") return { evaluation, result: null };
  return { evaluation, result: calculateDuctForm(form) };
}
