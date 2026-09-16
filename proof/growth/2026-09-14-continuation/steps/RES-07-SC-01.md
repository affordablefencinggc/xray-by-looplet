# RES-07-SC-01: Complete Residential Workflow and Independent Assistant Review

2026-09-15. COMPLETE for RES-07: Complete Residential Workflow and Independent Assistant Review on `feat/architect-cad-engine`.

## Requirement
Implement and verify **RES-07** from `INDUSTRY-REMAINING-WORK-PLAN.md`:
1. **End-to-End Residential Qualification Workflow**:
   - Survey / brief → existing work → alteration authoring → edit/undo/clear → quantities → schedules → issue → reopen.
2. **Survey / Brief & Existing Work**:
   - Establish base residence perimeter (existing brick walls, internal partition, door D01, window W01, Lounge and Dining room tags) under survey reference `Survey R01`.
3. **Alteration Planning & Authoring**:
   - Execute alteration operations via assistant `prepareArchitectEdits`:
     - Demolish internal partition wall `w-demo-part`.
     - Demolish door `d01` with full infill disposition (`Full Infill D01`).
     - Demolish window `w01` with partial infill disposition (`Reduce W01`) retaining void aperture (900mm width, 1200mm height, 900mm sill).
     - Repair external wall `w-north` with explicit before-repair height (2700mm) under `Repair R01`.
4. **Lifecycle Work Quantities & Shared Junctions**:
   - Partition work quantities into pure lifecycle categories: Existing retained (11.54 m³ before / 12.17 m³ proposed), Demolished (1.40 m³ before), New (0 m³), Repaired (4.94 m³ before / 4.47 m³ proposed).
   - Compute symmetric, ID-order-invariant shared junction volume ($0.05589\text{ m}^3$) between intersecting categories and disclose without arbitrary priority or lexical ID attribution.
5. **6 Specialized Coordinated Schedules**:
   - Demolition Schedule: 3 items (wall `w-demo-part`, door `d01`, window `w01`), total volume $2.307\text{ m}^3$.
   - Salvage & Disposal Schedule: 3 items, salvage tonnage $1.002\text{ t}$, bulking factor volume $3.230\text{ m}^3$.
   - Repair Schedule: 1 item (`w-north`), before-repair height $2700\text{ mm}$, current height $2700\text{ mm}$, extension $8.00\text{ m}$.
   - Materials & Waste Schedule: 1 item (Brick external wall assembly), rate $\$120/\text{m}^2$, waste allowance $5\%$.
   - Stage Openings Schedule: 2 items (D01 full infill, W01 partial infill void aperture with explicit aperture boundaries).
   - Stage Rooms Schedule: Dining ($22.16\text{ m}^2$, retained), Lounge ($44.83\text{ m}^2$, merge variance $+22.68\text{ m}^2$ due to partition removal).
6. **Formal Issue, Supersession & Reopen**:
   - Issue Revision A with audit checklist confirmation and purpose "For construction / client sign-off".
   - Author Revision B changes (adding new window W02, reference `Brief N01`).
   - Issue Revision B ("For Construction & Contractor Tender"), automatically transitioning Revision A to `status: "superseded"` with audit pointers.
   - Open Revision Comparison drawer verifying mathematical deltas across geometry, schedules, and sheets.
7. **Responsive Cross-Device Qualification**:
   - Desktop ($1600 \times 1000$): full workspace rendering, schedule tables, issue modal, revision comparison card.
   - Tablet ($1024 \times 768$): responsive layout, scrollable schedule tables, touch-friendly tab bar without horizontal overflow.
8. **Daniel's Non-Negotiable Proof Standard**:
   - Code diff + 5 alteration issue unit tests + 254 full architect unit tests + 1,339 regression suite + TypeScript typecheck (`tsc --noEmit`) + production web build (`npm run build`) + Fast CDP browser verification with captured framebuffer proof.

