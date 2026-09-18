import { z } from "zod";
import type { IssueSetReview } from "./issueSet.ts";

/**
 * The drawing register — the transmittal sheet an issue leads with (SC-02).
 *
 * An issue is a set of drawings at a revision, and the register is the page that says which ones, on what
 * paper, and at what scale. It is a module rather than a block of PDF code because three readers need the
 * same rows: the batch PDF's register page, the issue history in the studio, and any export that has to
 * name the sheets it carried. Two registers that could disagree would be worse than none, so `issueSet.ts`
 * builds its register through here.
 *
 * The one thing this adds over the row it replaces is the scale as it is actually printed. "1:100" is a
 * ratio; "1:100 @ A3" is an instruction a person can act on, because the same ratio on A1 is a different
 * drawing of the same building — the bar is the same length on paper, the sheet it sits on is twice the
 * size, and a reader who is told only the ratio cannot tell which sheet they are holding.
 */

export const SHEET_SIZES = ["A1", "A3"] as const;
export const SHEET_SCALES = ["50", "100", "200"] as const;
export type SheetSize = (typeof SHEET_SIZES)[number];
export type SheetScale = (typeof SHEET_SCALES)[number];

/** How a sheet's scale is written on the register: the ratio, qualified by the paper it is drawn on. */
export function paperScaleLabel(scale: string, size: string): string {
  if (!(SHEET_SCALES as readonly string[]).includes(scale)) {
    throw Error(`A drawing register records one of the sheet set's scales (${SHEET_SCALES.join(", ")}), not "${scale}".`);
  }
  if (!(SHEET_SIZES as readonly string[]).includes(size)) {
    throw Error(`A drawing register records one of the sheet sizes (${SHEET_SIZES.join(", ")}), not "${size}".`);
  }
  return `1:${scale} @ ${size}`;
}

/**
 * The length in millimetres of a scale bar standing for `metres` at `scale`. A ratio is dimensionless, so
 * this is the same number on every paper size — which is exactly why the label has to carry the paper.
 */
export function scaleBarMm(scale: string | number, metres = 5): number {
  const ratio = Number(scale);
  if (!Number.isFinite(ratio) || ratio <= 0) throw Error(`A scale bar needs a positive scale, not "${scale}".`);
  return (metres * 1000) / ratio;
}

export const drawingRegisterRowSchema = z
  .object({
    position: z.number().int().positive(),
    sheetId: z.string().min(1).max(100),
    number: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    size: z.enum(SHEET_SIZES),
    scale: z.enum(SHEET_SCALES),
    /** `1:100 @ A3` — the ratio and the paper, as the register prints them. */
    scaleLabel: z.string().min(1).max(20),
    viewports: z.number().int().nonnegative(),
  })
  .strict();
export type DrawingRegisterRow = z.infer<typeof drawingRegisterRowSchema>;

/** One bar per distinct scale in the issue, because a bar means nothing without the ratio beside it. */
export const registerScaleSchema = z
  .object({
    scale: z.enum(SHEET_SCALES),
    label: z.string().min(1).max(20),
    sheets: z.number().int().positive(),
    barMm: z.number().finite().positive(),
  })
  .strict();
export type RegisterScale = z.infer<typeof registerScaleSchema>;

export const drawingRegisterSchema = z
  .object({
    project: z.string().min(1).max(200),
    purpose: z.string().min(1).max(80),
    designRevision: z.string().min(1).max(40),
    modelRevision: z.number().int().positive(),
    issuedAt: z.string().datetime({ offset: true }),
    sheetCount: z.number().int().positive(),
    sheets: z.array(drawingRegisterRowSchema).min(1),
    /** Each distinct paper-scale in the issue, in the order the sheets first use it. */
    scales: z.array(registerScaleSchema).min(1),
  })
  .strict();
export type DrawingRegister = z.infer<typeof drawingRegisterSchema>;

export function drawingRegister(review: IssueSetReview, issuedAt: Date): DrawingRegister {
  const sheets: DrawingRegisterRow[] = review.sheets.map((sheet, index) => ({
    position: index + 1,
    sheetId: sheet.sheetId,
    number: sheet.number,
    name: sheet.name,
    size: sheet.size,
    scale: sheet.scale as SheetScale,
    scaleLabel: paperScaleLabel(String(sheet.scale), sheet.size),
    viewports: sheet.viewports,
  }));

  /* Grouped by the printed label rather than by the ratio: the same ratio on A1 and on A3 is two different
     drawings of the same building, and a register that merged them would tell a reader to expect one paper
     size where the issue carries two. */
  const scales: RegisterScale[] = [];
  for (const row of sheets) {
    const found = scales.find((entry) => entry.label === row.scaleLabel);
    if (found) found.sheets += 1;
    else scales.push({ scale: row.scale, label: row.scaleLabel, sheets: 1, barMm: scaleBarMm(row.scale) });
  }

  return drawingRegisterSchema.parse({
    project: review.projectName,
    purpose: review.purpose,
    designRevision: review.designRevision,
    modelRevision: review.modelRevision,
    issuedAt: issuedAt.toISOString(),
    sheetCount: sheets.length,
    sheets,
    scales,
  });
}
