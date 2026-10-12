# Plan tracer slice 8 — the walls are painted, and the scale was wrong

Owner: `cline-plan-tracer-4-20261013`. Baseline `5bf08ff6` (slice 7).
Still additive in intent: `engine.run`, `source_building.py`, `building_svg.py`, the
trade packs and phase-1 receipts are unchanged. `source_wireframe.py` gained two
recorded fields (paint mode and fill colour) and nothing else; that change is
backwards compatible and is covered below.

## What was wrong with the artifact the user was looking at

The committed artifact (`steps/wardoo-wireframe/`, 42 parts, scene `829f4dc0`) renders
as nested thin rectangles in the top-left with a couple of stray bars — not a floor
plan. Every measurement in slices 1-7 was made on that output, so the first job was to
find out what the reader was actually looking at. Rendered evidence:
`xray-recovery-evidence\plan-trace-20261013-fb27c4e1a0d9\overlay-sheet6.png` (the old
reader's claims painted back onto the sheet).

Three separate defects, each measured rather than guessed.

## Defect 1 — the calibration was 1:100 on a 1:50 sheet

The title block says `SCALE: 1:50 @ A3`. The engine's paper-size prior
(`scale.py::vote_scale`, weak prior weight 0.5) won anyway: `engine-out/result.json`
from the Wardoo run records `{"value": "1:100", "mmPerPt": 35.27777777777777}`, and the
tracer evidence run passed that same 35.2778 straight through.

The drawn geometry says the prior is wrong, and it says so exactly. Take the filled
wall-thickness bands that lie on the drawing's bottom wall line and on its top wall
line, sort them, and measure the gaps between consecutive bands — the gaps are the
windows the drawing itself annotates:

| Line | Gap in page points | at 35.2778 mm/pt | at 17.6389 mm/pt | Annotated on the sheet |
| --- | --- | --- | --- | --- |
| bottom wall `y=570.6` | 48.2 | 1700 mm | **850.0 mm** | `-850W` (annotated twice) |
| top wall `y=174.9` | 85.6 | 3020 mm | **1510.0 mm** | `-1510W` (annotated three times) |
| bottom wall, second gap | 48.2 | 1700 mm | **850.0 mm** | `-850W` |

At 1:50 the measured gaps reproduce the annotated window widths; at 1:100 they reproduce
nothing. `sheet6-region.png` and `reader-a-bottom.png` show the two 850 mm gaps under
their own labels on the sheet, so this is not a reading of numbers alone.

**Status of this table, corrected after an audit: it is not independently reproducible.**
It is a property of the pdfium path decomposition the extractor uses. Re-deriving the same
line with PyMuPDF (`_probe_gaps_items.py`, `_probe_calibration.py` in the evidence
directory) reports the bottom wall as **one** dark path spanning `351.6-857.0 pt`, with the
fills drawn as polylines rather than rectangles — so a second engine neither splits those
bands nor sees the 48.2 pt gaps between them. The table is kept as the observation that
started this slice, and it is marked as unverified. **The calibration no longer rests on
it.** It rests on two checks that do reproduce independently:

1. the sheet's own title block reads `SCALE: 1 : 50 @ A3` (six separate text tokens,
   confirmed by PyMuPDF);
2. at 1:50, **six** traced openings land exactly on the width the drawing annotates for
   them (1510 x3, 850 x2, 2400), and at 1:100 none of them would.

A third check agrees too: the traced 7.07 m depth equals the 7070 mm the residential pack
derived from page-5 dimension text by a completely different path (see below).

**1:50 on A3 is 25.4/72 x 50 = 17.6389 mm per PDF point**, which is the calibration the
re-run uses. Every length and thickness in the artifact was therefore **twice** its real
## Defect 2 — walls were read by shape, and the sheet is full of wall-shaped non-walls

`wall_bands` accepted every closed axis-aligned rectangle of wall thickness and
plausible length. Walked with pdfium, page 6 has 5743 objects: 5235 stroked paths, 260
filled paths, 246 text objects. The filled paths are the interesting ones:

| Fill colour | Count | Σ bbox width | What they are |
| --- | --- | --- | --- |
| `rgb(0, 0, 0)` | 50 | 3493.5 pt | **the wall poche** |
| `rgb(255, 255, 255)` | 193 | 6271.6 pt | the background panel behind every text label and title-block cell |
| `rgb(0, 223, 223)` | 17 | 9.3 pt | the pan inside each window symbol |

