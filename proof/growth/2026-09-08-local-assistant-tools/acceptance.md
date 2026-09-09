# Local assistant application tools — implementation and dev acceptance

Application source is stable. This verifies the real local tool implementations and their active UI controller; the parent agent owns MCP SDK transport and conversational integration. These direct tool executions do **not** establish an end-to-end MCP connection or model-driven conversation.

## Public contract

`src/studio/assistant/appTools.ts` exports `appTools: AppTool[]`. Every descriptor has `name`, `description`, a strict JSON Schema `inputSchema`, and `execute(args: unknown): Promise<{content: (text|image)[], isError?: boolean}>`. Invalid arguments and failed actions return `isError: true`; successful messages are produced only after the associated operation succeeds. No SDK dependency is imported by this module.

| Tool | Arguments / scope |
|---|---|
| `read_project_context` | `{}`; current project identity, main revision, source metadata, counts and recovery/save state |
| `navigate_workspace` | `{expectedJobId,pane}`; one of overview/sheets/measure/sketch/components/model/render/review/cost/proof. Sketch selects the actual Architectural workspace UI and waits for its controller. |
| `read_architect_design` | `{expectedJobId}`; real active project in mm, design revision, sheets, stable geometry IDs, pending draft and undo availability |
| `draw_architect_elements` | `{expectedJobId,expectedRevision,operations}`; 1–25 append operations, one validated and saved transaction |
| `undo_architect_change` | `{expectedJobId,expectedRevision}`; real mounted workspace undo history, save and readback |
| `capture_workspace_image` | `{expectedJobId,target:'architect'|'source-building'}`; actual rendered PNG pixels, max1536px, excludes HTML UI |
| `save_project` | `{expectedJobId,expectedRevision}`; actual verified main project record save on this device |

`expectedRevision` is the **design revision** for draw/undo and the **main project revision** for save_project. Read the appropriate context first.

Drawing operations use millimetres and fresh entity identities:

- Wall: `{kind:'wall',ref?,levelId,a:[x,y],b:[x,y],heightMm?,name?,templateWallId?}`. An explicit existing template copies layer properties with new layer IDs. Otherwise the existing unpriced default assembly is used and reported for review.
- Door: `{kind:'door',ref?,wallRef,offsetMm,widthMm,heightMm,tag,hinge:'left'|'right',swing:'in'|'out'}`. Sill is zero.
- Window: the door fields with `kind:'window'` and required `sillMm`.
- Reference line: `{kind:'line',ref?,levelId,a,b}`.
- Room label: `{kind:'room',ref?,levelId,point:[x,y],name}`.

`wallRef` resolves an existing wall ID or an earlier operation ref. All operation refs within one batch are unique. The full proposed project goes through the existing domain validator before any save, including opening bounds, overlaps and unique tags. Existing geometry, materials, sheets and layout IDs are retained. No deletion, arbitrary whole-project replacement, external messaging or external service call is provided.

## Controller integration

New `assistant/architectBridge.ts` holds a lifecycle-guarded registry and pure operation preparation. `ArchitectWorkspace.tsx` registers its actual mounted controller, which calls its existing commit and undo functions. The UI checks active project, expected design revision, recovery/error state, render freshness and unfinished gestures. A successful commit now also compares the stored architectural raw bytes with the expected saved bytes before publishing UI/history success. A mismatched readback blocks editing and retains the open prior design.

The application tool module never writes architecture localStorage itself. Sketch entry uses one click on the existing Architectural workspace navigation button and an acknowledged mounted-controller wait. It does not write a hidden alternate design state or modify Studio.tsx. Pending source trace/calibration points prevent navigation, as do unfinished architectural gestures. The active project is checked again immediately before navigation mutation.

## Executed tests

`node --experimental-strip-types --test src/studio/assistant/appTools.test.ts src/studio/architect/architect.test.ts src/studio/architect/authoredSheetSet.test.ts`

