# X-Ray recurring recovery handoff

## Authority and recurrence — October 12, 2026

User: "please proceed with everything required set a loop @10mins to nudge to
continue working through the app please".

- Enabled schedule: `sched_e1b36f37-c625-458b-a343-80197418a5f7`.
- Cron: `*/10 * * * *`, using the scheduler's existing local timezone
  (`Australia/Brisbane`, not an agent-selected override).
- One scheduled run at a time, nine-minute timeout, bounded work slices.
- Absolute repository:
  `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery`.
- Branch: `recovery/full-studio-20261011`; scheduling baseline `e91f9bc5`.
- Acquire the exclusive owner marker before edits or test launches:
  `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\continuation-loop.lock.json`.
  A live/unexpired other owner means defer, not start another editor. Expiry alone
  does not authorize interrupting a live worker. Release only your own marker.

### Superseding DANS1 approval — October 12, 2026

User: **"im approving all dans1 works. !!"**

This subsequent, host-specific approval supersedes the earlier missing DANS1
execution-method authorization, including the schedule prompt's baseline warning.
Proceed with recovery-related DANS1 checks, fresh engine qualification, sequential
builds and isolated pre-install QA, subject to their unchanged evidence gates.
If required, use a process-only `powershell.exe -NoProfile -NonInteractive
-ExecutionPolicy Bypass -File` invocation of the independently hash-verified
recovery worker. Check policy scopes first; do not modify persistent policy or
evade MachinePolicy/UserPolicy. Record exact invocation, identities and cleanup.

This does **not** establish engine/app acceptance, authorize installation, signing,
production credentials/deployment, dependency upgrades, normal-profile/data writes,
unreviewed engine promotion, push or merge. **Stop before installation.** Preserve
historical attempt `1a9f4e6c8202`, original helpers and phase-1 receipt bytes.
Approval and fresh preflight observations are recorded separately in
`DANS1-AUTHORIZATION.md`; do not rewrite the old blocked-attempt proof.
Fresh probes confirmed DANS1 access and process-only Bypass; a subsequent default
session remained Restricted, and the probe launchers exited. No qualification
worker was launched. Authorization is no longer the gate-2 blocker; the next
technical action below is unchanged. Evidence ID: `3730110660a2`.

## Current slice — artifact consistency and trusted collection

Superseding update, October 12: clean worker `b212a4926b37` and independently
executed verifier `3b9ba15119a4` both passed unchanged source `280c61a0`:
21 preflight tests, 109 preserved sources / four helpers, 25 terminal-record tests,
queried 20% aggregate CPU cap, successful terminal/cleanup/source checks.
Separate proof: `proof/growth/2026-10-11-full-studio-recovery/steps/terminal-prerequisite-executed.md`.
The historical timeout cause is unknown, not reproduced, not claimed fixed.

New additive artifact consistency implementation has clean worker and independent
executed proof at `9cc49c9c94bb22338f2ebae18e900d3b9322b111`:
`scripts/qualification_structure.py`, `scripts/verify_qualification_artifacts.py`,
their two test modules and `scripts/run-artifact-evidence-check.ps1`. It checks
ZIP/extracted source, build artifacts, executable bytes, toolchain metadata,
JUnit, all 18 child steps, six fixtures and eight negatives. It explicitly keeps
execution authentication, full evidence, engine and app acceptance false.
Worker `949c60f956ac` and independent `a98a9486919b` each passed 95 tests
(21 preflight + 25 terminal + 25 structure + 24 artifact), zero skips, real Windows
junction rejection, 109-source/four-helper audit, queried 20% cap, unchanged
11-source hashes, zero exits and observed owned cleanup. Separate proof:
`proof/growth/2026-10-11-full-studio-recovery/steps/artifact-consistency-executed.md`.
Earlier dirty development `efa977a3e23f` is retained, not final proof. No engine/app
acceptance is inferred. Next implementation contract and source-test/skip findings:
`QUALIFICATION-COLLECTION-PLAN.md` (design only, not executed). Trusted collection
and source/test/warning review remain engineering work, not a DANS1 permission issue.

Next additive slice: `scripts/verify_qualification_coverage.py`, its tests and
`scripts/run-coverage-evidence-check.ps1` compare externally pinned declared
inventory with exact JUnit identities, require every in-scope snapshot test module
represented and zero skips/errors/failures. They do **not** authenticate inventory,
map pytest rootdir, prove all functions/parameters collected, or replace artifact
validation. Static review `run_00041` approved this narrow scope. Development
`b0bd64d1f8f7` passed 21 preflight + 19 coverage tests with queried 20% cap and
zero exits; clean worker and independent coverage proof are next.

## Previous slice — terminal-record prerequisite

Additive files, leaving the phase-1 runner and qualification producers unchanged:

