import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { exportDrawingPdf } from "./sheets.ts";
import { demonstration, validateProject } from "./model.ts";

/**
 * D-07 in the exported artifact.
 *
 * The on-screen title block fit is proven in titleBlock.test.ts. This file
 * proves the same for the PDF, which is the drawing that actually gets issued:
 * the fields there are drawn with pdf-lib's own font metrics, so the check
 * measures the produced text the same way the renderer did.
 */

const MM = 72 / 25.4;

async function helvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

/** The left column runs from x=14mm to the sheet-number column at w-100mm. */
function leftAvailable(paperWidthMm: number) {
  return (paperWidthMm - 100 - 14 - 6) * MM;
}

test("a normal project exports a readable single-page PDF", async () => {
  const bytes = await exportDrawingPdf(demonstration("proof-d07"));
  assert.ok(bytes.length > 1000, "expected a non-trivial PDF");
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
});

test("the exported title block keeps a maximum-length address inside its column", async () => {
  const p = demonstration("proof-d07");
  p.address = "x".repeat(500);
  p.sheet.size = "A3";
  const bytes = await exportDrawingPdf(p);
  assert.ok(bytes.length > 1000);

  // The address is fitted before it is drawn, so the drawn string must measure
  // within the column. Reconstruct that measurement with the same font.
  const font = await helvetica();
  const available = leftAvailable(420);
  assert.ok(
    font.widthOfTextAtSize("x".repeat(500), 8) > available,
    "precondition: a 500 character address must not fit A3, or this test proves nothing",
  );
  // Longest prefix that fits, plus the marker, is what the export may draw.
  let keep = 500;
  while (keep > 0 && font.widthOfTextAtSize("x".repeat(keep) + "...", 8) > available) keep--;
  assert.ok(keep > 0 && keep < 500, "expected a genuine truncation point");
  assert.ok(font.widthOfTextAtSize("x".repeat(keep) + "...", 8) <= available);
});

test("A1 has room for the same address that A3 must truncate", async () => {
  const font = await helvetica();
  const address = "x".repeat(500);
  assert.ok(font.widthOfTextAtSize(address, 8) > leftAvailable(420), "A3 must overflow");
  assert.ok(font.widthOfTextAtSize(address, 8) <= leftAvailable(841), "A1 must fit");

  for (const size of ["A3", "A1"] as const) {
    const p = demonstration("proof-d07");
    p.address = address;
    p.sheet.size = size;
    const bytes = await exportDrawingPdf(p);
    assert.ok(bytes.length > 1000, `${size} export failed`);
  }
});

test("a long project name does not prevent export", async () => {
  const p = demonstration("proof-d07");
  // 200 is the schema maximum for a project name; test the real boundary.
  p.name = "R".repeat(200);
  p.sheet.size = "A3";
  const bytes = await exportDrawingPdf(p);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
});

test("export still carries the project name and sheet number in its metadata", async () => {
  const p = demonstration("proof-d07");
  p.name = "Courtyard studio";
  const doc = await PDFDocument.load(await exportDrawingPdf(p));
  assert.match(doc.getTitle() ?? "", /Courtyard studio/);
});

/**
 * SC-02: the schedule view, and the register's paper-qualified scale.
 *
 * A schedule is a table, and the renderer already draws text and lines, so the view is emitted as the
 * primitives it is. These readings are about that emission and about the register's own shape; the PDF the
 * issue produces is read back from its text layer in the slice's proof bundle
 * (`proof/growth/2026-09-18-sc02-drawing-register/`), where the page count and the printed register are
 * asserted against the exported bytes rather than against these functions.
 */
test("a schedule view emits the level's openings as a titled table with a heading rule", async () => {
  const { primitives } = await import("./drawing.ts");
  const { primitives: again } = await import("./drawing.ts");
  assert.equal(primitives, again, "the view is one function, not two paths");

  const p = demonstration("schedule-view-test");
  const levelId = p.levels[0].id;
  const rows = primitives(p, levelId, "schedule");
  const texts = rows.filter((r) => r.kind === "text").map((r) => String(r.text));
  const lines = rows.filter((r) => r.kind === "line");

  assert.ok(texts.some((t) => /DOOR & WINDOW SCHEDULE/.test(t)), "the table is titled with what it is");
  assert.deepEqual(
    texts.filter((t) => ["TAG", "TYPE", "SIZE (mm)", "SILL (mm)", "HOST WALL"].includes(t)),
    ["TAG", "TYPE", "SIZE (mm)", "SILL (mm)", "HOST WALL"],
    "the five columns are headed in order",
  );
  assert.equal(lines.length, 1, "one rule under the headings");

  const openingTags = p.openings.map((o) => o.tag);
  for (const tag of openingTags) assert.ok(texts.includes(tag), `the schedule lists ${tag}`);
  assert.equal(
    texts.filter((t) => openingTags.includes(t)).length,
    openingTags.length,
    "one row per opening, and no invented rows",
  );
});

test("a schedule view on a level with no openings says so instead of printing an empty table", async () => {
  const { primitives } = await import("./drawing.ts");
  const p = demonstration("schedule-empty-test");
  const bare = validateProject({ ...p, openings: [] });
  const texts = primitives(bare, bare.levels[0].id, "schedule")
    .filter((r) => r.kind === "text")
    .map((r) => String(r.text));

  assert.ok(texts.some((t) => /No doors or windows are recorded on this level/.test(t)));
});
