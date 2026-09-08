# Stage checkpoint - candidate 71f5b012342b

**Build and feature acceptance passed. A fresh full-workload retry exited normally; one original windowless process and live-provider acceptance remain OPEN.** The candidate has not replaced the previous verified `38a64f0b8c2b` installation or normal working data. This is the recovery record for continuing the release work, not an unconditional release signoff.

## Frozen identity and passed gates

- Source archive SHA-256: `71f5b012342be7887a29bbf051131b57e5ed998ada46c5c79b5c22cd1325f14c`.
- Executable SHA-256: `38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c`.
- The [57-file source checkpoint](source-manifest.json) has scope hash `43eecd3487e5d52c23ed2cab1f116f8cccdbd4f22c1b7c1cc1aa65e6b6d64719`. This scope hash is distinct from the source archive hash above. [Complete code diff](code.diff), [freeze guard](release-freeze-guard.json) and [source drift check](release-71f5b012342b/source-drift.json) preserve the tested identity; the recorded drift list is empty.
- Dans1 completed seven sequential High-priority gates with 16 worker settings: dependency verification, typecheck, focused TypeScript tests, web build, native build, Rust assistant tests and Rust material tests. [Verified build identity and gate results](release-71f5b012342b/build-identity-verified.json), [artifact verification](release-71f5b012342b/artifacts-verified.json).

| Accepted evidence | Passed total | Exact record |
|---|---:|---|
| TypeScript tests | 219 | [Test log](release-71f5b012342b/focused-tests.stdout.log) |
| Rust tests | 14 = 9 assistant + 5 material | [Assistant log](release-71f5b012342b/native-assistant-tests.stdout.log), [material log](release-71f5b012342b/native-material-tests.stdout.log) |
| Production browser commands | 226 = 53 design + 77 assistant + 66 controls + 30 exports | [Drawing/MCP acceptance](../2026-09-08-gemini-takeover/final-71f5b012342b-mcp/acceptance.md), [controls/export acceptance](../2026-09-08-production-pencil/2026-09-08-8095-pencil-final-01/acceptance.md) |
| Native commands | 97 = 11 bridge/status + 34 model + 52 design | [Native acceptance and exact runners](native-acceptance.md) |

Command totals are not unique product requirements. Setup, report rendering, earlier candidates and failed attempts are excluded. The underlying seven production/native runner results were checked: all returned exit 0 and their command counts match the table. Screenshots and actual exported PNG/PDF pages were inspected in the linked acceptance records.

## OPEN - original native process; clean shutdown comparisons

The full-workload candidate QA window closed normally, but owned PID `53296` remained windowless after the close request and CDP-session release. Its launch identity was checked to exclude PID reuse. The recorded CPU time remained unchanged; no child process or live owned socket was observed. No force termination was performed. [Original close](release-71f5b012342b/qa-close.json), [post-CDP observation](release-71f5b012342b/qa-close-after-cdp-release.json), [diagnosis and its limits](release-71f5b012342b/qa-close-diagnosis.md).

The previous verified build `38a64f0b8c2b` **did exit after startup/readiness only**, using a fresh isolated profile. WaitForExit and subsequent process lookup confirmed disappearance; the final observation was 524 ms after CloseMainWindow. Numeric exit code was unavailable. [Baseline report](baseline-shutdown-38a64/README.md), [normal-close evidence](baseline-shutdown-38a64/normal-close.json).

The final candidate also exited in a matched **startup/readiness-only** comparison: [launch identity](candidate-startup-shutdown/launch.json), [normal-close observation](candidate-startup-shutdown/normal-close.json). It reports process disappearance and no remaining child processes, with no force termination and no numeric exit-code claim. The recorded timestamps are about 522 ms apart. Thus both baseline and final candidate close under startup-only conditions.

The final candidate then passed a fresh **full 97-command workload retry** in original order (11 bridge/status, 34 model controls, 52 design/persistence), with screenshot paths changed only and no viewport emulation. Owned PID `23120` exited normally after CloseMainWindow; the final observation was about 515 ms later (514.4 ms between raw timestamps), no process or direct child remained, and no force termination was used. Numeric exit code was unavailable. [Retry report](candidate-workload-shutdown/README.md), [scenario identity](candidate-workload-shutdown/scenario-manifest.json), [normal-close evidence](candidate-workload-shutdown/normal-close.json). These repeated 97 commands are shutdown comparison evidence, not added to the original feature-acceptance total. This retry omitted the original failed viewport-emulation attempt; that difference is a possible factor, not proof of causation.

Both startup-only comparisons and this full-workload retry closed successfully. They qualify the original observation: shutdown failure is not reproduced on every fresh launch or this repeated workload. They do not explain why original PID `53296` remained windowless or establish that its unresolved state was fixed. Preserve that process/profile. The [read-only symbolic stack](release-71f5b012342b/qa-close-main-thread-stack-symbols.json), with [verified symbol identity](release-71f5b012342b/diagnostic-symbols/identity.json), places its main thread in GetMessageW under the Tauri event loop at observation time; this does not establish a causal fix. Do not infer a deadlock cause from the limited observations or force an unconditional exit without the required evidence and authorization.

## OPEN - provider and broader coverage

Local MCP discovery, playback/status and honest error results passed. The tested provider is unconfigured, so live Gemini replies, grounded web searches, paid voice, and external MCP server integration are not accepted. Production geometry save/undo/reopen was driven through the real UI; geometry dispatch through MCP was separately verified in development. The 52-storey authoring request, wider professional A-Z capabilities, macOS/Linux native packages and physical tablet hardware remain outside the completed slice. Model-sheet exports are illustrative raster projections, not certified construction drawings.

## Git hygiene and resumption

**Publication: LOCAL ONLY.** Source checkpoint commit `476f39511b234fd65050a92a5550a14281277392` exists locally on `feat/architect-cad-engine`. Root reports that automatic approval review rejected uploading the 56-file source checkpoint because ownership/trust of the external remote was not established. No upload occurred. Publishing to `https://github.com/affordablefencinggc/xray-by-looplet.git` requires the user's explicit approval for that checkpoint and branch; this record does not request or infer approval.

Root reported staged `git diff --check` warnings for cosmetic whitespace already in this candidate: `src/studio/assistant/appTools.ts:201` and `src/studio/assistant/useAssistantChat.ts:75` extra EOF blank lines, and `src/studio/blueprintSheet.ts:29` trailing whitespace. **Diff-check is not claimed passed.** Source files were not changed to preserve the tested freeze. The 57-file hash guard passed; evidence-link cleanup does not change that application snapshot.

Resume shutdown diagnosis as the next release blocker, keep live-provider work separately open, and preserve all earlier failed/superseded candidate evidence. No installation, normal-data replacement, force termination, application-source edits or staging was performed in this checkpoint cleanup.

[Illustrated release report](release-report.html) / [PNG summary](../../../screenshots/growth/2026-09-08-release-71f5b012342b-report.png) / [Checkpoint log](checkpoint.md)
