# Plan tracer slice 2 — region isolation and open double-line walls

Owner: `cline-plan-tracer-2-20261013`. Branch `recovery/full-studio-20261011`.
Baseline `0597cc3b` (slice 1). Still additive: no change to `engine.run`,
`source_wireframe.py`, `source_building.py`, the trade packs or phase-1 receipts.

## What slice 1 got wrong

Slice 1 recovered only closed, axis-aligned quadrilateral subpaths. On Wardoo
sheet 6 that produced **66 horizontal against 7 vertical** wall bands spread across
the whole 1191x842 sheet — a shape no floor plan has. Two causes, both addressed
here:

1. **No plan-region isolation.** Title-block cells, revision tables and sheet
   margins were being read as wall bands.
2. **No open double-line recovery.** 5,235 of 5,565 subpaths are *open*. CAD plans
   draw many walls as a pair of parallel strokes, and slice 1 could not see them.

## What was added

| Function | Purpose |
| --- | --- |
| `open_runs` | Axis-aligned straight segments from open subpaths |
| `plan_region` | Density grid + largest 4-connected component; the plan is the densest contiguous block |
| `within_region` | Keeps only bands whose midpoint is inside that block |
| `open_wall_bands` | Pairs each stroke with its nearest parallel partner when the separation is a plausible wall thickness and the runs overlap enough |
| `drop_regular_arrays` | Discards regular close-spaced parallel chains (stair treads, hatching, dimension ticks) |

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **40 passed, 14 subtests**, 0.45 s (was 26) |
| `python -m pytest xray -q --ignore=xray/test_plan_trace.py` | **197 passed, 1 skipped** (pre-existing skip), 223 subtests, 24.88 s — no regression |
| Real Wardoo CLI, sheet 6 | exit 0, `sceneSha256 65593e12…b335` |

## Result on Wardoo sheet 6, before and after

| Measure | Slice 1 | Slice 2 |
| --- | --- | --- |
| Wall runs | 73 | 45 |
| Horizontal / vertical | **66 / 7** | **28 / 17** |
| From closed quads | 73 | 9 |
| From open double-line pairs | 0 | **36** |
| Excluded outside plan region | n/a | 225 |
| Excluded as regular array | n/a | 4 |
| Openings | 2 | 3 |
| Thickness mm (min/med/max) | 78.5 / 277.8 / 337.3 | 64.0 / 154.3 / 333.0 |

**The axis balance is now plausible, and 36 of 45 walls come from the open-pair
reader** — direct confirmation that open double-line strokes were the main gap.

### An independent cross-check on the region

The density detector found a region of **13.1 x 7.8 m (about 102 m²)** on sheet 6.
The engine's residential pack independently derived an envelope of
**15.255 x 7.070 m (107.9 m²)** from page-5 dimension chains — a different code
path, a different sheet, and a different method. Agreement within 6% is real
corroboration that the detector isolated the dwelling footprint rather than a
detail or the title block.

A threshold sweep (`xray-recovery-evidence\plan-trace-20261013-fb27c4e1a0d9\sweep.py`)
is why sensitivity stays at 1.0: 0.70 gives 14.8 x 8.7 m, but 0.50 jumps to
32.3 x 20.1 m as the component merges the plan with the other drawings on the
sheet, and 0.08 covers the entire sheet.

## Defect found and fixed inside this slice

The first slice-2 scene reported `fromOpenPairs: 0` while the diagnostic showed 233
paired bands. The `paired` flag was being dropped, so the summary credited every
open double-line wall to the closed-quad reader. `test_scene_attributes_paired_
walls_to_the_open_pair_source` now pins that attribution.

## Still not trustworthy

1. **Total recovered wall length is 47.7 m for a ~102 m² footprint**, which is
   about the external perimeter plus very little internal wall. Internal walls are
   clearly still under-recovered; a plausible dwelling of this size needs far more.
2. **The calibration remains unverified** (1:100 from the paper-size prior,
   `verified: false`), so every metre inherits that assumption.
3. Median wall length is only 1.1 m and the maximum is 2.45 m, so walls are being
   broken into short pieces — openings, door swings and dimension crossings
   interrupt them and nothing re-joins the fragments.
4. Curves and diagonal geometry are still skipped, never approximated.
5. **No quantities.** `wallRuns` and `openings` are presentation object counts.
   Nothing here is a takeoff.

## Next required step

Re-join collinear fragments interrupted by openings and crossings so a wall is one
run rather than several, then re-measure the total against the ~41.8 m external
perimeter implied by the 13.1 x 7.8 m region. Only after the totals close should
this feed the residential pack.
