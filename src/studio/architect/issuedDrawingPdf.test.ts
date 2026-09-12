import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { demonstration } from "./model.ts";
import { authoredSheets } from "./authoredSheetSet.ts";
import { recordDrawingIssue } from "./issueHistory.ts";
import { reviewIssueSet } from "./issueSet.ts";
import { exportIssuedDrawingPdf } from "./issuedDrawingPdf.ts";

async function inspect(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes), page = doc.getPage(0);
  const contents = page.node.Contents()!;
  const streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
  const operators = streams.map(stream => Buffer.from(decodePDFRawStream(stream as PDFRawStream).decode()).toString()).join("\n");
  const text = [...operators.matchAll(/<([0-9a-f]+)>/gi)].map(match => Buffer.from(match[1], "hex").toString("latin1")).join("\n");
  return {doc,page,text,operators};
}

test("issued PDF preserves original geometry, metadata, dimensions and a recreated-file label", async () => {
  const p = demonstration("issued-pdf");p.name = "Issued project";p.address = "Original address";p.designRevision = "A";
  const id = authoredSheets(p).activeId;
  const ready = recordDrawingIssue(p, reviewIssueSet(p, [id], "Tender"), new Date("2026-09-12"), () => "issue-a");
  const baseline = await inspect((await exportIssuedDrawingPdf(ready.issues![0], id)).bytes);
  ready.name = "LIVE PROJECT";ready.address = "LIVE ADDRESS";ready.walls[0].b[0] += 4000;ready.roomTags[0].name = "LIVE ROOM";
  const result = await exportIssuedDrawingPdf(ready.issues![0], id), output = await inspect(result.bytes);
  assert.equal(output.doc.getPageCount(), 1);
  assert.ok(Math.abs(output.page.getWidth() - 420 * 72 / 25.4) < 1e-8);
  assert.ok(Math.abs(output.page.getHeight() - 297 * 72 / 25.4) < 1e-8);
  assert.equal(output.operators, baseline.operators);
  assert.match(output.text, /Issued project/);assert.match(output.text, /Original address/);
  assert.match(output.text, /HISTORICAL ISSUE/);assert.match(output.text, /Recreated from saved issue/);
  assert.doesNotMatch(output.text, /LIVE|SUPERSEDED/);
  assert.match(output.doc.getSubject()!, new RegExp(ready.issues![0].sheets[0].layoutHash));
  assert.match(result.filename, /rev-A-2026-09-12-issued\.pdf$/);
});

test("superseded PDF carries a watermark and replacement reference, including A1 paper", async () => {
  let p = demonstration("superseded-pdf");p.sheet.size = "A1";p.designRevision = "A";
  const id = authoredSheets(p).activeId;
  p = recordDrawingIssue(p, reviewIssueSet(p, [id], "Tender"), new Date("2026-09-12"), () => "issue-a");
  p.designRevision = "B";
  p = recordDrawingIssue(p, reviewIssueSet(p, [id], "Replacement"), new Date("2026-09-13"), () => "issue-b");
  const result = await exportIssuedDrawingPdf(p.issues![0], id), output = await inspect(result.bytes);
  assert.match(output.text, /SUPERSEDED/);
  assert.match(output.text, /Superseded by Rev B on 2026-09-13/);
  assert.ok(Math.abs(output.page.getWidth() - 841 * 72 / 25.4) < 1e-8);
  assert.ok(Math.abs(output.page.getHeight() - 594 * 72 / 25.4) < 1e-8);
  assert.match(result.filename, /superseded\.pdf$/);
  assert.match(output.doc.getTitle()!, /Rev A/);
});

test("incomplete or tampered issue records cannot be exported", async () => {
  const p = demonstration("bad-export"), id = authoredSheets(p).activeId;
  const issue = recordDrawingIssue(p, reviewIssueSet(p, [id], "Tender"), new Date("2026-09-12"), () => "issue-a").issues![0];
  const old = structuredClone(issue);delete old.snapshot;
  await assert.rejects(exportIssuedDrawingPdf(old, id), /complete drawing snapshot/);
  issue.sheets[0].layout.scale = "200";
  await assert.rejects(exportIssuedDrawingPdf(issue, id), /recorded hash/);
});
