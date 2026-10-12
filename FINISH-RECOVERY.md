# X-Ray recovery: remaining app finish gates

Continuation date: **October 12, 2026**. User: "continue please with finishing the app".
Baseline: `cbd1d45ef184f04d2a8a3869af50a387783e0f63`, branch
`recovery/full-studio-20261011`. Main stays `be29918ad5aa466ec0f67a0d5742af23634483a9`.

**The app is NOT finished or accepted for installation. Stop before installation.**
This document is the app-level roadmap. The root `LEDGER.json` / `LEDGER.md`
is a mechanically enforced **phase-1 provenance/local-tooling ledger only**.
A `FINISHED` result there means that bounded phase, never Windows qualification,
native acceptance, signed release, installation or the complete app. Later gates
must acquire real, reviewed acceptance commands before becoming ledger-ready;
missing validators are engineering work, not a reason to invent a passing command.

## Workflow and authority

- Requested local skill discovered at
  `C:\Users\danie\.codex\skills\finish-line-ledger\SKILL.md`.
  The skill registry could not load it; the actual local instructions and CLI are
  used directly, not an invented substitute. Set `LEDGER_ACTOR` for every command.
- Only that CLI writes root ledger status and receipt logs. Worker proof requires
  a clean relevant tree/commit and a separate verifier reruns acceptance.
- Existing `finish-line/`, `FINISH-LINE.md`, `V1-FINISH-TODO.md` and production
  closeout records remain historical. Do not run the older conveyor in live mode:
  it can push `main`, and packaging completion is not native runtime acceptance.
- No execution-policy changes or bypass, remote retry, engine promotion, production
  credentials, signing, deployment, user-profile writes or installation follow
  from ledger creation. Explicit approval is needed at the applicable boundary.
- Keep fail-closed transport. No PATH-Python/source-tree runtime fallback. Python
  in local checks is a build/test dependency only. Do not change the historical pin.
- Local test children must inherit a queried aggregate CPU hard cap of 20% or less.
  DANS1 qualification uses its separately documented resource/ownership policy.
- Retain blocked attempt `1a9f4e6c8202`; future attempts get new immutable IDs.
  Never reuse it, overwrite proof, merge to `main`, or install as cleanup.

## Historical evidence, not fresh acceptance

| Evidence class | Exact recorded result | Limit / source |
| --- | --- | --- |
| Recovery checkpoint | `cbd1d45e`; maintained helpers and byte-exact raw `.txt` copies committed | Preparation checkpoint, not an engine build |
| CI/package matrix | `c93ae1e7354e7d295196ab5db0d363ed9e1a34eb`, run `38150581911`, completed October 11, 2026 at 15:38:33 UTC | `steps/ci-matrix-final.md`; not a current rerun or staged qualified engine |
| Linux package identities | Independent ZIP/tar/member checks, recorded package hashes and `0755` modes | `steps/linux-artifact-integrity.md`; no execution or installation |
| Local qualification preparation | Nine helper tests, six TypeScript cases, source bindings; 20% CPU cap | `engine-qualification-preflight/local-validation.json`; source `5a6378320ce16b9ad801db094aea31d216e52a42` |
| DANS1 attempt | Restricted policy prevented worker execution; input identities independently checked | `steps/frozen-engine-qualification-preflight.md`; no extraction/build/qualification |
| Saved UI captures | AI review of four desktop/tablet screenshots | `steps/saved-screenshot-review.md`; no fresh native/UI run or human signoff |

