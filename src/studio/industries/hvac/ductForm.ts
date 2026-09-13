import { z } from "zod";
import { calculateStraightDuctWrapDraft } from "./straightDuctWrap.ts";
import { calculateStraightDuctDraft, straightDuctScheduleSchema } from "./straightDuct.ts";

const field = z.object({ value: z.string(), sourceReference: z.string() }).strict();
export const ductSectionFormSchema = z.object({
  id: z.string(), shape: z.enum(["rectangular", "round"]),
  lengthM: field, widthM: field, heightM: field, diameterM: field,
  includeSheetMass: z.boolean(), sheetMassKgPerM2: field,
  includeWrap: z.boolean().optional(), insulationThicknessM: field.optional(), longitudinalOverlapM: field.optional(),
}).strict();
export const ductFormSchema = z.object({ sections: z.array(ductSectionFormSchema).max(100) }).strict();
export type DuctForm = z.infer<typeof ductFormSchema>;
export type DuctSectionForm = z.infer<typeof ductSectionFormSchema>;
export function createEmptyDuctForm(): DuctForm { return { sections: [] }; }
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
    const common = { id: section.id.trim(), lengthM: operand(section.lengthM, `${label} length`),
      ...(section.includeSheetMass ? { sheetMassKgPerM2: operand(section.sheetMassKgPerM2, `${label} sheet mass`) } : {}) };
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
