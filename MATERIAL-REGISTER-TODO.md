# Material register continuation

Approved: user "continue", 2026-09-06. Adopted feat/model-wireframe-navigation; existing shared work preserved.

- [x] SC-01: Reviewed source elevation/context studies (pages 9, 18, 19) and full text index. No construction stock schedule or verified window-unit count established. Proof: `proof/audit/IW-MATERIAL-REGISTER/completion.md`.
- [x] SC-02: Added validated material lines, quantities/units/packaging/weight basis and source references. Tested byte-preserving v1 restore and v2 save that retains count edits/reviews. Proof: `proof/audit/IW-MATERIAL-REGISTER/completion.md`.
- [x] SC-03: Added material editing, duplicate detection, per-line calculations and CSV export. Actual stock remains separate from inferred drawing allowances. Proof: `proof/audit/IW-MATERIAL-REGISTER/completion.md`.
- [x] SC-04: Typecheck/build, 198 script tests + 356 TypeScript tests, and desktop/mobile dev/built behavioral checks pass. Diff and proof: proof/audit/IW-MATERIAL-REGISTER/completion.md.

Limits: source is early-design guidance; no construction schedules or actual stock list supplied. Do not turn facade graphics into verified window counts or populate materials with fabricated quantities.
Document status: closed