The relative evidence names above are beneath
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery\proof\growth\2026-10-11-full-studio-recovery`.
Historical engine comparison found 14 changed and seven unmanifested Python files:
that executable cannot qualify the recovery source. Historical reviewer task
completion (including `run_00011`) is not missing runtime proof; its full report
is unavailable after cleanup. `run_00012` gaps and `run_00013` checkpoint review
are not Windows acceptance. Current static review `run_00015` likewise is not execution.

## Ordered completion gates

### 1. Provenance and local qualification tooling

**Current machine status lives only in root `LEDGER.md`.** `PREFLIGHT` checks
preserved raw hashes, exact immutable Git blobs, LF-only maintained-script
equivalence, transferred identities, all 109 historical source blobs against HEAD,
source inventory/worktree integrity and blocked/cleanup records. It does not
re-contact DANS1, hash the external old ZIP or qualify an executable.

`CONTAINMENT` executes the real Windows local owner with an exited direct child
and a live descendant holding output files; requires bounded, specifically
diagnosed failure and a signaled retained descendant handle after owner exit.
It does not validate the separate DANS1 qualification worker's Job implementation.

Phase `SHIP` reruns that checker, its 21 record/real-Git rejection tests, the
containment regression, the nine helper tests,
Node/PowerShell syntax, and generates a new local snapshot plus six TypeScript
cases and checks their bindings. Successful temporary test inputs are removed;
failed/intentional-failure diagnostic folders remain outside the immutable receipts.
Receipts
remain tool-generated under `.ledger/logs/`. No product/full-suite acceptance.

### 2. Authorize the DANS1 execution method — BLOCKED: human decision

Need an explicit owner-approved method for the bounded engine-only worker.
Existing saved policy observation is `Restricted`, not a current host probe.
Do not silently use inline execution, policy overrides or another interpreter
to evade it. The owner may arrange a policy-compliant method, or specifically
authorize a narrowly scoped method after considering host restrictions. No
persistent policy change is assumed. Record the exact approval and method.

### 3. Fresh immutable frozen-engine qualification — NOT EXECUTED

Depends on gate 2. Before execution, create a terminal-evidence validator and
rejection tests, including `qualification.json` without a successful owner exit.
The October 12 recurring continuation is implementing an additive **terminal-record
prerequisite only**, tracked in `CONTINUATION.md`. It is not the complete validator
and cannot close this gate: the legacy owner exit lacks attempt/owner/hash binding,
and full artifact/log/toolchain/fixture validation and trusted collection remain open.
Then create a new 12-hex-ID snapshot/cases/transfer set at the actual source commit;
validate and independently rehash transferred inputs and the owner script.

Acceptance requires ALL of:

1. Attached, bounded owner execution; verified process identities, deadlines,
   resources, sanitized environment and task-owned cleanup. Inspect progress at
   least every ten minutes; no dependency upgrades or unrelated process kills.
2. Source manifest/inventory, existing toolchain pins and before/after inventories,
   `pip check`, complete source tests with JUnit counts and explicit skips.
3. Build command, exit, stdout/stderr, spec/TOC/warnings, executable bytes/digest.
4. Frozen executable with unrelated cwd and no Python PATH/engine override;
   exact contract triple within ten seconds / 4,096 bytes, six fixture/parity
   cases and eight rejection/no-overwrite cases with actual request/result files.
5. Input revalidation followed by **owner `exit.json`: `exitCode: 0`,
   `workerExited: true`**; inspect complete evidence, never `qualification.json`
   alone. Independently review receipt consistency and actual executable identity.

Even success covers the declared frozen BOM scope, not all PDF/CAD operations,
native host invocation, UI, installation or commercial release.

### 4. Reviewed staging and native app build — PENDING qualification and authorization

Do not update the old pin merely because PyInstaller succeeds. Explicitly review
promotion and the staging adapter: the maintained staging function still expects
the historical digest. Require exact current source/hash agreement, no unmanifested
files, full terminal qualification and no-overwrite staging into an isolated build
snapshot. Preserve fail-closed rejection tests for wrong/missing engine, invalid
status, legacy commands and PATH-Python discovery. Capture app and engine identities,
native build logs, package member/hash checks and engine inclusion; no installation.

### 5. Native host, UI and working-day acceptance — OPEN, not inherited from web CI

Use an explicitly approved isolated portable/profile workflow. Run native host
transport against the qualified executable, not mocked status or a source engine.
Verify actual WebView launch and engine invocation, supported input/output routes,
saved/reopened project state and ten graceful closes within five seconds after
activity with no forced termination. Retain exact source/build/profile identities,
screenshots, console errors, executed scenarios and cleanup observations.

Run desktop, tablet landscape and portrait journeys (including 1600x1000,
1024x768 and 768x1024 where applicable), keyboard/focus, project isolation,
save/reload, backup/recovery and DAY-01..08 on that build. Resolve or explicitly
reject the compact-control usability issue and portrait assistant-bar obstruction.
Browser layout fixes can proceed independently after reproducing them with a
fresh authorized capped browser harness; static screenshots alone cannot close them.
Human visual/behavioral signoff remains separate from AI screenshot review.

### 6. Current-source regression and pre-install handoff — OPEN

Require full registered JS/TS tests, typecheck, scoped lint, Python tests, Rust
host/Tauri transport tests and applicable builds/CI for the **final** code.
Bind all evidence to that source/artifact; rerun invalidated proofs after changes.
Audit broader closeout/day-to-day requirements and explicit backlog decisions;
recovery is not a blanket claim that all historic feature gaps disappeared.
Prepare a hashed, reproducible handoff with known limits and remaining human gates.
This is the maximum deliverable allowed by **stop before installation**.

### 7. Signed installation / release — BLOCKED: separate explicit authorization

Neither this continuation nor a passing pre-install ledger authorizes signing,
credential use, installation over the normal app, data/profile migration, forced
app closure, auto-update configuration or production deployment. Only after the
relevant explicit approval: signed artifact verification, approved rollback/data
preservation plan, installed launch/daily-use/close tests, then human acceptance.
Update verified-build pointers only to the actually accepted artifact. Linux/macOS
runtime and deployment remain separate platform gates, not implied by Windows.

## Operator commands (phase 1 only)

Working directory:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery`

```powershell
$env:LEDGER_ACTOR='cline-recovery-worker'
$L='C:\Users\danie\.codex\skills\finish-line-ledger\ledger.mjs'
node $L check
node $L next
```

Use only `start`, `run`, `done`, `verify`, `note`, `block` through the CLI for
status changes. A different actor/context performs `verify`. Acceptance commands
are not edited after running. Commit explicit paths and preserve receipt bytes.
Do not use the old conveyor, `git add -A`, automatic pushes or policy bypasses.