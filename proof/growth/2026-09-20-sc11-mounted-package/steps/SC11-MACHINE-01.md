# SC11-MACHINE-01 — mounted package source gates

Status: **source machine gates PASS; browser and screenshot acceptance PENDING**. SC11 remains pending. This record does not promote the mounted export/reopen slice to done.

## Exact tested source

The preserved DANS1 snapshot is `sc11-c9b41fd82e89`, with source digest `c9b41fd82e892df8d8630ed73dc48c94f1208aa51058c7bf2a9fb1d723bd6ba7`, Git HEAD `6f82b9340b2fd33d195c78ee9029cc4deee84644`, and 1,244 source files. The digest identifies the complete staged working bytes; the Git commit alone does not identify the uncommitted SC11 changes.

- [Exact SC11 mounted-source diff](../sc11-mounted.source.diff), SHA-256 `8df0f257bbea2f83f0c19ec42551a056ccb86172a8fe5b466335d300b77b9fdd`.
- [Complete source manifest](../machine/source-manifest.json), SHA-256 `a990b4d8c72da93bdea5f8461670dda46049066ccc19eb64179c9042028ed5e2`.
- [Aggregate DANS1 result](../machine/preflight-sc11-c9b41fd82e89/results.json), SHA-256 `ea2dd198cdb473e362a7b6615d3fb1413349491472d5d893dcabe4fff124956e`.

The exact diff covers the mounted package panel integration and its state-preservation tests in `QSCostPlanPackagePanel.tsx`, `QSWorksheet.tsx`, `QuantityDraftPanel.tsx`, `QuantityReportView.test.ts`, `quantityForm.test.ts`, and `quantityForm.ts`. This evidence remains bound to the frozen digest above, not to later working-tree bytes.

## Already executed machine evidence

All commands ran sequentially on DANS1 against the frozen source snapshot. This documentation step did not rerun product tests.

| Gate | Recorded result | Receipt |
| --- | --- | --- |
| Focused QS and state-boundary tests | **273/273 passed**, 0 failed, exit 0 | [stdout](../machine/preflight-sc11-c9b41fd82e89/qs-focused.stdout.log), [command receipt](../machine/preflight-sc11-c9b41fd82e89/qs-focused.json), [process identity](../machine/preflight-sc11-c9b41fd82e89/qs-focused.process.json) |
| Full TypeScript check | **Exit 0** for `tsc --noEmit` | [command receipt](../machine/preflight-sc11-c9b41fd82e89/typecheck.json), [stdout](../machine/preflight-sc11-c9b41fd82e89/typecheck.stdout.log), [stderr](../machine/preflight-sc11-c9b41fd82e89/typecheck.stderr.log) |
| Scoped lint of the four mounted-package source files | **0 errors, 10 existing warnings**, exit 0 | [lint output](../machine/preflight-sc11-c9b41fd82e89/scoped-lint.stdout.log), [command receipt](../machine/preflight-sc11-c9b41fd82e89/scoped-lint.json), [process identity](../machine/preflight-sc11-c9b41fd82e89/scoped-lint.process.json) |
| Returned receipt integrity | Recorded SHA-256 values for all machine outputs | [SHA-256 manifest](../machine/preflight-sc11-c9b41fd82e89/sha256-manifest.json) |

The lint warnings are the existing `react-refresh/only-export-components` warnings: eight in `QSCostPlanPackagePanel.tsx` and two in `QSWorksheet.tsx`. There were no lint errors. The focused test command included every `*.test.ts` under the quantity-surveying directory plus the SC10 state-boundary test; it is not represented as the repository-wide full suite.

## Pending proof and scope limits

No screenshot evidence belongs to this machine-only step. Mounted browser interaction, actual package download, disk readback, reopen/restore behavior, responsive visual inspection, production build, deployment, native packaging, and historical-package compatibility are not proved here. Screenshot links are therefore explicitly **pending**, not omitted as though accepted. [SC11-BROWSER-INFRA-02](SC11-BROWSER-INFRA-02.md) preserves the first browser attempt as an infrastructure failure with no application assertions.

## Subsequent acceptance (same frozen product bytes)

The later [mounted-app receipt](SC11-MOUNTED-03.md) and [actual downloaded PDF receipt](SC11-PDF-04.md) supply the previously pending browser and visual proof. The [mounted package screenshot](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-mounted-export-details-desktop-1600x1000.png) shows the integration tested by these source gates; it does not itself prove unit-test results. The pending language above records the machine-only stage, not the final slice status. Production/native/deployment and legacy-renderer limits remain.
