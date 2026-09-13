import { z } from "zod";
import { calculateSheetCoverage, sheetCoverageInputSchema } from "./sheetCoverage.ts";

export const name = "calculate_draft_roof_sheet_coverage";
export const description = "Calculate draft rectangular roof sheet coverage from explicit developed dimensions, effective cover after side lap, ordered sheet length, end lap and source references. Lengths are decimal strings in metres, up to nine decimal places. End lap must be explicitly supplied, including zero. Explain the returned calculation steps and limitations faithfully: the first course is full length, so courses is NOT generally ceil(run / (ordered length - end lap)). End laps ARE included; fixings and flashings are excluded. No measured project quantities, geometry, orders or quotes are changed.";
export const inputSchema = z.toJSONSchema(sheetCoverageInputSchema);
export const execute = (input: unknown) => calculateSheetCoverage(sheetCoverageInputSchema.parse(input));