- `scripts/verify_qualification_terminal.py`: offline, read-only input/owner/exit
  record consistency gate; explicit external run/transfer/source/owner pins.
- `scripts/test_verify_qualification_terminal.py`: synthetic real-file rejection
  regressions, including a successful-looking qualification without owner exit.
- `scripts/run-terminal-evidence-check.ps1`: separate local capped test entrypoint;
  reuses the unchanged reviewed runner by dot-sourcing its preflight gate in the
  same owner, then executes the new tests under its queried 20% cap and containment.

**Not a full qualification validator.** A successful prerequisite deliberately
returns `freshEngineQualified: false`, `fullEvidenceValidated: false` and
`appAccepted: false`. It does not verify executable, archive members, fixture
results, build logs, toolchain, live process cleanup or resources on DANS1.
Legacy `exit.json` has no run ID/owner/hash binding; plausible transplanted exit
records cannot be authenticated. A trusted bound terminal receipt/collection
format and complete artifact validation remain required before actual acceptance.

### Development execution (not clean committed acceptance)

- Initial local run `8c1d51d241f8` was interrupted at the command tool's 30-second
  limit. It has no terminal exit record; its passing prefix is **not acceptance**.
  Its launcher PID 42456 and matching test markers were absent at the subsequent
  observation. Logs remain external, not overwritten.
- Retry `ebc677d7a0a8`: 18 new tests and 21 preflight tests passed; terminal
  exit zero, owner-only accounting and launcher PID 87300 absent after completion.
- Static review `run_00022` found missing source/case binding, 100ns timestamp
  precision loss, weak JSON-negative test setup and runner evidence overclaims.
  Corrected them without weakening assertions or changing historical helpers.
- Revised run `35786c9e6c68`: 22 tests plus 21 preflight tests passed; terminal
  exit zero, launcher PID 83448 absent after completion. Three further rejection
  tests and runner setup-claim corrections now require a fresh rerun.
- Final-file static review `run_00023` approved the bounded prerequisite scope;
  it explicitly did not claim full artifact acceptance or watchdog enforcement.
  No independent executed acceptance is claimed from static reviews.
- Development run `d013bd0a744f` launched PID 62572 at
  `2026-10-12T06:13:39.7827276Z`; it exercises the 25-test revision. The existing
  21 preflight tests passed in 65.641 seconds, but the unchanged preserved-evidence
  check then hit its existing 120-second deadline. Exit 1 at
  `2026-10-12T06:17:15.3570239Z`; owner/observed child processes absent afterward.
  The 25 new tests were not reached. Failure diagnostics remain external; do not
  weaken or extend the established deadline to bypass this result.
- Replaced the wrapper's synchronous Git HEAD subprocess with the reused bounded
  `Run-Check` function (15 seconds). No wrapper-wide hard deadline claim.
- Final runner delta received read-only approval in `run_00024`.
- Implementation checkpoint committed as **`067105e9`**, explicitly WIP. Clean
  committed run `b66c4d708dbe`, owner PID 99724, creation
  `2026-10-12T06:21:11.9183467Z`, hit the existing 120-second `evidence-tests`
  deadline and wrote exit 1 at `2026-10-12T06:23:38.1770378Z`. The 25 new tests
  again were not reached. Launcher PID 99724 was absent at the next observation.
  Prior 18/22-test passes do not prove this final revision. No acceptance claimed.
- A foreground phase-1 `ledger check` invocation also hit the command tool's
  30-second timeout; no fresh successful result is claimed for that invocation.
  Preserved phase-1 status remains 3/3 verified; its source/receipts were not edited.

External evidence parent for these run IDs:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.
Each test run uses `terminal-records-<id>` plus tracked
`terminal-launch-<id>.{owner.json,stdout.log,stderr.log}`.

## Next action

Implement trusted source-bound test preparation/coverage and separately pinned
execution/collection around the unchanged legacy producers, using the concrete
contract in `QUALIFICATION-COLLECTION-PLAN.md`. The additive artifact validator
already has clean worker and independent proof. Full source/test inventory and warning/skip review are
not established by a self-consistent bundle. Do not weaken deadlines or assertions.
Use a new immutable local run ID with the following entrypoint; monitor a tracked
bounded supervisor asynchronously because foreground commands time out after 30 seconds:

```powershell
powershell.exe -NoProfile -File C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery\scripts\run-artifact-evidence-check.ps1 -RunId <new-12-hex-id> -Actor <worker-name>
```

The new prerequisite is not yet registered as a verified machine-ledger item. Do not
change the scope/acceptance of completed phase 1 to pretend it covers this work.
Do not call gate 3 or the app complete. Continue full terminal binding/artifact
validation after proving the prerequisite, or
independently reproducible tablet/desktop UI work with fresh capped browser proof.
Follow `FINISH-RECOVERY.md` for remaining gates and `LEDGER.md` for phase 1 only.