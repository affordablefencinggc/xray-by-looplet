# A-Z E-08 / E-11 — partial implementation assessment

2026-09-19. Neither requirement is ticked or verified. This records implemented, exercised subsets so the catalogue no longer says they do not exist. SC10 remains pending.

## Source and executed test boundary

Frozen DANS1 source `9abf4c807030` passed [1951 tests, TypeScript and scoped lint](../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/REPORT.md), including 21 rate-book and 11 delta tests. The [source diff](az-pricing-source.diff) covers the committed implementation through `6a9d5b3`. The later CSS-only overlay is identified in [campaign runtime/source bindings](campaigns/sc10-9abf4c807030-css1/output/run-binding.json).

The [289-operation browser campaign](campaigns/sc10-9abf4c807030-css1/output/browser-results.json) is **FAILED** after 170 completed operations: nominal6 differs from actual pointer-derived5.999999930955706. That later failure is retained and pricing stays withheld. The following earlier assertions passed before it; no unexecuted remainder is claimed.

| Row | Implemented/executed subset | Still open |
| --- | --- | --- |
| E-08 | Separate material/labour supplier revision+line pins; explicit labour exclusion; measured quantity retained separately from waste; component, markup and GST reconciliation | Plant, broader assemblies, extended-decimal quantity workflow and final platform qualification |
| E-11 | Proposed option excluded; explicit acceptance changes only accepted total; original base stays unchanged; two immutable cost revisions and scope-only comparison | Complete changed-geometry/rate/reload/tablet workflow and production/native acceptance |

Worked values asserted by the browser: 5m base produces material55.00, labour10.00, markup13.00, GST7.80, total85.80 AUD. The 4m option is68.64 AUD. Proposed total is excluded; accepting it yields154.44 AUD accepted, base remains85.80. Recorded revision comparison is quantity0, rate0, scope+68.64 and accepted+68.64; earlier snapshot bytes remain unchanged.

## Inspected screenshots

- [Material and labour supplier pins, source references and hash](campaigns/sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-supplier-provenance-desktop-1600x1000.png).
- [Separate base, accepted and proposed totals](campaigns/sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-proposed-option-excluded-desktop-1600x1000.png).
- [Frozen revision comparison and scope delta](campaigns/sc10-9abf4c807030-css1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-option-scope-delta-desktop-1600x1000.png).

Root visually inspected these three desktop captures. This does not claim tablet, native, live-device or actual supplier-quotation acceptance. Source fixtures are controlled inputs, not reviewed commercial quotes. The catalogue changes only two states from gap to partial: verified remains6; partial110; gaps239; blocked19; failed1; total375.
