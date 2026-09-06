# Inventory integrity repair

Approved: 2026-09-06, user: "fix them then . take over!!"
Branch: `feat/model-wireframe-navigation` (adopted), baseline `3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe`.
Shared changes preserved; no staging, commit, merge or publication in this task.
Pre-edit file copies: `proof/audit/IW-INVENTORY-INTEGRITY/before/`.

- [x] SC-01: Independent recovery lock guards ordinary edits, autosave and explicit save; successful restore/replacement releases it. Six executed store regression cases pass with the actual browser subscription enabled.
- [x] SC-02: Previous-rule requirements are replaced while unrelated flags survive. Material changes advance revisions and mark prior review stale; count-only updates retain approval. Three added rule regression cases pass.
- [x] SC-03: Full tests (195 script + 338 TypeScript), final typecheck and production build pass. Desktop/mobile Components and recovery scenarios pass on dev and built output, with no browser errors or horizontal overflow. Exact diff, source hashes and screenshots are recorded in the completion report.

Boundaries: inventory and its persistence/store integration, regression tests, necessary recovery messaging, and verification records. Fencing domain migration and unrelated UI redesign are outside this repair.

Executed proof: `proof/audit/IW-INVENTORY-INTEGRITY/completion.md`, including pre-fix failures, 33 targeted tests, full tests, final build, exact repair diff and source hashes. No whole-app completion is claimed.

Verification-discovered extension: `vite.config.ts` disables Nitro's automatic HTML renderer, which was serving the existing native `index.html` as an unbuilt web document. TanStack now owns web rendering; desktop entry files are preserved. Components' hardcoded M20 rule label now reflects the current rule, and its row wraps on mobile.
