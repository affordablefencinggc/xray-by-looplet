# SC-02 — the drawing register, the paper-qualified scale, and the schedule sheet

Slice SC-02 of `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md`: *Multi-Sheet Drawing Register & Vector PDF Batch
Publisher*. Written 2026-09-18 on `feat/architect-cad-engine`.

## What was already there, and what was not

The ledger's file list names `drawingRegister.ts` and `drawingRegister.test.ts` as new, and describes the
rest as work on `authoredSheetSet.ts`, `alterationIssueExport.ts` and `ArchitectSheets.tsx`. An audit of the
tree before any of this was written found that **two of the gap claims were false**, and they are recorded
here because rebuilding working code is the most expensive error available:

- *"no unit test asserts the batch PDF's page count"* — false. `issueSet.test.ts` loads the real
  `exportIssueSetPdf` output and asserts `getPageCount() === 4` for three sheets plus the register, and 3
  for a two-sheet subset and for mixed paper sizes.
- *"NO scale bar and NO ratio text exists anywhere"* — the audit's grep missed the one that does:
  `sheets.ts` draws a real bar of `5000 / scale` mm on every sheet, labelled `0 … 5 m / 1:<scale>`, and
  `ArchitectSheets.tsx` draws the same bar on screen. What was genuinely absent was the **paper-qualified**
  idiom (`1:100 @ A3`) and a bar on the register page.

So this slice is three things, and only three:

- **`drawingRegister.ts` (new)** — the register as a module: one row per sheet, the scale as it is actually
  printed, and one entry per printed scale with the bar length that scale needs.
- **The register page** in `sheets.ts` prints `1:100 @ A3` rather than `1:100`, and draws one bar per printed
  scale beneath the table.
- **A `schedule` view** (`drawing.ts`, `authoredSheetSet.ts`, `ArchitectSheets.tsx`), so the ledger's
  "Schedules in a single batch PDF" is a sheet a user can add rather than a claim nothing carried.

### Why the register is a module and not a block of PDF code

Three readers need the same rows: the batch PDF's register page, the issue history, and any export that
names the sheets it carried. `issueSet.issueRegister` now builds its register through `drawingRegister`, so
there is one definition of the register's shape and no way for two of them to disagree.

### Why the scale label carries the paper

`1:100` is a ratio; `1:100 @ A3` is an instruction. The same ratio on A1 is a different drawing of the same
building — the bar is the same length on paper, the sheet it sits on is twice the size — and a reader told
only the ratio cannot tell which sheet they are holding. `scaleBarMm` returns the same number for both, which
is exactly why the label has to carry the rest.

## DONE (machine)

| Criterion | Reading | Carrier |
| --- | --- | --- |
| Plans, sections, elevations and schedules render in a single batch PDF | the exported 4-page issue's last sheet carries `DOOR & WINDOW SCHEDULE — Ground` with the columns `TAG TYPE SIZE (mm) SILL (mm) HOST WALL` and a row per opening (`D01 DOOR 1800 × 2400 0 Brickwork`, `W01 WINDOW 2400 × 1400 1000 Brickwork`, `D02 DOOR 870 × 2100 0 Internal lining`) | `issued-set.pdf`, read back from its own text layer |
| Bounding-box text measurement across the title block | pre-existing (`fitTextMeasured`, `titleBlock.ts`), tested in `titleBlock.test.ts` and `sheetExport.test.ts` — not rebuilt | — |
| Scale bars and ratio text (`1:100 @ A3`) scale with the page | the register prints `1:100 @ A1` and `1:50 @ A3` per row, and `1:100 @ A1 — 0 to 5 m as drawn (2 sheets)` / `1:50 @ A3 — 0 to 5 m as drawn (1 sheet)` beneath it; `scaleBarMm` is 50 mm at 1:100 and 100 mm at 1:50 on any paper | `drawingRegister.test.ts`, `issued-set.pdf` |
| Unit tests verify buffer, non-zero size and page count | **1733 tests pass, 0 fail**; `tsc --noEmit` exit 0; the changed files lint with 0 errors | `npm-test.out.txt`, `tsc.out.txt`, `eslint.out.txt` |

The readings above are the document's own, not the arguments that produced it: `export-issue.mjs` builds the
design, reviews the issue, exports it through the shipping path, and then reads the bytes back with the same
PDF reader the application uses for its own previews.

```
ok    the last sheet carries the door and window schedule, rendered in the same batch
ok    the schedule lists the project's own openings (D01, W01, D02)
ok    the register page is first and carries the sheets
ok    every sheet's scale is qualified by its paper
ok    the register draws one bar per printed scale, labelled with the ratio and the paper
ok    the purpose and the revision are on the register
ok    the page count is the sheets plus the register (3 + 1)
```

`npm-test.out.txt` (173,826 bytes) is the suite's stdout, unedited.

### ESLint

The files this slice changed lint with **0 errors** and 5 pre-existing warnings (unused imports and an
unnecessary `useMemo` dependency in files the slice touched but did not introduce). Recorded in
`eslint.out.txt` as it came out.

## DONE (human) — inspected

*"Inspected multi-page PDF output attached. All sheet titles, revision blocks, and client metadata align
cleanly. Zero console errors during batch generation."*

The exported `issued-set.pdf` was opened in the browser's own PDF viewer — no system rasteriser is installed,
so the viewer is the rasteriser — and captured:

| Capture | What it shows |
| --- | --- |
| `pdf-register-page-1-1600x1000.png` | page 1 of 4, titled *Courtyard studio / demonstration / For construction*, showing the DRAWING ISSUE REGISTER: the three sheet rows with their sizes and printed scales, the heading block with purpose and revision, and the two scale bars beneath the table. The four page thumbnails run register, plan, plan, sections-and-schedule. |
| `pdf-register-1024x768.png` | the same page at the tablet viewport. |

**Read the captures for what they are.** The viewer fits the page to its window (41% in both), which is
enough to see that the register leads, that the set is four pages, and that the bar and the table are drawn
where the register page puts them — but not enough to read the smallest type. The register's *content* is
therefore read from the document's text layer above, which is the stronger evidence of the two; the capture
is the visual confirmation that it renders as a document in a real viewer.

No console errors were recorded during the export: the runner report for the turn that produced the PDF
(`proof/growth/runner/`) carries `exitCode 0` and `error null`.

## Not established here

- **A "Site Plan" sheet type does not exist.** The ledger's DONE (machine) lists *Site Plan, Floor Plans,
  Sections, Elevations, and Schedules*. The sheet set's views are `plan | north | south | east | west |
  section | schedule`; a site plan is a plan drawn at a smaller scale, which the sheet set already supports
  by its scale, and the ledger's list reads as sheet kinds rather than as a view enum. Adding a `site` view
  that renders the same plan under a different name would be a label, not a capability, so it was not added.
- **The schedule's footprint is laid out for a 1:50 viewport.** `primitives` is not told the viewport's
  scale, so the table is sized to land inside an A3 viewport at 1:50 (20 000 model units = 400 mm there).
  A viewport at a smaller scale prints the same table larger. A schedule that sized itself to its viewport
  would need `primitives` to receive it, which is a wider change than this slice.
