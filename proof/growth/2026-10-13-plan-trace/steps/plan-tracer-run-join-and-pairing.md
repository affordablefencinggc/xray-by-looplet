# Plan tracer slice 3 — run re-join and best-overlap pairing

Owner: `cline-plan-tracer-2-20261013`. Baseline `e68b9e96` (slice 2).
Still additive: `engine.run`, `source_wireframe.py`, `source_building.py`, the trade
packs and phase-1 receipts are unchanged.

## What slice 2 left wrong

Median wall length was 1.1 m and the longest was 2.45 m, while a plan whose region
is 13.1 m wide must contain walls of that order. Measuring the run population on
sheet 6 gave the cause:

```
runs inside region 1487   (759 h / 728 v)
h: median 0.08 m, p90 1.16 m, max 7.79 m, total 275.0 m
v: median 0.06 m, p90 1.05 m, max 5.10 m, total 215.2 m
```

Half the population is **hatch, tick and text strokes a few centimetres long**, and
only the tail are real walls. Two defects followed from that:

1. Only the FIRST stroke of a candidate pair was length-checked. A long wall stroke
   could pair with a 3 cm hatch mark.
2. The first partner inside the thickness window won, so a wall could pair with a
   neighbouring wall's facing line rather than its own.

## What changed

| Change | Effect |
| --- | --- |
| `open_runs` re-joins consecutive collinear segments within a subpath | 4312 → 3904 runs |
| `open_wall_bands` requires BOTH strokes to be at least `MIN_WALL_LENGTH_MM` (`viableRuns`) | hatch marks can no longer be a wall face |
| `open_wall_bands` selects the partner with the GREATEST overlap, not the first nearby one | a wall pairs with its own facing line |

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **42 passed, 14 subtests**, 0.64 s (was 40) |
| `python -m pytest xray -q --ignore=xray/test_plan_trace.py` | **197 passed, 1 skipped** (pre-existing skip), 223 subtests, 22.70 s — no regression |
| Real Wardoo CLI, sheet 6 | exit 0, `sceneSha256 ea2aa0d4…37b5` |

## Wardoo sheet 6 across the three slices

| Measure | Slice 1 | Slice 2 | Slice 3 |
| --- | --- | --- | --- |
| Wall runs | 73 | 45 | 41 |
| Horizontal / vertical | 66 / 7 | 28 / 17 | **25 / 16** |
| From open double-line pairs | 0 | 36 | 32 |
| Total recovered wall | 167.5 m | 47.7 m | **52.6 m** |
| Longest wall | 6.84 m | 2.45 m | **3.78 m** |
| Openings | 2 | 3 | 3 |
| Thickness mm (min/med/max) | 78.5 / 277.8 / 337.3 | 64.0 / 154.3 / 333.0 | **67.0 / 180.0 / 367.0** |

Slice 1's 167.5 m was mostly not walls, so it is not a target to return to.

## A change that was tried and reverted

Cross-subpath collinear re-join (`merge_collinear_runs`) was implemented, then
removed. It reduced paired bands 209 → 92, cut the recovered total 52.6 m → 39.4 m
and eliminated all three openings, because joining strokes before pairing consumed
the very gaps that identify an opening. It was deleted rather than kept as dead
code: an unproven idea does not belong in the module.

## Still not trustworthy

1. **52.6 m of wall for a region of 13.1 x 7.8 m.** The external perimeter alone is
   about 41.8 m, so internal walls are still badly under-recovered, and no wall in
   the result is longer than 3.78 m although 7.79 m runs exist in the region.
2. **The calibration is still unverified** (1:100 from the paper-size prior,
   `verified: false`); every metre inherits it.
3. Hatch strokes are excluded by a length threshold rather than identified as
   hatch, so a genuinely short wall nib is also excluded.
4. Curves and diagonals are still skipped, never approximated.
5. **No quantities.** `wallRuns` and `openings` remain presentation object counts.

## Next required step

A wall in this drawing is one face stroke facing several shorter strokes, so pairing
must accept a long stroke against a SET of facing pieces rather than one partner.
That is the change that should close the 3.78 m ceiling, and it must be validated by
checking the external perimeter against the ≈41.8 m the region implies.
