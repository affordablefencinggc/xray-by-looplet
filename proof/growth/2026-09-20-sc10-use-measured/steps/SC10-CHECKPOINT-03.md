# SC-10 — byte-preserving approved checkpoint

Daniel approved the four named documents and this proof folder on 2026-09-20. No other paths are included.

Staging exposed default CRLF-to-LF conversion of captured receipts. The [exact scoped attributes diff](../checkpoint-attributes.diff) preserves evidence bytes inside this folder only. Captured logs retain their original endings; patch context spaces are retained. Source and documentation whitespace checks remain enabled.

Executed local Git integrity check (not a DANS1 product test): after explicit `git add --renormalize -- proof/growth/2026-09-20-sc10-use-measured/`, compare each staged blob ID from `git ls-files --stage` with `git hash-object --no-filters` of its on-disk file. Result: **133/133 byte-identical**, including the new attributes file. `git diff --cached --check`: **PASS**. No receipt was rewritten or normalized on disk.

Accompanying [inspected tablet dashboard screenshot](../dashboard-final/browser/captures/dashboard-summary-tablet-1024x768.png) shows the resulting SC-10 closeout record; it is an existing DANS1 capture whose exact bytes are preserved, not a new screenshot of Git. Product test, screenshot and source-diff evidence remain in [SC10-USE-MEASURED-01](SC10-USE-MEASURED-01.md); generated-document evidence remains in [SC10-DASHBOARD-02](SC10-DASHBOARD-02.md). Their earlier statements awaiting approval record the pre-approval state and are superseded by this checkpoint record.

The original 856 untracked files and the other writer's `CODEX-HOVER-LOG.md` changes are excluded. No application source, shared workbench, HVAC, old proof or dashboard KPI was changed during checkpoint packaging.
