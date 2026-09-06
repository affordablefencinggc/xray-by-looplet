# Altitude source takeoff

Approved: user "gooo", 2026-09-06. Adopted feat/model-wireframe-navigation; shared work retained, no staging or publication.

- [x] SC-01: Record typical-floor entrance counts and unresolved window/structural quantities with source hash, page and floor lists.
- [x] SC-02: Add a persistent, source-bound takeoff inventory in Components with inspection, review, safe recovery and packaging/weight inputs.
- [x] SC-03: Verify arithmetic, source isolation, rejected writes and unreadable snapshots; run typecheck/build and desktop/mobile browser flows.
- [x] SC-04: Attach source diff and proof, record remaining drawing dependencies.

Scope: counted entrance openings are not a door-leaf schedule. Typical-floor quantities are provisional. Unknown counts/dimensions/weights remain unknown. Existing demonstration inventory is retained separately. A complete tower reconstruction remains dependent on dimensions and level information.

Dev behavioral proof passes with zero browser errors and mobile overflow. Eight new regression tests pass; full suite is 195 script + 346 TypeScript tests. Production verification in progress.

Final: all four bounded implementation slices proven. Eight new regressions and 541 full-suite tests pass; typecheck/build pass; dev and built desktop/mobile behavioral proof clean. Remaining dependencies are real source schedules/specifications and coordinated tower 3D dimensions. See proof/audit/IW-ALTITUDE-TAKEOFF/completion.md.
