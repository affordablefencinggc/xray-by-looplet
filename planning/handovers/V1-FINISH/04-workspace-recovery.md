# 04 — Everyday workspace and recovery

**When:** Fri 23 Oct – Tue 3 Nov 2026 (8 days) · **Depends on:** 01

## Goal
Make everyday measuring, navigation, saving and recovery smooth and safe. Everything in scope from INDUSTRY-WIDE, DAY-TO-DAY, PROJECT-BACKUP and DAILY-RECOVERY is included.

## Starting state
- **INDUSTRY-WIDE-TODO:** 31 open lines. In scope:
  - precision set SC-01..06 (reticle, lens wheel zoom, source-coordinate lens, palette, delivery freeze)
  - pointer-mode repair (Area over existing vertices, Select/Move)
  - workspace navigation, diagnostics, plan switcher and header
  - the 10-tab main-pages audit (L52–60)
  - IW-003 cold-start gate, IW-004 core verification, IW-005 source/overlay
  - Caroline and viewer rows, if not moved to the backlog in 00
- **DAY-TO-DAY-TODO:** SC-01..04, SC-07, SC-08. SC-05 (Firecrawl) and SC-06 (staff handoff) are moved to the backlog.
- **PROJECT-BACKUP-TODO SC-04:** apply a package into the editor.
- **DAILY-RECOVERY-TODO:**
  - DR-01 hydration-failure autosave
  - DR-02 backup boundaries
  - DR-03 sheet lifecycle
  - DR-05/05a/06 visible build identity, frozen Dans1 build and staged publication
- **VISIBLE-WORKING-EXAMPLE:** the schedule download stalls as `.crdownload`. Desktop downloads were proven to complete on 23 Sep, so re-check on web.

## Steps
1. Work the INDUSTRY-WIDE precision set SC-01..06 in order. Each item gets a native CDP journey with screenshots at 1024×768 and 768×1024.
2. Pointer-mode repair: fix Area placement over existing vertices and Select/Move hit-testing. Add unit tests in `tracingCanvas.test.ts` / `snapping.test.ts`.
3. Workspace navigation, diagnostics, plan switcher and header, then the 10-tab audit. Every tab gets a journey, a screenshot and a findings list, and every finding is fixed.
4. DAY-TO-DAY SC-01..04, SC-07 and SC-08, per their TODO text.
5. PROJECT-BACKUP SC-04: apply a backup package into the open editor, with preflight, confirmation, undo point and a proof of zero data loss.
6. DAILY-RECOVERY DR-01..03, then DR-05/05a/06. Show the build ID in the app footer and freeze the build via the Dans1 stage.
7. Re-check the `.crdownload` stall in the web build and fix it if it still happens.

## Exit check
- All in-scope lines in these four TODO files are ticked with proof.
- The 10-tab audit has zero open findings.
- A backup applies and restores byte-identically.

## Proof
`proof/growth/<date>-workspace-v1/`: per-item runner reports, screenshots, the tab-audit table, recovery drill logs and a README.