**44 tests passed**: 13 new tool/bridge tests plus 31 existing architecture/sheet tests. The final added capture guard rechecks project identity after waiting for renderer pixels and refuses to return an image if the project changed. `node node_modules/typescript/bin/tsc --noEmit` passed after the final source edit. No full local build or installation was performed.

Unit cases cover strict schemas, status reporting, valid/stale/recovery-blocked navigation, preservation of pending source and architectural gestures, a project switch during asynchronous inspection, verified save/failure reporting, invalid draw/undo rejection before controller dispatch, an atomic mixed-geometry batch, invalid opening rollback, stable authored sheet preservation, explicit template copying, controller disposal/replacement and actual-canvas export/empty-render rejection.

## Actual browser evidence

Fresh isolated session `growth-local-app-tools-final`, dev8080,1440×1000:

- Full flow **38 commands passed**, exit0,3.8773908s. Runner `proof/growth/runner/2026-09-07T21-04-08-163Z-growth-local-app-tools-final.{json,log,scenario.json}`. Scenario `app-tools-final.json`, SHA256 `8bf49b90f95bae86ed18806ef96573703402622208edb725db183c26e5acec71`.
- Additional real unfinished-gesture and silent-write-readback guards: **12 commands passed**, exit0,0.3594848s. Runner `proof/growth/runner/2026-09-07T21-05-59-695Z-growth-local-app-tools-final.{json,log,scenario.json}`. Scenario `app-tools-failure-guards.json`.

The flow read the current project, navigated through the tool into the active Architectural workspace, created two authored sheets using UI controls, then used a single tool batch to add four walls, one door, one window, one reference line and one room label. Actual design reads and UI revisions confirmed the geometry and unchanged sheet collection. Stale revision and oversized door calls returned errors without altering saved bytes. Tool undo removed that batch through real UI history; the normal Redo button restored it. Main project save returned verified success.

An architecture-key-only quota fault made a valid tool draw fail without changed bytes. Normal storage was restored; navigating away/back reopened the unchanged saved design, and retry saved the new line. A real unfinished wall gesture separately blocked both navigation and drawing. Escape cancelled it through the UI. A silent setItem no-op was then detected by readback verification and did not report success; reopening recovered the same saved revision and geometry. Faults were removed in the isolated fixture; no normal user data was involved.

Browser error output is empty. Console contains the pre-existing Three.js PCFSoftShadowMap deprecation warning, with no uncaught runtime error. No paid model, voice or external messaging call was made.

## Actual PNG and visual inspection

The final tool-returned PNG was decoded from its result, signature-checked and inspected: `screenshots/growth/local-app-tools-final-actual-capture.png`,550×495,102204bytes, SHA256 `670df289ec6914a72d3af4f6b50c50de0f14b4f7c5264bea15058c5fcd720d6a`. Metadata identifies rendered design revision3/frame4. The image visibly contains the generated four-wall room and hosted door/window. It is renderer output, not a mock screenshot. Capture includes the viewer's presentation ground; this batch did not add a physical slab or roof.

Also inspected:

- `screenshots/growth/local-app-tools-final-drawn-model.png`: actual 2D plan and 3D geometry, saved revision3.
- `screenshots/growth/local-app-tools-final-retry.png`: saved revision6, added reference line and existing design retained.
- `screenshots/growth/local-app-tools-pending-gesture-preserved.png`: actual pending wall gesture remains while tools refuse to overwrite it.

Earlier failed proof attempts remain: the first script used an invalid top-level-await evaluation; the second navigated to Sketch but initially lacked automatic architectural subworkspace entry. A manual-entry21-command resume passed before the navigation adapter was completed. The final38-command run above uses automatic tool navigation and supersedes those incomplete runs.

Limits: no new full-project transaction lock across browser windows; current storage comparison/readback and expected revisions remain enforced. Undo history is the existing mounted-session history and resets when reopening. After a failed architecture save, navigate away/back or use the UI's saved-design recovery before retrying tools. Live capture was verified for Architect; the shared source-building selector path has no new source-viewer smoke in this slice. No production/native/tablet acceptance or LLM/MCP transport acceptance is claimed here.
