# IW-WIREFRAME geometry and vector export packet

2026-09-05. Python vector implementation and executed regressions are complete; actual browser SVG review is pending. Interactive Three.js wireframe, palette/navigation UI and its browser gates belong to the UI owner. This packet does not claim the whole slice is complete.

The explicit user correction was that the wireframe step had been skipped. This work adds real native SVG paths derived from the curated Caroline meshes, rather than embedding a shaded image. The user later requested a checkpoint and new branch; work paused, then resumed after verifying `feat/model-wireframe-navigation`. The earlier checkpoint was local, with its push blocked as reported by root. No git operations are owned by this agent.

## Fixed geometry and source

Input `public/models/caroline/source-building.json` remains SHA-256 `c8451663dcb5430dfe7fdaa0dec40e31785c3943eb7c9b4d9ad3ccc28d23e0f8`: 1,180 meshes, 34 wall runs, 28 openings, 7 roof faces and two floors. It includes the corrected closed rear annex gable and front steps descending away from the porch. No geometry changed during SVG implementation.

Exact source `engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf` has SHA-256 `f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb`. The exporter verifies that PDF hash against scene metadata before writing. This is projection of source-specific curated geometry, not an arbitrary PDF-to-model claim. Ruffles remains historical and visually partial.

## Files and reconstruction

Implementation: `engine/python/xray/building_svg.py`; tests: `engine/python/xray/test_building_svg.py`. The independent exporter uses Python's standard library plus the existing `BuildingError` exception; it adds no dependency or service. Both scene and PDF reads are bounded to 32 MiB.

With trusted Python and `PYTHONPATH=engine/python`, run:

```text
python -m xray.building_svg public/models/caroline/source-building.json --source engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf --out public/models/caroline
python -m unittest xray.test_building_svg xray.test_caroline_building -v
```

Public output URLs and exact raw asset hashes are recorded in `public/models/caroline/wireframe-manifest.json`:

| SVG | Parts | Segments | SHA-256 |
| --- | ---: | ---: | --- |
| `/models/caroline/wireframe-axonometric.svg` | 388 | 6,025 | `1eac6901f937dcfc3000a0f50635c42b1e91155ec2d83ac07975715e293a282f` |
| `/models/caroline/wireframe-ground.svg` | 235 | 1,678 | `70c4cd984feb105224d4b12c402e4d5b18fed4f4b30b40373af99f8ba327e183` |
| `/models/caroline/wireframe-upper.svg` | 141 | 564 | `0c5e8d1fcfa51cee62746367c8b1171006edd5df9a660624adbe9d450b501d3c` |

## Drawing policy and editable provenance

Coincident vertices are welded at six decimal places in metres. Mesh edges shared by coplanar triangles are removed with a one-degree crease threshold. Remaining edges are orthographically projected and collapsed/duplicate projected segments are removed within each part. The axonometric uses unit orthogonal projection axes; floor exports use X/Z. All views declare their exact projection matrix, 100 SVG units per projected metre, fitted translation and metric bounds.

These are X-ray drawings: concealed architectural edges remain visible. They are not hidden-line elevations or construction documents. Room colour overlays and repetitive clapboard, louver and flashing details are omitted for legibility; source geometry remains intact. Ground and upper exports select the corresponding explicit part level. Each source part remains an individually editable SVG group with its exact `data-part-id`, category, level, label, evidence state and original page references. Group DOM IDs are deterministic hashes of the part ID.

Global `metadata#source-provenance` preserves both hashes, source attribution/license and projection metadata. UI palette adaptation may change only `g#building-edges` stroke, `rect#drawing-background` fill and visible `text[data-palette-role="text"]` fill. Paths and provenance remain untouched. Such a styled download has different bytes from the raw asset hashes above and must be described as a presentation adaptation. Source attribution remains Jay Osborne / FreeFarmhouse, adapted under CC BY-SA 4.0.

## Evidence and remaining integration gate

`proof/audit/IW-WIREFRAME/geometry-tests.json` records actual process exit 0: eight SVG tests plus eleven geometry tests, 19 passed in 1.151 seconds. It verifies real slab edge preservation and diagonal removal, exact roof perimeter preservation, malformed mesh rejection, byte-identical regeneration, source mismatch rejection, exact per-part provenance/floor filtering, valid native XML paths, no raster embeds and finite in-canvas coordinates. Tests compare real Caroline meshes and exported assets, not a substituted synthetic house.

Actual browser captures of all three SVGs are requested from the UI owner and await independent visual review. Final stair closeup and rear gable WebGL captures also remain integration evidence owned by UI/root. Do not use prior pre-correction screenshots as final acceptance.

No external AI/API, credentials, auth, Supabase, migration, deployment, global installation, staging or commit was performed or needed. Root owns orchestration and final acceptance; the UI agent owns `startup.md` and UI evidence; this geometry packet is separate to avoid concurrent edits.

Root review caught hardcoded Caroline attribution in the otherwise generic exporter. Visible title now derives from source title/name, author and license from source metadata, and the footer page list from actual included part references. An additional test substitutes alternative metadata on the same real meshes and checks that no Caroline/Jay Osborne attribution survives. Root requested this bounded implementation handoff without waiting for UI captures; final actual SVG visual inspection is explicitly delegated to root. No visual acceptance is claimed by this packet.
