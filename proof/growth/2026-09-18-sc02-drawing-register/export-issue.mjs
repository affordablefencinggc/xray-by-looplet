/**
 * SC-02's executed proof: build an issue from a real design, export it, and read the bytes back.
 *
 * The PDF is produced by the shipping export path, not by a test double, and then read with the same PDF
 * reader the application uses for its own previews — so the readings below are the document's own text and
 * its own page count, not a restatement of the arguments that produced them.
 *
 * Run from the repo root: node --experimental-strip-types .temp/live-rig/export-sc02-issue.mjs
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { demonstration } from "../../src/studio/architect/model.ts";
import { changeAuthoredSheets, authoredSheets } from "../../src/studio/architect/authoredSheetSet.ts";
import { issuableSheets, reviewIssueSet } from "../../src/studio/architect/issueSet.ts";
import { exportIssueSetPdf } from "../../src/studio/architect/sheets.ts";

const OUT = "proof/growth/2026-09-18-sc02-drawing-register/issued-set.pdf";
const ISSUED_AT = new Date("2026-09-18T03:30:00.000Z");

let seed = 0;
const makeId = () => `id-${++seed}`;

/* Three sheets: the first as the demonstration leaves it, then two more, with the paper and the scale moved
   so the register has to say which drawing is on which paper rather than repeating one ratio three times. */
let p = demonstration("sc02-register-proof");
p = changeAuthoredSheets(p, { type: "add" }, makeId);
p = changeAuthoredSheets(p, { type: "add" }, makeId);
const set = authoredSheets(p);
const sheets = set.sheets.map((sheet, index) => ({
  ...sheet,
  name: ["Ground Floor Plan", "First Floor Plan", "Sections and schedules"][index] ?? sheet.name,
  layout: {
    ...sheet.layout,
    number: ["A-101", "A-102", "A-201"][index] ?? sheet.layout.number,
    size: index === 2 ? "A3" : "A1",
    scale: index === 2 ? "50" : "100",
    /* The third sheet carries the door and window schedule beside its sections, which is where a drawing
       set puts one: the table is a viewport like any other, so the batch PDF renders it through the same
       path and the ledger's "schedules in a single batch PDF" is the same claim as "the sheets are". */
    viewports:
      index === 2
        ? [
            { id: "vp-sections", view: "section", levelId: sheet.layout.viewports[0]?.levelId ?? "", x: 12, y: 150, width: 396, height: 130, scale: "100" },
            { id: "vp-schedule", view: "schedule", levelId: sheet.layout.viewports[0]?.levelId ?? "", x: 12, y: 12, width: 396, height: 128, scale: "50" },
          ]
        : sheet.layout.viewports,
  },
}));
p = { ...p, sheetSet: { ...set, sheets } };

const selected = issuableSheets(p).map((sheet) => sheet.id);
const review = reviewIssueSet(p, selected, "For construction");
const bytes = await exportIssueSetPdf(p, review, ISSUED_AT);
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(OUT, bytes);
console.log(`exported  ${OUT}`);
console.log(`  ${bytes.length} bytes, sha256 ${crypto.createHash("sha256").update(bytes).digest("hex")}`);
console.log(`  header ${new TextDecoder().decode(bytes.slice(0, 8))}`);

/* Read it back with the application's own PDF reader. */
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
console.log(`  pages ${doc.numPages} (expected ${review.sheets.length} sheets + 1 register)`);

const first = await (await doc.getPage(1)).getTextContent();
const registerText = first.items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
console.log(`\nregister page text:\n  ${registerText}`);
for (let n = 2; n <= doc.numPages; n++) {
  const text = (await (await doc.getPage(n)).getTextContent()).items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
  console.log(`page ${n}: ${text.slice(0, 600)}`);
}

const scheduleText = (await (await doc.getPage(doc.numPages)).getTextContent()).items.map((i) => i.str).join(" ").replace(/\s+/g, " ");

const reads = [
  ["the last sheet carries the door and window schedule, rendered in the same batch",
    /DOOR & WINDOW SCHEDULE/.test(scheduleText) && /TAG TYPE SIZE \(mm\) SILL \(mm\) HOST WALL/.test(scheduleText)],
  [`the schedule lists the project's own openings (${p.openings.map((o) => o.tag).join(", ")})`,
    p.openings.every((o) => scheduleText.includes(o.tag))],
  ["the register page is first and carries the sheets", /DRAWING ISSUE REGISTER/.test(registerText) && /A-101/.test(registerText)],
  ["every sheet's scale is qualified by its paper", /1:100 @ A1/.test(registerText) && /1:50 @ A3/.test(registerText)],
  ["the register draws one bar per printed scale, labelled with the ratio and the paper",
    (registerText.match(/0 to 5 m as drawn/g) ?? []).length === 2 && /1:100 @ A1 — 0 to 5 m as drawn \(2 sheets\)/.test(registerText)],
  ["the purpose and the revision are on the register", /For construction/.test(registerText) && new RegExp(review.designRevision).test(registerText)],
  [`the page count is the sheets plus the register (${review.sheets.length} + 1)`, doc.numPages === review.sheets.length + 1],
];
let bad = 0;
for (const [what, ok] of reads) { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"}  ${what}`); }
console.log(bad ? `\n${bad} reading(s) failed.` : "\nPASS — the register says what the issue contains, on what paper, at what scale.");
process.exit(bad ? 1 : 0);
