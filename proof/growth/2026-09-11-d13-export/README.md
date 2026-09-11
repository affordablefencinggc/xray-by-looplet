# D-07 in the exported PDF — 2026-09-11

Follow-on from `proof/growth/2026-09-11-d07-title-block/`. That slice fitted the title block **on screen**. This one fixes the same defect in the **exported PDF**, which is the artifact that actually gets issued to a builder, certifier or client.

## The gap in the previous slice

`exportDrawingPdf` in `src/studio/architect/sheets.ts` drew the title block with raw, unfitted values:

```js
text(p.name, 14, h - 32, 13);
text(p.address || "Project address not specified", 14, h - 25, 8);
```

So a long project name or address still ran under the sheet number in the exported drawing, even after the on-screen fix. Measured with the embedded Helvetica before changing anything:

| Sheet | Field | Needs | Available | Overflows |
|---|---|---|---|---|
| A3 | address, 500 chars at 8 pt | 2000 pt | 850 pt | **yes** |
| A3 | name, 200 chars at 13 pt | 1877 pt | 850 pt | **yes** |
| A1 | address, 500 chars at 8 pt | 2000 pt | 2044 pt | no |
| A1 | name, 200 chars at 13 pt | 1877 pt | 2044 pt | no |

Both figures are the schema maximums (`address` 500, `name` 200 in `model.ts`), not invented lengths.

## What changed

- `src/studio/architect/titleBlock.ts` — added `fitTextMeasured(text, size, available, measure)`. The PDF embeds a real font and can measure exactly, so it must not rely on the on-screen advance-ratio estimate. It uses `...` rather than `…` because Helvetica in pdf-lib's standard encoding has no ellipsis glyph.
- `src/studio/architect/sheets.ts` — the five title block fields are fitted with `font.widthOfTextAtSize` before being drawn.
- `src/studio/architect/sheetExport.test.ts` (new) — 5 tests exercising the real `exportDrawingPdf`.
- `src/studio/architect/titleBlock.test.ts` — 4 more tests for the measured variant, including one proving it honours proportional glyph widths rather than a flat ratio.

## Machine proof

- `node --experimental-strip-types --test architect.test.ts titleBlock.test.ts sheetExport.test.ts authoredSheetSet.test.ts` → **51/51 pass**.
- `node node_modules/typescript/bin/tsc --noEmit` → **exit 0**.

## Proof from the exported bytes

Two PDFs were generated at the schema maximum address (500 characters) and are committed beside this file. `verify-pdf-text.mjs` inflates their content streams and decodes the hex-encoded `Tj` operands — this reads **what was actually drawn into the artifact**, not what a helper returned:

```
--- A3 ---
  text nodes drawn : 28
  address chars    : 213 (TRUNCATED with marker)
  name             : 78 chars
--- A1 ---
  text nodes drawn : 28
  address chars    : 500 (full, no marker)
  name             : 78 chars
```

A3 truncates the 500-character address to 213 characters and appends the marker; A1 draws all 500 untouched. That matches the measurement table above and the on-screen A3/A1 split exactly.

Reproduce with `node proof/growth/2026-09-11-d13-export/verify-pdf-text.mjs`.

## Boundary

- **No visual screenshot of the PDF.** Chrome's PDF plugin does not expose its render surface to CDP in this environment, so the page could not be photographed. The byte-level text extraction above is the substitute, and is stronger evidence for this specific claim than a picture would be — it reads the drawn operands directly.
- Only the title block is fitted. Viewport labels and in-drawing text are unchanged.
- D-13 batch printing and issue sets is **not** started; this only removes a defect from the single-sheet export that D-13 would otherwise inherit and multiply across every sheet in an issue.
- D-07 remains `partial`: still no template system.
