# SC-11 checkpoint hygiene — exact-file preservation

Result at 2026-09-19T15:32:31Z: **856 original files preserved byte-for-byte; 561 effectively excluded locally; 295 logs still visible.** No deletion, move, staging, commit or branch change was performed by this hygiene task. The approved SC-11 checkpoint and branch change remain the lead agent's responsibility.

## Frozen approval and boundaries

Daniel's reply, forwarded verbatim by the lead agent:

> Approve checkpoint, local exclusions and new branch

The approved question was:

> Approve this exact SC‑11 checkpoint scope, commit/push after proof passes, then create feat/closeout-sc09-remainder? I can also hide the 856 inventoried leftovers using exact-file local Git exclusions; all bytes stay on disk and future proof stays visible. The shared hover log remains untouched.

Only anchored literal paths were appended to local `.git/info/exclude`. No directory wildcards were added. The new `proof/growth/2026-09-20-sc11-mounted-package/` proof is outside the exclusion list. Root `.gitignore` was **not changed**. Hiding the remaining logs requires a separately approved root-ignore change; the proposal below has not been applied.

## Preservation and executed metadata checks

- [Original manifest](legacy-preservation-manifest.json): **856 paths / 30,255,382 bytes**, per-file SHA-256, category and proposed literal rule. Manifest SHA-256: `2c5991e56cae4bf0b336a06f3c2b259d0ddfa582e9191198d6cc46cf5170568f`.
- [Precheck receipt](precheck-results.json): branch `feat/architect-cad-engine`, HEAD `6f82b9340b2fd33d195c78ee9029cc4deee84644`, local upstream comparison **0/0**, index empty at 15:29:20Z. No fetch was performed by this audit.
- [Original local-exclude byte backup](git-info-exclude-before-2026-09-19T15-29-19.382Z.bin): 20,225 bytes, SHA-256 `6e3dfffe885abd5432d60605a86dd0e041586e6c2047f6f7faa85c1554d416c4`.
- [Applied exact configuration diff](local-exclude-applied.diff): append-only rule content. `apply_patch` changed one context-line newline; a mechanical format repair restored the backed-up original mixed CRLF/LF prefix. The final **20,225-byte original prefix is byte-identical**, not merely text-equivalent.
- [Executed `git check-ignore` matches](local-exclude-matches.json): all 856 intended paths examined. **561** resolve to the new exact local rules. **295** resolve to root `.gitignore`'s existing `!/proof/growth/**/*.log` negation, which has higher priority and keeps them visible.
- [Post-change hashes](legacy-after-preservation.json): **856/856 unchanged**, all originals still on disk. This manifest is an identity record, not a second backup of every file's contents.
- [Final metadata receipt](local-exclude-results.json): five hypothetical adjacent/future paths remain visible; SC-11 proof remains outside the excluded scope. The total visible-untracked count was 459 at this observation, including the 295 legacy logs and the lead's growing SC-11 proof. Six source files had been staged concurrently by the lead by then; this task did not stage them.

The current local exclude is 106,979 bytes, SHA-256 `e36a5a6bc39991d10b8d8b29731616e567efce80243f8468d46d50c2aac2d648`. The original 856-file visible count has fallen to **295**, a reduction of **561**; no claim that all 856 are hidden is made.

## Shared hover log preserved, not edited

[Dated original-byte snapshot](CODEX-HOVER-LOG-2026-09-19T15-29-19.382Z.md) and [its diff against HEAD](CODEX-HOVER-LOG-2026-09-19T15-29-19.382Z.diff) preserve the shared writer's state at capture. Snapshot SHA-256: `15564ba40000825ed80f374d5c728bb990562085d9df9b50e3d64bb44d63bccf`. The live hover file was read twice to establish a stable capture and was not edited. Subsequent watcher writes are not constrained by this snapshot.

## Pending 295-log proposal — not applied

[Exact anchored log rules](proposed-root-gitignore-log-exclude.txt) and [proposed root-ignore patch](root-gitignore-log-proposal.diff) would override the existing root negation only for these 295 already inventoried files. They add no parent-directory pattern and do not hide future adjacent evidence. Root approval is still pending; local rules cannot override the repository's higher-priority negation.

## Accompanying work-context screenshot

[Mounted SC-11 export panel](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-mounted-export-details-desktop-1600x1000.png) shows the product work awaiting checkpoint. It is **not evidence of Git exclusion behavior**; the executed match records, per-file hashes and exact diff above provide that proof. No application checks ran on DANIEL for this hygiene operation.

Preparation/verification helpers: [preservation metadata](prepare-preservation.mjs), [local-exclusion verification](verify-local-exclusions.mjs). Do not rerun the original precheck after hiding files and mistake its expected-856 guard for a preservation failure; subsequent verification uses the frozen manifest.
