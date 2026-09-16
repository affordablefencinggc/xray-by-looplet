# RES-06-SC-01: Issue a Frozen Coordinated Alteration Set with Revision Comparison

2026-09-15. COMPLETE for RES-06: Issue a Frozen Coordinated Alteration Set with Revision Comparison on `feat/architect-cad-engine`.

## Requirement
Implement and verify **RES-06** from `INDUSTRY-REMAINING-WORK-PLAN.md`:
1. **Frozen Coordinated Alteration Issue Set**:
   - Bind exact source project, reviewed alteration basis, stage geometry snapshots (`before` and `proposed`), audited annotations, drawing sheets (plans, sections, elevations), and all 6 schedules (Demolition, Salvage & Disposal, Repair, Material, Stage Openings, Stage Rooms).
   - Store immutable, nonrecursive issue records in `project.alterationIssues`.
2. **Supersession Contract**:
   - When a new revision is issued, prior active issues are marked `status: "superseded"` with explicit audit pointers (`supersededAt`, `supersededById`, `supersededByRevision`).
   - Prior issue records and historical project snapshots remain byte-identical and retrievable via `retrieveAlterationIssue`.
3. **Deterministic Revision Comparison**:
   - Compare two alteration issues (or current design against a historical issue):
     - Geometry changes (added/removed/modified walls, openings, rooms).
     - Schedule variances (demolition volume delta, salvage tonnage/m³ delta, repair extension delta, material order area delta, room floor area delta, openings count delta).
     - Sheet differences (added / removed).
4. **Official Multi-Page Issued PDF Deliverable**:
   - `exportAlterationIssueSetPdf`: generates an official multi-page PDF set with cover sheet, issue register, drawing views with standard title blocks, schedule appendices, and prominent `SUPERSEDED` watermarks when applicable.
5. **UI Exposure & Interaction**:
   - Modal for reviewing and issuing the alteration set (`AlterationIssueModal.tsx`).
   - History viewer (`AlterationIssueHistory.tsx`) displaying status badges, PDF download action, and revision comparison drawer.
   - Integration in `AlterationStagePreview.tsx` and `alterationStagePreview.css`.
6. **Daniel's Non-Negotiable Proof Standard**:
   - Code diff + targeted unit tests + full architect suite (254 tests) + full regression suite (1,339 tests) + TypeScript typecheck (`tsc --noEmit`) + production web build (`npm run build`) + Fast CDP browser verification with captured framebuffer proof.

## Executed Checks
- **Targeted Alteration Issue Unit Tests**: 5 passed, 0 failed (`src/studio/architect/alterationIssues.test.ts`) in 516ms.
  - Creating and freezing immutable issue record with source snapshot and 6 frozen schedules.
  - Supersession: issuing revision B marks revision A superseded without mutating historical snapshot bytes.
  - Revision comparison: calculates deltas across model entities, schedules, and drawing sheets.
  - Fail-closed validation: rejects tampered sourceJson or foreign project ID.
  - PDF export: exports multi-page PDF with cover, sheets, schedules, and superseded watermark.
- **Full Architect Unit Tests**: 254 passed, 0 failed in 1.72s (`src/studio/architect/*.test.ts`).
- **Full Test Suite**: 1,339 tests passed across 89 test suites in 7.45s (`npm test`).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) exited code 0 with zero errors.
- **Production Web Build**: `npm run build` completed successfully (Nitro/Vercel output bundle generated, code 0).
- **Fast CDP Browser Verification**:
  - Script: `scripts/fast-cdp-test.mjs` running `proof/growth/cdp-demo/issue-demo.scenario.json` (`issue-v2` session).
  - Duration: **4.27 seconds** across 39 declarative opcodes.
  - Exit code: 0, with 0 uncaught console or runtime exceptions.
  - Verified DOM presence of `AlterationIssueModal` dialog, issue confirmation flow, issue history list with `CURRENT` badge, issuing Revision B, supersession of Revision A to `SUPERSEDED` badge, opening the Revision Comparison drawer, verifying delta rows across geometry, schedules, and sheets.

## Visual Proof Artifacts
- `17-issue-modal.png`: Live browser render of `AlterationIssueModal` displaying:
  - Header: "Issue Coordinated Alteration Set".
  - Explanatory guidance text for freezing coordinated stage drawings and schedules.
  - Required "Issue Purpose" input field populated with default purpose.
  - Audit box detailing Design Revision (A), Basis Reference (Reviewed Stage Coordination Set S01), Registered Sheets (5), and Frozen Schedules (6).
  - Mandatory confirmation checkbox: "I confirm that stage drawings, quantities, and annotations have been reviewed and are ready for official issue."
  - Action buttons: "Issue & Freeze Coordinated Set" and "Cancel".
- `18-issued-history.png`: Live browser render of `Formal Coordinated Issue History (1 records)` displaying:
  - Green `CURRENT` status badge.
  - Revision header: `Rev A — For construction / client sign-off` with timestamp.
  - Metadata row: `Basis: Reviewed Stage Coordination Set S01 | Registered Sheets: 5 | Demolition: 2.307 m³ | Rooms: 1 (44.83 m²)`.
  - Action button: `Download Issued PDF`.
- `19-revision-comparison.png`: Live browser render of `Revision Comparison: Rev A vs Rev B` displaying:
  - Header with "Close Comparison" action.
  - Scope/Quantity delta table comparing Rev A against Rev B:
    - Proposed Wall Solid Volume: `-0.4968 m³` (Modified).
    - Demolition Scope Volume: `0.0000 m³` (Unchanged).
    - Salvage & Disposal Volume: `0.0000 m³` (Unchanged).
    - Repair Scope Volume: `0.0000 m³` (Unchanged).
    - Material Order Area: `0.00 m²` (Unchanged).
    - Room Floor Area: `0.00 m²` (Unchanged).
    - Openings Count: `+1 apertures` (Modified).
  - Issue records list below showing Rev B with `CURRENT` status and Rev A with `SUPERSEDED` status badge.
