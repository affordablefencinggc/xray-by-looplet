# Verification limits and retained failures

The first broad lint attempt lacked the repository's unchanged `eslint.config.mjs` in the isolated transfer. [Receipt](lint-missing-config-03.log). It was copied without editing source and lint rerun.

[Broad folder lint](lint-04.log) still reports five pre-existing errors in `priceBooks.test.ts` (four unnecessary quote escapes) and `priceWorkbookClient.ts` (one unused expression). Both files are unchanged from baseline `f6987a1a`: HEAD and worktree Git blob identities were compared and match, respectively `3e0942a5aea51bb9fa3116e9fc7bfbcd36d542db` and `06a58035a7fb667be0cdd22e942db3123d084a15`. No unrelated lint cleanup was folded into this stage.

[Changed-source lint](lint-changed-05.log) exits 0 with one existing ref-cleanup warning in `PriceBookPanel.tsx`; that unchanged effect predates this change. Typecheck and all 1,958 source tests pass. This is not a claim that the complete repository lint gate passes.

The [initial HVAC test failure](source-tests-02.log) was a new test calling `document.destroy`, absent from this PDF reader API; all mathematical and text checks had passed. Removing that cleanup call produced the passing full regression in `source-tests-03.log`. Browser syntax failures are retained in `v1-quote-issue-dev01` and `v1-hvac-pressure-dev01`; corrected browser campaigns pass.

Desktop browser and simulated tablet viewports were tested on DANS1. No native macOS/Linux, physical tablet, deployment, installer or new Windows-native build acceptance is claimed here. Final build/requalification remains in the live checklist. Launcher results for each browser campaign record task-owned process cleanup; no task-owned preview was retained.
