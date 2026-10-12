# DANS1 execution authorization and bounded policy probes

## Requirement and source

October 12, 2026 user: **"im approving all dans1 works. !!"**

Record the subsequent host-specific approval, select a nonpersistent execution
method and verify host/policy without claiming engine qualification. Baseline
`31740433`, branch `recovery/full-studio-20261011`. Documentation-only changes:
`DANS1-AUTHORIZATION.md`, `CONTINUATION.md`, `FINISH-RECOVERY.md`, this step,
`COMPLETE-CHECKLIST.md` and `LOOPLET_BRANCH_RELEASE_LEDGER.md`.

The maintained worker, terminal validator/tests, fixed deadlines, historical
blocked attempt, engine pin, product source and machine-ledger receipts are unchanged.

## Executed observations

Evidence directory:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\dans1-authorization-3730110660a2`.

1. Trusted SSH configuration resolved `dans1` to the existing DANS1 target,
   user `danie`, port 22, BatchMode enabled and StrictHostKeyChecking enabled.
2. Bounded read-only probe: DANS1, 16 logical processors, PowerShell
   `5.1.26100.9444`, expected build-only Python file present. Effective policy
   Restricted; MachinePolicy/UserPolicy/Process/CurrentUser/LocalMachine all
   Undefined. Exit zero, no timeout, launcher exited.
3. Approved process-scope probe: `powershell.exe -NoProfile -NonInteractive
   -ExecutionPolicy Bypass -EncodedCommand` with the saved plain-text query.
   Effective/Process Bypass observed; other scopes Undefined. Exit zero, no
   timeout, launcher exited. No script worker or engine build was launched.
4. A fresh session without the override returned effective Restricted and all
   explicit scopes Undefined. Previously observed remote PIDs 11696 and 888
   were absent. Exit zero, no timeout, launcher exited. All three recorded
   local SSH launcher identities were absent afterward; no process was killed.

Each probe used a 15-second local wait bound, a three-second owned-stop fallback,
five-second connection timeout, trusted host checking, redirected stdout/stderr
and exact local launcher PID/creation/executable/arguments records. Queries and
terminal results are retained beside the raw logs. The initial stderr contains
PowerShell module-preparation progress XML, not an execution failure.

Raw files: `remote-query.txt`, `launcher.json`, `ssh.stdout.log`, `ssh.stderr.log`,
`exit.json`; corresponding `process-scope.*` and `cleanup.*` query/launcher/log/
terminal records. `verified-observations.json` records checked invariants and
SHA-256 identities for those raw files.

Host clocks are not synchronized by this step: remote observed timestamps are
approximately 23 seconds ahead of local terminal timestamps. Preserve both;
do not infer cross-host ordering by comparing them as one clock. This does not
relax the terminal validator's same-host owner/exit timestamp requirements.

## Limits and next action

This is nonvisual authorization/preflight evidence; no screenshot or UI behavior
is claimed. Only the missing DANS1 permission boundary is resolved. The selected
method is session/process-only, not a persistent policy change. Recheck managed
policies and independently hash-verify the worker before any future launch.

The final 25-test prerequisite, full terminal/artifact validation, new immutable
engine qualification and native/UI acceptance remain open. Diagnose the retained
preflight timeouts next without weakening assertions or deadlines. The existing
ten-minute schedule receives this approval through the current handoff; its
configuration is unchanged. Stop before installation; no push or merge.