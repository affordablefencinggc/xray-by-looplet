import { z } from "zod";
import { HVAC_ESTIMATE_LABEL, HVAC_MASS_RULE } from "./hvacPolicy.ts";

const operand = z.object({
  value: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER),
  sourceReference: z.string().trim().min(1),
}).strict();

const common = {
  id: z.string().trim().min(1),
  lengthM: operand,
  // Supplier-provided sheet mass per developed area; never a guessed density/gauge.
  sheetMassKgPerM2: operand.optional(),
};

export const straightDuctScheduleSchema = z.object({
  sections: z.array(z.discriminatedUnion("shape", [
    z.object({ ...common, shape: z.literal("rectangular"), widthM: operand, heightM: operand }).strict(),
    z.object({ ...common, shape: z.literal("round"), diameterM: operand }).strict(),
  ])).min(1),
}).strict().superRefine((schedule, context) => {
  const ids = new Set<string>();
  schedule.sections.forEach((section, index) => {
    if (ids.has(section.id)) context.addIssue({ code: "custom", path: ["sections", index, "id"], message: "Section IDs must be unique." });
    ids.add(section.id);
  });
});

export type StraightDuctSchedule = z.infer<typeof straightDuctScheduleSchema>;

function positiveResult(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error("Duct calculation is outside the supported positive finite range.");
  }
  return value;
}

/**
 * Straight-section lateral surface only, using explicitly entered developed dimensions.
 * References are retained for subsequent review, not authenticated here. This function
 * deliberately cannot issue a verified construction quantity or select a duct size.
 */
export function calculateStraightDuctDraft(input: unknown) {
  const schedule = straightDuctScheduleSchema.parse(input);
  const sections = schedule.sections.map((section) => {
    const perimeterM = positiveResult(section.shape === "rectangular"
      ? 2 * (section.widthM.value + section.heightM.value)
      : Math.PI * section.diameterM.value);
    const developedAreaM2 = positiveResult(perimeterM * section.lengthM.value);
    return {
      id: section.id,
      inputs: section,
      perimeterM,
      developedAreaM2,
      sheetMassKg: section.sheetMassKgPerM2
        ? positiveResult(developedAreaM2 * section.sheetMassKgPerM2.value)
        : null,
      areaFormula: section.shape === "rectangular"
        ? "2 × (widthM + heightM) × lengthM"
        : "π × diameterM × lengthM",
    };
  });
  return {
    status: "draft-unverified" as const,
    estimateLabel: HVAC_ESTIMATE_LABEL,
    massRule: HVAC_MASS_RULE,
    verifiedQuoteEligible: false as const,
    ruleset: "hvac-straight-duct-area-v1" as const,
    sections,
    developedAreaM2: positiveResult(sections.reduce((sum, section) => sum + section.developedAreaM2, 0)),
    // A missing mass operand must never look like a zero-mass section in a total.
    sheetMassKg: sections.every((section) => section.sheetMassKg !== null)
      ? positiveResult(sections.reduce((sum, section) => sum + section.sheetMassKg!, 0))
      : null,
    exclusions: ["fittings", "end caps", "seams and joints", "waste", "insulation", "supports"] as const,
  };
}
