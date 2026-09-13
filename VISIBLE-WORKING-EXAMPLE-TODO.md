# Visible working example and deeper interaction tests
- [x] Reopen saved takeoff example and move a traced endpoint, verify quantity change and undo.
- [x] Reproduce endpoint snapping losing to extension; add failing regression and fix.
- [x] Verify corner snapping in Edge, finish a closed room, window, slab and room tag (revision 17, 21.468 m²).
- [x] Automated UI: draw four joined walls, insert door/window/slab, tag the closed room, inspect schedules and quantities; 41/41 operations in development and compiled build.
- [x] Save actual UI-created design backup and plan/3D screenshots.
- [x] Retain the completed room in Daniel's saved QA project; reopened in Edge.
- [ ] Drawing export: schedule download started but remained a .crdownload; completion not verified.
- [x] Typecheck/build and focused checks for source fix; record limitations and cleanup.
User asked to continue tests and show something actually working. Original Terrace Court remains unchanged; test project is QA — basic drawing and takeoff.

## Sheet 3 and MiniMax follow-up
- [x] Reproduce assistant unable to read the imported PDF; connect the active source to its file reader with byte/hash validation.
- [x] Read the actual Sheet 3 through MiniMax; approve a separate inferred draft, save 10 walls and 7 room tags on a new level (revision 18).
- [x] Keep the original QA room and imported source unchanged.
- [x] Add source/model comparison and a visible “Ask assistant to draw this sheet” action; inspect in Edge.
- [x] Typecheck and 33 focused tests; 19/19 development comparison operations.
- [x] Final compiled-build comparison verification: 19/19 operations on DANS1 build 07fd5df6fefb; owned browser/tunnel/preview cleaned up.
- [ ] Faithful PDF-to-geometry reconstruction: MiniMax's text-only draft is inaccurate and lacks openings; this is not qualified.
- [x] Fix duplicate browser module stores; 35 focused tests, 10/10 browser identity/navigation operations, build 491b4ea42782 and 19/19 final compiled comparison operations passed.
- [x] Activate the retained side-by-side tab in this PC's Edge browser.
- [ ] MiniMax repeats checks after completion; stopped the redundant response. Drawing remains saved.

## 2026-09-13 ? NCC archive, compact chat and continuity

- [x] Private standards archive uploaded and byte/hash readback verified; local search and reference selection exercised in Edge.
- [x] Actual MiniMax-M3 library search completed without project edits.
- [x] One-row assistant controls and History handover; reload, draft, hide-during-response and original-history restoration verified.
- [x] 57 focused tests and DANS1 web build/typecheck passed; compiled UI inspected and controls exercised.
- [ ] Hosted/native authenticated standards access and OCR for 26 empty pages remain open.
- [ ] Full Sheet 3 reconstruction remains unqualified; partial Python WIL drawing saved at revision 19 with assumptions.

Recovery: proof/growth/2026-09-13-ncc-library/README.md and changes.patch; build 4449a46a6959. Branch feat/architect-cad-engine, uncommitted.

- [x] 2026-09-13: NCC search results grouped by document with clickable page pills; removable, refresh-persistent composer references and actual MiniMax source delivery verified in Edge. Eleven tests and DANS1 web build/typecheck e4b7c3253bff passed. Recovery: proof/growth/2026-09-13-ncc-pills/README.md and changes.patch. Uncommitted on feat/architect-cad-engine.
