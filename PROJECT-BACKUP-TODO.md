# Main workspace backup ledger

Authorized: yes, 2026-09-07 — user: “continue”, following the requested save/store-away/recovery and proof work.
Baseline: `3e422f0084de607a775c2ede8dfecdf0b032c75e`, branch `feat/architect-cad-engine`.
Preserve all existing changes and installed-app data. No merge, install or forced process termination in this slice.

- [x] SC-01 Audit and document the main workspace's durable data boundaries.
- [x] SC-02 Named immutable local backups, original-byte verification, portable download, validated import preview, archive/unarchive, search and storage errors.
- [x] SC-03 Executed corruption/identity/size tests and real browser save/reload/archive/import/download proof; inspect desktop/mobile screenshots; typecheck and production build/render.
- [ ] SC-04 Apply a package back into the editing workspace with recoverable transactions and cross-window conflict protection. This is a separate, unimplemented slice; importing into the library must not imply restoration into the editor.

SC-02 boundary: current job (including per-document workspaces, calibration, evidence and markups), architecture, BOM, component inventory, fencing recipes, source takeoff, connection review, project materials, saved reference rate sheet, and referenced original plans/photos. Separate construction-runtime jobs, source-model location notes, application preferences, credentials and undo history are outside this package format and must be stated in the UI.

Proof directory: `proof/audit/IW-PROJECT-BACKUP`; screenshots: `screenshots/project-backup`. Nothing is checked before diff plus executed/visual evidence exists.

- [ ] SC-15 portable archive: packager and Project Library integration written, not executed. [WIP diff and complete acceptance gaps](proof/growth/2026-09-20-sc15-portable/steps/SC15-CONTAINER-01-WIP.md). Preserve original DWG bytes, prove complete clean-browser restoration and measure the original 20 MB / under-two-second requirement.
