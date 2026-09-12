import { z } from "zod";
import type { ArchitectProject } from "./model.ts";
import { authoredSheets, sheetLayoutSchema } from "./authoredSheetSet.ts";
import {
  type IssueSetReview,
  assertIssueReviewCurrent,
  ISSUE_PURPOSE_MAX,
  ISSUE_SHEET_MAX,
} from "./issueSet.ts";
import { sha256Hex } from "./designedScene.ts";

/**
 * D-09: Drawing revisions and supersession.
 *
 * Acceptance is "old revision remains retrievable and visibly superseded".
 *
 * When an issue set is exported (D-13), this module captures an immutable
 * issue record in the project (`project.issues`). When subsequent revisions are
 * released, prior issues and overlapping sheets are marked superseded with an
 * audit pointer to the superseding issue, while keeping historical layouts
 * retrievable and byte-identical.
 */

export const issuedSheetRecordSchema = z
  .object({
    sheetId: z.string().min(1),
    number: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    size: z.enum(["A1", "A3"]),
    scale: z.string().min(1).max(20),
    viewports: z.number().int().positive(),
    layoutHash: z.string().min(1),
    layout: sheetLayoutSchema,
    status: z.enum(["current", "superseded"]).default("current"),
    supersededAt: z.string().optional(),
    supersededByRevision: z.string().optional(),
  })
  .strict();

export type IssuedSheetRecord = z.infer<typeof issuedSheetRecordSchema>;

export const issueRecordSchema = z
  .object({
    id: z.string().min(1),
    issuedAt: z.string().min(1),
    purpose: z.string().min(1).max(ISSUE_PURPOSE_MAX),
    designRevision: z.string().min(1).max(40),
    modelRevision: z.number().int().positive(),
    projectName: z.string().min(1).max(200),
    status: z.enum(["current", "superseded"]).default("current"),
    supersededAt: z.string().optional(),
    supersededById: z.string().optional(),
    supersededByRevision: z.string().optional(),
    sheets: z.array(issuedSheetRecordSchema).min(1).max(ISSUE_SHEET_MAX),
  })
  .strict();

export type IssueRecord = z.infer<typeof issueRecordSchema>;

/**
 * All recorded drawing issues in chronological order.
 */
export function issueHistory(p: ArchitectProject): IssueRecord[] {
  return p.issues ? [...p.issues] : [];
}

/**
 * Retrieve a specific past issue record by ID.
 */
export function retrieveIssue(p: ArchitectProject, issueId: string): IssueRecord | undefined {
  return p.issues?.find((issue) => issue.id === issueId);
}

/**
 * Retrieve a specific frozen sheet record from an issue.
 */
export function retrieveIssuedSheet(
  p: ArchitectProject,
  issueId: string,
  sheetId: string,
): IssuedSheetRecord | undefined {
  const issue = retrieveIssue(p, issueId);
  return issue?.sheets.find((s) => s.sheetId === sheetId);
}

/**
 * Pure function: records a new drawing issue set and marks prior overlapping issues/sheets as superseded.
 *
 * Enforces:
 * 1. Stale-review guard via `assertIssueReviewCurrent`.
 * 2. Immutable frozen sheet layout snapshots and deterministic layout SHA-256 hashes.
 * 3. Supersession linking: prior issues are transitioned to `superseded` with a timestamp and pointer.
 * 4. Fail-closed validation before return.
 */
export function recordDrawingIssue(
  project: ArchitectProject,
  review: IssueSetReview,
  issuedAt: Date,
  makeId: () => string = () => crypto.randomUUID(),
): ArchitectProject {
  assertIssueReviewCurrent(project, review);

  const available = authoredSheets(project);
  const byId = new Map(available.sheets.map((s) => [s.id, s]));

  const issuedTimestamp = issuedAt.toISOString();
  const newIssueId = makeId();

  const newSheets: IssuedSheetRecord[] = review.sheets.map((entry) => {
    const authored = byId.get(entry.sheetId);
    if (!authored) {
      throw Error(`Drawing sheet ${entry.number} cannot be frozen: sheet not found in project.`);
    }
    const layoutClone = structuredClone(authored.layout);
    const layoutHash = sha256Hex(JSON.stringify(layoutClone));

    return {
      sheetId: entry.sheetId,
      number: entry.number,
      name: entry.name,
      size: entry.size,
      scale: entry.scale,
      viewports: entry.viewports,
      layoutHash,
      layout: layoutClone,
      status: "current",
    };
  });

  const newIssue: IssueRecord = {
    id: newIssueId,
    issuedAt: issuedTimestamp,
    purpose: review.purpose,
    designRevision: review.designRevision,
    modelRevision: review.modelRevision,
    projectName: review.projectName,
    status: "current",
    sheets: newSheets,
  };

  const currentIssues: IssueRecord[] = (project.issues ?? []).map((prior) => {
    // If prior issue was already superseded, preserve its historical supersession record
    if (prior.status === "superseded") {
      return structuredClone(prior);
    }

    // A prior active issue is now superseded by the newer issue release
    const updatedSheets = prior.sheets.map((s) => {
      const reissued = newSheets.some((ns) => ns.number === s.number || ns.sheetId === s.sheetId);
      if (reissued || s.status !== "superseded") {
        return {
          ...structuredClone(s),
          status: "superseded" as const,
          supersededAt: s.supersededAt ?? issuedTimestamp,
          supersededByRevision: s.supersededByRevision ?? review.designRevision,
        };
      }
      return structuredClone(s);
    });

    return {
      ...structuredClone(prior),
      status: "superseded" as const,
      supersededAt: prior.supersededAt ?? issuedTimestamp,
      supersededById: prior.supersededById ?? newIssueId,
      supersededByRevision: prior.supersededByRevision ?? review.designRevision,
      sheets: updatedSheets,
    };
  });

  const updatedProject = structuredClone(project);
  updatedProject.issues = [...currentIssues, newIssue];

  return updatedProject;
}
