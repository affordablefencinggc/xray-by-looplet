import { z } from "zod";

const reference = z.string().trim().min(1).max(1000);
const area = z.number().finite().nonnegative();
const openingSchema = z.object({
  id: reference,
  planAreaM2: area,
  measurementReference: reference,
}).strict();

/** Areas are horizontal projections, including openings; pitch is from horizontal.
 * References identify caller evidence only. This module never validates that evidence.
 */
export const roofAreaInputSchema = z.object({
  planes: z.array(z.object({
    id: reference,
    grossPlanAreaM2: area.positive(),
    measurementReference: reference,
    pitchDegrees: z.number().finite().min(0).lt(90),
    pitchReference: reference,
    openings: z.array(openingSchema),
  }).strict()).min(1),
}).strict().superRefine((input, context) => {
  const planeIds = new Set<string>();
  input.planes.forEach((plane, index) => {
    if (planeIds.has(plane.id)) context.addIssue({ code: "custom", path: ["planes", index, "id"], message: "Duplicate roof plane id" });
    planeIds.add(plane.id);
    const openingIds = new Set<string>();
    plane.openings.forEach((opening, openingIndex) => {
      if (openingIds.has(opening.id)) context.addIssue({ code: "custom", path: ["planes", index, "openings", openingIndex, "id"], message: "Duplicate opening id within roof plane" });
      openingIds.add(opening.id);
    });
    const deduction = plane.openings.reduce((sum, opening) => sum + opening.planAreaM2, 0);
    if (!Number.isFinite(deduction) || deduction > plane.grossPlanAreaM2) context.addIssue({ code: "custom", path: ["planes", index, "openings"], message: "Opening plan areas exceed gross plan area" });
  });
});

export type RoofAreaInput = z.infer<typeof roofAreaInputSchema>;

/** Draft arithmetic only: same-plane net horizontal area / cos(pitch).
 * The caller must ensure distinct non-overlapping planes and openings, measured in m².
 * Deliberately no waste, stock, rates, compliance or verified-output promotion.
 */
export function calculateDraftRoofArea(input: unknown) {
  const parsed = roofAreaInputSchema.parse(input);
  const planes = parsed.planes.map(plane => {
    const slopeFactor = 1 / Math.cos(plane.pitchDegrees * Math.PI / 180);
    const openingPlanAreaM2 = plane.openings.reduce((sum, opening) => sum + opening.planAreaM2, 0);
    const grossTrueAreaM2 = plane.grossPlanAreaM2 * slopeFactor;
    const openingTrueAreaM2 = openingPlanAreaM2 * slopeFactor;
    const netTrueAreaM2 = (plane.grossPlanAreaM2 - openingPlanAreaM2) * slopeFactor;
    if (![slopeFactor, grossTrueAreaM2, openingTrueAreaM2, netTrueAreaM2].every(Number.isFinite)) throw new RangeError("Roof area calculation exceeds finite numeric range");
    return { ...plane, slopeFactor, openingPlanAreaM2, grossTrueAreaM2, openingTrueAreaM2, netTrueAreaM2 };
  });
  const totals = planes.reduce((sum, plane) => ({
    grossTrueAreaM2: sum.grossTrueAreaM2 + plane.grossTrueAreaM2,
    openingTrueAreaM2: sum.openingTrueAreaM2 + plane.openingTrueAreaM2,
    netTrueAreaM2: sum.netTrueAreaM2 + plane.netTrueAreaM2,
  }), { grossTrueAreaM2: 0, openingTrueAreaM2: 0, netTrueAreaM2: 0 });
  if (!Object.values(totals).every(Number.isFinite)) throw new RangeError("Roof area totals exceed finite numeric range");
  return {
    status: "draft-calculation" as const,
    verifiedQuoteEligible: false as const,
    units: "m2" as const,
    planes,
    totals,
    limitations: [
      "Input references are retained, not validated against source documents or calibration.",
      "Plane and opening geometry is not available to check overlap or containment.",
      "No hip, valley, sheet, lap, waste, drainage or compliance calculation is included.",
    ],
  };
}
