# RES-04-SC-01: Demolition, Salvage/Disposal, Repair & Material Schedules and Qualified Material Sync

2026-09-15. COMPLETE for RES-04: Demolition, Salvage/Disposal, Repair & Material Schedules and Qualified Material Sync on `feat/architect-cad-engine`.

## Requirement
Implement and verify **RES-04** from `INDUSTRY-REMAINING-WORK-PLAN.md`:
1. **Four Specialized Alteration Schedules**:
   - **Demolition schedule**: Physical elements (walls, openings, slabs, roofs), solid demolition volumes ($\text{m}^3$), opening cuts/dimensions, slab/roof areas, host associations, and dispositions (`infill`, `retain-void`, `partial-infill`).
   - **Salvage & disposal schedule**: Quantitative breakdown of demolished materials (concrete/masonry rubble volume, timber, removed fixtures), explicit supplied disposal & bulking assumptions (`masonryBulkingFactor: 1.30`, `timberBulkingFactor: 1.20`, routing: `landfill`/`recycling`/`salvage`).
   - **Repair schedule**: Scope of repair for retained elements classified as `repaired`, before-repair dimensions vs proposed dimensions, height deltas ($\text{mm}$), repair volumes ($\text{m}^3$), repair basis references.
   - **Material schedule**: Net material geometry vs gross order quantities (with explicit layer waste allowance percentages) for all proposed new work and infills from the reviewed proposed stage.
2. **Separate Reporting of Unknowns**:
   - Hazardous materials unassessed, missing material densities, unspecified disposal facilities, or uninspected structural conditions are flagged independently from physical totals in explicit callouts.
3. **Qualified Material Sync**:
   - Unblock `designMaterialSyncBlockedReason` in `materialBridge.ts` **only** when a project has a valid, verified `AlterationBasis` and complete reviewed alteration quantities without blockers.
   - Synchronize proposed new and repair work to `ProjectMaterials` with exact stock references, category, and lifecycle calculation metadata.
   - Keep the sync guard strictly locked when the basis is missing, stale, or has blockers; preserve legacy unclassified sync behavior untouched.
4. **UI Exposure & CSV Export**:
   - Tabbed schedule views in `AlterationStagePreview.tsx` (`Wall breakdown`, `Demolition`, `Salvage & disposal`, `Repair`, `Materials & sync`) with metric cards, tables, unknown condition banners, and CSV download buttons with formula-injection neutralization (`'`) for each schedule.
   - Embedded `SyncDesignMaterials` in the materials tab.
5. **Daniel's Non-Negotiable Proof Standard**:
   - Code diff + targeted unit tests + full architect suite (244 tests) + full regression suite (1,339 tests) + TypeScript typecheck + production web build + Fast CDP browser verification with captured framebuffer proof.

## Executed Checks
- **Targeted Alteration Schedule Unit Tests**: 5 passed, 0 failed (`src/studio/architect/alterationSchedules.test.ts`) in 301ms.
  - Demolition schedule quantifies demolished walls, openings, slabs, notes unknowns, and exports valid CSV.
  - Salvage and disposal schedule computes gross disposal volume via bulking factor and flags architectural salvageability.
  - Repair schedule calculates height extension volume and captures repair basis references.
  - Alteration material schedule quantifies new work and repair layers with explicit waste allowances.
  - Unreviewed or invalid basis returns non-ready schedules with explicit blockers.
- **Targeted Material Sync Unit Tests**: 4 passed, 0 failed (`src/studio/architect/alterationMaterialSync.test.ts`) in 330ms.
  - Classified design without reviewed basis strictly blocks sync with phase-aware review notice.
  - Classified design with stale basis blocks sync with specific blocker reason.
  - Classified design with valid reviewed basis unblocks sync and synchronizes proposed new and repair materials to `ProjectMaterials`.
  - Legacy unclassified design syncs untouched without requiring basis.
- **Full Architect Unit Tests**: 244 passed, 0 failed in 1.51s (`src/studio/architect/*.test.ts`).
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 6.02s (`npm test`).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Production Web Build**: `npm run build` completed successfully in 1m 37s (Nitro/Vercel output bundle generated, code 0).
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/schedules-demo.scenario.json` (`scheds-v2` session).
  - Duration: **2.90 seconds** across 21 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.
  - Verified DOM presence of 5 schedule tabs, active `Materials & sync (2)` tab, metric cards (`Total net volume: 1.430 m³`, `Total order area: 17.32 m²`), tabular breakdown with exact layer rows (Repaired Stud, New Partition), CSV download button, and `Sync to project material register` action button.

## Visual Proof Artifacts
- `13-alteration-schedules.png`: Live browser render of `AlterationStagePreview` displaying:
  - Solid wall volume cards (Before: 3.13308 m³, Proposed: 3.127455 m³, Change: -0.005625 m³).
  - Schedule navigation tab bar with all 5 tabs: `Wall breakdown`, `Demolition (2)`, `Salvage & disposal (2)`, `Repair (1)`, and active `Materials & sync (2)`.
  - Action row with `Proposed new & repair material schedule · 2 layers`, `Download materials CSV`, and `Sync to project material register` button.
  - Metric cards: Total net volume 1.430 m³, Total order area (with waste) 17.32 m².
  - Material schedule table with columns Material / Layer, Source Element, Lifecycle, Net Area, Waste %, Order Area, Net Volume.
  - Verified review reference and detailed quantity notes.
