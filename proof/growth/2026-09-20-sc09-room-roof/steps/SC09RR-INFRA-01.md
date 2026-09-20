# SC09 room/roof snapshot preflight - infrastructure failure

Status: FAIL before source staging or product execution. Not a slice completion receipt.

Command on DANIEL (orchestration only):
`powershell -NoProfile -ExecutionPolicy Bypass -File .\proof\growth\2026-09-20-sc09-room-roof\infrastructure\prepare-snapshot.ps1`

First invocation, exec session 53887, exit 1:

```text
ForEach-Object : Method invocation failed because [System.Object[]] does not contain a method named 'Replace'.
prepare-snapshot.ps1:91
) | ForEach-Object { $_.Replace('\', '/') }
```

Cause: commas inside the dirty-path collector created nested arrays under Windows PowerShell. Changed the collector to stream each Git command's string output without nested arrays. Exact change remains in `infrastructure/prepare-snapshot.ps1` in this slice's eventual diff.

No source stage was created, no DANS1 product test ran, and no browser launched. Screenshot: none; this is an infrastructure-failure record, not visual acceptance. Product source is unchanged by this correction. Rerun pending.
