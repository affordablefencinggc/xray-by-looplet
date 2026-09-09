# MCP takeover acceptance / 8 September 2026

**Development acceptance:** actual local SDK MCP transport, isolated browser fixture. No paid Gemini/provider turn or web search was performed.

- **26 focused automated tests passed** (counted once); typecheck passed.
- **59 passed browser commands across four acceptance runs** below. These include repeated regression and screenshot commands; they are not 59 distinct test cases.
- Setup/inspection runs (7 + 2 + 4 commands), the preserved failed selector attempt and older direct-appTools checks are excluded from the acceptance total.

| Acceptance run | Commands | Exact scenario | Runner result | Raw log |
|---|---:|---|---|---|
| Draw / save / undo / reload | 21 | [Scenario](../2026-09-08-draftsman-mcp-qa/actual-mcp.json) | [Result](../runner/2026-09-08T03-05-08-817Z-growth-local-app-tools-final.json) | [Log](../runner/2026-09-08T03-05-08-817Z-growth-local-app-tools-final.log) |
| Playback / pause / exit | 12 | [Scenario](../2026-09-08-draftsman-mcp-qa/playback-corrected.json) | [Result](../runner/2026-09-08T03-07-55-963Z-growth-local-app-tools-final.json) | [Log](../runner/2026-09-08T03-07-55-963Z-growth-local-app-tools-final.log) |
| Full desktop geometry proof | 13 | [Scenario](../2026-09-08-draftsman-mcp-qa/desktop-proof.json) | [Result](../runner/2026-09-08T03-08-21-547Z-growth-local-app-tools-final.json) | [Log](../runner/2026-09-08T03-08-21-547Z-growth-local-app-tools-final.log) |
| Immediate receipt regression | 13 | [Scenario](../2026-09-08-draftsman-mcp-qa/immediate-receipts.json) | [Result](../runner/2026-09-08T03-11-28-081Z-growth-local-app-tools-final.json) | [Log](../runner/2026-09-08T03-11-28-081Z-growth-local-app-tools-final.log) |

## Accepted behavior

Real MCP discovery lists nine local application tools plus web_search. The latter was only discovered. Drawing appends four walls and a hosted door/window through the mounted UI controller; save/readback, stale-revision rejection, real undo and reload with the same saved job identity were executed. Unknown tools, pre-aborted calls, unsupported draftsman actions and unmounted draftsman requests fail honestly. Both draftsman tools now require a ready matching project and mounted Model viewer, with no implicit navigation.

The immediate play/exit receipt bug was reproduced, fixed by root and retested: play returns active=true with a status; exit returns active=false/status=null immediately. The broader UI blueprint/PDF work is root-owned and is excluded here.

## Visual evidence and limits

- [Real authored geometry](../../../screenshots/growth/draftsman-mcp-agent-drawn-desktop.png): Four walls and two hosted openings are visible in plan and live 3D. Saved design revision 4. The fixture uses unpriced default wall assemblies.
- [Undo restored the previous design](../../../screenshots/growth/draftsman-mcp-agent-undo-desktop.png): The normal architectural history removed the QA batch and saved revision 5. This empty design is intentional.
- [Playback at 45%](../../../screenshots/growth/draftsman-mcp-agent-paused.png): The disclosed Redburn reconstruction is paused in wireframe, with the actual draftsman dock and telemetry visible.
- [Exit restored the solid model](../../../screenshots/growth/draftsman-mcp-agent-receipts-corrected.png): The final receipt regression confirms active=false and status=null immediately. The dock is absent and the solid model is restored.

All four embedded images were actually inspected. Self-contained [HTML report](mcp-acceptance.html) embeds their original PNG bytes. Full desktop screenshots are 1440?1000. No mobile/native/production acceptance claim. Earlier 1258?622 clipped captures and the incorrect .draftsman-dock selector failure are preserved and excluded from final visual acceptance.

The named isolated browser was relaunched with an empty fixture at setup; this is not recovery evidence for the old profile. Job job-4675835c-3367-4139-b66e-a8d48ab6218c retained identity through the tested reload. Final authored fixture is empty at saved revision 5; no normal user data was used. Browser uncaught errors were empty; existing Three.js warning counters on earlier runs were not treated as zero console messages.

[Focused test log](../2026-09-08-draftsman-mcp-qa/focused-tests.log) / [Typecheck log](../2026-09-08-draftsman-mcp-qa/typecheck.log) / [Owned source hashes](../2026-09-08-draftsman-mcp-qa/owned-source-identity.json) / [Detailed chronological acceptance](../2026-09-08-draftsman-mcp-qa/acceptance.md)

Report QA (excluded from application command totals): all 18 relative HTML links resolve, all four embedded PNGs load at their original 1440 px width, and the final report has no horizontal overflow or text encoding artifacts. Final report runner `2026-09-08T03-23-12-041Z-growth-local-app-tools-final` passed; opening and embedded-image screenshots were inspected. An initial punctuation encoding issue was corrected before final acceptance.
