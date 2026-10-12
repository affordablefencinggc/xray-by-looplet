# DANS1 recovery authorization — October 12, 2026

## User approval and scope

Exact subsequent user message: **"im approving all dans1 works. !!"**

Recorded on branch `recovery/full-studio-20261011` from baseline `31740433`.
This is explicit DANS1 host-work approval in the X-Ray recovery conversation,
superseding the earlier lack of permission for remote retry/execution method.
Recovery checks, fresh frozen-engine qualification, sequential web/native builds,
and isolated pre-install acceptance work on DANS1 may proceed when their
technical prerequisites are satisfied. No repeated approval question is needed
for those scoped operations.

The existing ten-minute schedule reads this decision through `CONTINUATION.md`
and `FINISH-RECOVERY.md`. Its original restriction was expressly conditional on
separate authorization; this is that subsequent authorization. No schedule timing,
parallelism, timeout or prompt change is required or performed by this record.

## Narrow execution method

- Inspect effective policy and every scope before launching a recovery script.
- If required, launch the independently hash-verified script with
  `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File`.
  This selects the process scope only; never run `Set-ExecutionPolicy` against
  CurrentUser/LocalMachine or edit policy registry values.
- Do not override or evade managed MachinePolicy/UserPolicy restrictions, change
  antivirus/firewall controls, elevate privilege, or substitute an interpreter
  to conceal a denied invocation. Report an actual managed-policy conflict.
- Use the existing trusted SSH target and known-host checking; no host-key or
  authentication relaxation. Record launcher/remote owner identities and exact
  commands; preserve logs and verify task-owned cleanup.
- Reference checked: Microsoft Learn, Windows PowerShell 5.1,
  `about_Execution_Policies`, Process scope and policy precedence. Process scope
  is session-limited and does not supersede Group Policy.

## Boundaries retained

**Stop before installation.** No normal installed app/profile/data changes,
signing, production credentials/deployment, dependency upgrades, automatic push,
merge, main changes, or unreviewed engine-pin promotion follows from this approval.
Do not weaken tests/deadlines, reuse old attempt IDs, or rewrite historical proof.
Preserve blocked attempt `1a9f4e6c8202` and phase-1 source/receipts unchanged.

DANS1 sequential full builds retain the existing High-priority/all-16-processors
policy and owned-process containment/cleanup. Local heavy work remains subject
to the queried aggregate CPU cap of at most 20%.

## Technical status at authorization

- The 25-test terminal prerequisite revision still lacks clean committed and
  independent executed proof; preflight timeout diagnosis remains the next slice.
- Full terminal binding, trusted collection and artifact validation remain open.
- No new engine qualification/build/native acceptance is claimed by permission.
- Fresh SSH host/policy probe succeeded: DANS1, 16 logical processors, expected
  build-only Python executable present. Default effective policy is Restricted;
  all five explicit scopes are Undefined.
- The separately approved process-only policy probe exited zero and observed
  effective/Process Bypass, with all other scopes still Undefined. A fresh default
  session then observed Restricted again; prior remote probe PIDs were absent.
  All three local SSH launchers exited and were absent after the final check.
- These were policy/identity probes, not worker execution or qualification.
  Proof: `proof/growth/2026-10-11-full-studio-recovery/steps/dans1-execution-authorization.md`.