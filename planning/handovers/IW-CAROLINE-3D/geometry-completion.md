# IW-CAROLINE-3D geometry completion packet

2026-09-05. **Owned geometry and regression tests completed; final integrated WebGL review is pending.** This packet does not promote canonical ledger, UI integration, deployment or construction readiness. Caroline supersedes Ruffles as the user's requested building. This work continued in the retained thread because the parent reported the fresh-thread limit was exhausted; this is a standalone handover, not a fresh-chat claim.

## Source and result

User source: `C:/Users/danie/Downloads/Caroline - Blueprints and Renderings - 2025-08-08.pdf`. Exact workspace copy: `engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf`; public copy: `public/models/caroline/source.pdf`. All share SHA-256 `f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb`, 4,169,029 bytes, 19 pages of 1584 x 1224 points.

Actual Python CLI emits `public/models/caroline/source-building.json`: **34 wall runs, 28 openings, 7 planar roof surfaces, 2 floors and 1,180 source-linked meshes**. Final scene SHA-256: `c8451663dcb5430dfe7fdaa0dec40e31785c3943eb7c9b4d9ad3ccc28d23e0f8`; 2,122,749 bytes. Files/hashes/counts in `proof/audit/IW-CAROLINE-3D/geometry/geometry-manifest.json`.

The model includes the source's main two-story 24 x 16-foot nominal body, lower wraparound porch, kitchen/screen-porch rear wing, side office and downstairs bathroom annexes, upstairs bedrooms/bath/hall/closets, source windows/doors/shutters, 14-riser winder staircase, real stair aperture, raised closet platform, porch turned posts, clapboard reveals, shown cabinets/fixtures, main gable and lower roofs, conditioned crawlspace perimeter and annex piers. It does not reuse Ruffles coordinates or roof masses. Only the generic triangulation and error primitive are imported from `xray.source_building`; there is no import-time Ruffles geometry generation.

## Source authority and explicit approximations

Page 5/6 floor plans and page 7/8 elevations supply the actual layouts and openings. Page 4 supplies roof/foundation outlines; page 9 sections resolve vertical datums; page 12 supports opening details; pages 13–18 provide visual comparison. Author and CC BY-SA 4.0 attribution are present in source metadata and visible UI integration.

Second floor +9 ft = 2.7432 m; main eave +17 ft 6 in = 5.334 m; ridge +23 ft = 7.0104 m. Main pitch is 7.5:12; lower roofs 3:12. Main roof width is the source's approximate 25-foot label. Pitch plus the 5-ft 6-in ridge rise imply 17.6-foot roof depth including overhang, 1.2 inches more than the rough 17-ft 6-in roof-plan label. The source says section/floor dimensions take precedence over the rough roof plan; this reconciliation is explicit in scene assumptions. No silent 16-foot-span pitch forcing is used.

Manual floor trace has about one point (17 mm) tolerance. In particular, the nominal 16-foot body depth traces as 287 points versus the 288-point nominal dimension; its label and tests retain this approximation. Colours, wall thicknesses, lower roof attachment heights, foundation depth, detailed shutter/post profiles and stair handrail are presentation assumptions. Roof object evidence is inferred, with separate dimensioned datum/pitch refs. No verified takeoff quantities or building-code certification are produced.

The upper floor opening is page-6 x603..665, z548..640. Slabs and room overlays leave that aperture empty. Raised closet platform sits beyond z640, 36 inches above the upper floor as shown. An initially inferred upper railing was removed because it obstructed the winder landing; a sloping stair-side handrail remains. The illustrated porch has no invented guardrail. Alternate basement/slab foundations and every other design on page 19 are excluded.

## Executed tests and observed visual correction

