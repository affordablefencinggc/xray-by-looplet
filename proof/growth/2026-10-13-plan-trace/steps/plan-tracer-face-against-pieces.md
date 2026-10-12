# Plan tracer slice 4 — one face against many facing pieces

Owner: `cline-plan-tracer-2-20261013`. Baseline `34aa9b42` (slice 3).
Still additive: `engine.run`, `source_wireframe.py`, `source_building.py`, the trade
packs and phase-1 receipts are unchanged.

## The ceiling slice 3 could not break

Slice 3 recovered 52.6 m of wall with a 3.78 m maximum, although the region is
13.1 m wide and single runs of 7.79 m exist inside it. Slice 3's pairing allowed each
stroke exactly ONE partner, so a wall drawn as one long outer face against several
shorter inner strokes was measured only across whichever single piece happened to
overlap — never the whole wall.

## What changed in `open_wall_bands`

* Strokes are processed **longest first**, so a wall's outer face claims its facing
  pieces before a shorter stroke can claim them for something else.
* A face may accept **several** partners, independently per side.
* Two accepted partners on the same side may never cover the same stretch of the
  face, so one wall is never counted twice.
* A stroke already consumed as a *partner* can no longer become a *face*. A test
  caught this during the slice: without it, three evenly spaced parallel lines
  produced two overlapping bands instead of one.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **42 passed, 14 subtests**, 0.32 s |
| `python -m pytest xray -q --ignore=xray/test_plan_trace.py` | **197 passed, 1 skipped** (pre-existing skip), 223 subtests, 25.29 s — no regression |
| Real Wardoo CLI, sheet 6 | exit 0, `sceneSha256 206a885f…21e1e` |

The regression now exceeds the 30-second foreground command limit, so it is run
through `regression.ps1` as a tracked detached process with a 600 s deadline and its
own stdout/stderr/exit record, as this repository requires for longer work.

## Wardoo sheet 6 across the four slices

| Measure | Slice 1 | Slice 2 | Slice 3 | Slice 4 |
| --- | --- | --- | --- | --- |
| Wall runs | 73 | 45 | 41 | **40** |
| Horizontal / vertical | 66 / 7 | 28 / 17 | 25 / 16 | **25 / 15** |
| From open double-line pairs | 0 | 36 | 32 | **31** |
| Total recovered wall | 167.5 m | 47.7 m | 52.6 m | **64.1 m** |
| Longest wall | 6.84 m | 2.45 m | 3.78 m | **7.61 m** |
| Openings | 2 | 3 | 3 | 1 |
| Thickness mm (min/med/max) | 78.5 / 277.8 / 337.3 | 64.0 / 154.3 / 333.0 | 67.0 / 180.0 / 367.0 | **70.0 / 220.0 / 386.0** |

### Why this is a real improvement, not just a bigger number

* The **7.61 m longest wall** matches the longest run that actually exists inside the
  region (7.79 m), so the artificial 3.78 m ceiling is gone.
* **64.1 m over a 13.1 x 7.8 m footprint** is external perimeter (about 41.8 m) plus
  roughly 22 m of internal wall — a credible shape for a dwelling, where slice 1's
  167.5 m and slice 2's 47.7 m were not.
* A **median thickness of 220 mm** is the standard Australian brick-veneer external
  wall, which is an independent sanity check on the calibration's order of magnitude
  even though the calibration itself remains unverified.

## Still not trustworthy

1. **The calibration is still unverified** (1:100 from the paper-size prior,
   `verified: false`). Every metre inherits that assumption; only the *relative*
   geometry is trustworthy.
2. **Openings fell to 1.** Longer walls that now span across door gaps absorb the
   gaps that slices 2 and 3 reported. Opening detection is now under-reporting and
   must be revisited; it is not a solved feature.
3. Hatch is excluded by a length threshold rather than identified as hatch, so a
   genuinely short wall nib is also excluded.
4. Curves and diagonals are still skipped, never approximated. Walls outside the
   detected region are excluded (232 bands on sheet 6).
5. **No quantities.** `wallRuns` and `openings` are presentation object counts and
   nothing here is a takeoff. `calibrationVerified` is `false` in the scene and in
   the CLI output.

## Next required step

Re-do opening detection against the longer walls — measure gaps along each wall run
after pairing rather than only between separate bands — and then reconcile the
recovered external perimeter against the ≈41.8 m the region implies before anything
feeds the residential pack.
