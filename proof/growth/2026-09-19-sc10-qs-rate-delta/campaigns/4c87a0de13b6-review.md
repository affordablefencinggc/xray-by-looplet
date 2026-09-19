# SC10 browser campaign review — incomplete

Both campaigns ran on DANS1 against the preserved workspace `C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\source`, with loopback preview 8080 and CDP 9337. No source or runner was edited in that workspace.

| Campaign | Result | Operations completed | First failure |
| --- | --- | --- | --- |
| [dev1](sc10-4c87a0de13b6-dev1/output/browser-results.json) | FAIL | 108 / 289 | Keyboard focus escaped modal after fourth Tab |
| [dev2 diagnostic](sc10-4c87a0de13b6-dev2/output/browser-results.json) | FAIL | 108 / 289 | Same failure, enriched focus receipt |

The second receipt records `activeElement=BODY`, `document.hasFocus()=true`, `dialog.matches(':modal')=true`, and `dialog.open=true`. The preceding reachable elements were the earlier revision selector, later revision selector, and read-only change-table scroll region. No assertion was relaxed. The second scenario changes only failure diagnostics.

Before the failure, the mounted product successfully bound both source-calibrated rows, selected pinned material/labour supplier revisions, showed exact CSV SHA-256 and explicit 10% GST, reconciled AUD 154.44 all-base pricing, kept a proposed AUD 68.64 option outside the AUD 85.80 base/accepted total, then accepted the option for AUD 154.44 without changing the base. Two immutable cost revisions persisted, and their scope delta reconciled to AUD +68.64 with zero quantity/rate delta.

Visually inspected returned captures:

- [Supplier provenance](sc10-4c87a0de13b6-dev1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-supplier-provenance-desktop-1600x1000.png): real supplier selectors, material/labour separation, source reference/date/hash visible and readable.
- [Proposed option excluded](sc10-4c87a0de13b6-dev1/output/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-proposed-option-excluded-desktop-1600x1000.png): base and accepted both AUD 85.80; proposed alternative AUD 68.64 is separate; measured 2D/3D geometry remains visible.
- [Failure boundary](sc10-4c87a0de13b6-dev1/output/failure-op-108-default.png): open native comparison dialog clearly shows AUD +68.64 scope/accepted change and modified option row. The focus defect is established by executed receipts, not inferred from pixels.

Both browser receipts record zero captured browser errors and successful context disposal. Both launcher receipts record browser/preview cleanup. Retrieval completed with exit code 0. The outer invocation wrapper labels the nonzero SSH stderr path `INFRA_FAILURE` with a null remote exit code; the preserved browser and launcher records explicitly establish the product assertion failure.

The remainder of the 289-operation workflow was not executed: unknown-tax/FX blockers, real geometry change and rebinding, quantity/rate deltas, new/removed/modified comparison, tablet layout/contrast, and reload remain pending on a fresh source snapshot containing the dialog-local keyboard fix. No completion, production-build, installed-app, or live-device claim is made.
