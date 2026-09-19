# SC11-HYGIENE-06 — approved exact-file source-control cleanup

Result: **856/856 original files preserved unchanged; all 856 inventoried legacy files are now excluded from source-control noise.** This is configuration/preservation verification, not a new product acceptance claim. No legacy file was deleted, moved, staged or committed by this hygiene task.

## Approval and exact change

Daniel's initial approval was **“Approve checkpoint, local exclusions and new branch”**, covering the explicitly presented SC-11 checkpoint, exact-file local exclusions and later `feat/closeout-sc09-remainder` branch. The first local-only pass hid 561 paths; 295 logs remained visible because the existing root `!/proof/growth/**/*.log` exception outranked local rules. That honest intermediate result remains in [HYGIENE-PRECHECK](../hygiene/HYGIENE-PRECHECK.md) and its original receipts.

Daniel then replied **“Approve both paths”** to the question naming `.gitignore` and `dashboard-curated-images.json`. This task applied only the previously proposed **295 anchored literal log paths** to root `.gitignore`. The lead owns the curated-images change, staging, checkpoint/push and branch operation. The shared hover log remains untouched.

- [Exact root-ignore diff](../hygiene/root-log-exclusions-applied.diff).
- [Previously applied local-ignore diff](../hygiene/local-exclude-applied.diff).
- [Root-ignore original-byte backup](../hygiene/root-gitignore-before-295-log-rules.bin), with [pre-change identity and approval receipt](../hygiene/root-gitignore-before-295-log-rules.json).
- [856-file frozen preservation manifest](../hygiene/legacy-preservation-manifest.json): **30,255,382 bytes**, individual SHA-256 values, categories and exact path rules.

## Executed verification

[Final result](../hygiene/final-root-log-results.json), [per-file Git rule matches](../hygiene/final-856-ignore-matches.json) and [post-change preservation hashes](../hygiene/final-856-preservation.json) establish:

- **856/856 originals still exist**, same byte counts and SHA-256 values as before cleanup.
- **561** paths resolve to `.git/info/exclude`; the remaining **295** resolve to the new exact root rules. No broader folder rule was substituted.
- Visible legacy files progressed **856 → 295 → 0**. The changing number of new SC-11 proof files is separately recorded at each observation; it is not attributed to legacy cleanup.
- The complete original **31,806-byte `.gitignore` prefix remains byte-identical**. Existing local-exclude content and the historical intermediate receipts remain preserved.
- Every current file under the named SC-11 proof root remains unignored, including tracked and untracked files checked with `--no-index`.
- Future adjacent `.log`, `.png` and `.json` paths remain visible, explicitly including `proof/growth/runner/future-adjacent-proof.log` and `proof/growth/2026-09-19-sc11-pdf-qualification/future-adjacent-proof.log`.

Commands were filesystem SHA-256 checks plus `git check-ignore --no-index --verbose --stdin -z` and read-only Git inventory, implemented in [the metadata verifier](../hygiene/verify-root-log-exclusions.mjs). **No application test ran on DANIEL.** No stage, commit, push or branch change was performed by this helper. The lead was staging its approved checkpoint concurrently; staged-path observations in the receipts belong to that activity.

## Accompanying screenshot and limits

[Mounted SC-11 export panel](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-mounted-export-details-desktop-1600x1000.png) supplies the accompanying work-context screenshot. It shows the product checkpoint being prepared, **not Git exclusion behavior**. The actual configuration behavior is established by the executed matches, exact diffs and preservation hashes above.

Ignoring a file is not deleting it, backing it up remotely or proving it redundant. The original proof—including the potentially unique PDF receipts—remains on disk. `.git/info/exclude` is local-only and must not be staged. The original proposal artifacts remain preserved as dated preparation records; this final step supersedes their earlier “not applied” state.
