# D-13 batch printing and issue sets — 2026-09-12

D-13's acceptance: **"Selected sheets export in reviewed order with an issue register."** Three parts, all now implemented and proven.

This was the top blocker in the industry-spec ranking, stopping five of six drafted profiles. The three preceding slices were its prerequisites: the title block had to fit on screen (2026-09-11), fit in the exported PDF (2026-09-11), and the workspace had to be visible enough to use (2026-09-12).

## What changed

- `src/studio/architect/issueSet.ts` (new) — the issue as pure state: which sheets, in what order, with what purpose, plus the register and a filesystem-safe file name. No rendering.
- `src/studio/architect/sheets.ts` — `exportIssueSetPdf` renders each selected sheet through the **existing single-sheet path** and merges the pages, then prepends the register. An issued drawing is therefore byte-for-byte the drawing the user saw.
- `src/studio/architect/ArchitectSheets.tsx` — selection list, purpose field, Review issue, and an explicit Export/Cancel step.
- `src/studio/architect/architect.css` — styles for the selection list.
- `src/studio/architect/issueSet.test.ts` (new) — 22 tests.

## Design decisions worth recording

**Order follows the design's managed sheet order, not click order.** A set selected bottom-up still prints in register order, so the issued PDF matches the list the user already reads on screen. An explicit order is available for a caller that wants it, and is tested.

**An issue is reviewed, then exported.** This mirrors the existing sheet-archive review: `reviewIssueSet` takes a snapshot, and `assertIssueReviewCurrent` refuses the export if the design moved. An issue assembled from a stale review could contain a sheet the reviewer never approved — worse than no issue at all. The guard runs both in the UI (button disabled, alert shown) and again inside the export function, so a programmatic caller cannot bypass it.

**The register leads the document** because it is the record of what the issue contains and at which revision.

## Machine proof

- 22/22 `issueSet.test.ts`; **73/73** across architect, title block, single-sheet export, authored sheet set and issue set.
- `node node_modules/typescript/bin/tsc --noEmit` → exit 0.
- A caught mistake worth keeping: the first rendering attempt swapped `sheet` without updating `sheetSet.activeId`, and `validateAuthoredSheets` refused it with "Active drawing sheet does not match its saved layout." The existing validator caught an inconsistency the new code would otherwise have shipped; both fields now move together.

## Proof from the exported bytes

`issue-set-4-sheets.pdf` is committed: a 4-sheet issue with one sheet deliberately set to A1 while the rest are A3. `verify-issue-pdf.mjs` reads it back (`issue-pdf-verification.log`):

```
pages          : 5
title          : Courtyard studio / For construction
subject        : Drawing issue, design revision A. Requires design review.
  page 1 (register) : 595 x 842 pt portrait
  page 2 (drawing) : 1191 x 842 pt landscape
  page 3 (drawing) : 1191 x 842 pt landscape
  page 4 (drawing) : 2384 x 1684 pt landscape
  page 5 (drawing) : 1191 x 842 pt landscape

  DRAWING ISSUE REGISTER
  Purpose: For construction
  Design revision A / model revision 1 / issued 2026-09-12T04:00:00.000Z
  4 drawing sheets in this issue
    1  A-101      A3    1:50         1  A-101
    2  S-002      A3    1:50         1  Drawing sheet 2
    3  S-003      A1    1:50         1  Drawing sheet 3
    4  S-004      A3    1:50         1  Drawing sheet 4
```

All three parts of the acceptance are visible there: **selected sheets** (4 of them), **in reviewed order** (register positions 1–4 matching the page order), **with an issue register** (page 1, listing every sheet, its size, scale and the issue's revision). Page 4 keeping A1 dimensions proves mixed paper sizes survive the merge.

Reproduce with `node proof/growth/2026-09-12-d13-issue-set/verify-issue-pdf.mjs`.

## Inspected browser proof

Desktop 1680x1050, against the running dev server (`cdp-issue-ui.log`, `cdp-stale-review-refused.log`):

- `screenshots/growth/2026-09-12-d13-issue-set/01-issue-selection.png` — the selection list with all sheets checked; the summary reads "Issue a drawing set (5 of 5 selected)".
- `02-issue-review.png` — the review panel: purpose, design revision A, model revision 5, and all five sheets listed in printed order with size, scale and viewport count, then Export issue PDF / Cancel issue.
- `03-stale-review-refused.png` — after adding a sheet while a review was open, the panel shows "The design changed after this review. Review the issue again before exporting." and the export button is **disabled**. Asserted, not just photographed:

```
{"alert":"The design changed after this review. Review the issue again before exporting.","exportDisabled":true}
```

## Boundary

- **D-13 is moved to partial, not verified.** The register's tick rule requires the complete stated behaviour, and what is proven here is development-server browser plus byte-level artifact checks. There is no built-browser or installed-app run, and no tablet capture at 1024x768.
- No download was performed in the browser proof: the CDP run drives selection, review and the stale-review refusal, while the produced bytes are verified separately through the committed PDF. The `saveDownload` path itself is unchanged and untested here.
- Issue history is not stored. Each issue is exported and forgotten; there is no record in the project of what was issued when, which D-09 supersession would need.
- No issue-to-recipient step: preparing a package is distinct from sending it (V-03, V-05, V-06 remain untouched).
- Sheets are limited to 60 per issue and the purpose to 80 characters, both enforced with explicit messages.
