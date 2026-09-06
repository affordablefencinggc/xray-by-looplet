# Inventory integrity repairs — 2026-09-06

User authorization: "fix them then . take over!!"
Recovery: adopted branch `feat/model-wireframe-navigation`, HEAD `3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe`, shared dirty tree. No staging, commit, merge or publication.

## Verified changes

- **SC-01:** A separate recovery lock survives ordinary inventory edits, autosave and explicit Save. Only a successful restore or explicit demo replacement clears it. Failed replacement retains the lock. Ordinary write failures display a retry-save action and retain pending edits. Tests install browser storage before importing the real store, exercising its real subscriptions.
- **SC-02:** Rule updates remove requirements from the previous matching quota and apply the current requirements while retaining unrelated component flags. Material type, position or missing-requirement changes advance component revisions and mark previous review `stale_revision`; identity, custom marks, evidence and review annotations remain. Count-only changes preserve surviving component revisions/approval. Existing v1 envelopes remain compatible; no data migration or guessed cleanup of historically ambiguous flags is performed.
- **SC-03:** Inspector shows an amber **Needs re-review** state. The tree describes the actual rule instead of hardcoded M20 bolts and wraps its row on mobile. Production render verification also uncovered the existing native `index.html` overriding TanStack with raw `/src/desktop.tsx`; `renderer: false` in Nitro prevents that fallback while retaining native build inputs.

## Exact diff and machine proof

- [Repair-only code diff](repair.patch), relative to captured pre-edit files, excluding unrelated shared changes.
- [Source SHA-256 manifest](source-hashes.json).
- [Failing regressions before repair](regressions-before.txt).
- [33/33 targeted tests](targeted-tests.txt): nine added tests, including three distinct unreadable-storage cases.
- [Full suite](full-tests.txt): 195/195 script tests and 338/338 TypeScript tests, no failures.
- [Final typecheck](typecheck.txt) and [final production build](build.txt) pass. `git diff --check` passes.

## Executed browser and visual proof

The browser CLI was absent both directly and in the offline npm cache; used the documented Playwright fallback with installed Edge. The Linux-only preview restart helper cannot run on this Windows host, so the built app was served through the existing `npm run preview` command. The live dev server was retained.

- [Dev interaction report](../../../screenshots/inventory-integrity/dev-report.json): Fastener exposes 48 bolts under 12 parents; search and selection; M24 properties, revision 5 after two material updates, stale approval, zero resolved RFIs and custom mark survive reload. Actual browser store edits and explicit Save preserve newer-schema bytes while recovery is blocked. Retry, reload and explicit reset are exercised. Zero console/page errors or document overflow.
- [Built interaction report](../../../screenshots/inventory-integrity/built-report.json): repeats desktop/mobile filtering, inspection, persisted revised inventory, rejected restore, reload and explicit recovery against built bundles. Zero console/page errors or document overflow.
- [Desktop Components](../../../screenshots/inventory-integrity/built-desktop-components.png) and [mobile Components](../../../screenshots/inventory-integrity/built-mobile-components.png): inspected alongside corresponding dev screenshots.
- [Protected saved data after an ordinary browser edit](../../../screenshots/inventory-integrity/dev-recovery-protected.png) and [built recovery banner](../../../screenshots/inventory-integrity/built-recovery-protected.png).
- Generic [dev smoke](../../../screenshots/inventory-integrity-dev.json) and [built smoke](../../../screenshots/inventory-integrity-built.json) both return successful rendering verdicts, with no console/page errors or overflow. The generic baseline flags a text/canvas difference because it captured dev during initial restoration and includes the dev annotation UI. Both built screenshots were inspected; the stronger settled Components interaction reports above verify matching behavior on both targets.

Scope boundary: these repairs and their declared scenarios are verified. No fencing-domain migration, native installer verification, or general approval of all existing product behavior is inferred.
