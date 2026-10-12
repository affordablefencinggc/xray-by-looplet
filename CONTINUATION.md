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

This is permission to continue unblocked local engineering, **not** permission to
bypass the DANS1 execution restriction, install, sign, promote an engine, deploy,
push, merge to main or change normal user data/profiles. Stop before installation.
No policy override or remote retry has been authorized. Preserve historical
attempt `1a9f4e6c8202`, original helpers and phase-1 acceptance/receipt bytes.

## Current slice — WIP: terminal-record prerequisite

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

External evidence parent for these run IDs:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.
Each test run uses `terminal-records-<id>` plus tracked
`terminal-launch-<id>.{owner.json,stdout.log,stderr.log}`.

## Next action

Finish this additive slice: inspect the final retry's complete logs/exit/cleanup, address
review findings, run and retain successful capped tests, commit explicit paths,
then obtain a clean committed rerun and independent review. Do not call gate 3 or
the app complete. Continue full terminal binding/artifact validation next, or
independently reproducible tablet/desktop UI work with fresh capped browser proof.
Follow `FINISH-RECOVERY.md` for remaining gates and `LEDGER.md` for phase 1 only.