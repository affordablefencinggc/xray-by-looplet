# Assistant Stop/retry receipt correction

User authorization: “continue with - ASSISTANT-MCP-TODO.md”, 2026-09-08. Branch: `feat/architect-cad-engine`. Application changes are limited to `src/studio/assistant/conversation.ts` and its test file. Existing edits are preserved.

## Behavior and executed proof

When the provider returns several tool calls, Stop or a project change between calls previously discarded the entire exchange from model history, including the receipt of an already completed drawing action. The two new deterministic tests reproduced this before the fix (5 passed, 2 failed, both failing because no receipts were checkpointed).

The corrected loop checkpoints the completed results and an explicit “Not executed” error result for each skipped call, preserving call IDs. It then propagates the interruption. A follow-up turn receives the receipts without automatically replaying tool mutations.

- [Code diff](code.diff)
- [36 focused local tests](tests.log), including both regressions and the official MCP SDK handshake.
- [Local typecheck](typecheck.log); exit 0 using `npm.cmd` after the PowerShell npm shim was blocked by execution policy.
- Scoped `git diff --check` passed.
- [221 passing TypeScript tests on Dans1](release-591a4b8b5452/focused-tests.stdout.log).
- [Nine Rust assistant tests](release-591a4b8b5452/native-assistant-tests.stdout.log) and [five Rust material tests](release-591a4b8b5452/native-material-tests.stdout.log).

These are deterministic tests, not live Gemini conversation or grounded-search acceptance.

## Build and browser verification

Snapshot `591a4b8b5452e2ca35c634d28985dbf9a0ef975d21527e023d187269f448f7c8` passed all seven sequential High/16 Dans1 gates. Web and Windows artifacts were downloaded and hashes verified against their build manifests. [Build identity](release-591a4b8b5452/build-identity-verified.json), [artifact verification](release-591a4b8b5452/artifacts-verified.json).

- [Production web scenario](web-scenario.json) / [executed output](web-scenario.json.log): 14 commands, exit 0; build badge, real MCP discovery/capability request, panel bounds at desktop 1440×1000 and tablet 1024×1366, zero runtime errors. Both screenshots inspected: [desktop](../../../screenshots/growth/assistant-stop-receipts-desktop.png), [tablet](../../../screenshots/growth/assistant-stop-receipts-tablet.png).
- [Windows-native scenario](native-status.json) / [executed output](native-status.json.log): 11 commands, exit 0; native build identity, provider status, two rejected invalid requests, inactive cancellation, real MCP discovery and composer bounds. No paid provider calls. [Workspace screenshot](../../../screenshots/growth/assistant-stop-receipts-591a4b8b5452-native-workspace.png), [assistant screenshot](../../../screenshots/growth/assistant-stop-receipts-591a4b8b5452-native-assistant-status.png). Both inspected. A later screenshot showed another actor had changed the window to Model; it is not attributed to this scenario.

## Release limits and recovery

**No promotion, installation, commit or publication.** Collection succeeded, but its final current-source comparison correctly failed because `src/studio/MagicPencilDraftsman.ts` changed concurrently after the snapshot. That edit was not reverted or included in the claim. The build identity checks validate the frozen artifacts, not all current workspace changes. Existing latest-verified pointers remain unchanged.

Gemini remains unconfigured in both tested environments. SC-02 through SC-07 remain open for their broader acceptance requirements. This continuation does not establish provider image generation, real grounded search, durable chat history, the full professional tool matrix, macOS/Linux native support, or a fix to the earlier shutdown anomaly.

The original lingering PID 53296 was absent on successful elevated lookup; no termination was needed. [Process observation](processes-active.json). Historical evidence claiming it should be preserved is superseded by the newer project cleanup rule, but its historical failure records remain intact.

The existing QA preview was occupied and preserved. A separate owned preview was used and then stopped with PID, creation-time, executable and command checks: [cleanup](preview-cleanup.json). An initial cleanup attempt safely rejected a timestamp representation mismatch; normalizing both timestamps to milliseconds allowed the exact identity check to succeed. The isolated tunnel exited normally. Web browser session closed after its evidence was saved.

The native candidate changed to Model and resized outside this task's scenario. The user was asked asynchronously whether they were using it; no reply had arrived at closeout. The candidate was retained as an apparently active user-facing window; only this task's native QA session was disconnected. No new native shutdown acceptance is claimed. [Final process disposition](cleanup-final.json). Recovery baseline: `39a50dc7358ae4058d73296ab0c9f338d0df57dd`; this correction is uncommitted and its exact diff is linked above.
