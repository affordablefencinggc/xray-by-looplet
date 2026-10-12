# Plan tracer slice 6 — look at the drawing first: walls are filled poche

Owner: `cline-plan-tracer-3-20261013`. Baseline `327be504` (slice 5).
Still additive: `engine.run`, `source_wireframe.py`, `source_building.py`, the trade
packs and phase-1 receipts are unchanged.

## Why this slice starts with a picture

Slices 4 and 5 were heuristics written without looking at the sheet, and slice 5
proved it by changing nothing. This slice rendered Wardoo sheet 6 and inspected it
before writing any code.

Evidence, both images in
`xray-recovery-evidence\plan-trace-20261013-fb27c4e1a0d9\`:
`sheet6-full.png` and `sheet6-region.png` (the detected plan region at 6x).

## What the drawing actually does

1. **Walls are solid black filled poche** — thick filled bands, not pairs of lines.
2. **Windows are drawn as a multi-line symbol sitting inside a gap in the poche**: a
   thin outlined rectangle with three parallel internal lines, annotated
   `900H-600W ASW` and `1800H-850W ASW`. The wall stops, the symbol fills the gap.
3. **Doors** appear as gaps with their own symbol and label (`PTY-4S`, `OCH`).
4. Hatching is common and regular: at `perp 430 pt` there are nine short runs at
   ~3-4 pt spacing, and at `perp 566 pt` seventeen runs at a uniform ~12 pt pitch.
   These are hatch and stair treads, and they are exactly what
   `drop_regular_arrays` exists to remove.
5. The longest real wall strokes are `perp 568 pt` (7609 mm) and `perp 573 pt`
   (7789 mm) — 5 pt apart, which is **176 mm**, a plausible wall thickness. Two faces
   of one wall, and the pair is correctly recovered.

## The defect this exposed

Wall poche is a **single filled path with many vertices**, not a set of four-corner
quads. Slice 1-5 accepted only 4-point quads, so most of the filled wall structure was
being discarded. `decompose_rectilinear` now splits any axis-aligned closed path into
exact rectangles by vertical slabs with even-odd scanline pairing.

The properties that matter:

* It **tiles** the polygon exactly rather than approximating it. The new test asserts an
  L-shaped closed path yields 7500 units of area, not the 10000 a bounding box would
  claim, and that no strip spans the missing quadrant. The old test asserted such a
  shape was rejected outright; that was the bug, so the test was corrected rather than
  the behaviour.
* Four-corner quads still take the direct path, so the common case cannot drift.

## Window and door symbols, and what they cost

Reading the render, a window is a rectangle of roughly wall thickness carrying several
parallel glazing rules, sitting in a gap in the poche. That rectangle has exactly the
shape `wall_bands` accepts, so it was being counted as a wall — and, because it touches
the poche either side, `merge_bands` would join it to them and **close the very gap that
identifies the opening**.

`symbol_rectangles` now detects a wall-thickness rectangle carrying two or more
internal parallel rules spanning at least 80% of it, and `build_scene` removes those
rectangles from the wall bands and emits them as openings instead.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **48 passed, 14 subtests**, 1.08 s (was 43) |
| Regression (detached `regression.ps1`) | recorded in `regression.stdout.log` |
| Real Wardoo CLI, sheet 6 | exit 0, `sceneSha256 f8756999…09f4` |

## Effect on the recovered geometry

| Measure | Slice 5 | Slice 6 |
| --- | --- | --- |
| Rectangles read | 219 | **285** |
| Closed wall bands | 74 | **104** |
| Bands inside region | 77 | **94** |
| Symbols detected in region | - | **1** |
| Kept after merge and array rejection | 40 | 40 |
| Total recovered wall | 64.1 m | **65.8 m** |
| Openings | 1 | **2** |
| Thickness mm (min/med/max) | 70.0 / 220.0 / 386.0 | 70.0 / 220.0 / 386.0 |

The merged wall result barely moves, and that is worth stating plainly: recovering 30
more bands from the filled poche mostly re-finds walls the stroke pairing already had,
so the two readers are **convergent** rather than the change being a large correction.

## Openings are STILL wrong — with the evidence that proves it

`symbols` detected inside the region: **1**. The two reported openings are 1435 mm and
1660 mm wide, while the windows annotated on this sheet are **600 mm** and **850 mm**
(`900H-600W ASW`, `1800H-850W ASW`). The widths do not match, so the two gaps being
reported are very probably **not** the two windows. The count is wrong in both
directions, and the improvement from 1 to 2 is not evidence that opening detection works.

Two concrete false-positive routes were found while testing and are not fixed:

1. **Glazing rules can pair into a thin "wall".** Two parallel rules exactly
   `WALL_MIN_MM` (60 mm) apart satisfy the wall test and become a 60 mm wall band. The
   regression test had to space its rules 20 mm apart to avoid it, which means real
   drawings with widely spaced glazing lines will produce phantom thin walls.
2. **A window symbol is only recognised when it is a closed rectangle.** If a drawing
   emits the glazing as loose rules without a closed outline, nothing here finds it.

## Next required step

Group the glazing rules themselves: several parallel rules of the same span, close
together and lying along a wall line, are a window regardless of whether a closed
outline was drawn, and they should be removed from the wall candidates as a group.
Then measure each opening's width against its annotation rather than trusting the count.
