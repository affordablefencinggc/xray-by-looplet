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
  const nextCourseRun = coveredRun + 1n; // Exact next representable run at nine decimal places.
  const runText = input.developedRunM.trim(), orderText = input.orderLengthM.trim(), lapText = input.endLapM.trim();
  return { status: "draft-sheet-coverage" as const, columns: Number(columns), courses: Number(courses), sheets: Number(sheets),
    inputs: { ...input },
    calculation: {
      columns: `ceil(${input.developedWidthM.trim()} / ${input.effectiveCoverM.trim()}) = ${columns}`,
      coursesFormula: "run <= ordered length ? 1 : 1 + ceil((run - ordered length) / (ordered length - end lap))",
      courses: run <= order ? `${runText} <= ${orderText}: 1 course`
        : `1 + ceil((${runText} - ${orderText}) / (${orderText} - ${lapText})) = ${courses}`,
      coursesExpanded: run <= order
        ? `The run ${runText} m fits inside one full ordered sheet of ${orderText} m, so 1 course is used and no end lap is applied.`
        : `Course 1 covers a full ordered sheet length of ${orderText} m. The remaining ${metres(run - order)} m is covered by further courses that each add ${orderText} - ${lapText} = ${metres(order - lap)} m, so ceil(${metres(run - order)} / ${metres(order - lap)}) = ${courses - 1n} more course(s), giving ${courses} courses in total.`,
      /** The reviewer must read these bounds, never extrapolate them from the single evaluated case. */
      courseBoundary: `${courses} course(s) cover any run greater than ${courses === 1n ? 0 : metres(coveredRun - (order - lap))} m and up to and including exactly ${metres(coveredRun)} m. A run of ${metres(nextCourseRun)} m or more needs ${courses + 1n} courses.`,
      maxRunAtThisCourseCountM: metres(coveredRun),
      minRunForAnotherCourseM: metres(nextCourseRun),
      /** Only claim a difference when one exists; a "3 instead of 3" warning would itself mislead. */
      wrongFormulaWarning: ceil(run, order - lap) === courses
        ? `Do NOT compute courses as ceil(run / (ordered length - end lap)). It happens to give the correct ${courses} for this particular input, but it is still the wrong rule and gives a different answer for other runs, because the first course is not shortened by an end lap.`
        : `Do NOT compute courses as ceil(run / (ordered length - end lap)); for this input that would give ${ceil(run, order - lap)} instead of the correct ${courses}, because the first course is not shortened by an end lap.`,
      sheets: `${columns} columns × ${courses} courses = ${sheets} sheets`,
      orderedLength: `${sheets} sheets × ${orderText} m = ${metres(sheets * order)} m`,
      endLapPolicy: "The first course covers a full ordered sheet length. Each additional course adds ordered length minus end lap.",
      excessRun: `${metres(coveredRun)} m covered run - ${runText} m requested run = ${metres(coveredRun - run)} m excess run. This is geometric over-coverage along the run, not a per-sheet waste or cutting quantity.`,
    },
    cuttingSchedule: { status: "not-calculated" as const, perSheetWasteM: null, reusableOffcuts: null,
      reason: "No cutting layout, trimming or offcut reuse is supplied. Do not infer per-sheet waste, scrap, usable cut length or reusable offcuts from coverage excess, in either the answer or Developer review." },
    orderedLinearM: metres(sheets * order), coveredWidthM: metres(columns * cover), coveredRunM: metres(coveredRun),
    excessWidthM: metres(columns * cover - width), excessRunM: metres(coveredRun - run),
    measurementReference: input.measurementReference, supplierReference: input.supplierReference,
    verifiedQuoteEligible: false as const,
    limitations: ["End lap (the lengthwise lap between courses, also called a transverse lap) IS included in this calculation: every course after the first is shortened by the supplied end lap. Do not describe end laps or transverse laps as excluded.",
      "Side lap (the lap between adjacent sheets across the width) is NOT calculated here: it is already contained in the supplied effective sheet cover, so it is neither added nor deducted again. Side lap and end lap are separate laps and must be explained separately.",
      "One rectangular developed surface with identical ordered sheet lengths; no opening deductions, hips, valleys, cutting or reusable offcut schedule.",
      "No fixings, flashings, product suitability or compliance calculation. References are retained but not validated; draft and not eligible for verified quotes."],
  };
}
