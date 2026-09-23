import { z } from "zod";
import { straightDuctScheduleSchema } from "./straightDuct.ts";
import { HVAC_ESTIMATE_LABEL } from "./hvacPolicy.ts";
const sourced = z.object({ value: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER), sourceReference: z.string().trim().min(1) }).strict();
export const straightDuctWrapSchema = z.object({ duct: straightDuctScheduleSchema, wraps: z.array(z.object({
  sectionId: z.string().trim().min(1), insulationThicknessM: sourced.extend({ value: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER) }), longitudinalOverlapM: sourced,
}).strict()).min(1) }).strict();
function bounded(value: number) { if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new Error("Wrap calculation exceeds the supported range."); return value; }
/** External straight-section wrap only; explicit rectangular outside-envelope convention. */
export function calculateStraightDuctWrapDraft(input: unknown) {
  const { duct, wraps } = straightDuctWrapSchema.parse(input);
  const seen = new Set<string>();
  const sections = wraps.map(wrap => {
    if (seen.has(wrap.sectionId)) throw new Error("Wrap section IDs must be unique.");
    seen.add(wrap.sectionId);
    const section = duct.sections.find(candidate => candidate.id === wrap.sectionId);
    if (!section) throw new Error("Wrap references an unknown duct section.");
    const t = wrap.insulationThicknessM.value;
    const outerPerimeterM = bounded(section.shape === "rectangular" ? 2 * (section.widthM.value + 2 * t + section.heightM.value + 2 * t) : Math.PI * (section.diameterM.value + 2 * t));
    const outerAreaM2 = bounded(outerPerimeterM * section.lengthM.value);
    if (outerPerimeterM <= 0 || outerAreaM2 <= 0) throw new Error("Wrap geometry is below the supported positive range.");
    const overlapAreaM2 = bounded(wrap.longitudinalOverlapM.value * section.lengthM.value);
    const wrapAreaM2 = bounded(outerAreaM2 + overlapAreaM2);
    const calculationSteps = [
      { quantity: "outerPerimeterM", formula: section.shape === "rectangular" ? "2 * (widthM + 2 * insulationThicknessM + heightM + 2 * insulationThicknessM)" : "pi * (diameterM + 2 * insulationThicknessM)",
        substitution: section.shape === "rectangular" ? `2 * (${section.widthM.value} + 2 * ${t} + ${section.heightM.value} + 2 * ${t})` : `pi * (${section.diameterM.value} + 2 * ${t})`, result: outerPerimeterM, unit: "m" },
      { quantity: "outerAreaM2", formula: "outerPerimeterM * lengthM", substitution: `${outerPerimeterM} * ${section.lengthM.value}`, result: outerAreaM2, unit: "m2" },
      { quantity: "overlapAreaM2", formula: "longitudinalOverlapM * lengthM", substitution: `${wrap.longitudinalOverlapM.value} * ${section.lengthM.value}`, result: overlapAreaM2, unit: "m2" },
      { quantity: "wrapAreaM2", formula: "outerAreaM2 + overlapAreaM2", substitution: `${outerAreaM2} + ${overlapAreaM2}`, result: wrapAreaM2, unit: "m2" },
    ];
    return { id: section.id, calculationSteps, inputs: { section, ...wrap }, outerPerimeterM, outerAreaM2, overlapAreaM2, wrapAreaM2 };
  });
  return { status: "draft-unverified" as const, estimateLabel: HVAC_ESTIMATE_LABEL, verifiedQuoteEligible: false as const, ruleset: "hvac-straight-external-wrap-v1" as const, sections,
    wrapAreaM2: bounded(sections.reduce((sum, section) => sum + section.wrapAreaM2, 0)),
    exclusions: ["fittings", "end faces", "transverse laps", "waste", "thermal performance", "fire performance", "compliance assessment"] };
}
