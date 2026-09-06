# Materials register: verified implementation

User authorization: "continue", 2026-09-06. Adopted branch feat/model-wireframe-navigation at 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared work preserved; no staging, commit or publication.

Implemented actual stock lines with quantity units, source references, unique stock codes, revision-safe edits, rounded package volume, specified unit/full-package weight, unknown/partial coverage and CSV export. Kg quantities give explicit unit-based mass. No density or actual project stock is fabricated. Valid v1 snapshots are upgraded in memory and written as v2 only after an explicit successful save, preserving existing count rows and review notes.

Exact implementation delta against captured pre-turn files: [implementation.patch](implementation.patch). New files are included in full. [source-hashes.json](source-hashes.json) records final source and patch hashes. The rest of the shared dirty tree is outside this delta.

Verification: build exit 0, typecheck exit 0, 198 script tests and 356 TypeScript tests pass (554 total in the final log; the earlier progress estimate of 551 used the prior script-test count). See build.txt, build-exit.json, typecheck.txt and tests.txt. Git diff --check passes.

Actual browser flows pass against dev and freshly built output, on desktop and 390px mobile: real Altitude PDF import; empty stock; v1 byte-preserving restore; v2 material save retaining old rows; package rounding and both weight bases; duplicate rejection; decimal stock; partial coverage; downloaded CSV source/calculation checks; reload; rejected write retaining saved bytes and draft; retry; future-version protection and recovery. No console/page errors or horizontal overflow. All material fixtures are visibly labelled fictional QA data in isolated browser contexts.

- [Dev behavior report](../../../screenshots/material-register/dev/report.json)
- [Built behavior report](../../../screenshots/material-register/built/report.json)
- [Built desktop stock calculation](../../../screenshots/material-register/built/02-synthetic-stock-totals.png)
- [Built mobile register](../../../screenshots/material-register/built/03-mobile-register.png)
- [Built mobile editor](../../../screenshots/material-register/built/04-mobile-editor.png)
- Prior takeoff built regression rerun: screenshots/altitude-takeoff/built/report.json. Count review invalidation, page-48 navigation, filters, recovery and switching to Caroline preserve source isolation.

Desktop/mobile screenshots were visually inspected for both environments. The generic smoke also renders content with no errors or overflow on dev/built. Its baseline comparison reports canvas/text differences from development-only annotation/diagnostic chrome; screenshots show matching application content. Its game/share-card heuristic flags this construction utility's development canvas. These warnings are recorded, not represented as a clean generic baseline comparison or a game branding requirement. Playwright/Edge fallback used because agent-browser is unavailable. Both servers remain running.

Source review: full Altitude text index and rendered pages 9, 18, 19 provide concept/context elevations, including adjacent buildings, not a construction material order or reliable window-unit schedule. Actual whole-building volume, weight, verified door/window/structure quantities and Altitude 3D reconstruction remain source-dependent. Guide: output/takeoff/material-register-guide.md.
