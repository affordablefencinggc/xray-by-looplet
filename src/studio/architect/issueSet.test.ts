import { test } from "node:test";
import assert from "node:assert/strict";
import { demonstration } from "./model.ts";
import { changeAuthoredSheets, authoredSheets } from "./authoredSheetSet.ts";
import {
  issuableSheets,
  reviewIssueSet,
  assertIssueReviewCurrent,
  issueRegister,
  issueFileName,
  ISSUE_SHEET_MAX,
  ISSUE_PURPOSE_MAX,
} from "./issueSet.ts";

let seed = 0;
const makeId = () => `id-${++seed}`;

function withSheets(count: number) {
  let p = demonstration("issue-test");
  for (let i = 1; i < count; i++) p = changeAuthoredSheets(p, { type: "add" }, makeId);
  return p;
}

const ids = (p: ReturnType<typeof withSheets>) => issuableSheets(p).map((s) => s.id);

test("a single-sheet design can be issued", () => {
  const p = demonstration("issue-test");
  const review = reviewIssueSet(p, ids(p), "For construction");
  assert.equal(review.sheets.length, 1);
  assert.equal(review.purpose, "For construction");
  assert.equal(review.designRevision, p.designRevision);
});

test("sheets print in the design's managed order, not selection order", () => {
  const p = withSheets(4);
  const all = ids(p);
  // Select them backwards; the issue must still follow the register order.
  const review = reviewIssueSet(p, [...all].reverse(), "For tender");
  assert.deepEqual(
    review.sheets.map((s) => s.sheetId),
    all,
    "issue order must match the order the user reads on screen",
  );
});

test("an explicit order is honoured when the caller asks for it", () => {
  const p = withSheets(3);
  const all = ids(p);
  const wanted = [all[2], all[0], all[1]];
  const review = reviewIssueSet(p, wanted, "For review", { explicitOrder: true });
  assert.deepEqual(review.sheets.map((s) => s.sheetId), wanted);
});

test("a subset issues without dragging in the rest", () => {
  const p = withSheets(5);
  const all = ids(p);
  const review = reviewIssueSet(p, [all[0], all[3]], "For approval");
  assert.deepEqual(review.sheets.map((s) => s.sheetId), [all[0], all[3]]);
  assert.equal(review.sheets.length, 2);
});

test("an empty selection is refused", () => {
  const p = withSheets(2);
  assert.throws(() => reviewIssueSet(p, [], "For construction"), /at least one/i);
});

test("a duplicated sheet is refused rather than printed twice", () => {
  const p = withSheets(2);
  const all = ids(p);
  assert.throws(() => reviewIssueSet(p, [all[0], all[0]], "For construction"), /twice/i);
});

test("a purpose is required and bounded", () => {
  const p = withSheets(2);
  assert.throws(() => reviewIssueSet(p, ids(p), "   "), /purpose/i);
  assert.throws(
    () => reviewIssueSet(p, ids(p), "x".repeat(ISSUE_PURPOSE_MAX + 1)),
    new RegExp(String(ISSUE_PURPOSE_MAX)),
  );
  // Exactly at the limit is allowed.
  assert.ok(reviewIssueSet(p, ids(p), "x".repeat(ISSUE_PURPOSE_MAX)));
});

test("an archived sheet cannot be issued", () => {
  let p = withSheets(3);
  const all = ids(p);
  const set = authoredSheets(p);
  const target = set.sheets.find((s) => s.id === all[1])!;
  p = changeAuthoredSheets(p, {
    type: "archive",
    review: {
      sheetId: target.id,
      name: target.name,
      projectSnapshot: JSON.stringify(p),
      viewports: 1,
    },
  });
  assert.equal(issuableSheets(p).length, 2);
  assert.throws(() => reviewIssueSet(p, [all[1]], "For construction"), /archived|no longer exists/i);
});

test("an unknown sheet id is refused", () => {
  const p = withSheets(2);
  assert.throws(() => reviewIssueSet(p, ["not-a-sheet"], "For construction"), /archived|no longer exists/i);
});

test("a review is refused once the design changes underneath it", () => {
  const p = withSheets(2);
  const review = reviewIssueSet(p, ids(p), "For construction");
  assertIssueReviewCurrent(p, review); // unchanged: passes
  const edited = changeAuthoredSheets(p, { type: "add" }, makeId);
  assert.throws(() => assertIssueReviewCurrent(edited, review), /changed after this issue was reviewed/i);
});

test("a review is refused when one of its sheets was archived after review", () => {
  let p = withSheets(3);
  const review = reviewIssueSet(p, ids(p), "For construction");
  const set = authoredSheets(p);
  const target = set.sheets.find((s) => s.id === review.sheets[1].sheetId)!;
  p = changeAuthoredSheets(p, {
    type: "archive",
    review: { sheetId: target.id, name: target.name, projectSnapshot: JSON.stringify(p), viewports: 1 },
  });
  assert.throws(() => assertIssueReviewCurrent(p, review), /changed after this issue|no longer active/i);
});

