import { z } from "zod";

const numericText = z.string().max(80);
export const sheetCoverageFormSchema = z.object({
  developedWidthM: numericText, developedRunM: numericText, effectiveCoverM: numericText,
  orderLengthM: numericText, endLapM: numericText,
  measurementReference: z.string().max(1000), supplierReference: z.string().max(1000),
  calculated: z.boolean(),
}).strict();
export type SheetCoverageForm = z.infer<typeof sheetCoverageFormSchema>;
export const sheetCoverageInputSchema = sheetCoverageFormSchema.omit({ calculated: true });
export const createEmptySheetCoverage = (): SheetCoverageForm => ({ developedWidthM: "", developedRunM: "", effectiveCoverM: "", orderLengthM: "", endLapM: "", measurementReference: "", supplierReference: "", calculated: false });
const SCALE = 1_000_000_000n;
function length(raw: string, label: string, zero = false): bigint {
  const value = raw.trim();
  if (!/^(?:\d+(?:\.\d{0,9})?|\.\d{1,9})$/.test(value)) throw Error(`${label}: enter an explicit decimal in metres (up to nine decimal places).`);
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole || "0") * SCALE + BigInt(fraction.padEnd(9, "0"));
  if (units < (zero ? 0n : 1n) || units > 10_000n * SCALE) throw Error(`${label}: enter ${zero ? "zero or a positive length" : "a positive length"} no greater than 10,000 m.`);
  return units;
}
const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;
const metres = (n: bigint) => Number(n) / Number(SCALE);
/** Exact decimal ceiling: tiny genuine remainders require another sheet; binary rounding never adds one. */
export function calculateSheetCoverage(raw: unknown) {
  const { calculated: _calculated, ...input } = sheetCoverageFormSchema.partial({ calculated: true }).parse(raw);
  if (!input.measurementReference.trim() || !input.supplierReference.trim()) throw Error("Enter both a measurement reference and a supplier / specification reference.");
  const width = length(input.developedWidthM, "Developed width");
  const run = length(input.developedRunM, "Developed run");
  const cover = length(input.effectiveCoverM, "Effective sheet cover");
  const order = length(input.orderLengthM, "Ordered sheet length");
  const lap = length(input.endLapM, "End lap", true);
  if (lap >= order) throw Error("End lap must be smaller than the ordered sheet length.");
  const columns = ceil(width, cover);
  const courses = run <= order ? 1n : 1n + ceil(run - order, order - lap);
  const sheets = columns * courses;
  if (sheets > 1_000_000n) throw Error("This draft worksheet supports at most 1,000,000 sheets; review the dimensions and units.");
  const coveredRun = order + (courses - 1n) * (order - lap);
  return { status: "draft-sheet-coverage" as const, columns: Number(columns), courses: Number(courses), sheets: Number(sheets),
    inputs: { ...input },
    calculation: {
      columns: `ceil(${input.developedWidthM.trim()} / ${input.effectiveCoverM.trim()}) = ${columns}`,
      coursesFormula: "run <= ordered length ? 1 : 1 + ceil((run - ordered length) / (ordered length - end lap))",
      courses: run <= order ? `${input.developedRunM.trim()} <= ${input.orderLengthM.trim()}: 1 course`
        : `1 + ceil((${input.developedRunM.trim()} - ${input.orderLengthM.trim()}) / (${input.orderLengthM.trim()} - ${input.endLapM.trim()})) = ${courses}`,
      sheets: `${columns} columns × ${courses} courses = ${sheets} sheets`,
      orderedLength: `${sheets} sheets × ${input.orderLengthM.trim()} m = ${metres(sheets * order)} m`,
      endLapPolicy: "The first course covers a full ordered sheet length. Each additional course adds ordered length minus end lap.",
    },
    orderedLinearM: metres(sheets * order), coveredWidthM: metres(columns * cover), coveredRunM: metres(coveredRun),
    excessWidthM: metres(columns * cover - width), excessRunM: metres(coveredRun - run),
    measurementReference: input.measurementReference, supplierReference: input.supplierReference,
    verifiedQuoteEligible: false as const,
    limitations: ["End laps between courses are included. Effective sheet cover already includes side lap; side lap is not deducted twice.",
      "One rectangular developed surface with identical ordered sheet lengths; no opening deductions, hips, valleys, cutting or reusable offcut schedule.",
      "No fixings, flashings, product suitability or compliance calculation. References are retained but not validated; draft and not eligible for verified quotes."],
  };
}
