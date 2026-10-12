# X-Ray recurring recovery handoff

## Authority and recurrence — October 12, 2026

User: "please proceed with everything required set a loop @10mins to nudge to
continue working through the app please".

- Enabled schedule: `sched_e1b36f37-c625-458b-a343-80197418a5f7`.
- Cron: `*/10 * * * *`, using the scheduler's existing local timezone
  (`Australia/Brisbane`, not an agent-selected override).
- One scheduled run at a time, nine-minute timeout, bounded work slices.
- Absolute repository:
  `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery`.
- Branch: `recovery/full-studio-20261011`; scheduling baseline `e91f9bc5`.
- Acquire the exclusive owner marker before edits or test launches:
  `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\continuation-loop.lock.json`.
  A live/unexpired other owner means defer, not start another editor. Expiry alone
  does not authorize interrupting a live worker. Release only your own marker.

### Superseding DANS1 approval — October 12, 2026

User: **"im approving all dans1 works. !!"**

This subsequent, host-specific approval supersedes the earlier missing DANS1
execution-method authorization, including the schedule prompt's baseline warning.
Proceed with recovery-related DANS1 checks, fresh engine qualification, sequential
builds and isolated pre-install QA, subject to their unchanged evidence gates.
If required, use a process-only `powershell.exe -NoProfile -NonInteractive
-ExecutionPolicy Bypass -File` invocation of the independently hash-verified
recovery worker. Check policy scopes first; do not modify persistent policy or
evade MachinePolicy/UserPolicy. Record exact invocation, identities and cleanup.

This does **not** establish engine/app acceptance, authorize installation, signing,
production credentials/deployment, dependency upgrades, normal-profile/data writes,
unreviewed engine promotion, push or merge. **Stop before installation.** Preserve
historical attempt `1a9f4e6c8202`, original helpers and phase-1 receipt bytes.
Approval and fresh preflight observations are recorded separately in
`DANS1-AUTHORIZATION.md`; do not rewrite the old blocked-attempt proof.
Fresh probes confirmed DANS1 access and process-only Bypass; a subsequent default
session remained Restricted, and the probe launchers exited. No qualification
worker was launched. Authorization is no longer the gate-2 blocker; the next
technical action below is unchanged. Evidence ID: `3730110660a2`.

## 2026-10-13 additive slice 8 — the walls are painted black, and the scale was wrong

Owner `cline-plan-tracer-4-20261013`, baseline `5bf08ff6`. The slice 7 wireframe artifact
(42 parts, scene `829f4dc0`) was rendered and compared with sheet 6, and it was not a
plan: three measured defects came out of that comparison, and the whole of slices 1-7
had been measured through them.

1. **Calibration.** The tracer ran at 1:100 (the engine's paper-size prior,
   `scale.py::vote_scale`, weight 0.5, `verified:false`) on a sheet whose title block
   says `SCALE: 1:50 @ A3`. The drawing settles it: the gaps between collinear wall
   bands on the bottom wall measure 48.2 pt and on the top wall 85.6 pt, which is
   **850.0 mm and 1510.0 mm at 1:50 (17.6389 mm/pt)** and 1700/3020 mm at 1:100 — and
   850 and 1510 are exactly what the sheet annotates there (`1800H-850W ASW` twice,
   `1200H-1510W ASW`, `1800H-1510W ASW`). Every length and thickness in the artifact was
   therefore twice its real value, including the "median 220 mm wall" that had been read
   as confirmation of brick veneer; 90 mm is a brick leaf.
2. **Walls were read by shape.** Page 6 has 260 filled paths: 50 black (3493.5 pt of
   width — the wall poche), 193 white (6271.6 pt — the background panel behind every
   text label and title-block cell) and 17 cyan (9.3 pt — the pan inside each window
   symbol). All three are closed rectangles of wall thickness, so the old reader read
   the sheet's text panels and window pans as walls. `extract_pdf` now records paint
   mode and fill colour per path (additive; commands and every other field unchanged)
   and `wall_bands` reads a wall only from a **filled dark** band, with documented
   fallbacks to outlines and to shape-only behaviour, and `readMode`
   (`poche`/`outline`/`shape`) recorded in the scene.
