## [D-02 / D-04 / D-05] Source-sheet lifecycle acceptance: rename, archive review with saved views, recover with evidence intact

**Date:** 2026-09-08 (repair round)  
**Branch:** `feat/architect-cad-engine`  
**Commit / working state:** uncommitted (shared dirty tree; slice SC-03, files below only)  

### Scope

Executed and inspected acceptance of the existing source-sheet lifecycle (`sheetLifecycle.ts`, `SheetManager.tsx`) against the 13-page Redburn PDF on the development server, closing one bounded gap: the archive review now also lists the saved views stored on the page. In this product "remove" is archive (page bytes and slot are kept) and "restore" is recover; both are assessed as the D-04/D-05 lifecycle. The repair round adds executed proof that a page's scale record and annotations survive archive, reload, recover and reload (unit test with job evidence; browser run with a real locked scale and a real sketch annotation on page 2). Authored architectural sheets are a separate lifecycle and are not covered.

### Checklist

- [x] `D-02` — Sheet names and numbers: rename changes labels without breaking evidence references (recommend verified-in-development)
- [x] `D-04` — Remove with impact preview: review lists dependent takeoffs, links and viewports before removal (recommend verified-in-development for job-model dependents; construction takeoff registers are not page-scoped, see limitation)
- [x] `D-05` — Restore removed sheets: restored sheet recovers annotations, scale and original ordering (recommend verified-in-development as archive → recover; annotation and scale survival now executed in unit test and browser)
- [x] Evidence / provenance impact reviewed (source SHA and page count asserted unchanged at every step; annotation carries `sourceSha256` = fixture SHA and `source-page-v1`; no source bytes touched)
- [x] Desktop proof captured (1280x800)
- [x] Tablet 1024x768 proof captured
- [x] Logic proof captured (37/37 focused tests, typecheck exit 0)

### Files changed

- `src/studio/sheetLifecycle.ts`
- `src/studio/SheetManager.tsx`
- `src/studio/sheetLifecycle.test.ts`
- `proof/growth/2026-09-08-az3-sheets/**` (README, code.diff, tests.log, typecheck.log, six scenario files, this entry)
- `screenshots/growth/2026-09-08-az3-sheets/**`

### Exact diff summary

`sheetArchiveImpact(job, identity, pageIndex, lifecycle?)` accepts the lifecycle value as an optional fourth argument, refuses a lifecycle whose storage key differs from the identity, and returns a new `savedViews` count (bookmarks on that page). `SheetManager.reviewArchive` passes the current lifecycle value and the review box renders a sixth row "Saved views retained". Archive/recover/move/rename semantics are unchanged. Tests: existing impact assertion extended with `savedViews:0`; new D-04 (per-page saved-view counts, foreign lifecycle refused), D-02 (rename leaves order, other pages, bookmarks, job evidence and impact counts identical) and D-05 (archive middle page with a scale record, trace, item, linked photo and two annotations on it; evidence deep-equal and impact counts identical after archive and after recover; move both neighbours; recover: same slot, same metadata; only the lifecycle key written; export order `[3,2,4,1]`). No CSS change was needed.

### Evidence and data status

- **Document source:** `web` (Redburn BR250157 prelim council PDF via the Model pane import path)
- **SHA-256 status:** `verified` — `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`, 13 pages, asserted unchanged before and after rename, calibration, annotation, archive, recover and every reload
- **Calibration status:** `locked` on page 2 for the browser run (two-point manual, 1 unit = 0.011878036323035074 m, `source-page-v1`); asserted still locked with the same value and candidate after archive, reload, recover and reload; 13 calibration records throughout
- **Affected evidence states:** none changed; one sketch annotation ("Manual trace", 7.863 m, 3 points, sheet 1) byte-identical at every step; lifecycle metadata is a sidecar keyed by original page index
- **Quote / BOM status:** `not applicable` (archive invalidates no estimate; review text states this)
- **Limitations:** development server only; no production build or native run; measured traces / located items were 0 in the browser fixture (retention proven by unit test); canvas points were placed with synthetic PointerEvents from eval; construction takeoff registers carry no page index in stored rows and are not counted; the floating Live assistant dock can cover "Confirm archive" at 1280x800 when the review sits at the bottom-left (outside this slice's files).

### Verification executed

```text
node --experimental-strip-types --test src/studio/sheetLifecycle.test.ts src/studio/sheetBookmarks.test.ts src/studio/documents.test.ts src/studio/domain.test.ts
tests 37, pass 37, fail 0 (baseline 34/34; first-round red phase 3 failures on the missing savedViews field; the repair-round D-05 evidence assertions passed first time against the existing behaviour)
```

```text
node node_modules/typescript/bin/tsc --noEmit
exit 0
```

```text
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-0-import.json                 exit 0
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-a-rename-desktop.json         exit 0
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-a2-annotate-desktop.json      exit 0
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-b-archive-recover-desktop.json exit 0
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-c-tablet.json                 exit 0
node scripts/fast-cdp-test.mjs az3-sheets-repair-a proof/growth/2026-09-08-az3-sheets/scenario-d-archived-row-desktop.json   exit 0
Runner reports: proof/growth/runner/2026-09-08T13-02-14-144Z, 13-05-52-044Z, 13-06-56-029Z, 13-08-31-319Z, 13-09-30-022Z, 13-10-47-881Z (all -az3-sheets-repair-a.json); every scenario ended with a passing `errors` opcode.
```

### Visual proof

- Desktop: `screenshots/growth/2026-09-08-az3-sheets/A2-after-rename-desktop.png`, `A4-page2-scale-locked-desktop.png`, `A5-page2-annotation-desktop.png`, `B0-renamed-heading-desktop.png`, `B1-archive-review-desktop.png`, `B2-archived-list-after-reload-desktop.png`, `D1-archived-row-desktop.png`, `B3-after-recover-reload-desktop.png`, `B4-recovered-page-annotation-desktop.png`
- Tablet 1024x768: `screenshots/growth/2026-09-08-az3-sheets/C1-archive-review-tablet.png`, `C2-archived-list-tablet.png`
- Interaction state: `screenshots/growth/2026-09-08-az3-sheets/C3-after-recover-tablet.png`

### Result

Rename changed only the page's name/discipline: the lifecycle order, its saved view, the other pages and the job's calibration/annotation/run/gate counts were byte-for-byte unchanged, and the new name appeared in the register row, pane heading and sidebar navigation before and after reload. With a locked scale and a real sketch annotation on page 2, the archive review listed six dependent record types (Calibrations 1, Annotations 1, Saved views 1, others 0) without mutating storage until confirmation; archive removed the page from the Active list and navigation, kept its managed slot and metadata, left the job record's 13 calibration records and the annotation byte-identical, and survived reload. Recover returned original page 2 to slot 1 with the same order `[0..12]`, identical metadata, the same locked scale and the same annotation (still drawn and listed on the recovered page in the Sketch pane), persisting across a further reload; the unit test proves the same with neighbours moved while archived and in the exported register. Tablet controls measured ≥ 44 px with no horizontal overflow; zero uncaught runtime errors.

### Remaining work

- Coordinator to decide whether the row's "takeoffs" wording includes the SHA-bound construction takeoff registers (not page-scoped in stored rows); if so hold D-04 at partial.
- Live assistant dock overlap with the review's Confirm button at 1280x800 belongs to the panel owner.
- Production build and installed/native run proof remain parent-owned gates.
