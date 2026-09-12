import { test } from "node:test";
import assert from "node:assert/strict";
import { demonstration, validateProject } from "./model.ts";
import { authoredSheets, changeAuthoredSheets } from "./authoredSheetSet.ts";
import { recordDrawingIssue } from "./issueHistory.ts";
import { reviewIssueSet } from "./issueSet.ts";
import { issuedDrawing } from "./issuedDrawing.ts";
import { viewportBox, sheetViewports } from "./sheets.ts";
import { titleBlockFields } from "./titleBlock.ts";

test("issued drawing survives live geometry, annotation, section and title changes and JSON persistence", () => {
  const p = demonstration("frozen-render");
  p.address = "Issued address";
  p.designRevision = "A";
  const id = authoredSheets(p).activeId;
  const recorded = recordDrawingIssue(p, reviewIssueSet(p, [id], "Tender"), new Date("2026-09-12"), () => "a");
  const original = issuedDrawing(recorded.issues![0], id);
  const originalVectors = sheetViewports(original).map(v => viewportBox(original, v));
  const originalTitle = titleBlockFields(original, original.sheet, 420);
  recorded.name = "Changed live project";
  recorded.address = "New address";
  recorded.designRevision = "B";
  recorded.revision += 1;
  recorded.walls[0].b[0] += 5000;
  recorded.roomTags[0].name = "Changed room";
  recorded.section.a = [4000, 4000];
  recorded.sheet.northAngle = 85;
  recorded.sheet.scale = "200";
  const restored = validateProject(JSON.parse(JSON.stringify(recorded)));
  const historic = issuedDrawing(restored.issues![0], id);
  assert.deepEqual(sheetViewports(historic).map(v => viewportBox(historic, v)), originalVectors);
  assert.deepEqual(titleBlockFields(historic, historic.sheet, 420), originalTitle);
  assert.deepEqual(historic.section, p.section);
  assert.equal(historic.sheet.northAngle, p.sheet.northAngle);
  historic.walls[0].b[0] += 10;
  assert.notDeepEqual(historic.walls, restored.issues![0].snapshot!.walls);
});

test("historical rendering refuses incomplete and altered records without substituting the live model", () => {
  const p = demonstration("unavailable");
  const id = authoredSheets(p).activeId;
  const issue = recordDrawingIssue(p, reviewIssueSet(p, [id], "Tender"), new Date("2026-09-12"), () => "a").issues![0];
  for (const field of ["snapshot", "projectAddress"] as const) {
    const old = structuredClone(issue); delete old[field];
    assert.throws(() => issuedDrawing(old, id), /complete drawing snapshot/);
  }
  const old = structuredClone(issue); delete old.snapshot!.section;
  assert.throws(() => issuedDrawing(old, id), /complete drawing snapshot/);
  const corrupt = structuredClone(issue); corrupt.sheets[0].layout.northAngle += 5;
  assert.throws(() => issuedDrawing(corrupt, id), /recorded hash/);
});

test("partial reissues only supersede their sheets and retain each successor through later releases", () => {
  let p = changeAuthoredSheets(demonstration("partial"), { type: "add" });
  const ids = authoredSheets(p).sheets.map(s => s.id);
  p.designRevision = "A";
  p = recordDrawingIssue(p, reviewIssueSet(p, ids, "Both sheets"), new Date("2026-09-12T00:00Z"), () => "a");
  const frozen = JSON.stringify(p.issues![0].snapshot);
  p.designRevision = "B";
  p = recordDrawingIssue(p, reviewIssueSet(p, [ids[0]], "First sheet"), new Date("2026-09-12T01:00Z"), () => "b");
  assert.equal(p.issues![0].status, "current");
  assert.equal(p.issues![0].supersededAt, undefined);
  assert.deepEqual(p.issues![0].sheets.map(s => s.status), ["superseded", "current"]);
  const firstSheet = structuredClone(p.issues![0].sheets[0]);
  assert.equal(firstSheet.supersededByIssueId, "b");
  p.designRevision = "C";
  p = recordDrawingIssue(p, reviewIssueSet(p, [ids[1]], "Second sheet"), new Date("2026-09-12T02:00Z"), () => "c");
  assert.deepEqual(p.issues![0].sheets[0], firstSheet);
  assert.equal(p.issues![0].sheets[1].supersededByIssueId, "c");
  assert.equal(p.issues![0].status, "superseded");
  assert.equal(p.issues![0].supersededById, "c");
  assert.equal(p.issues![1].status, "current");
  assert.equal(p.issues![1].sheets[0].status, "current");
  assert.equal(JSON.stringify(p.issues![0].snapshot), frozen);
  assert.equal(validateProject(p).issues!.length, 3);
  assert.throws(() => recordDrawingIssue(p, reviewIssueSet(p, [ids[1]], "Duplicate"), new Date(), () => "b"), /must be new/);
});
