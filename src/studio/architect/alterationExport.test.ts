import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream } from "pdf-lib";
import { demonstration } from "./model.ts";
import { createAlterationBasis } from "./alterationStage.ts";
import { exportAlterationStagePdf } from "./alterationExport.ts";

function classified() {
  const p = demonstration("draft-export-source");
  for (const element of [...p.walls, ...p.openings, ...p.slabs, ...p.roofs]) {
    element.lifecycle = { status: "existing", reference: "Survey A" };
  }
  return p;
}
function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const entries = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return entries.map((entry) => {
    const stream = doc.context.lookup(entry);
    if (!(stream instanceof PDFRawStream)) throw Error("Expected an encoded PDF page stream.");
    return new TextDecoder().decode(decodePDFRawStream(stream).decode());
  }).join("\n");
}
function attachedReview(doc: PDFDocument) {
  const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
  const files = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
  const entries = files.lookup(PDFName.of("Names"), PDFArray);
  const file = doc.context.lookup(entries.get(1), PDFDict);
  const embedded = file.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"));
  if (!(embedded instanceof PDFRawStream)) throw Error("Expected an encoded PDF attachment stream.");
  return JSON.parse(new TextDecoder().decode(decodePDFRawStream(embedded).decode()));
}

test("draft export labels each drawing and preserves original project/revision/reference without source changes", async () => {
  const p = classified(), original = structuredClone(p);
  const basis = createAlterationBasis(p, "Survey A, reviewed unchanged retained geometry");
  const bytes = await exportAlterationStagePdf(p, basis, "before", { levelId: p.levels[0].id, view: "plan" });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  assert.ok(doc.getSubject()?.includes(basis.reference));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const drawing = pageContent(doc, 1);
  assert.ok(drawing.includes(font.encodeText("BEFORE ALTERATION / DRAFT / NOT ISSUED / NOT FOR CONSTRUCTION / original model revision 1").toString()));
  assert.ok(drawing.includes(font.encodeText("Project identity: " + p.id).toString()));
  const attached = attachedReview(doc);
  assert.equal(attached.projectId, p.id);
  assert.equal(attached.projectRevision, p.revision);
  assert.equal(attached.basisReference, basis.reference);
  assert.equal(attached.stage, "before");
  assert.equal(attached.draftOnly, true); assert.equal(attached.issued, false); assert.equal(attached.quoteEligible, false);
  assert.equal(attached.sharedAnnotationsReviewed, false);
  assert.deepEqual(p, original);
});

test("maximum-length Unicode reference and drawing labels export with lossless attached originals", async () => {
  const p = classified();
  p.name = "住宅 🏠"; p.address = "住所"; p.designRevision = "修訂 A";
  p.levels[0].name = "地面"; p.roomTags[0].name = "居間 🪑";
  p.slabs[0].name = "床版";
  const reference = "漢".repeat(490) + "\\u{1234}尾字";
  assert.equal(reference.length, 500);
  const basis = createAlterationBasis(p, reference);
  const bytes = await exportAlterationStagePdf(p, basis, "proposed", { levelId: p.levels[0].id, view: "plan" });
  const doc = await PDFDocument.load(bytes), attached = attachedReview(doc);
  assert.equal(attached.basisReference, reference);
  assert.equal(attached.projectName, p.name);
  assert.equal(attached.levelName, p.levels[0].name);
  assert.ok(doc.getSubject()?.endsWith(reference));
  assert.ok(attached.displayLabels.some((label: {original:string;display:string}) => label.original === p.roomTags[0].name && label.display.includes("\\u{")));
  assert.ok(doc.getPageCount() >= 2);
});

test("stale/unresolved basis and invalid selected view or level reject before returning PDF data", async () => {
  const p = classified(), basis = createAlterationBasis(p, "Review A");
  const selection = { levelId: p.levels[0].id, view: "plan" as const };
  await assert.rejects(exportAlterationStagePdf(p, null, "before", selection), /basis/);
  await assert.rejects(exportAlterationStagePdf(p, basis, "before", { ...selection, levelId: "absent" }), /existing level/);
  await assert.rejects(exportAlterationStagePdf(p, basis, "before", { ...selection, view: "invalid" as "plan" }), /supported drawing view/);
  p.walls[0].height += 1;
  await assert.rejects(exportAlterationStagePdf(p, basis, "before", selection), /stale/);
  delete p.walls[0].lifecycle;
  await assert.rejects(exportAlterationStagePdf(p, createAlterationBasis(p, "Review B"), "proposed", selection), /Unassigned/);
});

test("selected level/view are bound to draft metadata and distinct review identity", async () => {
  const p = classified(), basis = createAlterationBasis(p, "Review A");
  const plan = attachedReview(await PDFDocument.load(await exportAlterationStagePdf(p, basis, "before", { levelId: p.levels[0].id, view: "plan" })));
  const section = attachedReview(await PDFDocument.load(await exportAlterationStagePdf(p, basis, "proposed", { levelId: p.levels[0].id, view: "section" })));
  assert.equal(plan.levelId, p.levels[0].id); assert.equal(plan.view, "plan");
  assert.equal(section.stage, "proposed"); assert.equal(section.view, "section");
  assert.notEqual(plan.reviewId, section.reviewId);
});

test("async export snapshots caller-owned options and basis before yielding", async () => {
  const p = classified(), basis = createAlterationBasis(p, "Original review A");
  const options = { levelId: p.levels[0].id, view: "plan" as "plan" | "section" };
  const pending = exportAlterationStagePdf(p, basis, "before", options);
  options.view = "section"; options.levelId = "different-level";
  basis.reference = "Changed after click"; basis.fingerprint = "stale";
  const attached = attachedReview(await PDFDocument.load(await pending));
  assert.equal(attached.view, "plan"); assert.equal(attached.levelId, p.levels[0].id);
  assert.equal(attached.basisReference, "Original review A");
});
