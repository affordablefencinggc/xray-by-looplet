# Source checkpoint: unfinished work preserved, not accepted

2026-09-19. Parent `6a9d5b3`, branch `feat/architect-cad-engine`.

The user requested immediate push/checkpoint and challenged 1,600 pending paths. Read-only enumeration found 1,636 paths: 17 tracked modifications and 1,619 untracked; 1,613 proof/generated paths, 14 application-source paths and nine other paths. No merge conflict or remote divergence existed. The shared Workbench and Host were unchanged.

This is a **WIP recovery checkpoint**, not a completion claim or release. No checklist item is promoted by committing these files.

## Source and evidence boundaries

- Exact-quantity domain and exporter: [PDF layout step](../2026-09-19-sc11-pdf-qualification/steps/SC11-PDF-LAYOUT-02.md) records 41/41 focused tests (24 rate +17 exporter), scoped typecheck, 46/46 raw-CDP checks and ten inspected PDF pages on an isolated DANS1 overlay. [Exact exporter diff](../2026-09-19-sc11-pdf-qualification/pdf-layout-exact.diff). Historical package compatibility remains open; same-version reopen is not legacy migration proof.
- Quantity-copy helper/UI and new helper/render tests: authored but **not executed**. [Exact precision/contrast diff](../2026-09-19-sc10-qs-rate-delta/precision-and-contrast.source.diff). The explicit action copies the exact measurement and rebinds; old bind-only semantics remain. The new 297-operation browser scenario is authored but **not run**. No current integrated suite/build claim.
- CSS contrast: [seven-image review](../2026-09-19-sc10-qs-rate-delta/campaigns/9abf4c807030-css-review.md) records contrast 5.34:1 on a CSS-only overlay. Its complete campaign **failed at operation 170/289** because typed `6` did not equal measured `5.999999930955706`. This is not SC10 acceptance. Charcoal/hover and later workflow assertions remain open.
- New `QSCostPlanPackagePanel.tsx`, `.css`, `.test.ts` and HVAC `ductMaterialBasis.ts`, `.test.ts`: checkpointed **unmounted preparatory source**, not integrated features. Isolated earlier DANS1 receipts under `2026-09-19-sc11-package-panel-preflight/sc11-panel-cb3d0b8de15f/output/` record 14 panel +14 HVAC tests and typecheck; no mounted screenshot/browser acceptance. HVAC scope is described by its [audit](../2026-09-19-sc12-hvac-qualification/AUDIT.md).

Full-suite 1,951/1,951 and production SC09 89/89 remain bound to frozen source `9abf4c807030`, **not these later edits**. SC09 stays partial; SC10, SC11 and SC12 remain pending. The 375-item catalogue has only six verified requirements.

## Git hygiene

Four narrow ignore patterns cover reproduced source/overlay copies only. The files are retained locally; nothing is deleted. Parent input manifests, campaign results, failures, screenshots, source helpers and application source remain eligible for explicit staging. New dashboard packaging is moving to the existing ignored `.temp` area.

Unrelated `20`, `probe-variants.mjs`, the live hover log and the other-chat handoff are not included in source checkpoints. No broad add, reset, clean, stash or force push is authorized or performed.

Remaining work: finish source-specific integrated tests and browser/build proof, resolve legacy package compatibility before claiming stable export support, and checkpoint reviewed proof/docs separately. Missing evidence means unfinished work even after push.
