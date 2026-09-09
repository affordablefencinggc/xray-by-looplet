# Production MCP/UI acceptance - build 4e6d1ebd3a62

Executed against `http://127.0.0.1:8093/` in isolated persistent browser `growth-takeover-production-mcp`. The exact build identifier was checked in the DOM and is visible in the inspected screenshots. No app source edits, production bundle modifications, provider turns, external messages or normal-profile writes were performed.

## Results without duplicate totals

| Run | Result | Evidence |
|---|---|---|
| Design/save/reopen | All 53 commands passed in 3.373 s | [Scenario](production-mcp-ui-01-design.json), [result](../runner/2026-09-08T03-38-40-998Z-growth-takeover-production-mcp.json), [log](../runner/2026-09-08T03-38-40-998Z-growth-takeover-production-mcp.log) |
| Assistant initial | First 16 commands completed; command 17 failed on an incorrectly escaped newline in test JavaScript | [Preserved scenario](production-mcp-ui-02-assistant.json), [failed result](../runner/2026-09-08T03-38-55-402Z-growth-takeover-production-mcp.json), [failed log](../runner/2026-09-08T03-38-55-402Z-growth-takeover-production-mcp.log) |
| Assistant corrected resume | All 62 commands passed in 3.241 s: remaining 61 original commands plus explicit build assertion | [Resume scenario](production-mcp-ui-02-assistant-resume.json), [result](../runner/2026-09-08T03-39-52-121Z-growth-takeover-production-mcp.json), [log](../runner/2026-09-08T03-39-52-121Z-growth-takeover-production-mcp.log) |
| Final visible refusal screenshot | All 7 commands passed in 0.548 s; screenshot-only supplementary evidence | [Scenario](production-mcp-ui-refusal-visible.json), [result](../runner/2026-09-08T03-42-03-488Z-growth-takeover-production-mcp.json), [log](../runner/2026-09-08T03-42-03-488Z-growth-takeover-production-mcp.log) |

The intended 53-design-command and 77-assistant-command journeys are covered across these runs. There was not a single clean 77-command assistant run. Do not count the failed runner's declared 77 commands as passed, or add the resumed 61 commands to them again. The six-command earlier supplemental screenshot run checked the right failure data but scrolled to the guide rather than the failure card; that image is retained and superseded by the explicitly visible refusal above.

## Verified application behavior

The real Architectural workspace UI loaded the Courtyard demonstration, drew and persisted a reference line without changing its existing walls, undid/redid it, and reopened the exact saved project. A second edit/undo after reopening was saved and reopened again. Job `job-85937198-55c5-4ab0-8ff7-0f6164d27c6f` retained identity; final saved design revision 7 contains five demo walls and one QA reference line. Persistence comparisons read the actual architecture record; all design writes used the UI controller. The only direct QA storage write was a sessionStorage expected-state marker.

The production assistant discovered ten tools through actual MCP: nine local app tools plus web_search. Known local `/draw`, `pause drawing` and `/draftsman` commands exercised MCP playback/status without provider inference. Play immediately returned active=true and a real status. Pause and live status were confirmed. The real Close Draftsman mode button removed the dock; the subsequent MCP status returned active=false/status=null. `/draw` in Sketch failed honestly and left the architectural workspace open, without implicit navigation.

At 1440x1000, the panel and right rail measured 400 px wide; panel bottom was 914 px and composer bottom 901 px. At 1024x768, the responsive inspector wrapped to full width and the assistant matched 1024 px, with panel bottom 682 px and composer bottom 669 px. The tablet assistant is therefore a full-width overlay, not a narrow sidebar. Composer placement stayed fixed while guide/capability content scrolled. Measured assistant buttons met 44 px targets. Shift+Enter inserted a newline, and the unsent draft survived collapse/reopen. No regular message was submitted.

The provider is explicitly shown as unconfigured and voice unavailable in this preview. Local MCP remains connected and functional. No live AI response, paid search or voice claim is made. Browser uncaught-error checks were empty; an existing Three.js warning counter is visible and is not described as zero console messages.

## Images actually opened and inspected

- `screenshots/growth/takeover-production-mcp-ui-drawn.png`: Courtyard model and selected saved reference line, revision 3.
- `screenshots/growth/takeover-production-mcp-ui-reopened.png`: same persisted model and line after both reopen cycles; build identifier visible.
- `screenshots/growth/takeover-production-mcp-assistant-desktop.png`: 400 px panel, actual discovered tool list and pinned composer. The prepared model is still loading in the background; this is assistant layout evidence, not a model-ready claim.
- `screenshots/growth/takeover-production-mcp-assistant-tablet-guide.png` and `...tablet-scroll.png`: full-width tablet panel, guide/capability scroll and stable composer; the open overlay covers the underlying navigation.
- `screenshots/growth/takeover-production-mcp-playback.png`: playback paused promptly at approximately 1% datum-grid phase. Sparse construction marks and zero visible meshes at this early phase are intentional; this image is not full-building wireframe proof.
- `screenshots/growth/takeover-production-mcp-unmounted-refused-visible.png`: actual failed MCP result and honest assistant reply are readable above the composer, with Sketch retained.

The earlier unmounted-refused images were also inspected but displayed older conversation/guide content; they are not the final visual evidence for the refusal.

## Scope boundary

This establishes production **MCP playback/status** and production **UI geometry save/reopen/undo**. Geometry dispatch through MCP was verified in development, not through this production UI-only run. No dev-module imports, minified-export discovery or injected application test hooks were used. Unknown/unsupported raw MCP dispatch, native acceptance, production live-provider inference and blueprint/PDF exports remain outside this slice. Root owns the separate release/native/export evidence.

Session released at 1440x1000, Sketch Architectural workspace, assistant collapsed. Application source remains frozen.
