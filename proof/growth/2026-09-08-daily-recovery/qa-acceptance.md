# Development recovery UI acceptance — 2026-09-08

Scope: new isolated persistent `growth-daily-recovery` browser session, development origin 8080. No prior QA fixtures, normal browser profiles, CRM or application source modified. No Firecrawl call. Browser artifacts are development evidence, not a final built/native/platform release gate.

## Passed behavior

- Corrupt main job text survives reload and retry unchanged. The recovery notice replaces normal pane content. Existing sidecar values remain unchanged. Retry and record-download buttons are at least 44×44, visible and hit-testable at 1440×1000, 1024×768 and 768×1024. The corresponding six blocked/unsaved screenshots were inspected; no recovery-action overlap.
- A failed load can be retried after the original valid record is restored. The original record remains byte-identical and the saved revision becomes visible.
- Injected quota failure preserves the edited name in the open workspace and retains the prior disk record. No confirmed-saved status remains. Retry saves the edited name and reload restores it.
- A silent `setItem` no-op independently proves readback verification. It shows the unsaved notice, retains the open name, then saves successfully after the injected fault is removed and survives reload.
- Injected `getItem` failure keeps recovery blocked, exposes the failure, and handles an attempted recovery download honestly. Removing the fault and restoring the last valid test record allows retry and reload.
- The actual downloaded text file equals the corrupt fixture: **66 bytes, SHA-256 `59405ff3fe8841b99a8809280d6518077a8cbdb5c957747d9aeca8c58ee91fb8`**. See `download-byte-proof.json` and retained `downloads/xray-saved-project-record.txt`.

## Executed runner evidence

All paths below are under `proof/growth/runner/`; companion JSON includes exact scenario hash, elapsed time and exit code.

| Scenario | Runner timestamp/session suffix | Result |
|---|---|---|
| corrupt-recovery.json | 2026-09-07T20-12-23-538Z-growth-daily-recovery | Preservation and all three layout predicates pass; run stops at CLI download cancellation, retained failure |
| blob-retry.json | 2026-09-07T20-13-57-495Z-growth-daily-recovery | 10 commands, 0.283 s, exit 0; generated Blob exact and valid-record retry |
| quota-retry.json | 2026-09-07T20-14-11-053Z-growth-daily-recovery | 28 commands, 0.733 s, exit 0 |
| readback-retry.json | 2026-09-07T20-15-07-115Z-growth-daily-recovery | 28 commands, 1.082 s, exit 0 |
| unreadable-retry.json | 2026-09-07T20-17-22-875Z-growth-daily-recovery | 14 commands, 1.276 s, exit 0 |
| download-normal-path.json | 2026-09-07T20-19-23-301Z-growth-daily-recovery | 12 commands, 1.039 s, exit 0; completed browser file, then restored latest test project |

The final isolated project is `Recovery readback unsaved name`, revision 3, verified saved. All Storage prototype overrides and temporary URL interception were removed. Corrupt/original fixture copies remain in this isolated session's sessionStorage for reproducibility. No user data was deleted.

## Retained failures and limits

- Initial setup and clean reload timed out with empty storage, no pending Web Locks and hydration idle. Root identified HMR store replacement and changed the Studio effect to subscribe to the current hydration action. Later reloads pass. The file named `daily-recovery-dev-startup-stuck.png` actually captured the already-recovered saved screen; it is not visual evidence of the earlier stall. Logs retain the earlier state.
- `agent-browser download` failed at relative and absolute destinations. Chrome's download history independently showed actual failed attempts with extended Windows `\\?\` paths and `Failed - Download error`, danger type 0. This was not accepted as a successful download.
- Root authorized a harness-only `Browser.setDownloadBehavior` configuration through the existing endpoint discovered by CLI `get cdp-url`. An ordinary button click then completed the file. Chrome reported its actual path as `C:\Users\danie\Downloads\xray-saved-project-record.txt`, despite the requested workspace directory. The exact browser-reported file was read, hash-checked and copied into proof; the original was preserved. This proves current UI file delivery but does not establish the precise CLI path-failure root cause. No app change was used to fix the harness.
- One diagnostic eval used unsupported top-level await; another tried returning nonserializable download data. A PowerShell quoting mistake prevented one scenario-generation attempt. Corrected bounded diagnostics/scenarios passed; failures remain in logs.
- Fault notices intentionally generate application diagnostic entries. Final `errors` commands were empty; expected handled storage failures are not claimed to be zero product diagnostics.
- Recovery notice guarantees are about the main job record. This does not prove complete multi-store restore, original-file recovery, conflict-free multi-window autosave, cloud sync, macOS/Linux packages or native file delivery.

## Inspected screenshots

Under `screenshots/growth/`: `daily-recovery-dev-blocked-{desktop,landscape,portrait}.png`, `daily-recovery-dev-unsaved-{desktop,landscape,portrait}.png`, `daily-recovery-dev-readback-unsaved-portrait.png`, and `daily-recovery-dev-final-restored.png`. The manifest stores their hashes and the source file hashes at audit close; development runs were not an immutable source snapshot.
