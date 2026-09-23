# Main workspace backup ledger

Authorized: yes, 2026-09-07 — user: “continue”, following the requested save/store-away/recovery and proof work.
Baseline: `3e422f0084de607a775c2ede8dfecdf0b032c75e`, branch `feat/architect-cad-engine`.
Preserve all existing changes and installed-app data. No merge, install or forced process termination in this slice.

- [x] SC-01 Audit and document the main workspace's durable data boundaries. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [x] SC-02 Named immutable local backups, original-byte verification, portable download, validated import preview, archive/unarchive, search and storage errors. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [x] SC-03 Executed corruption/identity/size tests and real browser save/reload/archive/import/download proof; inspect desktop/mobile screenshots; typecheck and production build/render. Proof: `proof/audit/IW-PROJECT-BACKUP`.
- [ ] SC-04 Apply a package back into the editing workspace with recoverable transactions and cross-window conflict protection. This is a separate, unimplemented slice; importing into the library must not imply restoration into the editor. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 04]

SC-02 boundary: current job (including per-document workspaces, calibration, evidence and markups), architecture, BOM, component inventory, fencing recipes, source takeoff, connection review, project materials, saved reference rate sheet, and referenced original plans/photos. Separate construction-runtime jobs, source-model location notes, application preferences, credentials and undo history are outside this package format and must be stated in the UI.

Proof directory: `proof/audit/IW-PROJECT-BACKUP`; screenshots: `screenshots/project-backup`. Nothing is checked before diff plus executed/visual evidence exists.

- [x] SC-15 portable archive: timing correction supported by `proof/growth/2026-09-22-sc15-fast/machine/sc15-under-two-seconds.mjs` and XRAY-PRODUCTION-CLOSEOUT-LEDGER.md SC-15. The 25,609,785-byte PDF exported in 1203.89 ms and 1144.02 ms with restored SHA-256; packaged archive verified and native DWG bytes round-tripped. Historical evidence, not a new execution. SC-04 editor restore acceptance remains separate.

- [x] Bounded clean-storage SVG recovery and tablet archive controls: [42/42 trial, screenshots and diff](proof/growth/2026-09-21-archive-clean/steps/SC15-CLEAN-03.md). Full SC-15 remains open for all-record/DWG coverage, large-PDF timing and production acceptance.
Closeout ledger SC-15 and SC-16 now record [[done]]; older pending notes are superseded by their 2026-09-22 evidence. This correction does not close SC-04.
Document status: open (1)
