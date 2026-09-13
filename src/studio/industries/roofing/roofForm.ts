import { z } from "zod";
import { calculateDraftRoofArea, roofAreaInputSchema } from "./roofArea.ts";

const text = z.string().max(1000);
const numericText = z.string().max(80);
const opening = z.object({ id: text, planAreaM2: numericText, measurementReference: text }).strict();
const plane = z.object({ id: text, grossPlanAreaM2: numericText, pitchDegrees: numericText,
  measurementReference: text, pitchReference: text, openings: z.array(opening) }).strict();
export const roofFormSchema = z.object({ planes: z.array(plane), calculated: z.boolean() }).strict();
export type RoofForm = z.infer<typeof roofFormSchema>;
export type RoofPlaneForm = RoofForm["planes"][number];
export const createEmptyRoofPlane = (): RoofPlaneForm => ({ id: "", grossPlanAreaM2: "", pitchDegrees: "", measurementReference: "", pitchReference: "", openings: [] });
export const createEmptyRoofForm = (): RoofForm => ({ planes: [createEmptyRoofPlane()], calculated: false });

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
