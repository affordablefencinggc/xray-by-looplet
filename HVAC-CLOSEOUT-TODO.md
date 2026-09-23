# HVAC closeout - Portion 4

Authorized: Daniel, 2026-09-20, "lets proiceed with a huge portion". Branch: feat/closeout-sc09-remainder.

- [x] Qualify straight/wrap draft arithmetic and visible rectangular/round insulation envelopes: [SC12 proof](proof/growth/2026-09-20-hvac-portion4/steps/SC12-STRAIGHT-WRAP-04.md).
- [x] Implement editable saved multi-zone duct graph, connectivity/transition checks, conservative plenum/beam review and recoverable 3D: [SC13 proof](proof/growth/2026-09-20-hvac-portion4/steps/SC13-NETWORK-05.md).
- [x] Implement velocity checks, design commissioning ranges, equipment schedule and SHA-256 PDF/CSV/JSON draft exports: [SC14 proof](proof/growth/2026-09-20-hvac-portion4/steps/SC14-SCHEDULES-06.md).
- [x] DANS1 2058 tests, typecheck/lint clean, required web build, dev 76/76, built 99/99, PDF readback 7/7. Proof: `proof/growth/2026-09-20-hvac-portion4/steps/SC12-STRAIGHT-WRAP-04.md`.
- [x] Automatic checkpoints: 114 files -> 7f043fe6 pushed; 105-file trigger -> 3b42c063 pushed. Continued automatically after each. Proof: `proof/growth/2026-09-20-hvac-portion4/steps/SC12-STRAIGHT-WRAP-04.md`.
- [x] Reviewed gauge/thickness/density table UI, invalidation and section linkage: [material proof](proof/growth/2026-09-20-hvac-portion4/steps/SC12-MATERIAL-08.md), dev 87/87, built 102/102.
- [ ] Resolve original SC-12 missing-velocity mass gate; full ledger scope remains unchanged. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 02]
- [x] Shared oriented rectangular envelope/beam checks and finite end caps: [proof](proof/growth/2026-09-20-hvac-portion4/steps/SC13-ORIENTED-10.md), 2075 tests, dev/built 41/41.
- [x] Pipe service coordination, separate flow/bore, pump connectivity, exports and tablet table polish: [proof](proof/growth/2026-09-20-hvac-portion4/steps/SC13-PIPE-14.md), 2083 tests, dev 47/47, built 147/147, PDF 7/7.
- [x] Declared elbow/tee/reducer coordination, trimmed ports, invalid/overlap withholding and fitting schedule: [proof](proof/growth/2026-09-20-hvac-portion4/steps/SC13-FITTINGS-16.md), 2097 tests, dev 65/65, built 375/375 operations, PDF 7/7.
- [ ] Formal SC-13 closeout retains SC-12 dependency and shared dev reload. Round/fitting bounds remain conservative; fabrication and hydraulics are not proven. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 01]
- [ ] Broader SC-14: measured commissioning, reviewed/issued delivery lifecycle and solved pressure loss. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 02]
- [ ] Historical development reload cause remains unconfirmed. Current DANS1 SC-09 dev 135/135; current HVAC fixture dev/built 46/46, full fitting dev 75/75; measured journal reads precede hydration and no earlier project write was observed. [Executed reports, screenshots, fixture/runner diff and limits](proof/growth/2026-09-24-stability/README.md). Earlier 118/135 and 37/46 failures are preserved; no speculative persistence fix or causal claim. [section 01]

All inputs remain labelled declared/sample drafts. No certification or verified quote promotion. Jev is not configured; deterministic calculations are not live Jev judgments.

- WIP development reload investigation: [DEV-RELOAD-19](proof/growth/2026-09-20-hvac-portion4/steps/DEV-RELOAD-19-WIP.md). Minimal reload reproduced; candidate dev stylesheet configuration awaits DANS1 verification after SSH key-exchange timeout. No completion or new passing machine gate claimed.
Closeout ledger SC-09, SC-12, SC-13 and SC-14 stay [[partial]]. Closeout ledger SC-16 stays [[pending]]. Checked rows above are recorded proofs, not slice closeout. The SC-09 dev-reload item stays open.
Document status: open (4)
