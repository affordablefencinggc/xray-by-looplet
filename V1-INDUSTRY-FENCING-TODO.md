# V1 industry and fencing execution ledger

Approved: yes, 2026-09-23. User requested the work in `02-industry-worksheets.md` and `03-fencing-estimating.md` in this session.
Baseline: `f6987a1a`, branch `feat/closeout-sc09-remainder`. Reuse this branch and workspace; no CRM repository changes.

Completion requires an executed behaviour check, inspected screenshot, exact diff and a separate named step record. DANS1 development checks precede one final web/native build. Desktop and both tablet orientations are in scope. Business inputs remain explicit; fixture prices and geometry cannot become real-job proof.

- [x] SC-01 [section 02] QS-03 dev 163/163, built 163/163, tablet readability 149/149. [Executed tests, screenshots, exact diff and limits](proof/growth/2026-09-23-industry-closeout/steps/SC-01-qs-web.md). Historical reload causation remains unconfirmed.
- [x] SC-02 [section 02] Current built worksheet qualification complete: [tests, screenshots, diff and limits](proof/growth/2026-09-23-industry-closeout/steps/SC-02-hvac-mass-web.md).
- [x] SC-03 [section 02] Current built worksheet qualification complete: [tests, screenshots, diff and limits](proof/growth/2026-09-23-industry-closeout/steps/SC-03-hvac-network-web.md).
- [x] SC-04 [section 02] Current built worksheet qualification complete: [tests, screenshots, diff and limits](proof/growth/2026-09-23-industry-closeout/steps/SC-04-hvac-delivery-web.md).
- [ ] SC-05 [section 02] Cite roofing proof, qualify final discussion-only routing and roofing/QS explanation turns on the final build.
- [ ] SC-06 [section 03] Reconcile fencing cleanup and full-bay/equal-bay native acceptance with exact historical proof.
- [ ] SC-07 [section 03] Level rail/post stock nesting implemented and development-qualified: [cuts, kerf, offcuts, price mappings and exact diff](proof/growth/2026-09-23-fencing-cutting/steps/SC-07-stock-cutting.md). Final build/native qualification remains; slope cutting needs a reviewed per-bay schedule.
- [ ] SC-08 [section 03] Add reviewed stepped/raked recipe support with TypeScript/Python parity. Reviewed supplier schedule requested.
- [ ] SC-09 [section 03] Current no-rate reasons and dated Bunnings allowance import pass development qualification: [proof and fit limits](proof/growth/2026-09-23-fencing-cutting/steps/SC-09-pricing-coverage.md). Repair/installation, actual gate mapping and final build/native qualification remain.
- [ ] SC-10 [section 03] Frozen quote issue history implemented; [58/58 development journey, tests, screenshots and diff](proof/growth/2026-09-23-fencing-v1/steps/SC-10-quote-issue.md). Final build/native qualification remains.
- [ ] SC-11 [section 03] Two-place rate display with supplier precision retained; PDF/CSV and tax fidelity tested. [Proof](proof/growth/2026-09-23-fencing-v1/steps/SC-11-rate-display.md). Final build qualification remains.
- [ ] SC-12 [section 03] Complete quote-relevant review/proof pack and the real-job revision/requote/handover journey. Read-only Boundaries v3 saved plan located: six runs/two gates, mixed timber/Colorbond; no fall or slope snapshots. Use an isolated copy; preserve the original.
- [ ] SC-13 [section 02] Run all worksheet journeys on one DANS1 build and record source/build/platform limits.

Checkpoint: 107 pending files triggered scope freeze. DANS1 source regression 1,958/1,958, typecheck exit 0, HVAC dev 144/144, quote dev 58/58. [Checkpoint and limits](proof/growth/2026-09-23-fencing-v1/README.md). Formal slices remain open for final build acceptance. Continue fencing stock/slope/no-rate mapping and the isolated saved-job journey after the automatic feature-branch push. Earlier hygiene/stability records remain in `V1-FINISH-TODO.md`; historical causes have not been relabelled as fixes.

Next checkpoint, baseline `9512f8b0`: source 1,964/1,964, typecheck/lint exit 0, stock/coverage browser 157/157 and actual PDF/ZIP/CSV verified. [Evidence and limitations](proof/growth/2026-09-23-fencing-cutting/README.md). Freeze triggered at 100 files; continue after pushing this WIP stage. Formal slices remain open.
