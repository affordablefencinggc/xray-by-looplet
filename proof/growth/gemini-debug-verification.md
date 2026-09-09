# Gemini execution debugging ? 2026-09-09

Request: run 100 tests and debug the false blockers.

## Executed results
- Baseline: 291 assistant tests passed. Final: 294 tests across 10 suites passed, zero failures. Three new regression cases cover completion beyond eight tool rounds and confirmed wireframe/solid selection including failures and project switching.
- TypeScript typecheck and scoped ESLint exited 0. Generated manual check passed. Native expected instruction byte fixture updated; Rust/native and full production builds were not run.
- Three real Gemini sends in isolated browser project job-40cf434a-9c10-4624-b496-e7151e8081b9. First plain-language concept request supplied no coordinates or tool recipe. Gemini independently called read, navigation, design read, structure read, draw, project read, save and show-model. It created revision 2 (6 walls, 1 door, 1 L-shaped slab, 2 flat roof zones and 1 label). Then the old eight-round loop threw and marked the packet blocked before inspection/final response.
- Loop now permits 12 rounds, retaining the 24-call and request-size guards. A deterministic regression reproduces the former cutoff and now completes nine calls plus final response.
- The model tool previously had no wireframe selector. Added optional displayMode, selecting the existing UI and confirming the scene digest, pressed button and renderer display mode. First integration test exposed a nonexistent design-revision canvas attribute; fixed binding to the actual scene digest. Failed run retained in runner logs.
- Final real provider send restored the saved model, read it, selected wireframe, captured the actual canvas and replied with an inspection. Successful tool order: read_project_context, navigate_workspace, read_architect_design, show_design_in_model, capture_workspace_image. Packet review-required, no uncertain action. Captured all-inferred model, not verified engineering.
- Independent acceptance verified revision 2 persisted across reload, 6 walls/1 opening/2 flat roofs, 27 square metres of authored L-shaped slab, intact task hash chains and successful wireframe receipt/render. Final 11-command browser batch passed: runner/2026-09-09T10-42-17-777Z-gemini-debug.json. Initial resize checks ran before renderer resize; corrected reactive wait, retained failed logs.
- Desktop/tablet screenshots inspected. Panel stays in bounds. At tablet width the existing wrapped viewer toolbar obscures part of the model; bounds checks do not establish ideal tablet usability. No uncaught browser errors.

## Changes
conversation.ts and test: 12-round execution window. appTools.ts and test: verified display selection, honest pencil-animation and approval descriptions. SourceBuildingViewer.tsx: scene digest telemetry separate from source hash. workbenchStructure.ts: remove obsolete no-move/no-delete claim and distinguish unavailable authority. Context budgets/app/skills atlases and generated manual: match current runtime. Native byte fixture updated. Exact task diff: gemini-debug.diff.

## Limits
This proves a small original concept and recovery/display workflow. It does not prove Dubai reconstruction quality, engineering verification, every possible provider prompt or the pasted 13-sheet state. Tests include fixtures; 294 is not 294 paid Gemini runs. No source calibration, source hashes or professional approvals were changed. No deployment/installation. Test browser closed; see gemini-debug-cleanup.json. User sessions preserved.
