

## 2026-09-08 — Candidate 71f5b012342b, build and feature acceptance

- PASS: Dans1 seven sequential High/16 gates; 219 TypeScript and 14 Rust tests. Frozen source 71f5b012342be7887a29bbf051131b57e5ed998ada46c5c79b5c22cd1325f14c. Executable 38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c.
- PASS: 226 production browser commands and 97 native commands; inspected screenshots and actual PNG/PDF downloads. Restored bottom preview controls, reserved tablet toolbar space, real MCP discovery/playback, drawing/save/reload/undo, synchronous export capture.
- [Open illustrated report](release-report.html); [PNG summary](../../../screenshots/growth/2026-09-08-release-71f5b012342b-report.png); [frozen source](source-manifest.json) and [complete diff](code.diff); [native exact commands/results](native-acceptance.md).
- OPEN: SC-06 shutdown cleanup. QA window closed, but owned process53296 remained alive after normal close and CDP disconnection. No force termination. Candidate is not promoted over38a64f0b8c2b pending diagnosis.
- OPEN: live Gemini replies/search (provider unconfigured), full52-storey authoring and broaderA-Z/nativeMac/Linux acceptance. No installation or working-data replacement.
- Earlier d0d468747f41 test failure, r2 missing preview-bottom-bar and r3 tablet overlap retained with evidence. Corrected storage success mock only; production lost-write guards remain tested.

- Git hygiene note: root reported staged `git diff --check` warnings for existing candidate whitespace: `appTools.ts:201` and `useAssistantChat.ts:75` extra EOF blank lines, and `blueprintSheet.ts:29` trailing whitespace. No source was changed to preserve the tested freeze; diff-check is not claimed passed. The frozen 57-file source hash guard passed.
- [Standalone stage recovery record](stage-checkpoint.md) preserves the accepted gates, exact identities and open shutdown/provider work.

- Publication LOCAL ONLY: source checkpoint commit `476f39511b234fd65050a92a5550a14281277392` exists locally. Automatic approval review rejected external upload because remote ownership/trust was not established; no push occurred. Explicit user approval is required for the 56-file source checkpoint to the stated GitHub remote/branch; root owns that approval request.
- Both baseline and final candidate exited in fresh startup-only comparisons (approximately 524 ms and 522 ms). The original full-workload process-exit issue remains OPEN; startup-only closure does not establish a workload-matched fix. [Baseline](baseline-shutdown-38a64/normal-close.json), [candidate startup](candidate-startup-shutdown/normal-close.json).

- Qualified shutdown update: the final candidate completed a fresh full 97-command workload retry in original order, without viewport emulation, and exited normally about 515 ms after CloseMainWindow (514.4 ms between raw timestamps); no process/direct children remained and no force termination was used. [Retry report](candidate-workload-shutdown/README.md), [scenario identity](candidate-workload-shutdown/scenario-manifest.json), [close evidence](candidate-workload-shutdown/normal-close.json). Do not add these repeated commands to the original 97-command feature total.
- One original windowless PID 53296 remains unresolved. Clean baseline/candidate startup closes and the clean full-workload retry show that the issue is not reproduced on every fresh launch; they do not explain or erase the original observation. Publication remains LOCAL ONLY / blocked pending explicit approval.

- Read-only symbolized main-thread evidence places original PID 53296 in GetMessageW under the Tauri event loop, without identifying a cause or fix. [Symbolic stack](release-71f5b012342b/qa-close-main-thread-stack-symbols.json), [symbol identity](release-71f5b012342b/diagnostic-symbols/identity.json). The diagnostic PDB is excluded from the curated evidence commit.