`proof/audit/IW-WIREFRAME/geometry-tests.json` records the latest actual Python process exit 0: **11 Caroline geometry tests and 8 SVG tests passed in 1.151 seconds**. Earlier nine- and ten-test records are retained as history. Tests verify exact source/public-copy identity and mismatch rejection; finite, index-valid, nondegenerate geometry and original page coordinate bounds; upper floor datum and disclosed nominal trace tolerance; all 7 roof meshes coplanar with correct pitches; gable vertices meeting the roof; genuine stair aperture and all 14 riser elevations; all 28 wall openings clear of wall meshes; invalid opening rejection; and source-backed foundation supports. Attempt 01 retains a test harness exact-float comparison mismatch (2.7432 versus 2.7432000000000003), fixed using numerical comparison, not altered geometry.

The UI agent supplied actual initial WebGL captures `screenshots/industry-real-3d-viewer/caroline-first-roof.png`, `caroline-first-ground.png`, `caroline-first-upper.png`. This geometry agent independently inspected all three against actual source pages 5/6/13/16. Exterior and both layouts are recognizable and source-specific. Concrete fixes since those first captures: close gable-to-roof gap, reduce roof width to source 25-foot span, add missing crawlspace/annex support geometry, correct roof source refs/evidence state, align stair opening and remove the obstructing inferred railing. Therefore those initial captures are **superseded for final acceptance**.

Latest source/scene assets are frozen. UI agent was notified to reload the exact 1,180-part version, then capture rear orbit and an angled whole-building roof-off view showing stairs through the upper aperture, and rerun its build/browser gates. Root independently owns final visual approval. Do not use software painter projections as proof of clean 3D visibility.

`ground-trace-overlay.png` and `upper-trace-overlay.png` overlay wall runs/openings directly on source pages 5/6; the upper overlay marks the real stair aperture in cyan. All source contactsheets and page renders are in `source-review/`; `inventory.json` records initial source metadata.

## Owned paths and reproduction

Owned implementation: `engine/python/xray/caroline_building.py`, `engine/python/xray/test_caroline_building.py`, `engine/fixtures/caroline-source-trace.json`, the exact Caroline source fixture, public/models/caroline, and this geometry/source-review evidence. Existing generic `source_building.py` supplies only `triangulate` and `BuildingError`; its original Ruffles building remains historical and visually partial.

Reproduce with trusted Python and PYTHONPATH=engine/python: `python -m xray.caroline_building engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf --trace engine/fixtures/caroline-source-trace.json --out public/models/caroline/source-building.json`. Test command: `python -m unittest xray.test_caroline_building -v`. Builder/tests add no third-party dependency. Actual PDF PNG rendering uses the prior isolated PDFium installation.

No auth, Supabase, credentials, migrations, external AI/API, global installation, unknown binary, staging or commit was performed or needed. UI/registry changes belong to `/root/audit_engine_release`; historical staging/ledger changes belong to their separate owner. Parent/root owns final proof and acceptance. No unrelated repository files were changed by this Caroline geometry slice.

## Final narrow corrections before wireframe export

Actual rear WebGL review revealed an open triangular wedge above the kitchen/screen-porch rear wall. The added rear gable cap now meets both actual lower roof planes, with four source-backed siding reveals. Its regression checks the closure vertices against both roof surfaces. Source pages 8 and 17 support the closure; attachment elevation remains explicitly approximate.

The user front-stair screenshot exposed reversed tread elevations. Front entry blocks now join the deck at its edge and -0.025 m datum, then descend away at -0.230 m and -0.435 m. All blocks extend to the existing illustrative ground datum -0.64 m. The first block is a flush landing extension, with three equal 0.205 m risers from that landing to the ground. Traced width/run and inferred equal heights are labeled separately. A monotonic-distance/height test proves the direction, deck connection and ground support. UI owns placing the presentation ground at the existing minimum datum; this does not change building floor elevations. Final closeup and rear WebGL review remain pending.

The source scene is frozen at the hash above. Python SVG exports are a separate additive slice described in `planning/handovers/IW-WIREFRAME/geometry-completion.md`.
