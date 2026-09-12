import { validateProject, type ArchitectProject } from "./model.ts";
import type { IssueRecord } from "./issueHistory.ts";
import { extractProjectModel } from "./revisionDelta.ts";
import { sha256Hex } from "./designedScene.ts";

/** Historical rendering never borrows geometry or metadata from the live project. */
export function issuedDrawing(issue: IssueRecord, sheetId: string): ArchitectProject {
  const sheet = issue.sheets.find(sheet => sheet.sheetId === sheetId);
  if (!sheet) throw Error("Historical drawing unavailable: this sheet is not in the selected issue.");
  if (!issue.snapshot?.section || issue.projectAddress === undefined) {
    throw Error("Historical drawing unavailable: this older issue does not contain a complete drawing snapshot. Its saved layout and register remain available; the live design cannot reconstruct the issued drawing.");
  }
  if (sha256Hex(JSON.stringify(sheet.layout)) !== sheet.layoutHash) {
    throw Error("Historical drawing unavailable: the saved layout does not match its recorded hash.");
  }
  return validateProject({ ...extractProjectModel(issue), sheet: structuredClone(sheet.layout) });
}