**The `Count` column is the load-bearing one and it is independently confirmed:** walking
the same page with PyMuPDF (`fitz`), a different engine from the pdfium that produced the
table, gives the same 260 filled paths and the same 50 / 193 / 17 by colour. The
`Σ bbox width` column is *not* painted wall length and must not be read as such — it is
the sum of `abs(right - left)` of each path's bounding box, so for a vertical band it
measures the band's **thickness**, not its length. A bounding-box long-side sum over the
same 50 fills is 5119.2 pt (90.3 m) and the tracer's 25 kept walls total 37.02 m
(2099.0 pt), so the three figures are not comparable and only the counts are used. The
column is kept because it shows the black poche is real, and it is flagged here because
it was originally presented as if it were wall length.

All three are closed rectangles of wall thickness and multi-metre length. The white
panels alone are why the wireframe was a wall of text-line boxes: `reader-a-top.png`
shows the seven `NOTE:` lines boxed one per line.

So the reader now uses the drawing's own paint evidence:

* `source_wireframe.extract_pdf` records `fill`, `stroke` and, when filled, `fillColor`
  (RGBA 0-255) on every path record. Nothing else changed, and a consumer that ignores
  the new fields behaves exactly as before.
* `plan_trace.wall_bands` reads a band as a wall only when it was **filled and dark**
  (luminance < 0.5). Light-filled shapes are counted as `lightFilled` and dropped;
  stroke-only closed rectangles are counted as `strokedOnly` and dropped.
* Fallbacks are explicit and tested: a page that paints nothing filled falls back to
  closed outlines, and a page that carries no paint evidence at all keeps the previous
  shape-only behaviour. `readMode` is `poche`, `outline` or `shape`, and the scene
  records which one produced its walls.

## Defect 3 — the plan region was applied to the wall reader and kept a third of the plan

The density region on sheet 6 was `[161.6, 384.1, 532.9, 606.2]` pt. The plan spans
x 142-1010 and y 171-573 pt, so **16 of the 26 real walls were outside the region and
were discarded** — including the whole east half of the dwelling and every exterior
wall. What survived was the dense wet-area cluster, i.e. the fixtures.

Now, when the page paints its walls, the region is the extent of the poche itself
(`band_region`) and the paired-stroke reader is not consulted at all: on this sheet it
returned 170 bands drawn from dimension lines, hatch and fixtures while the poche
returned the dwelling's walls. The density region is left exactly as it was for the
fallback path — it is a known weakness there (a plan whose interior rooms are empty can
still be truncated) and it is not exercised by this sheet, so it is recorded as an open
defect rather than changed blind.

## Result

| Measure | Slice 7 artifact | Slice 8 artifact |
| --- | --- | --- |
| Calibration | 1:100, 35.2778 mm/pt | **1:50, 17.6389 mm/pt** |
| Wall runs | 42 parts (mostly not walls) | **25** |
| Wall source | closed quads + open stroke pairs | **filled dark poche only** |
| Wall thickness mm (min/median/max) | 70.0 / 220.0 / 386.0 | **61.9 / 90.0 / 90.0** |
| Traced extent | 20.19 x 5.67 m spread over the sheet | **12.69 x 7.07 m, the dwelling** |
| Openings | 2 (1435 mm, 1660 mm — matching nothing) | **10** |
| `readMode` | (did not exist) | `poche` |

The re-run, executed exactly as recorded:

```
python -B engine\python\xray\plan_trace.py "C:\Users\danie\Documents\LOT 31 WARDOO STREET REV H.pdf"
  --page 6 --mm-per-pt 17.6389 --scale-value "1:50 @ A3"
  --out <evidence>\wardoo-sheet6-poche.scene.json --wireframe <evidence>\wireframe
```

Scene SHA-256 `557d63b8a29f0acbd52bc508af896c68a07111939966c4feac43ddee0317d60d`,
35 objects, exit 0, and the exporter wrote both views (`wireframe-ground.svg`
`2bb3fb60...`, `wireframe-axonometric.svg` `2bc3d167...`, 35 parts / 140 and 420
segments). `overlay-scene-1x50.png` paints that scene's own wall and opening footprints
back onto the sheet for eyeball comparison.


## The openings: six match the drawing exactly, four do not

The slice 6 finding was that the reported openings were 1435 mm and 1660 mm while the
sheet's windows are annotated in entirely different sizes, so nothing matched. Slice 8
reports ten openings and **six of them sit exactly on an annotated width**. The other four
do not, and the drawing's own text (read with PyMuPDF, token by token) shows it:

