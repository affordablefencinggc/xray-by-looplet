import { z } from "zod";
import { calculateDraftRoofArea, roofAreaInputSchema } from "./roofArea.ts";

export const name = "calculate_draft_roof_area";
export const description = "Calculate draft true roof-plane areas from explicitly supplied horizontal gross plan areas (m²), pitch degrees measured from horizontal, and horizontal opening areas (m²). Every plane requires a measurementReference and pitchReference; every opening requires a measurementReference. Use only values and references actually supplied by the user or read from project evidence; never invent dimensions, references or pitch. Empty openings must be explicitly supplied as []. Returns per-plane gross/opening/net true areas and totals, preserving supplied references. This is arithmetic only, not source inspection or calibration: references are not verified, overlap/containment is not checked, and output is always draft-calculation with verifiedQuoteEligible:false. No project changes, saved quantities, prices, sheet layouts, hip/valley lengths, waste, drainage or compliance results. Missing input must be requested, not defaulted.";

// Generated from the same strict boundary used at execution. Cross-field checks
// (duplicate IDs, deduction totals) additionally run in the Zod parser at execute.
export const inputSchema = z.toJSONSchema(roofAreaInputSchema);

export function execute(input: unknown) {
  return calculateDraftRoofArea(input);
}
