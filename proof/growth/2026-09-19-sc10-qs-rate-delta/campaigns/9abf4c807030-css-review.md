# SC10 CSS overlay and exact-quantity blocker review

Status: partial diagnostic evidence, **not SC10 complete**. DANS1 only; no deployment or live-device claim.

The immutable `9abf4c807030` source passed its separate preflight. Its first SC10 browser campaign passed the corrected keyboard containment path but failed the Modified badge contrast at 4.16:1. A new isolated source overlay changed only `QSWorksheet.css`; neither original baseline nor overlay source changed during the browser run. [Overlay verification](../overlays/sc10-css-9abf4c807030-02/output/verification-after.json).

The CSS campaign completed 170 of 289 operations before a genuine precision workflow blocker. [Browser results](sc10-9abf4c807030-css1/output/browser-results.json) and [launcher result/cleanup](sc10-9abf4c807030-css1/output/launcher-results.json) both record FAIL; there were zero browser errors. Receipt 113 records Modified contrast **5.34:1** and every tested comparison label at least 5.13:1. The original strict contrast and six-Tab containment assertions were retained.

The real pointer drag changed run A from 5 to `5.999999930955706` metres at geometry revision 2, preserving run B exactly (receipt 155). Typing `6` and invoking the existing bind-only action correctly remained stale. The failure exposes a missing usable exact-quantity workflow plus the cost domain's former six-decimal quantity restriction; it is not evidence that stale equality should be rounded or bypassed.

All seven returned screenshots were visually inspected:

- [Supplier provenance](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-supplier-provenance-desktop-1600x1000.png): explicit material/labour pins, source reference, GST basis and complete supplier SHA visible.
- [Proposed option excluded](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-proposed-option-excluded-desktop-1600x1000.png): base and accepted AUD85.80 remain equal; AUD68.64 option separate.
- [Option scope comparison](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-option-scope-delta-desktop-1600x1000.png): unchanged versus amber Modified rows, scope-only AUD68.64, visible focused revision selector and readable labels.
- [Unknown GST blocker](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-unknown-tax-withheld-desktop-1600x1000.png): no totals, explicit missing tax reason, disabled snapshot capture.
- [Real geometry edit](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-real-geometry-edit-desktop-1600x1000.png): extended selected run and unchanged second run, locked calibration and revision2 visible. Displayed6.00 is a presentation label, not the exact stored measurement.
- [Stale source geometry](sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-stale-geometry-pricing-blocker-desktop-1600x1000.png): entity change named; totals and new snapshot withheld.
- [Failure170](sc10-9abf4c807030-css1/output/failure-op-170-default.png): exact measured quantity versus typed6 stated plainly, existing revisions preserved, no misleading cost total.

The subsequent authored precision change separates bounded exact quantity decimals from six-decimal rates/tax/FX and adds an explicit “Use measured quantity and rebind” action. [Exact CSS/precision source and test diff](../precision-and-contrast.source.diff). New tests preserve the actual measurement, exact allowance, integer-cent rounding, immutable package/reopen data, fail-closed source/evidence behavior, and the strict stale guard for rounded6. The scenario has 297 operations after adding that workflow and a screenshot. Those source changes and downstream new/removed, tablet, reload and theme evidence were **not executed by this CSS-only run** and remain pending a newly frozen source campaign.
