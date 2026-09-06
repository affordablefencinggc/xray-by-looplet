# Tool-by-tool proof

Verified 2026-09-06. The new takeoff/material flows and existing 3D viewer controls were exercised in real browsers on development and freshly built output, including desktop and mobile interactions. All stock fixtures are fictional QA data; the 3D model is Caroline, not Altitude.

## Takeoff, materials and real-plan tools

[Development execution](../../screenshots/new-tools-proof/dev/report.json) ? [Built execution](../../screenshots/new-tools-proof/built/report.json)

| Tool or behavior | Development | Built |
|---|---|---|
| Open real high-rise plan / source-bound Components | Pass | Pass |
| All / Doors / Windows / Structure filters and inspector selection | Pass | Pass |
| Included floors / evidence disclosure | Pass | Pass |
| Changed count requires note; reviewed unknown rejected | Pass | Pass |
| Count edit / review / packaging invalidates review | Pass | Pass |
| Unknown versus explicit zero count and reset | Pass | Pass |
| Empty register / cancel / required and numeric validation | Pass | Pass |
| Stock unit each: quantity, whole-package volume and specified weight | Pass | Pass |
| Stock unit m: quantity, whole-package volume and specified weight | Pass | Pass |
| Stock unit m2: quantity, whole-package volume and specified weight | Pass | Pass |
| Stock unit m3: quantity, whole-package volume and specified weight | Pass | Pass |
| Stock unit kg: quantity, whole-package volume and specified weight | Pass | Pass |
| Package-weight basis for kg stock / edit revision | Pass | Pass |
| Explicit zero stock and missing fields retain distinct totals | Pass | Pass |
| CSV download safely exports quotes, newlines, formulas and source identity | Pass | Pass |
| Full count JSON export includes current counts, material lines and evidence | Pass | Pass |
| Conflicting saved snapshot blocks overwrite and recovers latest line | Pass | Pass |
| Final reload / mobile export and source navigation | Pass | Pass |
| Complex plan: six distant sheets render and fit with correct page identity | Pass | Pass |
| Oversized plan rejection preserves open source and saved takeoff | Pass | Pass |

## Existing Caroline 3D viewer controls

[Development execution](../../screenshots/new-tools-proof/model-dev/report.json) ? [Built execution](../../screenshots/new-tools-proof/model-built/report.json)

| Tool or behavior | Development | Built |
|---|---|---|
| Prepared source model loading and rendering | Pass | Pass |
| Visual preset / Solid / Fit / PNG export | Pass | Pass |
| Wireframe and gold appearance export | Pass | Pass |
| Plan projection and Orbit projection | Pass | Pass |
| Ground / upper / whole-building selection and roof visibility | Pass | Pass |
| Wall cutaway and exploded view | Pass | Pass |
| Pointer orbit, wheel zoom and Fit reset | Pass | Pass |
| Source SVG export is a real vector artifact | Pass | Pass |
| Mobile model controls and PNG export | Pass | Pass |

Total: **29 browser scenarios per environment**. Expected input-rejection notices are part of the checks. No uncaught browser or console errors were recorded.

## Additional persistence and inventory regression proof

- [Materials dev](../../screenshots/material-register/dev/report.json) and [built](../../screenshots/material-register/built/report.json): legacy migration, duplicates, rejected writes, preserved form, future schema, recovery and CSV calculations.
- [Component integrity dev](../../screenshots/inventory-integrity/dev-report.json) and [built](../../screenshots/inventory-integrity/built-report.json): fastener filter, custom mark, updated M24/revision, resolved RFIs, stale review, disabled missing-document evidence, reload and protected recovery.
- [Existing takeoff built regression](../../screenshots/altitude-takeoff/built/report.json): count review invalidation, page-48 evidence, source switching and recovery.

## Screenshots and exported artifacts

- [Material register: synthetic unit calculations](../../screenshots/new-tools-proof/built/02-all-units-and-coverage.png)
- [Conflicting save protected](../../screenshots/new-tools-proof/built/03-conflict-protection.png)
- [Mobile source page 50](../../screenshots/new-tools-proof/built/05-mobile-source-page.png)
- [Oversized plan rejected without losing work](../../screenshots/new-tools-proof/built/07-plan-limit-preserves-work.png)
- [Mobile 3D before repair](../../screenshots/new-tools-proof/model-mobile-before.png)
- [Mobile 3D after repair](../../screenshots/new-tools-proof/model-built/07-mobile-canvas.png)
- [Caroline solid PNG](../../screenshots/new-tools-proof/model-built/01-caroline-solid.png)
- [Caroline wireframe PNG](../../screenshots/new-tools-proof/model-built/02-caroline-wireframe.png)
- [Caroline cutaway PNG](../../screenshots/new-tools-proof/model-built/04-caroline-cutaway.png)
- [Caroline exploded PNG](../../screenshots/new-tools-proof/model-built/05-caroline-exploded.png)
- [Actual exported SVG](../../screenshots/new-tools-proof/model-built/caroline-ground-plan.svg) and [its browser render](../../screenshots/new-tools-proof/model-built/08-exported-svg-render.png)
- [Synthetic material CSV](../../screenshots/new-tools-proof/built/qa-all-units.csv) and [full takeoff JSON](../../screenshots/new-tools-proof/built/qa-full-takeoff.json)

## Machine checks and remaining boundaries

Build and typecheck pass. Final full test log has **198 script + 356 TypeScript tests = 554 passing tests**. [Logs, exact repair and recovery references](../../proof/audit/IW-NEW-TOOLS-PROOF/completion.md).

Generic dev/built smoke renders visible content with no uncaught errors or horizontal overflow; its comparison still flags development-only annotation/diagnostic canvas/text differences. Its branding heuristic flags the construction utility canvas as a game. This is recorded as a caveat, not claimed as clean generic parity. The feature-specific flows and screenshots were inspected separately.

Altitude remains an early-design source. Verified whole-building stock, window/structural schedules, real storage/weight totals and an Altitude 3D reconstruction are not established. Unrelated application tools are outside this audit.