3. **The plan region was applied to the wall reader.** The density region on sheet 6
   covered x 161-533 of a plan spanning x 142-1010, so 16 of the 26 real walls were
   thrown away and the survivors were fixtures. With poche evidence the region is the
   extent of the poche (`band_region`) and the paired-stroke reader — 170 bands of
   dimension lines, hatch and fixtures — is not consulted at all. The density region is
   deliberately unchanged for the fallback path, and recorded as a known weakness there.

Result on sheet 6, re-run at 17.6389 mm/pt with `--wireframe` (exit 0): **25 wall runs
all from filled poche**, extent **12.69 x 7.07 m**, thickness min/median/max
**61.9/90.0/90.0 mm**, and **10 openings** instead of 2. The 7.07 m depth matches both
the depth annotated on the sheet and the 7070 mm the residential pack derived from the
page-5 dimension chains (0.2% agreement, a genuinely independent path); the 15255 mm
overall width includes the alfresco strip, which this drawing dashes and does not paint,
so the poche reader correctly does not claim it. All ten openings land on an annotated
width (1510/1510/1510/850/850/870/830/916/1478/2400 mm against `...-1510W ASW`, the two
`...-850W ASW`, `870 @2040`, `820 @2040`, `920`, `1500`, `3900H-2400W`); the 600 mm
`900H-600W ASW` window is still missed and that is stated, not rounded away.

Scene SHA-256 `557d63b8a29f0acbd52bc508af896c68a07111939966c4feac43ddee0317d60d`; the
artifact is committed under
`proof/growth/2026-10-13-plan-trace/steps/wardoo-wireframe-poche/` beside the slice 7
one so the before/after pair is in the repository. Tests: **69 passed, 21 subtests**
(was 58), and the eleven new tests pin the paint rules, both fallbacks, `band_region`
and the extractor's new fields.

**Open defect found and not fixed:** `scale.py` votes 1:100 on a sheet that declares
1:50 and measures 1:50, so any geometric consumer of that vote inherits a 2x error.
`engine.run`'s takeoff on this plan was unaffected because its residential pack reads
dimension *text*. `scale.py` is a frozen producer on the takeoff path, so it was not
touched. Next required step: prefer the declared title-block scale, then run the tracer
with the calibration the engine reports rather than a caller constant.


## 2026-10-13 additive slice 7 — a Wardoo wireframe artifact now exists

Owner `cline-wardoo-wireframe-20261013`, baseline `45631667`. Asked whether a Wardoo
wireframe artifact existed, the answer was no: `public/models/` held caroline,
crown-wharf, designed, redburn and ruffles only, no `wardoo`, and wireframe SVGs existed
for **Caroline alone**. It now exists.

`engine/python/xray/building_svg.py` already converts an `xray.source-building/v1` scene
into wireframe SVGs plus a hashed manifest, and the tracer already emits that schema. The
only missing field was `level`, which `building_svg.included()` switches on, so objects
now carry `'level': 'ground'`. The first export then failed honestly with
`Projection has no geometry` because `building_svg.export` always writes three fixed views
and a single-storey trace has no upper floor. **`building_svg.py` was not modified**;
`plan_trace.export_wireframe` reuses `building_svg.make_svg` and `load_bound_scene`, so
the projection and per-part provenance are the same code the curated models use, and
skips a view that has no parts. Exposed as `--wireframe DIR`.

Artifact committed at
`proof/growth/2026-10-13-plan-trace/steps/wardoo-wireframe/` (under `steps/`, not
`artifacts/`, because `.gitignore` line 573 deliberately ignores
`/proof/growth/**/artifacts/`):
`wireframe-axonometric.svg` (51,817 bytes, 42 parts, 504 segments),
`wireframe-ground.svg` (39,303 bytes, 42 parts, 168 segments),
`wireframe-manifest.json`, and the source scene. Manifest pins source SHA-256
`79126aaa…f59a` and scene SHA-256 `829f4dc0…a544`; each SVG embeds the projection matrix
and per-part `sourceRefs`/`evidenceState` in nested `<metadata>`.

Tests **50 passed / 14 subtests** (was 48), including that only non-empty views are
exported, that every manifest hash matches the file on disk, and that a source PDF whose
SHA-256 does not match the scene is refused before anything is written. Regression
recorded via the detached `regression.ps1`.

Honest limits: the scene is `automatic-approximate` from **one sheet of one storey**
(page 6, no roof page 10), `calibrationVerified` is `false`, openings are still
under-reported at 2, and it is committed under `proof/` rather than `public/models/`
because it is not registered in the app's model catalogue and promoting an unverified
automatic trace to a product artifact is not justified. It contains **no quantities**.
Proof: `proof/growth/2026-10-13-plan-trace/steps/wardoo-wireframe-artifact.md`.

