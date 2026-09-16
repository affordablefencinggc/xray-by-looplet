# RES-02-SC-02: Partial Infill, Replacement Openings & CDP Verification

2026-09-15. COMPLETE for the partial infill and replacement opening residential architecture slice. Baseline `3abaca2` on `feat/architect-cad-engine`.

## Requirement
Extend the residential renovation and alteration engine to support **partial aperture infill** and **mutually exclusive replacement openings**:
1. Demolished door/window disposition accepts `partial-infill` with an explicit `remainingVoid: { offset, width, height, sill }`.
2. Strict project boundary validation: remaining void must fit within the parent opening (offset, width, height, sill boundary checks).
3. Non-concurrent replacement openings: `validateProject` permits overlapping openings on the same wall if one is `demolished` and the other is `new`, while concurrently overlapping same-stage openings remain strictly rejected.
4. Alteration stage resolver: in `proposed` stage, partial infill replaces the fixture with an explicit `kind: "void"` of the remaining sub-rectangle dimensions; host wall layers close the remainder of the aperture. In `before` stage, the original fixture and cut remain intact.
5. UI exposure: `AlterationPanel.tsx` renders `partial-infill` in the disposition dropdown and displays inputs for remaining void offset, width, height, and sill.
6. Assistant bridge: `architectBridge.ts` and `appTools.ts` accept and validate `partial-infill` operations in `edit_architect_elements`.
7. Alteration schedule & CSV: 14-column spreadsheet header layout strictly preserved with `partial-infill` disposition status.

## Executed Checks
- **Focused Architect Tests**: 28 passed, 0 failed (`src/studio/architect/alterationInfill.test.ts`, `src/studio/architect/alterationPartialInfill.test.ts`, `src/studio/architect/alterationEditIntegration.test.ts`, `src/studio/architect/alterationStage.test.ts`) in 321ms.
- **All Architect Unit Tests**: 229 passed, 0 failed in 1.68s.
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 5.88s (`npm test`).
- **Production Web Build**: `npm run build` completed successfully, producing the complete Nitro / Vercel bundle.
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/partial-infill-demo.scenario.json` over native `agent-browser` CDP.
  - Duration: **4.04 seconds** across 33 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.

## Visual Proof Artifacts
- `08-partial-infill-saved.png`: Alteration panel with D01 demolished door, `partial-infill` disposition saved with remaining void dimensions.
- `09-stage-before-door.png`: Alteration stage preview in `before` stage: full D01 door fixture and swing retained in the wall solid.
- `10-stage-proposed-partial-void.png`: Alteration stage preview in `proposed` stage: aperture reduced to `VOID D01` with wall solid restored.
- `11-stage-south-elevation.png`: Elevation view demonstrating the elevated `VOID D01` aperture at 900mm sill with the lower wall aperture closed by host layers.
