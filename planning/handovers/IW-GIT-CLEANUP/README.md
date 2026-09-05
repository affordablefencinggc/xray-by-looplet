# Local WIP cleanup

User stopped feature and QA work on 2026-09-05 to reduce the working tree. Source preservation checkpoint: f47b9f78516bf3485fcc8a87c82411ca4caf2a68 (30 reviewed source files). This is not feature completion or native application acceptance.

The ignore change retains generated QA images, timestamped reports and downloaded binaries on disk. Existing tracked evidence remains tracked. Reproduction scripts, tests, README files and handovers remain visible. The inventory records 1255 original paths and their SHA-256; 965 became ignored, and every original file was rehashed unchanged. No deletion, reset, stash, untracking, branch or remote change occurred.

Correction: the high-rise files exist at repo-relative downloads/high_rise_plans (four PDF files, two IFC files and README.md). The earlier IW-HIGHRISE-INVENTORY report checked only Windows Downloads and incorrectly treated missing files there as the task blocker. The six binaries are retained locally and ignored; README provenance remains reviewable. No parsing or new processing was performed. Model/drawing compatibility is still unassessed.

QA stopped before overall final acceptance. Prior raw reports and patches remain local context, and the earlier accepted Caroline packet still describes its prior commit only. Canonical historical ledger was not changed. Further control/harness checkpoints require explicit review. Unrelated skill copies, startup scripts, autopilot helper, SWEEPER ledger and the empty {} path remain visible for owner review.

## Final preservation checkpoints

- Browser source: f47b9f78516bf3485fcc8a87c82411ca4caf2a68 (30 files; WIP).
- Initial scoped ignores: cce9a8c2018d3810959b160fa7b9289cb125176d (3 files).
- Historical reproduction archive: 8b103b8d5dc6d6fe1c7f1bf7a8234d61d52a10f5 (108 files). Scripts were not executed or represented as verified. Original CRLF fixture bytes and two existing EOF blank lines were preserved.
- Paused current control: f2106d6905c4e3c769533ced52b9b0843b9b6f47 (60 files). Tracker explicitly says browser WIP/native unverified; original immutable patch bytes preserved. Only visual-browser.mjs line47 trailing CR was trimmed as reviewed.
- Existing workspace launchers and ledger notes: da4788ff257eadf3a53730e332fd00826207e36a (13 files; bytes preserved, no execution).

All 1255 originally observed files remain on disk. 1074 original generated/local paths (326464945 bytes) are now ignored and were rehashed unchanged. The final cleanup stage contains only .gitignore, this handover and remaining-stage-proposal.json. No other working-tree changes are expected after this checkpoint. No resets, stashes, deletions, untracking, branch or remote changes were performed. Native rebuild is the next user-authorized phase after cleanup; this checkpoint does not claim the native app works.