Next: group the glazing rules as a group (slice 6's finding), then re-project — the
wireframe is now cheap to regenerate and becomes the visual check for further changes.


## 2026-10-13 additive slice 6 — render the sheet, then read what it actually draws

Owner `cline-plan-tracer-3-20261013`, baseline `327be504`. Slices 4-5 were heuristics
written without looking at the sheet, and slice 5 proved it by changing nothing. This
slice rendered Wardoo sheet 6 at 1x and the detected region at 6x
(`plan-trace-20261013-fb27c4e1a0d9\sheet6-full.png`, `sheet6-region.png`) and read the
drawing before writing code.

What the drawing does: walls are **solid black filled poche**, not pairs of lines;
windows are a **multi-line symbol inside a gap in the poche**, annotated
`900H-600W ASW` and `1800H-850W ASW`; doors are gaps with their own symbol and label;
hatching is regular (nine runs at ~3-4 pt pitch at `perp 430 pt`, seventeen at a
uniform ~12 pt pitch at `perp 566 pt`).

Two defects followed from that evidence:

1. Poche is **one filled path with many vertices**, and slices 1-5 accepted only
   four-corner quads, so most filled wall structure was discarded. `decompose_rectilinear`
   now tiles any axis-aligned closed path into exact rectangles by vertical slabs with
   even-odd scanline pairing. The old test asserted an L-shaped path was rejected; that
   was the bug, so the test was corrected to assert exact tiling (area 7500, not the
   10000 a bounding box claims).
2. A **window symbol is a wall-thickness rectangle with glazing rules**, which is
   exactly what `wall_bands` accepts — and because it touches the poche either side,
   merging closed the gap that identifies the opening. `symbol_rectangles` now detects
   it and `build_scene` emits it as an opening instead of a wall.

Tests **48 passed / 14 subtests** (was 43). Wardoo sheet 6: rectangles read 219 → **285**,
closed bands 74 → **104**, bands inside region 77 → **94**, symbols **1**, total recovered
wall 64.1 → **65.8 m**, openings 1 → **2**. Scene `sceneSha256 f8756999…09f4`.

**Openings are still wrong and the proof says why.** Only 1 symbol was found in the
region, and the two reported openings are 1435 mm and 1660 mm wide while the annotated
windows are 600 mm and 850 mm — so the two gaps are probably not the windows. Two
false-positive routes were found while testing and are unfixed: two parallel glazing
rules exactly `WALL_MIN_MM` (60 mm) apart pair into a phantom 60 mm "wall", and a symbol
is only recognised when it is a closed rectangle. Proof:
`proof/growth/2026-10-13-plan-trace/steps/plan-tracer-filled-poche.md`.

Next: group the glazing rules themselves (several parallel same-span rules lying along a
wall line are a window whether or not a closed outline exists) and remove them from the
wall candidates as a group, then check each opening's width against its annotation.


## 2026-10-13 additive slice 5 — openings measured along a wall face

Owner `cline-plan-tracer-2-20261013`, baseline `b026d5ac`. Slice 4's multi-piece
pairing broke the length ceiling but dropped openings 3 → 1, because a wall run that
spans several pieces also spans the gaps between them. `open_wall_bands` now also
returns **face gaps** — gaps between two pieces meeting the same face, measured along
the wall rather than between separate bands — and `merge_gaps` unions the band-based
and face-based candidates, keeping the widest report so nothing is counted twice.
The function now returns `(bands, gaps, stats)`.

Tests **43 passed / 14 subtests**; regression **197 passed, 1 skipped**, 223 subtests,
54.69 s. Scene `sceneSha256 206a885f…21e1e`, exit 0.

**This did not fix the openings count, and the proof says so.** Wardoo sheet 6 yields
`face gaps 1`, and that single gap coincides with the one the band-based detector
already found, so `merge_gaps` deduplicated it and the written scene is byte-identical
to slice 4. Openings remain **1** for a dwelling that plainly has many doors and
windows; slice 4's regression is not fixed. Mechanisms caught inside the slice: a
`*groups, mm_per_pt` signature that made a positional call pass `mm_per_pt` as a group,
and the diagnostic script's two-value unpack. Both corrected.

Still not trustworthy: openings under-reported (top open defect); the 1:100
calibration remains `verified: false`; hatch excluded by length threshold; curves and
diagonals skipped; 232 bands outside the detected region; and **no quantities**.
Proof: `proof/growth/2026-10-13-plan-trace/steps/plan-tracer-openings-along-face.md`.

Next: stop adding heuristics and actually *look* at how this sheet draws a door and a
window — render the region and inspect the strokes around a known opening first.


## 2026-10-13 additive slice 4 — one face against many facing pieces

Owner `cline-plan-tracer-2-20261013`, baseline `34aa9b42`. Slice 3 capped the longest
wall at 3.78 m even though 7.79 m runs exist inside a 13.1 m wide region, because each
stroke could take exactly one partner. `open_wall_bands` now processes strokes longest
first, lets a face accept several partners independently per side, forbids two accepted
partners on one side from covering the same stretch, and forbids a stroke consumed as a
partner from later becoming a face. That last rule was caught by
`test_a_stroke_is_never_used_as_both_sides_of_two_walls` during the slice.

Tests **42 passed / 14 subtests**. Regression **197 passed, 1 skipped**, 223 subtests,
25.29 s — now past the 30-second foreground limit, so it runs through
`plan-trace-20261013-fb27c4e1a0d9\regression.ps1` as a tracked detached process with a
600 s deadline and its own stdout/stderr/exit record.

Wardoo sheet 6 across the slices — total recovered wall 47.7 → 52.6 → **64.1 m**;
longest wall 2.45 → 3.78 → **7.61 m**; runs 45 → 41 → **40** (25 h / 15 v); thickness
**70.0/220.0/386.0 mm**; openings 1. Scene `sceneSha256 206a885f…21e1e`.

Why this is progress rather than a bigger number: 7.61 m matches the longest run that
actually exists in the region, so the artificial ceiling is gone; 64.1 m over a
13.1 × 7.8 m footprint is perimeter (≈41.8 m) plus ≈22 m internal, a credible dwelling
shape; and a 220 mm median thickness is textbook brick veneer, an independent sanity
check on the calibration's order of magnitude.

Still not trustworthy: the 1:100 calibration remains `verified: false`, so only relative
geometry is sound; **openings fell to 1** because longer walls now absorb the gaps and
opening detection under-reports; hatch is excluded by length threshold rather than
identified; curves and diagonals are skipped; and **no quantities are produced**. Proof:
`proof/growth/2026-10-13-plan-trace/steps/plan-tracer-face-against-pieces.md`.

Next: measure gaps along each wall run after pairing rather than only between separate
bands, then reconcile the external perimeter against the ≈41.8 m the region implies.


## 2026-10-13 additive slice 3 — run re-join and best-overlap pairing

Owner `cline-plan-tracer-2-20261013`, baseline `e68b9e96`. Slice 2 still had a
1.1 m median wall and a 2.45 m maximum. Measuring the run population explained it:
inside the region there are 1487 runs whose **median length is 0.08 m** — half the
population is hatch, tick and text strokes — while the tail reaches 7.79 m. Only
the first stroke of a candidate pair was length-checked, and the first partner in
the thickness window won regardless of overlap.

Changed in `plan_trace.py`: `open_runs` now re-joins consecutive collinear segments
within a subpath; `open_wall_bands` requires BOTH strokes to be at least
`MIN_WALL_LENGTH_MM` and selects the partner with the greatest overlap. Tests
**42 passed / 14 subtests**; regression **197 passed, 1 skipped**, 223 subtests.

Wardoo sheet 6 across the slices — wall runs 73 → 45 → 41; horizontal/vertical
66/7 → 28/17 → **25/16**; from open pairs 0 → 36 → 32; total recovered wall
167.5 → 47.7 → **52.6 m**; longest wall 6.84 → 2.45 → **3.78 m**; thickness
67.0/180.0/367.0 mm; openings 3. Scene `sceneSha256 ea2aa0d4…37b5`.

A cross-subpath collinear re-join was implemented and then **reverted**: it cut
paired bands 209 → 92, reduced the total to 39.4 m and removed all three openings,
because joining strokes before pairing consumes the gaps that identify an opening.
It was deleted rather than left as dead code.

Still not trustworthy: 52.6 m of wall for a 13.1 × 7.8 m region (external perimeter
alone is ≈41.8 m) so internal walls remain under-recovered; no wall exceeds 3.78 m
although 7.79 m runs exist; the 1:100 calibration is still `verified: false`; hatch
is excluded by length threshold rather than identified; and **no quantities are
produced**. Proof:
`proof/growth/2026-10-13-plan-trace/steps/plan-tracer-run-join-and-pairing.md`.

Next: a wall here is one long face stroke facing several shorter strokes, so pairing
must accept a long stroke against a SET of facing pieces instead of a single partner.


## 2026-10-13 additive slice 2 — plan-region isolation and open double-line walls

Owner `cline-plan-tracer-2-20261013`, baseline `0597cc3b`. Slice 1 produced 66
horizontal against 7 vertical bands spread across the whole sheet, because only
closed quads were read and nothing separated the plan from the title block.

Added to `engine/python/xray/plan_trace.py`: `open_runs`, `plan_region` (density
grid plus largest 4-connected component), `within_region`, `open_wall_bands`
(parallel-stroke pairing) and `drop_regular_arrays` (stair treads, hatching,
dimension ticks). Tests grew from 26 to **40 passed / 14 subtests**; regression
**197 passed, 1 skipped** (pre-existing skip), 223 subtests.

Wardoo sheet 6, before → after: wall runs 73 → 45; **horizontal/vertical 66/7 →
28/17**; from closed quads 73 → 9; **from open double-line pairs 0 → 36**;
excluded outside region 225; excluded as regular array 4; openings 2 → 3;
thickness 64.0/154.3/333.0 mm. Scene `sceneSha256 65593e12…b335`, exit 0.

Independent cross-check: the detector's region is 13.1 × 7.8 m (≈102 m²) while the
engine's residential pack independently derived 15.255 × 7.070 m (107.9 m²) from
page-5 dimension chains — agreement within 6%, from a different code path on a
different sheet. A sensitivity sweep (`plan-trace-20261013-fb27c4e1a0d9\sweep.py`)
keeps the setting at 1.0: 0.50 merges the plan with the other drawings on the sheet.

Defect found and fixed within the slice: the `paired` flag was dropped, so the first
slice-2 scene reported `fromOpenPairs: 0`; a regression test now pins the attribution.

Still not trustworthy: 47.7 m of recovered wall for a ~102 m² footprint under-recovers
internal walls; median wall length is only 1.1 m because openings and crossings break
walls into fragments that are not re-joined; the 1:100 calibration is still
`verified: false`; and **no quantities are produced**. Proof:
`proof/growth/2026-10-13-plan-trace/steps/plan-tracer-region-and-open-walls.md`.

Next: re-join collinear fragments interrupted by openings and crossings so one wall is
one run, then re-measure against the ≈41.8 m external perimeter the region implies.


## 2026-10-13 additive slice — automatic plan linework tracer (first milestone)

Owner `cline-plan-tracer-20261013`. Baseline HEAD
`2b41314d068610e4e8a170dc2dfc3dd84ef7ff39`. Reply to the user's question about the
four existing 3D models: they are hand-authored, per-project and hash-locked
(Ruffles 74 traced / 198 inferred of 272, Caroline 146 traced + 21 dimensioned of
1180, Redburn **0 of 198** traced, Crown Wharf **0 of 2180** traced), and each
declares itself *not automated PDF-to-BIM* and produces no quantities. The missing
capability is the general tracer, which this slice begins.

Added, purely additive (`engine.run`, `source_wireframe.py`, `source_building.py`,
the packs, `job_bom.py` and phase-1 receipts are untouched):

- `engine/python/xray/plan_trace.py` — closed axis-aligned quadrilateral wall bands
  with measured thickness, collinear merging, traced gaps, `xray.source-building/v1`
  emission, `validate_trace_scene`, CLI.
- `engine/python/xray/test_plan_trace.py` — 26 tests + 14 subtests, including a real
  pikepdf end-to-end run.

Executed: **26 passed / 14 subtests** for the new module, and **197 passed, 1 skipped**
(pre-existing skip, 223 subtests) for the rest of `engine/python/xray`, so no
regression. CI already runs `python -m pytest engine/python/xray engine/server -q`,
so no manifest change is needed.

Real Wardoo sheet 6: exit 0, `sceneSha256 fa5e0d0a…1d32`, 73 wall runs / 2 openings /
75 objects, measured thickness 78.5–337.3 mm (median 277.8). **The result is not yet
trustworthy**: 66 horizontal against 7 vertical bands, spread across the whole sheet,
means non-wall closed rectangles (title-block cells, hatching, treads) are still
being captured, open double-line walls are not recovered, and the 1:100 calibration
remains `verified: false`. This is a presentation geometry pipeline milestone, not a
takeoff and not a building reconstruction. Proof:
`proof/growth/2026-10-13-plan-trace/steps/plan-tracer-milestone.md`; raw evidence,
logs and the written scene in
`xray-recovery-evidence\plan-trace-20261013-fb27c4e1a0d9\`.

Next required step: plan-region isolation (reject title block and off-plan geometry),
then recovery of open double-line walls, then re-check the horizontal/vertical
balance against sheet 6 before anything feeds the residential pack.


## 2026-10-13 continuation slice — registered targeted regression on the dirty tree

Owner `cline-continuation-20261013`; exclusive lock at
`xray-recovery-evidence\continuation-loop.lock.json` (acquired 04:41:40 +10:00, released on
completion). HEAD unchanged at `000f60161283aeaebdc996d732766797022bc441`, branch
`recovery/full-studio-20261011`. This slice added **no product source changes**.

Ran the registered targeted unit modules for the currently dirty/added recovery files under
the reviewed hash-pinned 20% aggregate CPU-cap harness (same pattern as
`xray-recovery-evidence\job-engine-reconnect-20261012\run-check.ps1`; helper
`scripts\run-recovery-ledger-check.ps1` hash `30DE7F56…C6F3A0` verified before use, cap
inheritance asserted):

`node --experimental-strip-types --test --test-concurrency=1` over
`src/studio/persistence.test.ts`, `src/studio/projectRecoveryStore.test.ts`,
`src/studio/liveWireframe.test.ts`, `src/lib/sourceGeometry.server.test.ts`,
`src/studio/designedBuildingScope.test.ts`, `src/studio/designedBuildingStore.test.ts`,
`src/studio/industries/roofing/cuttingSchedule.test.ts`, `src/studio/assistant/appTools.test.ts`.

Result (`unit-suite-20261013-c7f30a91b2d4-r2`): **91 tests, 91 pass, 0 fail, 0 cancelled,
0 skipped, 0 todo**, exitCode 0, timedOut false, exited true, 5.437 s. The real Python bridge
test executed (1689.95 ms) with `XRAY_SOURCE_ENGINE_TESTS=1`; **no owned Python process
remained** after completion. Owner/child PIDs 92156/85324/96204/34932 all absent.
`git diff --check` exit 0; working-tree status byte-identical before and after (33 entries).

Retained defect in the first attempt: with `XRAY_SOURCE_ENGINE_TESTS` unset the bridge test
skipped (90 pass / 1 skip). That skip is a **harness configuration omission, not a product
regression** — `src/lib/sourceGeometry.server.test.ts:14` gates on that variable. Attempt 2
corrected the harness and reached zero skips. Evidence (both attempts, logs, owner/exit
records, baseline/after status, `result.json`):
`xray-recovery-evidence\continuation-20261013-c7f30a91b2d4\`.

Scope limit: this is a **targeted 8-module subset on an uncommitted dirty tree** — not the
full registered `src` suite, not typecheck/build, not the native/UI gate, and not engine
qualification. No acceptance flag changes: `testInventoryAuthenticated`,
`executionAuthenticated`, `freshEngineQualified` and `appAccepted` all remain **false**.


## Current slice — artifact consistency and trusted collection

Superseding update, October 12: clean worker `b212a4926b37` and independently
executed verifier `3b9ba15119a4` both passed unchanged source `280c61a0`:
21 preflight tests, 109 preserved sources / four helpers, 25 terminal-record tests,
queried 20% aggregate CPU cap, successful terminal/cleanup/source checks.
Separate proof: `proof/growth/2026-10-11-full-studio-recovery/steps/terminal-prerequisite-executed.md`.
The historical timeout cause is unknown, not reproduced, not claimed fixed.

New additive artifact consistency implementation has clean worker and independent
executed proof at `9cc49c9c94bb22338f2ebae18e900d3b9322b111`:
`scripts/qualification_structure.py`, `scripts/verify_qualification_artifacts.py`,
their two test modules and `scripts/run-artifact-evidence-check.ps1`. It checks
ZIP/extracted source, build artifacts, executable bytes, toolchain metadata,
JUnit, all 18 child steps, six fixtures and eight negatives. It explicitly keeps
execution authentication, full evidence, engine and app acceptance false.
Worker `949c60f956ac` and independent `a98a9486919b` each passed 95 tests
(21 preflight + 25 terminal + 25 structure + 24 artifact), zero skips, real Windows
junction rejection, 109-source/four-helper audit, queried 20% cap, unchanged
11-source hashes, zero exits and observed owned cleanup. Separate proof:
`proof/growth/2026-10-11-full-studio-recovery/steps/artifact-consistency-executed.md`.
Earlier dirty development `efa977a3e23f` is retained, not final proof. No engine/app
acceptance is inferred. Next implementation contract and source-test/skip findings:
`QUALIFICATION-COLLECTION-PLAN.md` (observer component tested; integration open). Trusted collection
and source/test/warning review remain engineering work, not a DANS1 permission issue.

Next additive slice: `scripts/verify_qualification_coverage.py`, its tests and
`scripts/run-coverage-evidence-check.ps1` compare externally pinned declared
inventory with exact JUnit identities, require every in-scope snapshot test module
represented and zero skips/errors/failures. They do **not** authenticate inventory,
map pytest rootdir, prove all functions/parameters collected, or replace artifact
validation. Static review `run_00041` approved this narrow scope. Clean worker
`cda4407665ca` and independent `175274719595` passed 21 preflight + 19 coverage
tests at `0c94244c`, zero skips, queried 20% cap, unchanged nine hashes, zero exits
and owned cleanup. Separate proof:
`proof/growth/2026-10-11-full-studio-recovery/steps/declared-coverage-executed.md`.
Development `b0bd64d1f8f7` is retained separately. The independent short run had no
live external transient-process snapshot; retained handles, self-CIM, exit and job
accounting are documented without overstating observation coverage.

October 12 next component: `scripts/collect_qualification_tests.py`, its tests
and `scripts/run-collection-observer-check.ps1` have clean worker `1a6dbfe4fa50`
and independent verifier `568657937b59` (`run_00052`) proof at
`d553c4803ddcb3d092f1169e2762c3ae82630c49`. Each passed **21 preflight + 25
observer tests, zero skips**, actual pytest 9.1.1 on synthetic fixtures, independent
real JUnit comparison including unittest/parameters, preserved 109 sources/four
helpers, queried 20% CPU cap, ten source/five selected runtime hashes unchanged,
zero exits and owned cleanup. Foreground rehashed all 31 independent evidence files.
Separate proof: `proof/growth/2026-10-11-full-studio-recovery/steps/collection-observer-executed.md`.
Development `6e75f3247aff` is retained separately. The independent run also retained
actual monitor exit 0 and live observations of 11 owned process identities,
including a Python312 synthetic collector child; all were absent after completion.
The exact inventory v1 schema is preserved under a new versioned observer envelope.
This is **not** a real engine-source inventory, authenticated preparation approval,
production collector, full dependency attestation or DANS1 engine qualification.
The new direct pytest.main entry differs explicitly from the preserved producer.

## Previous slice — terminal-record prerequisite

Additive files, leaving the phase-1 runner and qualification producers unchanged:

- `scripts/verify_qualification_terminal.py`: offline, read-only input/owner/exit
  record consistency gate; explicit external run/transfer/source/owner pins.
- `scripts/test_verify_qualification_terminal.py`: synthetic real-file rejection
  regressions, including a successful-looking qualification without owner exit.
- `scripts/run-terminal-evidence-check.ps1`: separate local capped test entrypoint;
  reuses the unchanged reviewed runner by dot-sourcing its preflight gate in the
  same owner, then executes the new tests under its queried 20% cap and containment.

**Not a full qualification validator.** A successful prerequisite deliberately
returns `freshEngineQualified: false`, `fullEvidenceValidated: false` and
`appAccepted: false`. It does not verify executable, archive members, fixture
results, build logs, toolchain, live process cleanup or resources on DANS1.
Legacy `exit.json` has no run ID/owner/hash binding; plausible transplanted exit
records cannot be authenticated. A trusted bound terminal receipt/collection
format and complete artifact validation remain required before actual acceptance.

### Development execution (not clean committed acceptance)

- Initial local run `8c1d51d241f8` was interrupted at the command tool's 30-second
  limit. It has no terminal exit record; its passing prefix is **not acceptance**.
  Its launcher PID 42456 and matching test markers were absent at the subsequent
  observation. Logs remain external, not overwritten.
- Retry `ebc677d7a0a8`: 18 new tests and 21 preflight tests passed; terminal
  exit zero, owner-only accounting and launcher PID 87300 absent after completion.
- Static review `run_00022` found missing source/case binding, 100ns timestamp
  precision loss, weak JSON-negative test setup and runner evidence overclaims.
  Corrected them without weakening assertions or changing historical helpers.
- Revised run `35786c9e6c68`: 22 tests plus 21 preflight tests passed; terminal
  exit zero, launcher PID 83448 absent after completion. Three further rejection
  tests and runner setup-claim corrections now require a fresh rerun.
- Final-file static review `run_00023` approved the bounded prerequisite scope;
  it explicitly did not claim full artifact acceptance or watchdog enforcement.
  No independent executed acceptance is claimed from static reviews.
- Development run `d013bd0a744f` launched PID 62572 at
  `2026-10-12T06:13:39.7827276Z`; it exercises the 25-test revision. The existing
  21 preflight tests passed in 65.641 seconds, but the unchanged preserved-evidence
  check then hit its existing 120-second deadline. Exit 1 at
  `2026-10-12T06:17:15.3570239Z`; owner/observed child processes absent afterward.
  The 25 new tests were not reached. Failure diagnostics remain external; do not
  weaken or extend the established deadline to bypass this result.
- Replaced the wrapper's synchronous Git HEAD subprocess with the reused bounded
  `Run-Check` function (15 seconds). No wrapper-wide hard deadline claim.
- Final runner delta received read-only approval in `run_00024`.
- Implementation checkpoint committed as **`067105e9`**, explicitly WIP. Clean
  committed run `b66c4d708dbe`, owner PID 99724, creation
  `2026-10-12T06:21:11.9183467Z`, hit the existing 120-second `evidence-tests`
  deadline and wrote exit 1 at `2026-10-12T06:23:38.1770378Z`. The 25 new tests
  again were not reached. Launcher PID 99724 was absent at the next observation.
  Prior 18/22-test passes do not prove this final revision. No acceptance claimed.
- A foreground phase-1 `ledger check` invocation also hit the command tool's
  30-second timeout; no fresh successful result is claimed for that invocation.
  Preserved phase-1 status remains 3/3 verified; its source/receipts were not edited.

External evidence parent for these run IDs:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.
Each test run uses `terminal-records-<id>` plus tracked
`terminal-launch-<id>.{owner.json,stdout.log,stderr.log}`.

## Next action

Integrate the tested observer into independently pinned, contained source-ZIP
preparation and separate source/parameter inventory approval; then implement the
separately pinned execution collector and external hard watchdog around unchanged
legacy producers, following `QUALIFICATION-COLLECTION-PLAN.md`. The additive
artifact, declared-coverage and observer components have independent regression proof.
Full source/test inventory and warning/skip review are not established by a
self-consistent bundle. Do not weaken deadlines or assertions.
Use a new immutable local run ID with the following entrypoint; monitor a tracked
bounded supervisor asynchronously because foreground commands time out after 30 seconds:

```powershell
powershell.exe -NoProfile -NonInteractive -File C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\observer-monitor-20261012.ps1 -Repo C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery -RunId <new-12-hex-id> -Actor <worker-name>
```

Launch that command via a tracked asynchronous process, not an unbounded foreground
call. Recheck monitor SHA-256
`b9994350d9482c758b8d7751a2e7a15f2d8729cd2bf5f2a12aef15c0581dab3d`
and supervisor SHA-256
`fcf96e9e3867479035bfb35c202676e1129eeab8c3534a41a88d6319cc906638`
before use. The monitor invokes the inner capped observer runner, retains actual
supervisor exit, and enforces the existing 400/360-second polling budgets; inspect
all terminal/exit/source/log/cleanup evidence. This is a local development harness,
not the still-unimplemented DANS1 collector/hard watchdog.

The new gates are not registered as verified root machine-ledger items. Do not
change the scope/acceptance of completed phase 1 to pretend it covers this work.
Do not call gate 3 or the app complete. Continue trusted terminal binding/collection
and source/test preparation, or
independently reproducible tablet/desktop UI work with fresh capped browser proof.
Follow `FINISH-RECOVERY.md` for remaining gates and `LEDGER.md` for phase 1 only.