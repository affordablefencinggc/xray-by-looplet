# Local MCP and draftsman takeover QA — 8 September 2026

Scope: actual development app, real SDK InMemory MCP initialization/discovery/callTool transport, isolated `growth-local-app-tools-final` browser. No provider inference, paid search, voice, external messages, normal profile, production/native build or CRM changes. The runner relaunched this named session with an empty fixture project; this is not evidence of recovery of the earlier session's fixture.

## Source change

Owned source identities are in `owned-source-identity.json`: `appTools.ts`, `appTools.test.ts`, `draftsmanBridge.ts`. No ArchitectWorkspace, MagicPencil, SourceBuildingViewer or blueprint source edits in this wave.

Both draftsman MCP tools now require `expectedJobId`, current hydrated/nonrecovering project, Model pane and mounted controller. They never navigate implicitly. Control catalogue exposes ten playback/status actions: play, pause, replay, seek, set_speed, finish, exit, status, tour, jump_storey. Blueprint, section_cut, dimensions and plan_book are excluded until verified APIs are available. The broader bridge input type remains compatible with the separate UI. Exit means animation cancellation, not reversal of completed project edits. Project switches during awaited results are rejected.

Actual session registration discovers ten tools: nine app tools plus web_search. The latter was discovered only, never executed. Tool exceptions/unknown names remain errors through MCP.

## Executed checks

- Focused tests: 26 passed (`focused-tests.log`), including no implicit navigation, recovery/current identity, unmounted controller, unsupported actions, status arguments, explicit exit, async project switch, unknown tool and conversation abort before mutation.
- Typecheck: exit 0 (`typecheck.log`).
- Setup: 7 commands passed, runner `2026-09-08T03-03-53-450Z-growth-local-app-tools-final`.
- Actual MCP: 21 commands passed in 1.122 s, runner `2026-09-08T03-05-08-817Z-growth-local-app-tools-final`. Discovered exact catalogue; rejected unknown, unsupported/unmounted and pre-aborted requests; appended four walls and two hosted openings; verified counts and unchanged sheet; main save readback verified; stale drawing rejected; real undo restored prior geometry; reload retained job identity and exact saved design revision 3.
- Playback: corrected 12 commands passed in 0.398 s, runner `2026-09-08T03-07-55-963Z-growth-local-app-tools-final`. Explicit UI opened disclosed Redburn preview, MCP replay/play/pause/seek reached 45%; exit removed dock and restored solid model; subsequent actual status reports inactive/null. Initial selector typo `.draftsman-dock` failed and is preserved in runner `2026-09-08T03-07-03-230Z-growth-local-app-tools-final`; corrected selector is `.draftsman-control-dock`.
- Full desktop repeat: 13 commands passed in 0.443 s, runner `2026-09-08T03-08-21-547Z-growth-local-app-tools-final`; actual draw/save/undo repeated at 1440×1000. Final fixture retains original empty geometry at saved design revision 5. Main project ID `job-4675835c-3367-4139-b66e-a8d48ab6218c` stayed unchanged.
- Browser error opcode returned no uncaught errors. Existing Three.js warning counters remain; these are not claimed zero console messages.

All exact scenarios and runner logs are retained. `actual-mcp.json` calls `session.ts` → `callAssistantTool` → SDK MCP; it does not invoke appTools.execute directly.

## Visual inspection

Actually opened and inspected:

- `screenshots/growth/draftsman-mcp-agent-drawn-desktop.png`: four-wall room, hosted door/window visible in plan and live model, saved revision 4.
- `screenshots/growth/draftsman-mcp-agent-undo-desktop.png`: geometry removed by normal undo, saved revision 5, controls remain visible.
- `screenshots/growth/draftsman-mcp-agent-paused.png`: 45% wireframe model, readable paused draftsman controls.
- `screenshots/growth/draftsman-mcp-agent-exited.png`: solid Redburn model restored, draftsman dock absent.

Earlier `drawn.png` and `undo-reloaded.png` were also inspected but at the reset 1258×622 viewport; model content was vertically clipped. Full desktop images supersede them for geometry visibility. No mobile layout or complete screen-clearance claim.

## Finding handed to root

The immediate Source viewer exit receipt reported `active:true,status:null` from a stale React `draftsmanActive` closure, while the next status correctly reported inactive and the dock disappeared. Root owns SourceBuildingViewer and was asked to derive active state from the actual engine status. This report records the observed defect; subsequent root fix requires its own receipt check. Blueprint receipt and unsupported SceneApi actions were separately reported; MCP no longer advertises them.

No final release signoff, live Gemini response claim, cross-device save claim, production/native claim or fabrication of blueprint/export success.

## Immediate receipt correction verified

Root corrected SourceBuildingViewer to derive active state from the engine's current status and guard preview/API readiness. After a real reload, `immediate-receipts.json` passed all 13 commands in 1.579 s: runner `2026-09-08T03-11-28-081Z-growth-local-app-tools-final`, scenario SHA-256 `b209b08d18cf76a2df977e84adf7f7afba6097b55a121139aa6379b55d63b258`.

The actual MCP play call immediately returned `active:true` with non-null datum-grid status. The exit call immediately returned `active:false,status:null`; the dock disappeared. All five unsupported action attempts and an unknown MCP tool name were rejected. Browser errors remained empty. Inspected `screenshots/growth/draftsman-mcp-agent-receipts-corrected.png`: solid model restored with no draftsman dock. This closes the stale active receipt finding above. No app source changes by this agent for this retest; the isolated session is released in Model preview at 1440×1000.
