# Wardoo sheet 6 — rule-confirmed window gaps

## Requirement and scope

Follow-up to the Cline plan-trace audit: recover the two missed 600W gaps and
the 610W gap on Wardoo sheet 6. This is an engine/source-geometry slice only;
it does not close the T-01 UI journey for deliberate sheet rotation and reload.

## Source change

Implementation commit: `d6589897c97b922677c7372d9919f7ecd3a6bf55` on
`codex/takeover-wardoo-plan-trace`. It changes:

- `engine/python/xray/plan_trace.py`: keep short, dark wall fragments as gap
  boundaries only when the gap is 500–1200 mm and at least two interior,
  paired line tracks cover at least 80% of it. Long paired wall outlines may
  bound the gap. The measured gap width is retained; window assembly geometry
  and vertical heights remain inferred.
- `engine/python/xray/test_plan_trace.py`: verify a 600 mm gap with two paired
  interior rules is recovered and that one line/one pair does not create one.

The preceding calibration commit is
`d8f0f26a812376e9b5905411c5908067c52ff2a6`. It makes the CLI use verified
per-page engine scale and recovers the split Wardoo title-block scale as 1:50.

## Executed checks

- `python -B -m pytest -q` from `engine/python`: **263 passed, 1 skipped,
  237 subtests passed in 31.72s**. Full output is retained at
  `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\opening-audit-20261013-5d9ac0e1c287\pytest-windows-20261013-final.txt`.
- Ran `python -B -m xray.plan_trace "C:\Users\danie\Documents\LOT 31 WARDOO STREET REV H.pdf" --page 6 --out <scene> --wireframe <directory>` with no caller-supplied scale. Exit code 0. The engine reported 1:50, `17.638888888888886 mm/pt`, calibration verified, 25 wall runs, 13 openings, 3 rule-confirmed windows, and 38 objects.
- The source PDF SHA-256 is `79126aaa2a59dfb835d840e9cbfb97225b2d905046ed6505db27aaabc191f59a`.
- `validate_trace_scene()` passed. An independent comparison confirmed all 25 wall meshes are unchanged from the calibration artifact and all 10 prior openings remain. The added measured gaps are **600 mm, 600 mm, and 610 mm**, with paired interior rule evidence.
- The wireframe manifest’s source and scene hashes match the PDF and scene. Both SVG hashes match the manifest.

## Artifacts

- [Wardoo sheet 6 scene](wardoo-sheet6.scene.json) — SHA-256
  `bebdac1a76f87630583d589b20e5752df1324179194d2ea54c28e56ee5fd52e2`.
- [Ground wireframe](wireframe/wireframe-ground.svg) — 38 parts.
- [Axonometric wireframe](wireframe/wireframe-axonometric.svg) — 38 parts.
- [Wireframe manifest](wireframe/wireframe-manifest.json) — binds the source,
  scene and SVG outputs.

## Limits

The trace remains `automatic-approximate`, not a coordinated CAD/BIM model or
quantity takeoff. Wall height and opening head/sill heights are presentation
assumptions. The prior 830 mm symbol on the bathroom wall remains as a separate
candidate next to the newly recovered 600 mm gap; this slice does not resolve
whether those neighboring parallel marks are two wall layers of one assembly.
No application UI screenshot was captured; the generated SVG files are the
visual artifacts for this step. T-01 remains partial until the deliberate
rotation-and-reload UI journey is exercised.
