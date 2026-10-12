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
| bottom wall `y=570.6` | 48.2 | 1700 mm | **850.0 mm** | `1800H-850W ASW` (twice) |
| top wall `y=174.9` | 85.6 | 3020 mm | **1510.0 mm** | `1200H-1510W ASW`, `1800H-1510W ASW` |
| internal wall `y=361.0` | 85.0 | 3000 mm | **1500 mm** | `1500` |
| bottom wall, second gap | 48.2 | 1700 mm | **850.0 mm** | `1800H-850W ASW` |

At 1:50 the measured gaps reproduce the annotated window widths to the millimetre, four
times over; at 1:100 they reproduce nothing. `sheet6-region.png` and
`reader-a-bottom.png` show the two 850 mm gaps under their own labels on the sheet, so
this is not a reading of numbers alone.

**1:50 on A3 is 25.4/72 x 50 = 17.6389 mm per PDF point**, which is the calibration the
re-run uses. Every length and thickness in the artifact was therefore **twice** its real
## Defect 2 — walls were read by shape, and the sheet is full of wall-shaped non-walls

`wall_bands` accepted every closed axis-aligned rectangle of wall thickness and
plausible length. Walked with pdfium, page 6 has 5743 objects: 5235 stroked paths, 260
filled paths, 246 text objects. The filled paths are the interesting ones:

| Fill colour | Count | Total width | What they are |
| --- | --- | --- | --- |
| `rgb(0, 0, 0)` | 50 | 3493.5 pt | **the wall poche** |
| `rgb(255, 255, 255)` | 193 | 6271.6 pt | the background panel behind every text label and title-block cell |
| `rgb(0, 223, 223)` | 17 | 9.3 pt | the pan inside each window symbol |

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


## The openings now match the drawing's annotations

The slice 6 finding was that the reported openings were 1435 mm and 1660 mm while the
sheet's windows are 600 mm and 850 mm, so nothing matched. All ten openings now land on
an annotated width:

| Opening | Where | Annotated on the sheet |
| --- | --- | --- |
| 1510 mm | top wall, master bedroom | `1200H-1510W ASW` |
| 1510 mm | top wall, bedroom 2 | `1800H-1510W ASW` |
| 1510 mm | east wall, media | `1800H-1510W ASW` |
| 850 mm, 850 mm | bottom wall, kitchen/family | `1800H-850W ASW` (both) |
| 870 mm | internal, bathroom | `870 @2040` |
| 830 mm | internal, ENS | `820 @2040` |
| 916 mm | internal, bath/bedroom 2 | `920` |
| 1478 mm | internal, bedroom 2 | `1500` |
| 2400 mm | east wall, alfresco | `3900H-2400W` |

One annotated window is still missing: the `900H-600W ASW` on the ENS wall at 600 mm is
not reported. That is stated rather than rounded away.

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
| Regression via detached `regression.ps1` | recorded in the evidence directory |
| Wardoo CLI sheet 6 at 1:50 with `--wireframe` | exit 0, 25 walls / 10 openings, manifest hashes verified |
| Headless render of both views | `wireframe-ground.png`, `wireframe-axonometric.png` |

New tests pin the rules rather than the numbers: a dark filled band is a wall and a
white or cyan filled one is not; a stroked outline is not a wall while a dark poche
exists, but still is when the page paints nothing filled; a page with no paint evidence
behaves exactly as before; `band_region` is the poche extent plus margin and `None` for
an empty set; and the extractor records paint mode and fill colour per path.

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
4. **One annotated window (600 mm) is still missed**, and openings are gaps, not yet
   doors or windows.
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
wireframe and the takeoff share one scale. After that, resolve the missing 600 mm window
and the leaf-versus-wall-build-up question, both of which need the drawing's own
dimension text rather than more shape rules.

value before, including the "median 220 mm" wall which was a false confirmation: 90 mm
at the true scale is a brick leaf.
