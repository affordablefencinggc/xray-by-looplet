# RES-03-SC-01: Lifecycle Work Quantity Allocation & Shared-Volume Resolution

2026-09-15. COMPLETE for RES-03: Lifecycle Work Quantity Allocation & Shared-Volume Resolution on `feat/architect-cad-engine`.

## Requirement
Implement and verify **RES-03** from `INDUSTRY-REMAINING-WORK-PLAN.md`:
1. **Explicit Lifecycle Classification Allocation**:
   - Work quantities are partitioned into pure lifecycle classifications: `existing` (retained), `new`, `demolished`, and `repaired`.
2. **ID-Order Invariant Shared Junction Resolution**:
   - Cross-lifecycle shared boundaries and junctions (e.g. perpendicular existing/new wall corners or T-junctions) are resolved symmetrically.
   - Eliminates lexical ID priority (`localeCompare`) from shifting physical volume between walls upon renaming or reordering.
3. **Explicit Cross-Category Shared Volume Disclosure**:
   - Shared boundary intersections between distinct lifecycle categories are disclosed explicitly as `sharedJunctionVolumeM3` (`beforeSharedJunctionVolumeM3` and `proposedSharedJunctionVolumeM3`), rather than being arbitrarily stolen by either category.
   - Volume conservation is maintained exactly: pure category volumes plus shared junction volume equals total stage solid volume to within floating-point precision ($10^{-8}$).
4. **UI Breakdown Table & Disclosures**:
   - `AlterationStagePreview.tsx` exposes a tabular lifecycle work breakdown (Existing retained, Demolished, New, Repaired, Shared category junctions) alongside an informative notice for unresolved shared volume.
5. **Preserved Governance Guards**:
   - Material-sync guard in `materialBridge.ts` remains strictly locked (`designMaterialSyncBlockedReason`).
   - Slabs, roofs, and contents remain excluded from wall-solid calculations.

## Executed Checks
- **Focused Lifecycle Quantity Tests**: 6 passed, 0 failed (`src/studio/architect/alterationLifecycleQuantities.test.ts`) in 307ms.
  - Coincident replacement ($2.16\text{ m}^3$ each, delta $0\text{ m}^3$).
  - T-junction crossing ($0.054\text{ m}^3$ shared volume isolated, exact ID-order invariance under swapped IDs and reversed arrays).
  - Unequal-thickness corner without mitre ($0.02025\text{ m}^3$ shared volume symmetrically isolated).
  - Infill, retain-void, and partial-infill volume tracking.
  - Changed-repair before ($1.92\text{ m}^3$) vs proposed ($2.16\text{ m}^3$) height attribution.
  - 3-way junction (existing, new, repaired) exact volume conservation under ID permutations.
- **Full Architect Unit Tests**: 235 passed, 0 failed in 1.49s (`src/studio/architect/*.test.ts`).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 6.61s (`npm test`).
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/volume.scenario.json` (`volume-demo` session).
  - Duration: **7.72 seconds** across 19 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.
  - Verified DOM presence of `.alteration-breakdown-table` with 5 classification rows, exact tabular values, and the shared junction notice.

## Visual Proof Artifacts
- `12-lifecycle-quantities-table.png`: Alteration stage preview rendering the solid wall volume cards, the tabular lifecycle work breakdown (Existing retained, Demolished, New, Repaired, Shared junctions), and the explicit shared junction notice for cross-category boundary intersections.
