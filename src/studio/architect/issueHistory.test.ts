import { test } from "node:test";
import assert from "node:assert/strict";
import { demonstration, validateProject, type ArchitectProject } from "./model.ts";
import { changeAuthoredSheets, reviewAuthoredSheetArchive } from "./authoredSheetSet.ts";
import { reviewIssueSet } from "./issueSet.ts";
import {
  recordDrawingIssue,
  issueHistory,
  retrieveIssue,
  retrieveIssuedSheet,
} from "./issueHistory.ts";

const ISSUED_A = new Date("2026-09-12T01:00:00.000Z");
const ISSUED_B = new Date("2026-09-12T02:00:00.000Z");
const ISSUED_C = new Date("2026-09-12T03:00:00.000Z");

function setupProject(): ArchitectProject {
  let p = demonstration("d09-supersession");
  // Add two extra authored sheets
  p = changeAuthoredSheets(p, { type: "add" });
  p = changeAuthoredSheets(p, { type: "add" });
  p.designRevision = "A";
  return validateProject(p);
}

test("recordDrawingIssue creates an initial current issue record with frozen layouts", () => {
  const p = setupProject();
  const sheets = p.sheetSet!.sheets.map((s) => s.id);
  const review = reviewIssueSet(p, sheets, "For tender");

  const recorded = recordDrawingIssue(p, review, ISSUED_A, () => "issue-rev-a");
  assert.equal(validateProject(recorded).issues?.length, 1);

  const history = issueHistory(recorded);
  assert.equal(history.length, 1);
  const issueA = history[0];

  assert.equal(issueA.id, "issue-rev-a");
  assert.equal(issueA.purpose, "For tender");
  assert.equal(issueA.designRevision, "A");
  assert.equal(issueA.modelRevision, p.revision);
  assert.equal(issueA.status, "current");
  assert.equal(issueA.supersededAt, undefined);
  assert.equal(issueA.supersededById, undefined);
  assert.equal(issueA.sheets.length, 3);

  // Each sheet has a layout clone, a hash, and current status
  for (const sheet of issueA.sheets) {
    assert.equal(sheet.status, "current");
    assert.ok(sheet.layoutHash.length === 64);
    assert.equal(typeof sheet.layout.size, "string");
    assert.ok(sheet.viewports >= 1);
    assert.ok(Array.isArray(sheet.layout.viewports));
  }
});

test("stale review is refused when recording an issue", () => {
  const p = setupProject();
  const sheets = p.sheetSet!.sheets.map((s) => s.id);
  const review = reviewIssueSet(p, sheets, "For tender");

  // Modify the project after review
  const modified = structuredClone(p);
  modified.name = "Modified Project Name";

  assert.throws(
    () => recordDrawingIssue(modified, review, ISSUED_A),
    /The design changed after this issue was reviewed/,
  );
});

test("recording a subsequent issue (Rev B) supersedes the prior issue and overlapping sheets", () => {
  const p = setupProject();
  const allSheets = p.sheetSet!.sheets.map((s) => s.id);

  // Issue Rev A
  const reviewA = reviewIssueSet(p, allSheets, "For tender");
  const projectA = recordDrawingIssue(p, reviewA, ISSUED_A, () => "issue-rev-a");

  // Update design revision to Rev B and issue again
  const projectBReady = structuredClone(projectA);
  projectBReady.designRevision = "B";
  projectBReady.revision = projectA.revision + 1;

  const reviewB = reviewIssueSet(projectBReady, allSheets, "For construction");
  const projectB = recordDrawingIssue(projectBReady, reviewB, ISSUED_B, () => "issue-rev-b");

  const validated = validateProject(projectB);
  const history = issueHistory(validated);
  assert.equal(history.length, 2);

  // Check Rev A is now superseded
  const issueA = history[0];
  assert.equal(issueA.id, "issue-rev-a");
  assert.equal(issueA.status, "superseded");
  assert.equal(issueA.supersededAt, ISSUED_B.toISOString());
  assert.equal(issueA.supersededById, "issue-rev-b");
  assert.equal(issueA.supersededByRevision, "B");
  assert.ok(issueA.sheets.every((s) => s.status === "superseded"));
  assert.ok(issueA.sheets.every((s) => s.supersededByRevision === "B"));

  // Check Rev B is current
  const issueB = history[1];
  assert.equal(issueB.id, "issue-rev-b");
  assert.equal(issueB.status, "current");
  assert.equal(issueB.designRevision, "B");
  assert.equal(issueB.purpose, "For construction");
  assert.equal(issueB.supersededAt, undefined);
  assert.ok(issueB.sheets.every((s) => s.status === "current"));
});