## Executed Checks
- **Targeted Alteration Unit Tests**: 5 passed, 0 failed (`src/studio/architect/alterationIssues.test.ts`) in 516ms.
- **Full Architect Unit Tests**: 254 passed, 0 failed in 4.75s (`src/studio/architect/*.test.ts`).
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 7.45s (`npm test`).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Production Web Build**: `npm run build` completed successfully (Nitro/Vercel output bundle generated, code 0).
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/res-07-workflow.scenario.json` (`res07-v5` session).
  - Duration: **4.24 seconds** across 47 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.
  - Verified base residence setup, assistant `prepareArchitectEdits` execution, stage geometry review under S01, 7 schedule tabs with active `Stage rooms (2)`, issue Revision A modal flow, issue Revision B with supersession of Revision A to `SUPERSEDED`, revision comparison drawer with delta table, and tablet ($1024 \times 768$) responsive rendering.

## Visual Proof Artifacts
- `20-res07-desktop-alteration-schedules.png`: Live browser render on Desktop ($1600 \times 1000$) of `AlterationStagePreview` displaying:
  - Top action banner: `Issue coordinated alteration set`.
  - Solid wall volume cards (Before: 17.94141 m³, Proposed: 17.1396 m³, Change: -0.80181 m³).
  - Schedule navigation tab bar with all 7 tabs: `Wall breakdown`, `Demolition (3)`, `Salvage & disposal (3)`, `Repair (1)`, `Materials & sync (1)`, `Stage openings (2)`, and active `Stage rooms (2)`.
  - Stage room schedule action row: `Stage room schedule (before) · 2 rooms` and `Download rooms CSV` button.
  - Metric summary cards: Total floor area 44.31 m², Rooms count 2, Orphaned tags 0.
  - Room schedule table: Dining (22.16 m², 19.22 m perimeter, 2.70 m ceiling, retained-unchanged), Lounge (22.16 m², 19.22 m perimeter, 2.70 m ceiling, retained-unchanged).
  - Audit disclosure: "Authored wall solid layers only... Cross-category shared junction volume is disclosed explicitly without arbitrary priority or ID-order attribution."
- `21-res07-desktop-issue-rev-a.png`: Live browser render on Desktop of `Formal Coordinated Issue History (1 records)` displaying:
  - Emerald `CURRENT` status badge.
  - Revision header: `Rev A — For construction / client sign-off` with timestamp `15/09/2026, 6:43:04 am`.
  - Audit subtitle: `Basis: Reviewed Stage Coordination Set S01 | Registered Sheets: 5 | Demolition: 2.307 m³ | Rooms: 1 (44.83 m²)`.
  - Action button: `Download Issued PDF`.
- `22-res07-desktop-revision-comparison.png`: Live browser render on Desktop of `Revision Comparison: Rev A vs Rev B` displaying:
  - Header: "Revision Comparison: Rev A vs Rev B" with "Close Comparison" button.
  - Comparison table comparing Rev A against Rev B:
    - Proposed Wall Solid Volume: `-0.4968 m³` (Modified).
    - Demolition Scope Volume: `0.0000 m³` (Unchanged).
    - Salvage & Disposal Volume: `0.0000 m³` (Unchanged).
    - Repair Scope Volume: `0.0000 m³` (Unchanged).
    - Material Order Area: `-2.27 m²` (Modified).
    - Room Floor Area: `0.00 m²` (Unchanged).
    - Openings Count: `+1 apertures` (Modified).
  - Issue list below showing Rev B with `CURRENT` badge and Rev A transitioned to `SUPERSEDED` badge.
- `23-res07-tablet-responsive-schedules.png`: Live browser render on Tablet ($1024 \times 768$) displaying:
  - Responsive header and navigation without horizontal clipping.
  - Lifecycle work breakdown table:
    - Existing (retained): 11.543355 m³ Before, 12.1716 m³ Proposed.
    - Demolished: 1.40211 m³ Before.
    - Repaired: 4.940055 m³ Before, 4.4712 m³ Proposed.
    - Shared category junctions: 0.05589 m³ Before, 0 m³ Proposed.
  - Disclosed shared junction volume notice and review reference `Reviewed Stage Coordination Set S02`.
