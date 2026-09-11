import type { ArchitectProject } from "./model.ts";
import { authoredSheets, type AuthoredSheet } from "./authoredSheetSet.ts";

/**
 * D-13: batch printing and issue sets.
 *
 * Acceptance is "selected sheets export in reviewed order with an issue
 * register". This module owns the first two parts and the register itself, as
 * pure state: which sheets are in the issue, what order they print in, and what
 * the issue records about itself. Rendering is left to sheets.ts.
 *
 * The discipline mirrors the archive review in authoredSheetSet.ts: an issue is
 * prepared, reviewed against a snapshot of the design, and refused if the design
 * moved underneath it. A drawing issue that silently included a sheet the
 * reviewer never saw would be worse than no issue at all.
 */

export type IssueSheet = {
  sheetId: string;
  /** Sheet number as it will print, e.g. "A-101". */
  number: string;
  name: string;
  size: "A1" | "A3";
  scale: string;
  viewports: number;
};

export type IssueSetReview = {
  /** Sheets in the exact order they will print. */
  sheets: IssueSheet[];
  /** Serialised design the review was taken against, to detect later edits. */
  projectSnapshot: string;
  /** Free-text purpose, e.g. "For construction", "For tender". */
  purpose: string;
  designRevision: string;
  modelRevision: number;
  projectName: string;
};

export const ISSUE_PURPOSE_MAX = 80;
/** A single issue must stay reviewable; beyond this, split it. */
export const ISSUE_SHEET_MAX = 60;

/** Sheets eligible for an issue: active ones, in their managed order. */
export function issuableSheets(p: ArchitectProject): AuthoredSheet[] {
  return authoredSheets(p).sheets.filter((sheet) => !sheet.archived);
}

function describe(sheet: AuthoredSheet): IssueSheet {
  return {
    sheetId: sheet.id,
    number: sheet.layout.number,
    name: sheet.name,
    size: sheet.layout.size,
    scale: sheet.layout.scale,
    viewports: Math.max(1, sheet.layout.viewports.length),
  };
}

/**
 * Prepare an issue for review.
 *
 * `selection` is the sheet ids to include. Order follows the design's managed
 * sheet order rather than click order, so the printed set matches the register
 * the user already reads on screen; an explicit order can be supplied instead.
 */
export function reviewIssueSet(
  p: ArchitectProject,
  selection: string[],
  purpose: string,
  options: { explicitOrder?: boolean } = {},
): IssueSetReview {
  const available = issuableSheets(p);
  const byId = new Map(available.map((sheet) => [sheet.id, sheet]));

  if (selection.length === 0) throw Error("Select at least one drawing sheet to issue.");
  if (new Set(selection).size !== selection.length)
    throw Error("A drawing sheet cannot appear twice in one issue.");
  if (selection.length > ISSUE_SHEET_MAX)
    throw Error(`An issue holds at most ${ISSUE_SHEET_MAX} drawing sheets. Split this issue.`);

  for (const id of selection) {
    if (!byId.has(id))
      throw Error("A selected drawing sheet is archived or no longer exists. Review the selection.");
  }

  const trimmed = purpose.trim();
  if (!trimmed) throw Error("State the purpose of this issue, for example: For construction.");
  if (trimmed.length > ISSUE_PURPOSE_MAX)
    throw Error(`Keep the issue purpose within ${ISSUE_PURPOSE_MAX} characters.`);

  const ordered = options.explicitOrder
    ? selection.map((id) => byId.get(id)!)
    : available.filter((sheet) => selection.includes(sheet.id));

  return {
    sheets: ordered.map(describe),
    projectSnapshot: JSON.stringify(p),
    purpose: trimmed,
    designRevision: p.designRevision,
    modelRevision: p.revision,
    projectName: p.name,
  };
}

/**
 * Refuse a review that no longer matches the design.
 *
 * Called immediately before export. The same stale-review guard the sheet
 * archive uses: the reviewer approved a specific set of drawings, and an edit
 * since then may have changed what would print.
 */
export function assertIssueReviewCurrent(p: ArchitectProject, review: IssueSetReview): void {
  if (review.projectSnapshot !== JSON.stringify(p))
    throw Error("The design changed after this issue was reviewed. Review the issue again before exporting.");
  const live = new Set(issuableSheets(p).map((sheet) => sheet.id));
  for (const sheet of review.sheets) {
    if (!live.has(sheet.sheetId))
      throw Error(`Drawing sheet ${sheet.number} is no longer active. Review the issue again.`);
  }
}

/**
 * The issue register: one row per sheet, plus what identifies the issue.
 * This is the record that accompanies the drawings, and the thing D-13 requires
 * beyond simply concatenating pages.
 */
export function issueRegister(review: IssueSetReview, issuedAt: Date) {
  return {
    project: review.projectName,
    purpose: review.purpose,
    designRevision: review.designRevision,
    modelRevision: review.modelRevision,
    issuedAt: issuedAt.toISOString(),
    sheetCount: review.sheets.length,
    sheets: review.sheets.map((sheet, index) => ({
      position: index + 1,
      number: sheet.number,
      name: sheet.name,
      size: sheet.size,
      scale: `1:${sheet.scale}`,
      viewports: sheet.viewports,
    })),
  };
}

/** A stable file name for the issued package. */
export function issueFileName(review: IssueSetReview, issuedAt: Date): string {
  const stamp = issuedAt.toISOString().slice(0, 10);
  const safe = review.projectName.replace(/[^A-Za-z0-9 _-]+/g, "").trim().slice(0, 40) || "design";
  return `${safe} REV ${review.designRevision} ${stamp}.pdf`.replace(/\s+/g, " ");
}
