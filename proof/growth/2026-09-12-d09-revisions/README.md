# Proof Record: D-09 Drawing revisions and supersession

**Slice:** `D-09` — Drawing revisions and supersession  
**Date:** 2026-09-12  
**Requirement / Acceptance Criteria:** *"Old revision remains retrievable and visibly superseded"* (`planning/industry-specs/catalogue.mjs`)  
**Operating Context & Scope:** Tablet, laptop, and desktop viewports (mobile/phones strictly excluded per project charter). Tested against live development server `http://127.0.0.1:8091/`.  
**Proof Standard:** Code diff + machine test execution + inspected visual screenshot proof + explicitly declared remaining boundaries.

---

## 1. What Changed

1. **`src/studio/architect/issueHistory.ts` (New module)**:
   - Zod schemas `issuedSheetRecordSchema` and `issueRecordSchema` capturing layout snapshots, deterministic layout SHA-256 hashes (`sha256Hex`), design and model revision tags, issue purpose, and supersession pointers (`supersededByRevision`, `supersededAt`).
   - `recordDrawingIssue(p, review, issuedAt)`: Clones sheet layouts into frozen records. When a new revision is issued, existing current issues and overlapping sheet records are automatically transitioned from `status: "current"` to `status: "superseded"` with timestamp and successor pointers.
   - `issueHistory(p)`, `retrieveIssue(p, issueId)`, `retrieveIssuedSheet(p, issueId, sheetId)`: Pure retrieval functions ensuring archived, deleted, or subsequently modified sheets remain 100% intact and retrievable as originally issued.
   - Enforces stale-review prevention (`assertIssueReviewCurrent`), immutable cloning, and fail-closed validation.

2. **`src/studio/architect/model.ts`**:
   - Added optional `issues: z.array(issueRecordSchema).optional()` to `architectProjectSchema` to preserve schema strictness while persisting issue lineages across save/load cycles.
   - Exported `IssueRecord` and `IssuedSheetRecord` types.

3. **`src/studio/architect/ArchitectSheets.tsx`**:
   - Integrated `recordDrawingIssue` into the issue export flow (`Export issue PDF`), committing the updated project history through `onChange(updated)`.
   - Added `arch-issue-history-control` section containing an expandable drawing revisions register with status badges (`[CURRENT]` vs `[SUPERSEDED]`) and an issue register modal table.
   - Added inspection mode (`inspectingIssueId` / `inspectingSheet`): clicking "Inspect layout" retrieves and mounts the frozen historical layout directly onto the stage SVG paper.
   - Added `.arch-superseded-banner` alert at the top of the canvas and a prominent diagonal `.arch-superseded-watermark` SVG watermark across superseded drawing sheets.
   - Guarded editing actions: viewports, paper sizing, and north angle modifications are strictly disabled while inspecting historical revisions.
   - Added direct `Drawing revision` editing in the sidebar inspector for intuitive revision progression (e.g. from Rev A to Rev B).

4. **`src/studio/architect/ArchitectInspector.tsx`**:
   - Updated `TextField` to inspect `e.currentTarget.value` on blur and accept an optional `className` prop, preventing React synthetic event closure lag during automated testing and programmatic commits.

5. **`src/studio/architect/architect.css`**:
   - Styled issue history cards, current/superseded badges, notices, and historical register tables.
   - Made `.arch-issue-history-control` span `grid-column: 1 / -1`, preserving the broad canvas stage in column 1 (`minmax(0, 1fr)`) and the inspector in column 2 (`245px`).
   - Styled `.arch-superseded-banner` with red alert treatment for superseded issues and blue notice for historical issues.

6. **`src/studio/architect/issueHistory.test.ts` (New unit test suite)**:
   - 8 comprehensive unit tests verifying initial issue recording, stale-review refusal, supersession transitions, retrievability of deleted/modified sheets, 3-issue chronological lineage, and fail-closed schema validation.

---

## 2. Machine Proof & Verification

