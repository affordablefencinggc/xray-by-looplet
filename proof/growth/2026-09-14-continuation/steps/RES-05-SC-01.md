# RES-05-SC-01: Coordinated Stage Plans, Sections, Elevations, Room/Opening Schedules and Annotations

2026-09-15. COMPLETE for RES-05: Coordinated Stage Plans, Sections, Elevations, Room/Opening Schedules and Annotations on `feat/architect-cad-engine`.

## Requirement
Implement and verify **RES-05** from `INDUSTRY-REMAINING-WORK-PLAN.md`:
1. **Coordinated Stage Plans, Sections, Elevations**:
   - Ensure drawing views reflect stage-specific geometry: before-alteration stage renders original openings, existing walls, and pre-repair heights; proposed stage renders infills, partial-infill voids with explicit aperture borders and labels, new walls/openings, post-repair geometry, and omits demolished structures.
2. **Stage Opening Schedules**:
   - Generate stage opening schedules (`calculateStageOpeningSchedule`, `stageOpeningScheduleCsv`) detailing tags, kinds (`door` | `window` | `void`), dimensions, sills, hinge/swing, host wall, level, lifecycle, stage disposition (`scheduled-for-demolition`, `infill`, `partial-infill-void`, `retained-void`, `new-installation`, `retained-existing`, `repaired`), and replacement status.
3. **Stage Room Schedules & Variance**:
   - Generate stage room schedules (`calculateStageRoomSchedule`, `stageRoomScheduleCsv`) quantifying closed room areas ($\text{m}^2$), perimeters ($\text{m}$), ceiling heights ($\text{m}$), room merge/split variances ($\Delta\text{m}^2$) between before and proposed stages, and identifying orphaned room tags whose coordinates fall outside any closed polygon in that stage.
4. **Annotation Lifecycle / Stage Coordination Audit**:
   - Audit opening tag collisions across stages, identify orphaned room tags, and verify dimension references against existing/retained host walls (`verifyAnnotationCoordination`).
5. **UI Exposure & CSV Export**:
   - Expose 7 schedule tabs in `AlterationStagePreview.tsx` (`Wall breakdown`, `Demolition`, `Salvage & disposal`, `Repair`, `Materials & sync`, `Stage openings`, `Stage rooms`) with metric cards, tables, CSV download buttons with formula-injection neutralization (`'`), and stage coordination notices.
6. **Daniel's Non-Negotiable Proof Standard**:
   - Code diff + targeted unit tests + full architect suite (249 tests) + full regression suite (1,339 tests) + TypeScript typecheck (`tsc --noEmit`) + production web build (`npm run build`) + Fast CDP browser verification with captured framebuffer proof.

## Executed Checks
- **Targeted Coordination Unit Tests**: 5 passed, 0 failed (`src/studio/architect/alterationCoordination.test.ts`) in 317ms.
  - Stage opening schedule categorizes before vs proposed openings with dispositions and replacement mapping.
  - Stage room schedule computes room merge variance ($\Delta\text{m}^2 > 0$) when an internal partition is demolished.
  - Annotation coordination audits opening tag collisions across stage lifecycles.
  - Stage room schedule detects orphaned room tags outside closed boundaries.
  - Stage room schedule computes room split variance ($\Delta\text{m}^2 < 0$) when an internal partition is added.
- **Full Architect Unit Tests**: 249 passed, 0 failed in 1.56s (`src/studio/architect/*.test.ts`).
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 6.91s (`npm test`).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Production Web Build**: `npm run build` completed successfully (Nitro/Vercel output bundle generated, code 0).
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/coordination-demo.scenario.json` (`coord-v4` session).
  - Duration: **3.42 seconds** across 31 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.
  - Verified DOM presence of 7 schedule tabs, active `Stage openings (2)`, active `Stage rooms (2)`, metric cards (`Total floor area: 44.31 m²`, `Rooms count: 2`, `Orphaned tags: 0`), room rows (`Dining 22.16 m²`, `Lounge 22.16 m²`), stage switch to `proposed` (`Lounge 44.83 m²` with `+22.68 m²` merge variance), and CSV export button.

## Visual Proof Artifacts
- `14-stage-coordination.png`: Live browser render of `AlterationStagePreview` displaying:
  - Solid wall volume cards (Before: 17.94141 m³, Proposed: 16.6428 m³, Change: -1.29861 m³).
  - Schedule navigation tab bar with all 7 tabs: `Wall breakdown`, `Demolition (3)`, `Salvage & disposal (3)`, `Repair (0)`, `Materials & sync (0)`, `Stage openings (2)`, and active `Stage rooms (2)`.
  - Action row with `Stage room schedule (before) · 2 rooms` and `Download rooms CSV` button.
  - Metric cards: Total floor area 44.31 m², Rooms count 2, Orphaned tags 0.
  - Room schedule table with columns Room Name, Level, Floor Area, Perimeter, Ceiling Height, Variance (Baseline), Status.
  - Table rows: Dining (22.16 m², 19.22 m perimeter, retained-unchanged), Lounge (22.16 m², 19.22 m perimeter, retained-unchanged).
- `15-stage-openings.png`: Live browser render of `Stage openings (2)` displaying:
  - Metric cards: Total openings 2, Doors 1, Windows 1, Retained voids 0.
  - Table columns: Tag, Kind, Level, Host Wall, Dimensions, Sill, Hinge / Swing, Lifecycle, Disposition.
  - Rows: D01 (door, 900 × 2100 mm, sill 0 mm, left / in, demolished, scheduled-for-demolition), W01 (window, 1500 × 1200 mm, sill 900 mm, left / in, demolished, scheduled-for-demolition).
  - CSV download button.
- `16-stage-rooms-proposed.png`: Live browser render of `Stage rooms (1)` in the Proposed stage displaying:
  - Metric cards: Total floor area 44.83 m², Rooms count 1, Orphaned tags 0.
  - Table row: Lounge (44.83 m², 27.08 m perimeter, ceiling 2.70 m, Variance +22.68 m², Status: altered) reflecting the demolished dividing partition.
  - Canvas drawing area below showing the coordinated proposed plan view with VOID W01.
