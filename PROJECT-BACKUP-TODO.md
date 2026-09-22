# Main workspace backup ledger

Authorized: yes, 2026-09-07 — user: “continue”, following the requested save/store-away/recovery and proof work.
Baseline: `3e422f0084de607a775c2ede8dfecdf0b032c75e`, branch `feat/architect-cad-engine`.
Preserve all existing changes and installed-app data. No merge, install or forced process termination in this slice.

- [x] SC-01 Audit and document the main workspace's durable data boundaries. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [x] SC-02 Named immutable local backups, original-byte verification, portable download, validated import preview, archive/unarchive, search and storage errors. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [x] SC-03 Executed corruption/identity/size tests and real browser save/reload/archive/import/download proof; inspect desktop/mobile screenshots; typecheck and production build/render. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [ ] SC-04 Apply a package back into the editing workspace with recoverable transactions and cross-window conflict protection. This is a separate, unimplemented slice; importing into the library must not imply restoration into the editor. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box.

SC-02 boundary: current job (including per-document workspaces, calibration, evidence and markups), architecture, BOM, component inventory, fencing recipes, source takeoff, connection review, project materials, saved reference rate sheet, and referenced original plans/photos. Separate construction-runtime jobs, source-model location notes, application preferences, credentials and undo history are outside this package format and must be stated in the UI.

Proof directory: `proof/audit/IW-PROJECT-BACKUP`; screenshots: `screenshots/project-backup`. Nothing is checked before diff plus executed/visual evidence exists.

- [ ] SC-15 portable archive: 19 archive tests and controlled local UI round trip 29/29 pass. [Tests, screenshots, exact diff and remaining gaps](proof/growth/2026-09-21-local-verification/steps/SC15-LOCAL-02-WIP.md). Preserve original DWG bytes, prove complete clean-browser restoration and measure the original 20 MB / under-two-second requirement; production and UI polish remain open. Blocker: the under-two-second rule is unmet. Next: change the plan-byte path or remeasure before checking this box.

- [x] Bounded clean-storage SVG recovery and tablet archive controls: [42/42 trial, screenshots and diff](proof/growth/2026-09-21-archive-clean/steps/SC15-CLEAN-03.md). Full SC-15 remains open for all-record/DWG coverage, large-PDF timing and production acceptance.
Closeout ledger SC-15 stays [[pending]]: the under-two-second rule is unmet. Closeout ledger SC-16 stays [[pending]]. Machine notes: `proof/growth/2026-09-21-archive-clean/steps/PROOF-LARGE-PDF-05.md` and `proof/growth/2026-09-22-sc16-lock/steps/SC16-LOCK-01.md`. Neither slice is done.
Document status: open (2)
