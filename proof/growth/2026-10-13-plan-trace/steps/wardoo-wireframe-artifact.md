# Wardoo wireframe artifact — from traced scene to SVG

Owner: `cline-wardoo-wireframe-20261013`. Baseline `45631667` (slice 6).
Still additive: `engine.run`, `source_wireframe.py`, `source_building.py`,
`building_svg.py`, the trade packs and phase-1 receipts are unchanged.

## The answer to "do we have a wireframe artifact of Wardoo?"

**It did not exist, and now it does.** Before this slice:

* `public/models/` held `caroline`, `crown-wharf`, `designed`, `redburn`, `ruffles`
  — **no wardoo**, and `Test-Path public/models/wardoo` was False.
* Wireframe SVGs existed for **Caroline only** (`wireframe-axonometric.svg`,
  `wireframe-ground.svg`, `wireframe-upper.svg`, `wireframe-manifest.json`).
* The Wardoo evidence held browser screenshots and `result.json` from the takeoff
  run, but no projected geometry of any kind.

## Why one line of code was all that stood in the way

`engine/python/xray/building_svg.py` already turns an `xray.source-building/v1` scene
into wireframe SVGs plus a hashed manifest. The tracer added in slices 1-6 already
emits exactly that schema. The only missing field was `level`, which
`building_svg.included()` switches on to choose the storey views, so objects now carry
`'level': 'ground'`.

The first attempt then failed honestly:

```
xray.source_building.BuildingError: Projection has no geometry
```

`building_svg.export` always exports three fixed views, and a single-storey trace has no
upper floor. `building_svg.py` is a producer for the curated models, so it was **not
modified**; instead `plan_trace.export_wireframe` reuses `building_svg.make_svg` and
`load_bound_scene` (so the projection, edge filtering and per-part provenance are the
same code the curated models use) and skips a view that has no parts. Exposed as
`--wireframe DIR` on the tracer CLI.

## The artifact

`proof/growth/2026-10-13-plan-trace/steps/wardoo-wireframe/`

| File | Bytes | Parts | Segments |
| --- | --- | --- | --- |
| `wireframe-axonometric.svg` | 51,817 | 42 | 504 |
| `wireframe-ground.svg` | 39,303 | 42 | 168 |
| `wireframe-manifest.json` | 880 | — | — |
| `wardoo-sheet6.scene.json` | 39,008 | — | — |

Committed under `steps/`, not `artifacts/`, because `.gitignore` line 573 deliberately
ignores `/proof/growth/**/artifacts/` - generated artifacts are not tracked by this
repository's convention. It is also deliberately **not** under `public/models/`, which is
the app's model catalogue.

Manifest, verbatim:

```json
{
  "schema": "xray.building-wireframe-manifest/v1",
  "sourceSha256": "79126aaa2a59dfb835d840e9cbfb97225b2d905046ed6505db27aaabc191f59a",
  "sceneSha256": "829f4dc0e61f83f0ec1a49b1a8fa8220c1d86383b3e9568bc6412611c463a544",
  "outputs": [
    {"file": "wireframe-axonometric.svg", "sha256": "b2b5a1504f84966a2448009d43ef3131fb97a89cac38b082655a2bf22cc21976", "parts": 42, "segments": 504},
    {"file": "wireframe-ground.svg", "sha256": "3aed8a34f1527f98bb97ee26bfc649e1bd7074a7237ed6ccdfd46f46d83cb20e", "parts": 42, "segments": 168}
  ]
}
```

Each SVG carries `<title>`, `<desc>` and a `<metadata id="source-provenance">` block with
the PDF SHA-256, the scene SHA-256, the projection matrix and the projected bounds. Each
part group carries `data-part-id`, `data-category`, `data-level` and a nested metadata
block containing that part's `sourceRefs` and `evidenceState`, so a reviewer can put any
drawn edge back on sheet 6.

## Executed evidence

| Check | Result |
| --- | --- |
| `python -m pytest xray/test_plan_trace.py -q` | **50 passed, 14 subtests**, 0.51 s (was 48) |
| Regression (detached `regression.ps1`) | recorded in `regression.stdout.log` |
| Wardoo CLI with `--wireframe` | exit 0, both views written, manifest hashes verified against the files |

New tests: the exporter writes only views that have geometry; every manifest hash matches
the file on disk; and a source PDF whose SHA-256 does not match the scene is rejected by
`load_bound_scene` before anything is written.

## Honest limits of this artifact

1. **It is `automatic-approximate`, from a single sheet.** `calibrationVerified` is
   `false` in the scene and in the CLI output, so every dimension in it inherits the
   1:100 paper-size assumption.
2. **It is one storey, one sheet (page 6).** No upper floor, no roof (page 10), no other
   sheet. The manifest says so by containing only axonometric and ground views.
3. **It is 42 parts, not 42 walls.** The same under-recovery documented in slices 4-6
   applies: openings are under-reported at 2, and windows may still be absorbed into
   wall runs.
4. **It is committed under `proof/`, not `public/models/`.** It is not registered in the
   app's model catalogue and is not shipped as a project model. Promoting it there would
   present an unverified automatic trace as a product artifact, which is not justified
   yet.
5. **It is presentation geometry. It contains no quantities.**

## Next required step

Group the glazing rules as a group (slice 6's finding, still unimplemented), then
re-project. The wireframe is now cheap to regenerate, so it becomes the visual check for
every further tracing change.