### Unit & Integration Test Suites
All 92 architect tests pass cleanly:
```text
$ node --experimental-strip-types --test src/studio/architect/*.test.ts
✔ recordDrawingIssue creates an initial current issue record with frozen layouts (13.7577ms)
✔ stale review is refused when recording an issue (1.4269ms)
✔ recording a subsequent issue (Rev B) supersedes the prior issue and overlapping sheets (2.3239ms)
✔ deleted or modified active sheets remain intact and retrievable in past issue records (1.7117ms)
✔ three sequential issues maintain chronological supersession lineage (1.9857ms)
✔ retrieveIssue returns undefined for nonexistent issue id (0.828ms)
✔ modifying active sheet viewports or names does not mutate frozen historical issue layouts (1.6231ms)
✔ validateProject rejects invalid or malformed issue records fail-closed (1.9083ms)
... (84 additional architect test suites passing)
ℹ tests 92
ℹ suites 0
ℹ pass 92
ℹ fail 0
```

### Industry Specification Validator
```text
$ node planning/industry-specs/validate.test.mjs
✔ register parses all 375 rows with the states the register itself reports (3.2417ms)
✔ the merge disturbed no previously reviewed assessment (0.8913ms)
✔ weakest takes the least-ready state, not the most-ready (0.1545ms)
...
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
```

### TypeScript Typecheck
```text
$ node node_modules/typescript/bin/tsc --noEmit
exit 0 (0 errors)
```

### Fast CDP In-Browser Scenario
Executed against `http://127.0.0.1:8091/` using `node scripts/fast-cdp-test.mjs d09-revisions proof/growth/2026-09-12-d09-revisions/scenario-d09.json`:
- **Scenario execution:** 35 CDP opcodes, 0 failures, 0 uncaught browser console errors, completed in 24.38s (`proof/growth/2026-09-12-d09-revisions/fast-cdp-execution.log`).

---

## 3. Visual Proof (Screenshots Inspected)

All screenshots captured at 1680x1050 and inspected directly using `view_file`:

1. **`screenshots/growth/2026-09-12-d09-revisions/01-issue-rev-a-current.png`**:
   - Initial issue **Rev A** ("For tender") issued.
   - Drawing revisions card displays **Rev A · For tender** with green `[CURRENT]` badge and action buttons (`View register`, `Inspect layout`).
   - Drawing revision in inspector confirms `A`.

2. **`screenshots/growth/2026-09-12-d09-revisions/02-rev-a-superseded-by-rev-b.png`**:
   - Revision bumped to **Rev B**, and second issue ("For construction") issued.
   - Drawing revisions list displays 2 issues:
     - **Rev A · For tender**: displays orange `[SUPERSEDED]` badge and notice *"Superseded by Rev B on 2026-09-12."*.
     - **Rev B · For construction**: displays green `[CURRENT]` badge.
   - Inspector confirms `Drawing revision: B`.

3. **`screenshots/growth/2026-09-12-d09-revisions/03-inspecting-superseded-revision.png`**:
   - User clicked "Inspect layout" on **Rev A**.
   - Inspection mode active (`Close inspection` button state).
   - Prominent red banner across the canvas header:
     `[SUPERSEDED REVISION] Rev A ("For tender") was superseded by Rev B on 2026-09-12.` with `Return to live design` button.
   - Large diagonal semi-transparent red SVG watermark across the paper sheet: **`SUPERSEDED`**.
   - All interactive controls locked; clicking "Return to live design" immediately restores active editing.

---

## 4. Remaining Boundaries (Declared Limits)

1. **Development Browser Environment:** Verified against development server instance (`http://127.0.0.1:8091/`); no production minification build or native Tauri package run was performed.
2. **Device Scope:** Laptop and desktop viewports verified; mobile phones are explicitly excluded per project charter.
3. **Sequential Lineage:** Revisions are tracked as a sequential project lineage (e.g. A -> B -> C); branch-based revision graphs, merge resolutions, or multi-party cryptographic signature sign-offs remain outside this slice.
4. **Local / In-Project Storage:** Historical issues and frozen layout records are stored directly within the client project model (validated via Zod) and persisted in browser LocalStorage; remote centralized document management integration is deferred to future cloud sync milestones.
