# Author-complete submission - independent QA pending

Parent: /root. Worker: /root/precision_scope. Baseline 1a10a3be3b01fddcbd4ed92391b5c6010ffc7cb0. No Git writes. Final browser acceptance belongs to /root/main_pages_qa; control/source binding belongs to /root/precision_delivery. Source is frozen pending reproducible QA failure.

## Implemented surfaces

- Shared three-post reticle (left, right, bottom), adaptive contrast, exact circular wheel hit test, finite 2-8x magnification. Actual secondary Three render remains tone-mapped; main camera untouched by lens wheel. 3D cursor hidden only while lens visible; restored on exit/disable.
- Measure and Sketch fixed precision lens. Place scope consumes one placement click. Subsequent clicks inverse-map enlarged lens pixels back to original source coordinates. Main page wheel resumes outside circle, including bounding-square corners. Exact draw crosshair remains in 2D; it is not an arrow over the 3D aiming point. Normal source image and vector evidence render through the same drawing pipeline. Cosmetic handles do not become huge while magnified.
- Palette cycle moved inside Visual settings; continuous scope slider and existing 12 presets/custom controls preserved. Prepared-building selector hidden after match; model rail stays authoritative.
- Source Sketch uses actual DocumentPreview with locked-scale/legacy guards. Overview now original source and real evidence summary, not unrelated demo Stage. Central diagnostics/new header plan selector integrated from delivery-owned components. Capabilities text reflects actual current scope.
- Viewer publishes actual rendered camera, view options, verified original SHA and scene SHA to delivery-owned bounded session snapshot. Studio invalidates snapshots on active original change. Render brief uses this contract; no image generation claim.
- Optional v2 source annotations persist exact sketch/area points, page, source ID/SHA and coordinate-space marker. Delete persists. Source-page annotation requires non-null original SHA. Source page selection and component names persist. Existing formulas unchanged.
- Optional inactive per-document evidence packages preserve calibrations, runs, gates, reciprocal photo links, annotations, legacy BOM lines, quote draft, review history/status and last page. Original verified bytes load before atomic switch. Pending trace/calibration and stale async selection reject visibly. Import archives old evidence instead of clearing it. Owned preview URLs revoke after successful source change.

## Source ownership manifest

Modified: src/studio/ModelScope.ts, ModelScope.test.ts, BuildingVisualSettings.tsx, SourceBuildingViewer.tsx, IsoCanvas.tsx, DocumentPreview.tsx, Studio.tsx, domain.ts, store.ts, bomStore.test.ts.
New: src/studio/precisionScope.ts, precisionScope.test.ts, PlanScope.tsx, planScope.css, documentWorkspaces.ts, documentWorkspaces.test.ts.
Delivery owns WorkspaceDiagnostics/ProjectPlanSwitcher/workspace-shell/diagnosticsBuffer and modelViewSnapshot/RenderStudio; Agentation worker owns root overlay/packages. Do not conflate ownership with final integrated input manifest.

## Executed checks

