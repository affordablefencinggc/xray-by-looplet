# Previous-build normal shutdown comparison

Previous verified build **38a64f0b8c2b exited normally** after a startup-only readiness check.

- Exact EXE SHA-256: 14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca
- Owned PID: 67892; fresh isolated WebView profile and diagnostic port 9274. No normal profile was used.
- Native page reached hydration ready; screenshot inspected. Four-command CDP check passed in 0.394 seconds with no runtime errors.
- CloseMainWindow returned true. WaitForExit returned true; a follow-up process lookup found no process and no direct children. The final observation was 524 ms after the close request. The wait timeout was 15 seconds; it was not exhausted.
- No force termination, installation or application source edits. The process ExitCode was unavailable, so this report makes no claim about its numeric value.

This was startup and readiness only, not a workload-matched reproduction of the final candidate's full feature tests. It shows a successful previous-build baseline under these conditions, but does not alone establish whether the candidate behavior was introduced by the latest change.

[Launch identity](launch.json) · [Normal close observation](normal-close.json)

Readiness runner: proof/growth/runner/2026-09-08T04-21-25-137Z-growth-baseline-shutdown-38a64.log

Screenshot: screenshots/growth/2026-09-08-shutdown-baseline-38a64-ready.png
