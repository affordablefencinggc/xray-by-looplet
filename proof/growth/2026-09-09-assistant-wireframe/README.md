# SC-08 — Assistant draws wireframes (development proof, 2026-09-09 01:55–02:05)

Daniel (2026-09-09): "the assistant should be able to do anything the user askes it too !! expecialy draw wire frames" / "can the assistant understand our structure/logic and draw wireframe?"

## What changed (code.diff, 534 lines)

- `src/studio/assistant/architectBridge.ts`: `draw_architect_elements` batches accept five new operations beside wall/door/window/line/room — `level` (new storey; its `ref` can be used as `levelId` later in the batch), `slab`, `roof` (per-edge pitch, gable indices, eaves; fascia/gutter defaults), `footprint` (closed wall loop on one level, one wall per edge) and `extrude` (footprint repeated over N storeys: new levels stacked on the base or on top of the existing storeys, walls per storey, optional slabs, optional top roof). Everything still goes through the append-only draft and `validateProject`; IDs and revision rules unchanged; assembly notices preserved.
- `src/studio/assistant/workbenchStructure.ts` (new): `WORKBENCH_STRUCTURE` (units, panes, architectural entities, wireframe operations, source-building schema/catalog, evidence states, sample firewall, and an explicit `notAvailableThroughTools` list) plus `loadCatalogScene` / `summariseSourceBuilding` (part summary in metres without meshes, filtered by storey/category, evidence counts).
- `src/studio/assistant/appTools.ts`: JSON schema for the new operations; tool description says how a multi-storey wireframe is drawn; two new read tools `read_workbench_structure` and `read_source_building` (project-bound, forwarded through the port; `SourceBuildingViewer.tsx` untouched).
- `src/studio/assistant/skills.ts`: the two read tools added to the permission-free VIEW set. `ASSISTANT_OPERATING_MANUAL` unchanged (native parity test still passes).
- Tests: new `wireframe.test.ts` (8 tests: level/footprint/slab/roof batch, 3-storey extrude, invalid geometry, structure tool + permission policy + schema kinds, source-building tool binding, scene summary) and the tool-count update in `appTools.test.ts`.

## Machine proof

- `node --experimental-strip-types --test wireframe.test.ts appTools.test.ts skills.test.ts conversation.test.ts architect/architect.test.ts` → tests 56, pass 56, fail 0 (`tests.log`).
- `tsc --noEmit` → exit 0 (`typecheck.log`).
- eslint on the touched files → one remaining error at `appTools.ts:73` (`error ? reject(error) : resolve()` in `openArchitectWorkspace`) which is pre-existing at HEAD and not part of this diff (`eslint.log`; blame check in the walkthrough entry). New files lint clean.

## Human proof (Fast CDP, own dev server 127.0.0.1:8091 with the user-authorized `.env.local` Gemini key, real provider `gemini-3.8-flash`)

- `desktop.scenario.json` (1280x800, runner `2026-09-08T16-00-00-400Z-wireframe-desktop`, exit 0, 37 commands): fresh project (0 walls · 1 level) → Sketch → Architectural workspace → assistant with "Allow drawing edits" ticked → one message asking for a 3-storey 20 m × 12 m wireframe with slabs and a hip roof on the existing ground level. The model called `read_project_context`, `read_architect_design`, `read_workbench_structure`, one `draw_architect_elements` (extrude), `read_architect_design`, `read_project_context`, `save_project`, then answered with the level/wall summary. Saved design: revision 2, levels Ground 0/2700, Level 2 3200/3200, Level 3 6400/3200, 12 walls, 3 slabs, 1 roof, extent 20000 × 12000 mm; UI strip "12 walls · 0 openings · 3 levels · Saved · revision 2". Reload → same design restored ("12 walls · 0 openings · 3 levels"). Screenshots `desktop-01-before`, `desktop-02-wireframe-3d` (3D hip-roofed three-storey block, all levels), `desktop-03-after-reload` — inspected.
- `tablet.scenario.json` (1024x768 in the same session, runner `2026-09-08T16-01-23-451Z-wireframe-desktop`, exit 0, 23 commands): one message "add one more storey … then undo". The model drew (revision 3) and called `undo_architect_change` (revision 4); design back to 3 levels / 12 walls; UI strip "Saved · revision 4". Screenshots `tablet-01-wireframe-3d`, `tablet-02-after-add-and-undo` — inspected.
- Two provider messages in total, both user-authorized; nothing else sent. Browser errors: none in either run.

## Process hygiene

Dev server 8091 (PID 44140, started 01:59) stopped at 02:02 through `cleanup-dev.ps1` (identity-checked, `dev-cleanup.json`); sessions `wireframe-desktop` and `wireframe-tablet` closed. The other chat's dev server 8080 and sessions were not touched. Failed first attempts (cold-server open timeout; tablet run in a fresh profile with no design) are preserved in `proof/growth/runner/` and were fixed by warming the server and by running the tablet scenario in the desktop session (shared storage).

## Remaining (not claimed)

- Dans1 build + production preview + Windows-native runs of these journeys (as for SC-06) — not started; this is development proof only.
- Undo after a page reload is not available (session history only), as the tool already states.
- The wireframe lives in the Architectural workspace's live 3D model; drawing into the Model viewer (source reconstruction) is intentionally not offered and is listed under `notAvailableThroughTools`.
- `read_source_building` was proven by unit tests with a fixture scene, not against a catalogued scene in the browser.