test("the register records position, identity and the issue's own revision", () => {
  const p = withSheets(3);
  const review = reviewIssueSet(p, ids(p), "For construction");
  const at = new Date("2026-09-12T04:00:00.000Z");
  const register = issueRegister(review, at);
  assert.equal(register.sheetCount, 3);
  assert.equal(register.purpose, "For construction");
  assert.equal(register.designRevision, p.designRevision);
  assert.equal(register.modelRevision, p.revision);
  assert.equal(register.issuedAt, "2026-09-12T04:00:00.000Z");
  assert.deepEqual(
    register.sheets.map((s) => s.position),
    [1, 2, 3],
    "positions must be the printed order, starting at 1",
  );
  for (const row of register.sheets) {
    assert.ok(row.number, "every register row names its sheet");
    assert.match(row.scale, /^\d+$/, "the row carries the bare ratio");
    assert.match(row.scaleLabel, /^1:\d+ @ A[13]$/, "the register prints the scale qualified by its paper");
  }
});

test("too many sheets in one issue is refused", () => {
  const p = withSheets(2);
  const many = Array.from({ length: ISSUE_SHEET_MAX + 1 }, (_, i) => `sheet-${i}`);
  assert.throws(() => reviewIssueSet(p, many, "For construction"), new RegExp(String(ISSUE_SHEET_MAX)));
});

test("the file name carries the project, revision and date, and is filesystem safe", () => {
  const p = demonstration("issue-test");
  p.name = "Courtyard studio / stage 2: works";
  const review = reviewIssueSet(p, ids(p), "For construction");
  const name = issueFileName(review, new Date("2026-09-12T04:00:00.000Z"));
  assert.match(name, /^Courtyard studio stage 2 works REV A 2026-09-12\.pdf$/);
  assert.equal(/[\\/:*?"<>|]/.test(name), false, "must not contain path or reserved characters");
});

test("a project named only with punctuation still yields a usable file name", () => {
  const p = demonstration("issue-test");
  p.name = "///";
  const review = reviewIssueSet(p, ids(p), "For construction");
  assert.match(issueFileName(review, new Date("2026-09-12T04:00:00.000Z")), /^design REV A 2026-09-12\.pdf$/);
});

// --- Rendered issue set -----------------------------------------------------
// These exercise the real exportIssueSetPdf, so they prove the merged artifact
// rather than only the selection logic above.

const { exportIssueSetPdf } = await import("./sheets.ts");
const { PDFDocument } = await import("pdf-lib");
const ISSUED = new Date("2026-09-12T04:00:00.000Z");

test("an issue exports one page per sheet plus the register", async () => {
  const p = withSheets(3);
  const review = reviewIssueSet(p, ids(p), "For construction");
  const doc = await PDFDocument.load(await exportIssueSetPdf(p, review, ISSUED));
  assert.equal(doc.getPageCount(), 4, "3 drawings + 1 register page");
});

test("the register page is first", async () => {
  const p = withSheets(2);
  const review = reviewIssueSet(p, ids(p), "For tender");
  const doc = await PDFDocument.load(await exportIssueSetPdf(p, review, ISSUED));
  const [first] = doc.getPages();
  // A4 portrait register versus the A3/A1 landscape drawings.
  assert.ok(first.getHeight() > first.getWidth(), "register is portrait, drawings are landscape");
});

test("a subset issues only the sheets selected", async () => {
  const p = withSheets(4);
  const all = ids(p);
  const review = reviewIssueSet(p, [all[0], all[2]], "For approval");
  const doc = await PDFDocument.load(await exportIssueSetPdf(p, review, ISSUED));
  assert.equal(doc.getPageCount(), 3, "2 drawings + register");
});

test("exporting a stale review is refused rather than producing a wrong issue", async () => {
  const p = withSheets(2);
  const review = reviewIssueSet(p, ids(p), "For construction");
  const edited = changeAuthoredSheets(p, { type: "add" }, makeId);
  await assert.rejects(
    () => exportIssueSetPdf(edited, review, ISSUED),
    /changed after this issue was reviewed/i,
  );
});

test("the exported issue carries its purpose and revision in metadata", async () => {
  const p = withSheets(2);
  p.name = "Courtyard studio";
  const review = reviewIssueSet(p, ids(p), "For construction");
  const doc = await PDFDocument.load(await exportIssueSetPdf(p, review, ISSUED));
  assert.match(doc.getTitle() ?? "", /Courtyard studio/);
  assert.match(doc.getTitle() ?? "", /For construction/);
  assert.match(doc.getSubject() ?? "", /revision A/);
  assert.match(doc.getSubject() ?? "", /requires design review/i);
});

test("exporting does not mutate the stored design", async () => {
  const p = withSheets(3);
  const before = JSON.stringify(p);
  const review = reviewIssueSet(p, ids(p), "For construction");
  await exportIssueSetPdf(p, review, ISSUED);
  assert.equal(JSON.stringify(p), before, "the active sheet and design must be untouched");
});

test("sheets of mixed paper sizes issue together", async () => {
  let p = withSheets(2);
  const set = authoredSheets(p);
  // Make the second sheet A1 while the first stays A3.
  const clone = structuredClone(p);
  clone.sheetSet!.sheets[1].layout.size = "A1";
  clone.sheetSet!.activeId = clone.sheetSet!.sheets[0].id;
  clone.sheet = structuredClone(clone.sheetSet!.sheets[0].layout);
  p = clone;
  const review = reviewIssueSet(p, ids(p), "For construction");
  const doc = await PDFDocument.load(await exportIssueSetPdf(p, review, ISSUED));
  assert.equal(doc.getPageCount(), 3);
  const pages = doc.getPages();
  assert.notEqual(
    Math.round(pages[1].getWidth()),
    Math.round(pages[2].getWidth()),
    "each sheet keeps its own paper size",
  );
  assert.ok(set.sheets.length >= 2);
});