| Traced | The drawing's words at that opening | Verdict |
| --- | --- | --- |
| 1510 mm | `1200H -1510W ASW` (18 pt away) | exact |
| 1510 mm | `1200H -1510W ASW` (17 pt) | exact |
| 1510 mm | `1200H -1510W ASW` (15 pt) | exact |
| 850 mm | `1800H -850W ASW` (20 pt) | exact |
| 850 mm | `1800H -850W ASW` (20 pt) | exact |
| 2400 mm | `2100H -2400W ASD` (19 pt) | exact |
| 830 mm | `900H -600W ASW` (26 pt) | **+230 mm too wide** |
| 870 mm | `ENS 870 @ 2040` | a door code, not a window |
| 916 mm | `870 @ 2040` is the nearest code | no 916 mm code exists |
| 1478 mm | `970`, `2040`, `700` nearby | no 1478 mm code exists |

Read the other way round, **three of the sheet's nine annotated widths have no traced
opening at their stated size**: the two `-600W` windows and the single `-610W`. One of the
600 mm windows is spanned by the 830 mm gap above; the other has no opening within 97 pt,
and the 610 mm window has none within 103 pt (the nearest is a 1510 mm opening 1.8 m away).

So the correct statement is **not** "all ten openings land on an annotated width". It is:
the six large exterior openings match the drawing exactly, and the small windows — 600,
600 and 610 mm — are precisely where this reader fails. Slice 8 initially claimed the 600
mm window was merely "missed"; it is worse than that, a gap of 830 mm is traced across it,
a 38% error on that opening.

Two further corrections to what slice 8 first wrote:

* the alfresco opening is annotated `2100H -2400W ASD`, not `3900H-2400W`. The string
  `3900` does not occur anywhere on sheet 6;
* the `820 @2040`, `920` and `1500` annotations attributed to the 830, 916 and 1478 mm
  openings are not at those openings. `@2040` occurs on this sheet only with `870`.

There are 8 `ASW` codes, 1 `ASD` and 3 `ENS` on the sheet; the nine widths are 1510 (x3),
850 (x2), 600 (x2), 610 (x1) and 2400 (x1).

## Independent cross-check, now exact

The traced dwelling is 12.69 x **7.07 m**. 7070 mm is the depth annotated on the sheet,
and it is the same 7070 mm the residential pack derived from the page-5 dimension chains
(`15255 x 7070 mm`, a different code path on a different sheet) — agreement to 0.2%.
Before this slice the same comparison was reported as a "6% agreement" that was in fact
a 2x error hidden by a truncated region.