test("deleted or modified active sheets remain intact and retrievable in past issue records", () => {
  const p = setupProject();
  const initialSheets = p.sheetSet!.sheets.map((s) => s.id);
  const sheetToArchiveId = initialSheets[1];

  // Issue Rev A containing the sheet
  const reviewA = reviewIssueSet(p, initialSheets, "For tender");
  const projectA = recordDrawingIssue(p, reviewA, ISSUED_A, () => "issue-rev-a");

  // Retrieve the sheet from the issue
  const retrievedBefore = retrieveIssuedSheet(projectA, "issue-rev-a", sheetToArchiveId);
  assert.ok(retrievedBefore);
  const savedNumber = retrievedBefore.number;
  const savedHash = retrievedBefore.layoutHash;

  // Now archive that sheet in the active design
  const archiveReview = reviewAuthoredSheetArchive(projectA, sheetToArchiveId);
  const projectAfterArchive = changeAuthoredSheets(projectA, {
    type: "archive",
    review: archiveReview,
  });
  // Active design now marks this sheet as archived
  assert.equal(projectAfterArchive.sheetSet!.sheets.find((s) => s.id === sheetToArchiveId)!.archived, true);

  // The historical issue record still retains it completely and unaltered
  const retrievedAfter = retrieveIssuedSheet(projectAfterArchive, "issue-rev-a", sheetToArchiveId);
  assert.ok(retrievedAfter);
  assert.equal(retrievedAfter.number, savedNumber);
  assert.equal(retrievedAfter.layoutHash, savedHash);
  assert.equal(retrievedAfter.layout.number, savedNumber);
});

test("three sequential issues maintain chronological supersession lineage", () => {
  let p = setupProject();
  const sheets = p.sheetSet!.sheets.map((s) => s.id);

  // Issue A
  p.designRevision = "A";
  p = recordDrawingIssue(p, reviewIssueSet(p, sheets, "Prelim"), ISSUED_A, () => "iss-1");

  // Issue B
  p.designRevision = "B";
  p.revision += 1;
  p = recordDrawingIssue(p, reviewIssueSet(p, sheets, "Tender"), ISSUED_B, () => "iss-2");

  // Issue C
  p.designRevision = "C";
  p.revision += 1;
  p = recordDrawingIssue(p, reviewIssueSet(p, sheets, "Construction"), ISSUED_C, () => "iss-3");

  const history = issueHistory(p);
  assert.equal(history.length, 3);

  // iss-1 superseded by B
  assert.equal(history[0].id, "iss-1");
  assert.equal(history[0].status, "superseded");
  assert.equal(history[0].supersededByRevision, "B");

  // iss-2 superseded by C
  assert.equal(history[1].id, "iss-2");
  assert.equal(history[1].status, "superseded");
  assert.equal(history[1].supersededByRevision, "C");

  // iss-3 current
  assert.equal(history[2].id, "iss-3");
  assert.equal(history[2].status, "current");
  assert.equal(history[2].designRevision, "C");
});

test("retrieveIssue returns undefined for nonexistent issue id", () => {
  const p = setupProject();
  assert.equal(retrieveIssue(p, "nonexistent"), undefined);
});

test("modifying active sheet viewports or names does not mutate frozen historical issue layouts", () => {
  let p = setupProject();
  const allSheets = p.sheetSet!.sheets.map((s) => s.id);
  const targetId = allSheets[0];

  p = recordDrawingIssue(p, reviewIssueSet(p, allSheets, "Initial"), ISSUED_A, () => "frozen-iss");

  const frozenBefore = retrieveIssuedSheet(p, "frozen-iss", targetId);
  assert.ok(frozenBefore);
  const frozenHash = frozenBefore.layoutHash;
  const originalScale = frozenBefore.layout.scale;

  // Mutate active sheet's scale
  p.sheet.scale = "200";
  p.sheetSet!.sheets[0].layout.scale = "200";

  // Re-retrieve from issue
  const frozenAfter = retrieveIssuedSheet(p, "frozen-iss", targetId);
  assert.ok(frozenAfter);
  assert.equal(frozenAfter.layout.scale, originalScale);
  assert.equal(frozenAfter.layoutHash, frozenHash);
  assert.notEqual(frozenAfter.layout.scale, "200");
});

test("validateProject rejects invalid or malformed issue records fail-closed", () => {
  const p = setupProject();
  const allSheets = p.sheetSet!.sheets.map((s) => s.id);
  const recorded = recordDrawingIssue(p, reviewIssueSet(p, allSheets, "Initial"), ISSUED_A);

  // Corrupt the issue record status
  const corruptedStatus = structuredClone(recorded);
  (corruptedStatus.issues![0] as Record<string, unknown>).status = "destroyed";
  assert.throws(() => validateProject(corruptedStatus));

  // Corrupt sheet paper size in historical issue
  const corruptedSheet = structuredClone(recorded);
  (corruptedSheet.issues![0].sheets[0].layout as Record<string, unknown>).size = "B5";
  assert.throws(() => validateProject(corruptedSheet));
});

