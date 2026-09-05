# Precision scope handover

Approved user request: three posts (left, right, bottom), wheel zoom isolated to the circular scope, precise sketch/drawing/measurement through the lens, palette cycle inside Visual settings.

Baseline: 1a10a3be3b01fddcbd4ed92391b5c6010ffc7cb0 on feat/model-wireframe-navigation. Parent released source writes after prior proof commit. Worker owns scope, viewer/settings, PlanCanvas/DocumentPreview and minimal Sketch source wiring; no Git, canonical ledger, package or root mount edits.

- SC-01: shared three-post reticle and circular wheel routing; preserve main model camera.
- SC-02: fixed 2D scope with explicit Place scope, inverse pointer mapping before source coordinate projection; redraw actual vector overlays, compose actual source image.
- SC-03: route Sketch to verified source preview and retain source calibration/read-only guards.
- SC-04: real desktop use cases and before/after screenshots; parent reviews before completion.

Before: own CUA Edge tab 2025846181, http://127.0.0.1:8080/?pane=model, actual Caroline 1180 parts, four-arm 4x scope and palette cycle outside settings inspected before writes. Dev server initially unavailable, restored by root. No mobile testing. No external/Supabase work required.

Source raster remains bounded by existing PDF renderer (maximum 4096 pixels / 16 MP); magnification does not invent source detail. Overlay vectors are freshly rendered at scope resolution. Quantity formulas and source calibration authority remain unchanged.

## Current implementation and review

Implemented shared three-post reticle, circular wheel routing, continuous 2–8x zoom synchronized with Visual settings, palette cycle inside settings, 3D cursor hide/restore, and prepared picker hidden after source/model match. Solid and Wireframe remain adjacent chrome buttons.

Implemented fixed 2D lens with explicit Place scope: placement click is consumed, drawing/calibration/vertex input passes through the same inverse lens transform and original source viewport. Snap and hit-test tolerances account for magnification. Source/page change resets the focus. Sketch now previews actual imported source rather than procedural HOUSE/PLAN. Locked calibration and legacy source restrictions remain in force.

Parent additionally authorized Overview cleanup: removed unrelated Stage model, replaced with original DocumentPreview, real record counts, project source identity and next-action navigation. No new Overview component or dependency.

Tests: typecheck passed. Scope tests 15/15, including mounted capture listener, inactive/outside-circle forwarding, unchanged source camera, cursor restoration and cleanup. Precision tests 4/4 include CSS/DPR/edge inverse mapping, circular wheel bounds, three posts and actual store commit point/metric equality. Existing canvas/source tests passed (16 additional checks; combined 35). These are local machine checks; final browser proof remains pending.

Independent browser QA found a maximum update depth loop. Fixed the cause: default calibrationPoints=[] allocated every render and retriggered the new drawing callback effect; default now uses stable module constant. Awaiting clean rerun. Do not treat earlier diagnostic report as passing.

Own CUA after showed the three-post reticle and removed external palette trigger. Subsequent CUA navigation/wheel was intercepted by Agentation mode in shared profile, so those attempts are not accepted functional proof. Independent QA uses isolated contexts for exact wheel/camera/source-point assertions.

Existing issue discovered: sketch markups are memory-only, because job hydration reconstructs run/gate markups. Parent notified; no store/domain changes made without ownership. Do not claim sketch survives reload until resolved and verified.