The 15255 mm overall width is not contradicted: it includes the alfresco strip east of
x 862 pt, which this drawing renders with dashed outlines and no poche, so a poche
reader cannot and should not claim it. The walled dwelling is the 12.69 m.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py xray/test_source_wireframe.py -q` | **69 passed, 21 subtests**, 2.01 s (was 58) |
| Regression via detached `regression.ps1` | **198 passed, 1 pre-existing skip, 223 subtests**, 27.19 s (was 197) |
| `verify_claims.py`, checks re-deriving every claim from outside the tracer | **46/46 passed** (see the audit below) |
| Wardoo CLI sheet 6 at 1:50 with `--wireframe` | exit 0, 25 walls / 10 openings, manifest hashes verified |
| Headless render of both views | `wireframe-ground.png`, `wireframe-axonometric.png` |

New tests pin the rules rather than the numbers: a dark filled band is a wall and a
white or cyan filled one is not; a stroked outline is not a wall while a dark poche
exists, but still is when the page paints nothing filled; a page with no paint evidence
behaves exactly as before; `band_region` is the poche extent plus margin and `None` for
an empty set; and the extractor records paint mode and fill colour per path.

## Audit of this slice's own claims (added after the fact)

The write-up above was itself wrong in six places. Every number in it was re-derived by
`xray-recovery-evidence/plan-trace-20261013-71f50a208c0e/verify_claims.py`, which imports
no xray module, reads the committed scene as plain JSON, and reads the source PDF with
PyMuPDF (a different engine from the pdfium the extractor uses). 46 checks, all passing.
What the audit confirmed, and what it broke:

**Confirmed:** every artifact hash recomputed from the committed bytes and
matched against the manifest; 35 objects, 25 walls, 10 openings; thickness
61.9/90.0/90.0 mm recomputed from the raw vertex arrays; extent 12.69 x 7.07 m recomputed
and agreeing with the scene's own bounds; the ten opening widths recomputed from geometry;
the paint census counts (50 black / 193 white / 17 cyan of 260 filled paths) confirmed by a
second PDF engine; the declared `SCALE: 1 : 50 @ A3`; the 9 annotated widths (1510 x3,
850 x2, 600 x2, 610 x1, 2400 x1); and the scene's own admission that its calibration is
`verified: false` and that it is not a takeoff.

**Broken, and corrected above:**

1. "All ten openings land on an annotated width" — **false**. Six do.
2. "830 mm `<->` `820 @2040`", "916 mm `<->` `920`", "1478 mm `<->` `1500`" — the drawing's
   words at those openings are `900H -600W ASW`, `870 @ 2040` and `970`/`2040`/`700`.
   `@2040` appears on this sheet only with `870`.
3. "`3900H-2400W`" — the sheet says `2100H -2400W ASD`; `3900` occurs nowhere on it.
4. "One annotated window (600 mm) is still missed" — worse: an 830 mm gap is traced across
   it (+230 mm), and the 610 mm window is unanswered as well.
5. The paint table's "Total width" column was presented next to counts as if it measured
   wall length. It is `sum(abs(right-left))` of bounding boxes, which for a vertical band
   measures its thickness. The counts are the load-bearing figure and they do reproduce.
6. The 48.2/85.6 pt gap table does not reproduce outside the extractor's own pdfium
   decomposition, and is now marked unverified in Defect 1.

A seventh problem was cosmetic but real: a stray sentence fragment sat at the end of this
file after a bad edit. Removed.

The audit scripts are kept beside the result in the evidence directory:
`verify_claims.py`, `_probe_codes.py`, `_probe_annotations.py`, `_probe_calibration.py`,
`_probe_gaps_items.py`, `_probe_lengths.py`, with their captured output in the matching
`probe.*.txt` / `verify.stdout.txt` files.

## Open defect this slice found and did NOT fix: the engine's scale vote

`scale.py::vote_scale` returned `1:100` (`verified: false`) for a sheet that declares
`1:50 @ A3` and whose geometry measures 1:50. Anything downstream that converts page
points to lengths through that vote inherits a 2x error. `engine.run`'s takeoff numbers
on this plan were not affected because its residential pack reads the dimension *text*
(15255 x 7070 mm), not geometry.

`scale.py` is a frozen producer on the takeoff path, so it was not modified. The
recommended fix, with the method that found it: prefer the declared title-block scale
when it is present and readable, and treat the window-gap measurement above as the
independent check that a scale vote is right before it is trusted.

## Honest limits of slice 8

1. **Wall height is still an assumed 2.70 m** and opening head heights are inferred;
   neither is read from the sheet.
2. **Only filled dark poche is read as walls.** On this drawing a wall is often painted
   as *leaves* (90 mm brick, 70 mm frame), so a "wall" in the scene is a leaf, not the
   full wall build-up. Whole-wall thickness is not recovered.
3. **Dashed and outline-only areas are not walls.** The alfresco is drawn dashed, so the
   12.69 m extent is the walled dwelling, not the full 15.255 m envelope.
4. **The small windows are where this reader fails.** Three of the sheet's nine annotated
   widths — the two 600 mm and the single 610 mm — have no traced opening at their stated
   size, and one 600 mm window is spanned by an 830 mm gap, a 230 mm error. Four of the ten
   traced openings (870, 830, 916, 1478) do not equal any width the sheet annotates.
   Openings are gaps in the poché, not yet doors or windows, and the drawing places its
   window codes 15-100 pt away from the geometry they describe, so matching annotation to
   opening is proximity-based and asserted, not proven.
5. **Curved and diagonal geometry is still never approximated**, and one sheet (page 6)
   is traced: no upper floor, no roof.
6. **`calibrationVerified` is `false` in the scene**: 17.6389 was supplied by the caller
   and cross-checked by the window measurement above, but the engine's own scale vote
   still says 1:100, so the two disagree in writing and the disagreement is recorded
   rather than hidden.
7. **Nothing here is a quantity.** This is presentation geometry.

## Next required step

Have the engine's scale vote prefer the declared title-block scale, then re-run the
tracer with the calibration the engine reports (rather than a caller constant) so the
wireframe and the takeoff share one scale. After that, the two questions that this audit
sharpened:

* **the three unanswered small windows (600, 600, 610 mm)** — they need the drawing's own
  dimension text and window schedule, not more shape rules, and the 830 mm gap over a
  600 mm window says the current gap reader is measuring something other than the window
  (most likely the structural opening or the reveal, which would make it consistent with
  the 1510/850/2400 exact matches only if those windows are drawn without reveals);
* **the leaf-versus-wall-build-up question** — a traced "wall" is one painted leaf, so no
  wall build-up, and therefore no wall length, can be claimed from it.

