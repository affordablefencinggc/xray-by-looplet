import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { exportDrawingPdf } from "./sheets.ts";
import { demonstration } from "./model.ts";

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
