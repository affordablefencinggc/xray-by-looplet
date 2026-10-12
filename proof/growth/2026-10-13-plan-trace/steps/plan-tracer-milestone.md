# Automatic plan linework tracer — first milestone (13 October 2026)

Owner: `cline-plan-tracer-20261013`. Branch `recovery/full-studio-20261011`.
Baseline HEAD `2b41314d068610e4e8a170dc2dfc3dd84ef7ff39`.

## Why this exists

Four 3D models already exist (Ruffles, Caroline, Redburn, Crown Wharf), but each is
a **hand-authored, per-project, hash-locked** reconstruction. Their own metadata says
so: Ruffles and Caroline declare *"not automated PDF-to-BIM"*, Redburn records
**0 of 198** traced objects and Crown Wharf **0 of 2180**, and
`engine/python/xray/source_building.py` states that it *"deliberately does not
classify arbitrary PDF drawing paths as walls"*. None of them produces a quantity.

This slice adds the missing general capability: a tracer that reads a plan's own
vector linework and emits the **same** `xray.source-building/v1` contract, so the
existing viewer, evidence and validation plumbing applies unchanged.

## What was added (purely additive)

| File | Purpose |
| --- | --- |
| `engine/python/xray/plan_trace.py` | Automatic tracer: closed axis-aligned quadrilateral wall bands, measured thickness, collinear merging, traced gaps, scene emission, schema validator, CLI |
| `engine/python/xray/test_plan_trace.py` | 26 tests + 14 subtests over the geometry rules, the validator and one real pikepdf end-to-end run |

Nothing was modified in `engine.run()`, `source_wireframe.py`, `source_building.py`,
the trade packs, `job_bom.py` or any phase-1 receipt. The extractor is reused as-is.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **26 passed, 14 subtests passed**, 0.26 s |
| `python -m pytest xray -q --ignore=xray/test_plan_trace.py` (regression) | **197 passed, 1 skipped** (pre-existing skip), 223 subtests, 20.21 s |
| Real Wardoo CLI run, sheet 6 | exit 0, scene written, `sceneSha256 fa5e0d0a…1d32` |

CI already runs `python -m pytest engine/python/xray engine/server -q`, so the new
module is collected without a manifest change.

## Real result on the user's plans (LOT 31 WARDOO STREET REV H.pdf, page 6)

```
wallRuns 73   openings 2   objects 75
thicknessMm  min 78.5   median 277.8   max 337.3
calibration 1:100 (35.2778 mm/pt) — VERIFIED: FALSE
```

Sheet 6 carries 5,495 paths / 15,487 segments. Of 5,565 closed subpaths, 219 were
axis-aligned quads; 9 were too thin, 61 too thick and 75 too short, leaving 74 raw
bands and 73 merged runs. Two collinear gaps (655 mm, 1660 mm) were recorded as
traced openings.

## Limits — read before trusting any number

1. **The calibration is not verified.** 35.2778 mm/pt comes from the engine's own
   paper-size prior for an A3 sheet at 1:100 (`methods: ["paper-size"]`,
   `verified: false`). Every real-world length inherits that assumption. The scene
   records this and the CLI prints `calibrationVerified: false`.
2. **The extraction is skewed and partly wrong.** 66 horizontal bands (148.9 m)
   against only 7 vertical bands (18.5 m) is not a plausible floor plan. The bands
   spread across x 18–1146, y 26–823 of a 1191×842 sheet, so **non-wall closed
   rectangles are being captured** (title-block cells, section hatching, stair
   treads) and there is no plan-region isolation yet.
3. **Open double-line walls are not recovered.** 5,235 of 5,565 subpaths are open,
   and only closed four-corner quads are read. Real CAD plans draw many walls as
   parallel open lines; those are currently invisible to this module.
4. **Curves, diagonals and anything non-orthogonal are skipped**, not approximated.
5. **No quantities.** Nothing here is a takeoff, and `wallRuns`/`openings` are
   presentation object counts, not measured building elements.
6. `source_building.validate_scene` is deliberately **not** used: it also enforces a
   fixed 1191×842 page box and a minimum of 100 objects, which only hold for the
   curated models. `plan_trace.validate_trace_scene` re-implements the same schema
   invariants without those two rules, rather than fabricating objects to pass.

## Next required step

Plan-region isolation (reject the title block and off-plan geometry) plus recovery
of open double-line walls, then re-check the horizontal/vertical balance against
sheet 6 before any of this feeds the residential pack.
