# New tool flow audit

Approved: user "continue on after that all the way through to testing out each new tool with proof", 2026-09-06.
Branch: feat/model-wireframe-navigation; existing shared work preserved.

Scope: tools added or repaired in this conversation: component tree/filter/inspector/evidence/recovery, real-plan import/navigation, Altitude source takeoff/review/packaging, material register/calculations/export. Existing unrelated tools and a whole-building 3D reconstruction are not assumed complete.

- [x] SC-01: Mapped new count/material flows plus existing requested 3D controls to 29 browser scenarios per environment; actual source limits recorded.
- [x] SC-02: All count filters, source disclosure, JSON/CSV, five units, validation/cancel and conflicting saves pass. Discovered and repaired mobile 3D grid collapsing the canvas and covering controls; regression failed before and passes after.
- [x] SC-03: Current dev/built component integrity, material and takeoff regressions pass. Final source/control and 3D flows pass in dev and built output; screenshots and SVG render inspected. Matrix: output/takeoff/tool-proof.md.
- [x] SC-04: Final build/typecheck and 554 tests pass. Exact repair, hashes and generic-smoke caveats: proof/audit/IW-NEW-TOOLS-PROOF/completion.md. Shared work retained; no staging/commit/publication.
