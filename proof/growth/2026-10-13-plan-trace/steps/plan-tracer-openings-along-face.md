# Plan tracer slice 5 — openings measured along a wall face

Owner: `cline-plan-tracer-2-20261013`. Baseline `b026d5ac` (slice 4).
Still additive: `engine.run`, `source_wireframe.py`, `source_building.py`, the trade
packs and phase-1 receipts are unchanged.

## The problem this slice set out to fix

Slice 4 let one wall face be met by several shorter pieces, which broke the 3.78 m
length ceiling — but openings fell from 3 to 1, because a wall run that now spans
several pieces also spans the gaps between them, and the old detector only compared
separate bands.

## What changed

* `open_wall_bands` now also returns the **face gaps**: where two pieces meeting the
  same face leave a gap inside the opening width band, that gap is reported as an
  opening, measured along the wall rather than between bands. It returns
  `(bands, gaps, stats)`.
* `merge_gaps` unions the band-based and face-based candidates, keeping the widest
  report when the same opening is found both ways, so nothing is counted twice.
* Face gaps are filtered by the plan region like bands are.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **43 passed, 14 subtests**, 0.76 s (was 42) |
| `python -m pytest xray -q --ignore=xray/test_plan_trace.py` | **197 passed, 1 skipped** (pre-existing skip), 223 subtests, 54.69 s — no regression |
| Real Wardoo CLI, sheet 6 | exit 0, `sceneSha256 206a885f…21e1e` |

Defects caught inside the slice: the first draft used `*groups, mm_per_pt`, which
made a positional call pass `mm_per_pt` as a group (`TypeError`), and the diagnostic
script's two-value unpack of `open_wall_bands` broke. Both corrected.

## The honest result: this did not fix the openings count

```
Wardoo sheet 6, slice 5
  open paired bands 244  (runs 3904, face gaps 1)
  openings 1
```

Only **one** in-range face gap exists on this sheet, and it coincides with the
gap the band-based detector already found, so `merge_gaps` deduplicated it. The
written scene is therefore **byte-identical to slice 4** (`206a885f…21e1e`), which is
the correct outcome for a dedupe but means:

**Openings remain under-reported at 1 for a dwelling that plainly has many doors and
windows.** Slice 4's regression in opening count is *not* fixed. The mechanism is now
correct and tested; the detection itself still misses openings. The likely reasons,
not yet verified: door and window openings in this drawing may not be drawn as a
break in the wall face at all, and `OPENING_MIN_MM`/`OPENING_MAX_MM` may not bracket
how the openings actually appear.

## Still not trustworthy

1. **Openings: 1.** Under-reported, per above. This is the top open defect.
2. **The calibration is still unverified** (1:100 from the paper-size prior,
   `verified: false`). Only relative geometry is sound.
3. Hatch is excluded by a length threshold rather than identified as hatch.
4. Curves and diagonals are skipped, never approximated; 232 bands fall outside the
   detected region.
5. **No quantities.** `wallRuns` and `openings` are presentation object counts and
   nothing here is a takeoff.

## Next required step

Stop adding mechanisms and instead *look* at how the Wardoo sheet actually draws a
door and a window — render the region and inspect the strokes around a known opening
before writing another heuristic. Guessing again would repeat this slice's outcome.
