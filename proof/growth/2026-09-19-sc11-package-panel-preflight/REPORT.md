# SC11 package panel / SC12 material basis: source diagnostics

Status: **source diagnostics passed; product qualification remains pending**. The panel is not mounted. No ledger/checklist status was promoted. No local product tests, full build, server, browser or screenshots were run by this campaign.

## Executed result

Unique DANS1 snapshot: `sc11-panel-cb3d0b8de15f`.

- [Panel + HVAC tests](sc11-panel-cb3d0b8de15f/output/panel-and-hvac.stdout.log): **28/28 passed**, comprising 14 SC11 UI/orchestration tests and 14 SC12 material-basis tests; exit 0.
- [Current runner tests](sc11-panel-cb3d0b8de15f/output/runner.stdout.log): **4/4 passed**; exit 0. These exercise runner helpers without launching a browser.
- [Full TypeScript check](sc11-panel-cb3d0b8de15f/output/typecheck.json): `tsc --noEmit`, exit 0, no diagnostics.
- [Scoped lint](sc11-panel-cb3d0b8de15f/output/scoped-lint.stdout.log): exit 0, **0 errors / 10 warnings**. Eight warnings concern mixed component/helper exports in the new panel (Fast Refresh only); one is the runner's unused `stat` import; one is PriceBookPanel's ref cleanup warning. No warning was suppressed to obtain this result.
- [Structured results](sc11-panel-cb3d0b8de15f/output/results.json) record the exact commands, argument arrays, runtime hash, owner, PIDs, creation times, priority/affinity, start/end times, exit codes and process exits.

Commands ran sequentially on **DANS1** from `2026-09-19T12:24:48.8188877Z` to `2026-09-19T12:25:04.6139650Z`. Runtime: `C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\runtime\node.exe`. Source workspace: `C:\Users\danie\XRayBuilds\preflight\sc11-panel-cb3d0b8de15f\source`.

## Exact source and isolation

[Source manifest](sc11-panel-cb3d0b8de15f/input/source-manifest.json) and [exact diff against baseline](sc11-panel-cb3d0b8de15f/source-diff.patch) identify all tested overlays. The baseline was `C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\source`, copied without node_modules/build caches. Dependencies were reused through per-entry read-only-use junctions; test transpilation used a **snapshot-local** `node_modules/.cache`. No install or baseline cache write was requested.

New source SHA-256:

| File | SHA-256 |
| --- | --- |
| QSCostPlanPackagePanel.tsx | `fb1804fad4dce87e429ae02c0457af138fb4fccb7f6cb7710084153911a5f17f` |
| QSCostPlanPackagePanel.css | `ecae6f5c3ab53a706ce2f07086cffe5816b42d0c25a3515a3a5cf9968202e132` |
| QSCostPlanPackagePanel.test.ts | `af008dca2afc2915d309e1d56cc0a89da4725aa0168b72d6c687fb2b48d4d626` |
| ductMaterialBasis.ts | `a67ff0e1299b4ad49f7356cc6a87719c7664829464746917be4efad30f8c7929` |
| ductMaterialBasis.test.ts | `f0df868ad03bf46811e5e5b759d1b607cdabd71dafb60e43bb2d02eba5657c19` |

The sixth new-file overlay was the requested SC12 audit document. Additional authorized overlays were `qsRateBook.ts`, `report.ts`, `PriceBookPanel.tsx`, `scripts/fast-cdp.mjs` and `scripts/fast-cdp.test.mjs`; their exact hashes appear in the manifest. No existing QuantityForm/Host/Workbench or persistence integration was overlaid or edited by this agent.

[Before](sc11-panel-cb3d0b8de15f/output/source-before.json)/[after](sc11-panel-cb3d0b8de15f/output/source-after.json) source manifests and baseline manifests are identical; all overlay hashes remained unchanged. [Invocation receipt](sc11-panel-cb3d0b8de15f/invocation-results.json) also records no local source changes since staging. Retrieved output hashes were checked against the remote [evidence manifest](sc11-panel-cb3d0b8de15f/output/sha256-manifest.json).

## Behavior actually checked

SC11: actual server-rendered component markup; latest snapshot/exact predecessor selection; mandatory explicit export inputs; stale quantity rejection; package export and integrity-checked reopen using the full production form schema; actual archive membership and every displayed digest (including manifest); tamper refusal with original imported bytes retained; explicit restore confirmation; foreign-project refusal; host rejection; detached restore; asynchronous A-to-B-to-A cancellation; disabled/form/metadata/unmount invalidation; safe markup and file-size bounds.

SC12: explicit reviewed mm/m thickness and kg/m3 bulk density produce declared kg/m2; missing/invalid/sample/inferred/unreviewed/stale inputs yield unknown; no normative material defaults or verification promotion; current-source mismatch; overflow/underflow; detached review snapshots; unchanged 16 m2 / 64 kg metal and 18.5 m2 wrap integration; unknown mass remains null.

## Cleanup and limits

[Cleanup receipt](sc11-panel-cb3d0b8de15f/cleanup-and-baseline.json) rechecked all four recorded process IDs and creation times: none remained the same live process. No diagnostic app/server/browser was created. Historical source and failed evidence were not removed.

Pending: parent integration, actual browser interaction, desktop/tablet screenshot inspection, saved-draft/project isolation lifecycle, real individual download readback, rendered PDF inspection, production/native build qualification and the remaining HVAC preview/source-binding work. SSR output is not visual evidence, and matching package hashes are not verified construction quantities. Under Daniel's completion rule, the missing screenshots and integration proof mean SC11/SC12 remain incomplete.
