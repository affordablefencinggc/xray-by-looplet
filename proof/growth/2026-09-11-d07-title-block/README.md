# D-07 title block field fitting — 2026-09-11

Slice: make project metadata update linked title block fields **without clipping**, which is D-07's stated acceptance.

## What changed

- `src/studio/architect/titleBlock.ts` (new) — pure field-fitting for the authored sheet title block. Computes the paper millimetres available to each column, measures the linked value, and truncates with a visible ellipsis when it cannot fit. Returns `full`, `truncated`, `available` and `required` per field so a caller can report honestly rather than silently cutting.
- `src/studio/architect/titleBlock.test.ts` (new) — 10 tests.
- `src/studio/architect/ArchitectSheets.tsx` — the five hardcoded title text nodes now draw fitted text, with an SVG `<title>` tooltip carrying the untruncated value on any field that was shortened. **Text content only; no layout or container change.**

## The register was wrong, and is corrected

D-07 was assessed `gap` on 2026-09-10 with the reasoning "There is no title block or template system, so project metadata cannot update linked fields."

That is half wrong. A title block is drawn on every authored sheet and its fields were **already linked** to project metadata: project name, address, sheet number, design revision, paper size, model revision, a rotating north arrow, and a scale bar computed from the sheet scale. Verified by reading `ArchitectSheets.tsx` and by reading the live DOM (see `cdp-overrun-check.log` lineage below): the rendered sheet reports

```
["PLAN / Ground / 1:50","Untitled architectural design","Project address not specified",
 "DESIGN REVIEW / not for construction","A-101 / REV A / A3","Model revision 1 / print at 100%",
 "N","0 — 5 m / 1:50"]
```

D-07 is re-assessed **partial** in `PROFESSIONAL-A-Z-CHECKLIST.md`. What is genuinely missing is the *template* — the block is at fixed coordinates, its content cannot be chosen, and no firm or client block can be substituted. That keeps it off `verified`.

## Machine proof

- `node --experimental-strip-types --test src/studio/architect/architect.test.ts src/studio/architect/titleBlock.test.ts` → **31/31 pass** (21 pre-existing architect tests unchanged + 10 new).
- `node node_modules/typescript/bin/tsc --noEmit` → **exit 0**.
- Red-first: the first run of `titleBlock.test.ts` failed 3 of 9. Two failures were a real bug — `fitText` returned a bare ellipsis wider than the space allowed — fixed by checking the ellipsis width itself. One failure was **my test being wrong**: I asserted a 500-character address clips on A1, and measurement showed it needs ~702 paper mm against 721 available, so it fits. The tests were corrected to the measured reality and now record both facts: A3 clips at 500 characters, A1 does not.

## Inspected visual proof

`screenshots/growth/2026-09-11-d07-title-block/03-title-block-cases.png` — four cases rendered from `titleBlock.ts` at true paper geometry, from `title-block-cases.html`. The dashed line marks `w-100`, where the sheet number column begins.

Measured **in the browser with real font metrics**, not with the module's own estimate (`cdp-overrun-check.log`):

```
["A3 normal values:OVERRUN=0","A3 long address:OVERRUN=0",
 "A3 long name:OVERRUN=0","A1 long address:OVERRUN=0"]
```

`OVERRUN` counts text nodes whose `getComputedTextLength()` carries them past the sheet-number column. Zero in every case. Visible in the screenshot: the 195-character address stops short of the dashed line with `A-101 / REV A / A3` clear beside it, and the same address on A1 is drawn in full.

## Separate defect found, not fixed here

**The architect workspace collapses its own container to 236 px, so the drawing sheet cannot render in the running app at any viewport.** Measured at 1680x1050 (`cdp-width-collapse.log`):

```
AFTER_LOAD:1656   AFTER_DESIGN:1396   AFTER_ARCH:236
```

`.arch-paper` therefore has a zero-width bounding box and the sheet is not visible on screen. This is why the visual proof above renders the component's output directly rather than photographing the sheet in situ.

**This is pre-existing and unrelated to this change.** Proven by reverting `ArchitectSheets.tsx` to `HEAD`, re-running the identical scenario, and getting identical numbers (`cdp-width-collapse-baseline-HEAD.log`), then restoring the change and re-running the tests (31/31). This change touches text content only.

It is recorded as a finding against U-02 rather than fixed, because the fix belongs to the workspace layout, is shared with the other chat's active files, and needs its own slice and proof.

## Boundary

- No template system: D-07 stays `partial`, not `verified`.
- The advance-width ratio (0.52) is a conservative estimate, not a font metric; the browser check above confirms it errs toward truncating early. A proportional font measured exactly would fit slightly more text.
- Proof is at desktop 1280x800 and 1680x1050. No tablet capture, and no installed-app run.
- The sheet was not photographed inside the running application because of the collapse above.
