# IW-VISUAL-SETTINGS — standalone completion handover

## Current state and authority

2026-09-05. Implementation and author verification finished; final submission awaits parent-bound approval and delivery. This is the retained `/root/audit_engine_release` thread, not a fresh-context claim. Root is orchestrator and independent reviewer; `staged_delivery` owns Git and the live proof HTML. The user requested desktop-only proof, source-linked Caroline 3D, Solid/Wireframe, restored left navigation, editable vector exports, silver controls, visual settings and a true zoom scope. Auth, database and external service integration remain off.

Branch is `feat/model-wireframe-navigation`, checkpoint `6803da9d20906c2c304435e55b98c8e71668f4ea`; current HEAD and dirty disclosure are recorded in `proof/audit/IW-REAL-3D-VIEWER/final-writer-packet.json`. This author did not stage, commit or push. Other agents share this workspace. Keep the 42 production/provenance input files frozen until the delivery proof gate and review are bound.

## Delivered behavior

- `SourceBuildingViewer.tsx` renders genuine Three.js triangle meshes from strict `xray.source-building/v1` JSON. The real Caroline PDF is imported through the existing inspection and binary persistence pipeline, rehashed, then matched to its curated reconstruction. Ordinary Open plan resolves the same original. Unrelated input removes the prepared model; invalid input preserves the previously verified original.
- `sourceBuilding.ts` validates bounded source identity, geometry, source regions, categories, floors, attribution and allowlisted model assets before rendering. Original source bytes are rehashed, not trusted from a caller flag. The PDF worker correction in `documents.ts` supports real compressed Ruffles and Caroline PDFs; focused tests cover both and malformed page trees.
- Solid / Wireframe is a visible toggle. Wireframe uses actual mesh edges, omits coplanar triangle diagonals and repeated clapboard/louver marks, includes concealed X-ray edges, clips wall edges for cutaway and highlights selected edges without opaque fills. Camera, floor, roof, cutaway and selection remain unchanged when toggling.
- Persistent left Models / Sheets navigation uses the actual 19-page source. Page labels and prepared thumbnails are guarded by the matching original SHA. Actual page 5 and page 6 render original bytes, and Model returns with its source and view options. Source attribution and per-part drawing evidence remain visible.
- Ground/upper/whole-building filters, plan/orbit, roof group, cutaway, explode, fit, selection and PNG are functional. Visible-level bounds fit the selected floor. Whole-building cutaway coherently selects ground instead of leaving an opaque floating upper floor.
- `buildingAppearance.ts` and `BuildingVisualSettings.tsx` provide 12 presets, cycle, custom background/wire hex and colour controls, wire opacity, solid lighting/shadows, reset and local preferences. Required grey/white, black/gold and white/graphite presets are present. Buttons use neutral chrome/silver rather than green. Appearance changes preserve actual camera and source geometry.
- ModelScope is independently authored by `/root/scope_zoom`: an actual cloned-camera cropped render, not a scaled screenshot. This viewer integrates a visible Scope toggle, 2/4/8x, 160–360px diameter and Escape state. Pointer leave hides it; camera stays steady; demand rendering stops while idle. Perspective and orthographic rendering work. Scope is inspection chrome, not baked into model PNG.
- PNG exports actual main-scene pixels plus attribution. SVG downloads use the Python-generated fixed axonometric/ground/upper vector files. The browser verifies scene/source identity, adapts only background/stroke/text/opacity, preserves vector paths and provenance, and labels the fixed projection. It does not pretend the fixed export matches an arbitrary orbit, cutaway or exploded view.

## Source model and independent ownership

Actual PDF SHA: `f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb`.
Final Caroline scene SHA: `c8451663dcb5430dfe7fdaa0dec40e31785c3943eb7c9b4d9ad3ccc28d23e0f8`, 1,180 source-linked parts. Python/trace/model/SVG ownership belongs to the geometry agent, not this UI author. Final model includes the source-shown rear closure, stair aperture and corrected descending front steps. Geometry/SVG author and independent root tests total 19 passing tests; details are in geometry handovers. Source attribution is Jay Osborne / FreeFarmhouse, CC BY-SA 4.0.

Ruffles remains a clearly separate historical sample with declared incomplete roof/solar fidelity. It is not the user's building. These models are curated, preliminary reconstructions, not automatic arbitrary-PDF semantic conversion, verified engineering geometry, quantities or construction documents.

## Final validation and exact proof

`final-writer-packet.json`, `final-source-files.json`, `final-screenshot-manifest.json`, `current-branch-code.patch` and `cumulative-viewer-code.patch` are under `proof/audit/IW-REAL-3D-VIEWER/`. The current branch patch is against checkpoint `6803da9`; the cumulative viewer patch is against old UI commit `bf1f20e`. They include the independently owned scope module for complete integration review; attribution remains separate.

Commands executed:

- `node proof/audit/IW-REAL-3D-VIEWER/gates.mjs build`: exit 0; log `build-2026-09-05T10-17-06-844Z.log`. This wrapper deletes DATABASE_URL only in the child. The actual build log proves migration skipped for missing URL. No database migration was performed.
- `node proof/audit/IW-REAL-3D-VIEWER/gates.mjs typecheck`: exit 0; log `typecheck-2026-09-05T10-17-07-746Z.log`.
- `node proof/audit/IW-REAL-3D-VIEWER/studio-tests.mjs`: 284 tests passed, 0 failed; `studio-tests-2026-09-05T10-17-13.641Z.log`.
- Run each of `browser.mjs`, `visual-browser.mjs`, `detail-browser.mjs`, `stairs-browser.mjs` in this proof directory with the dev or built origin. All final reports bind the identical 42 current inputs and verify unchanged hashes at completion.

Final DEV reports (relative to proof directory):

- `run-2026-09-05T10-18-54-717Z/results.json`: source identity/import/rejection/persistence and geometry controls, 19 raw pass entries.
- `visual-2026-09-05T10-24-00-293Z/results.json`: 14 passed visual settings, export, decoded page navigation and scope cases.
- `detail-2026-09-05T10-22-34-357Z/results.json`: 6 passed actual solid lighting/shadow pixel, wireframe cutaway and offline cases.
- `stairs-2026-09-05T10-25-12-297Z/results.json`: 1 passed fresh unobstructed low-front stair capture.

Final BUILT reports:

- `run-2026-09-05T10-19-51-224Z/results.json`.
- `visual-2026-09-05T10-24-11-364Z/results.json`.
- `detail-2026-09-05T10-22-48-311Z/results.json`.
- `stairs-2026-09-05T10-25-23-578Z/results.json`.

All final reports have zero uncaught browser errors. There are 40 raw pass entries per environment, but the old base report's stair-closeup case is superseded by the low-front report: **39 accepted scoped checks per environment**, not 40 distinct product features. The original `02e-front-stair-closeup.png` images are preserved but excluded from current accepted gallery because roof geometry occludes the steps. Use low-front `03-stair-scope.png` instead.

Screenshots live under `screenshots/industry-real-3d-viewer/` in the report timestamp folders. The final manifest contains current source-bound screenshots. Root independently accepted required palettes, full SVG render, chrome controls, 4x scope, both floors, closed rear, high rear aperture, corrected low-front steps and decoded actual page 6. Root's acceptance must be bound to the final packet by the delivery agent; this author does not self-approve.

The downloaded custom SVG PNG in each visual folder is a rendering of exact downloaded bytes through an explicit test-only localhost response, not a new application endpoint. Raw SVG downloads and model PNG downloads are preserved in their matching report/screens directories. The SVG is genuine vector geometry; the screenshot documents its appearance.

## Limited offline result

Fresh browser import and reload work with all external internet requests blocked while localhost is running. An already loaded scene still supports wireframe, scope and PNG after all browser networking is disabled. This does not verify installed offline cold-start, service-worker completeness, or fetching unloaded pages/models/SVG after localhost is unavailable. External fonts/platform chrome were intentionally blocked in this bounded test.

## Preserved errors and corrections

- Initial real compressed-PDF import failed due missing worker configuration; fixed narrowly and verified in actual browser as well as tests.
- Source/roof/floor fitting and incorrect normalized dimension display were corrected before this final source freeze.
- Vite previously crashed with EBUSY while watching a locked downloaded PNG. Narrow generated screenshots/planning-control ignore rules preserve the dev server through repeated real downloads/reloads.
- Early visual test attempts had a hidden export button beneath the open settings panel, an invalid XML-document `setContent` harness operation and an incorrect page-caption selector. They are retained as failed harness attempts. One run overlapped HMR edits and logged document errors; frozen final runs are clean.
- Root caught a page6 screenshot taken during preparation despite the correct selected heading. Final visual runs wait for changed image URL, decoded image and source-ready state before capture.
- Root caught the high-angle stair lens magnifying occluding porch roof; final low-front actual lens clearly shows the descending risers and landing. Do not reuse that superseded high-angle proof as successful stair geometry evidence.
- Build emits existing large-chunk and Node shell-wrapper deprecation warnings; no build/typecheck/runtime errors remain in the bounded tested slice.

## Resume and external handoff

Dev is left running via `npm.cmd run dev` on 0.0.0.0:8080 in owned exec session `48335`. Built preview was restarted after the final build via `npm.cmd run preview`, owned session `53622`, at 127.0.0.1:8081. Do not kill unrelated listeners. Tracker8097 and Python8098 belong to other agents. Existing startup contracts remain intact; current source only added Vite watcher ignores, not launcher changes.

Next agent starts with this handover and the exact final writer packet, verifies branch/current hashes, then consumes the eight reports and selected screenshot manifest. Delivery must embed current images in the localhost HTML, apply the reviewed 42-input proof gate, attach parent independent approval and stage only explicit reviewed source/proof paths. Exclude npm-cache and repetitive superseded screenshot runs from normal delivery; keep historical failures locally and references truthful. No Supabase, auth, API keys, database, OS installation, mobile work or external deployment is required for this slice. Further offline-install support, arbitrary-PDF reconstruction and historical broader audit defects remain separate work.