- npm.cmd run typecheck: pass.
- node --experimental-strip-types --test src/studio/*.test.ts: 306 passed, 0 failed, 47 suites. Log proof/audit/IW-PRECISION-SCOPE/studio-tests.log.
- Owned tracked git diff --check: pass.
- Six document-workspace tests cover distinct locked scales, exact source points, gate/photo reciprocity, history/legacy BOM/quote, A-B-A durable JSON roundtrip, missing/tampered bytes rollback, pending/stale rejection, page/SHA corruption, real store sketch/area mutation/deletion/component/page persistence.
- BOM regression proves retained successful snapshot becomes source-invalidated history, pending is canceled, late completion rejected.
- Mounted ModelScope test covers real listener registration/circle routing, unchanged main camera, cursor restoration, listener disposal. Shared math tests include DPR, translated/scaled canvas, clamped edges and actual store persisted points.
- Independent diagnostic proof prior to freeze proved inside/outside wheel for both modes and inverse-mapped calibration/run + run reload. Final fresh dev/built acceptance required after expanded storage/header integration. Earlier HMR warnings and old large-handle PNGs are diagnostic, not final completion proof.

## Limits and next handover

Original PDF magnification uses bounded raster resolution (4096 max dimension / 16MP); it does not invent missing pixel detail. Vector evidence redraws at lens scale. Model is source-specific curated approximate reconstruction, not arbitrary-PDF automatic BIM. No photoreal generation was added.

Photo links belong to their source evidence package. A global cross-document photo-link model was not introduced. Legacy inactive documents without an archived package restore empty; no guessed recovery. Legacy source coordinates remain read-only. Engine bomState keeps one retained historical snapshot with source invalidation; per-document engine snapshot history is not implemented. This differs from each package's preserved legacy job.bom/quote fields. Installed-app offline cold start was not verified in this slice.

No external/Supabase work is required. Final QA must test actual two-document IndexedDB switching/reload and exact sketch persistence, refreshed scope handle/cursor screenshots, Agentation dev-only absence in built output, actual camera brief export, central diagnostics/header/capabilities layout, and clean dev/built console. Root/delivery must embed exact local screenshots and result links in HTML before marking items complete. No source formatting after proof hash freeze.

## Exact 28-file integrated implementation ownership

Precision worker (16):
1. src/studio/ModelScope.ts
2. src/studio/ModelScope.test.ts
3. src/studio/BuildingVisualSettings.tsx
4. src/studio/SourceBuildingViewer.tsx
5. src/studio/IsoCanvas.tsx
6. src/studio/DocumentPreview.tsx
7. src/studio/Studio.tsx
8. src/studio/domain.ts
9. src/studio/store.ts
10. src/studio/bomStore.test.ts
11. src/studio/precisionScope.ts
12. src/studio/precisionScope.test.ts
13. src/studio/PlanScope.tsx
14. src/studio/planScope.css
15. src/studio/documentWorkspaces.ts
16. src/studio/documentWorkspaces.test.ts

Delivery worker (8):
17. src/studio/WorkspaceDiagnostics.tsx
18. src/studio/ProjectPlanSwitcher.tsx
19. src/studio/workspace-shell.css
20. src/studio/diagnosticsBuffer.ts
21. src/studio/diagnosticsBuffer.test.ts
22. src/studio/modelViewSnapshot.ts
23. src/studio/modelViewSnapshot.test.ts
24. src/studio/RenderStudio.tsx

Agentation worker (4):
25. src/components/AgentationOverlay.tsx
26. src/routes/__root.tsx
27. package.json
28. package-lock.json

Typecheck pass was directly observed in tool output; final root gate should save its own timestamped raw log bound to all 63 inputs. The complete studio test output is retained at the path above. Author implementation is complete, but independent acceptance/screenshots and final control manifest are still pending.

## Confirmed QA defect correction - drawing precedence and transactional Move

Independent real Area capture starting on an existing selected run handle proved a product defect: editing hit tests intercepted an explicitly active drawing tool. Corrected in IsoCanvas.tsx/Studio.tsx with regression input tracingCanvas.test.ts (29th integrated implementation file; control manifest now 65 inputs).

Active drawing wins after calibration and explicit pan/Place scope. MeasurePane owns Select/Move/Insert state; inspector choices exit drawing. Select selects without changing coordinates. Only explicit Move permits drag. Insert uses existing Insert after action with clear helper. Active drawing helper discloses that it overrides stored edit mode.

A multi-event Move gesture now uses local transient point preview, rendered in both main plan and lens; no durable run changes during pointermove. Pointerup commits exactly once through existing moveRunVertex. Source ID/SHA, page, original run revision and original point must still match. Escape, pointercancel and source/page changes discard preview; stale/invalid/no-op release does not commit. No store schema/formula changes. Single Undo restores pre-drag geometry; Redo reapplies final point.

After correction: full studio 308/308 pass, typecheck pass, three owned diff checks clean. Updated raw suite log: proof/audit/IW-PRECISION-SCOPE/studio-tests-pointer-fix.log. Nine tracing-canvas tests include overlap area preserves exact run, eight preview steps with one revision/Undo/Redo, and cancel/stale/source SHA/page/no-op rejection. Actual browser acceptance must restore original overlapping Area case, Select drag no mutation, eight-event Move one revision/Undo/Redo, and Escape-before-release cancellation. Source refrozen after this handover update; do not write proof handovers while dev QA is actively rendering.
