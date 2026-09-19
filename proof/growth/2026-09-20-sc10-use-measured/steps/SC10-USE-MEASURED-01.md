# SC-10 — exact measured quantity, rates and cost revisions

Result: **PASS** on DANS1, 2026-09-20 Australia/Brisbane (capture 2026-09-19T14:40:22Z). This closes the SC-10 browser acceptance gate, not SC-09 geometry-family coverage, SC-11 delivery, deployment, native packaging or the working-day sign-off.

## Source and exact change

- Tested complete tracked application source at `545d25f2cedd5b7e2b55c8f1735cccc84559a4c7`, not the earlier CSS overlay. Source/archive identity: [source manifest](../machine/verified-source-manifest.json), SHA-256 `54da86633e12da78bb8f88538f5b37248d0eb133582285008706cf458907dead`.
- Implementation checkpoints: `a2935a9` (mounted rates/options/deltas), `6a9d5b3` (keyboard focus), `378bcd9` (precision/copy and contrast).
- Named exact [precision, measured-copy, regression-test and contrast diff](../sc10-use-measured.source.diff): seven SC-10 files, `6a9d5b3..545d25f`. No product edits were needed in this verification pass. Workbench/Host and HVAC were not edited.
- The first transfer was rejected before tests because a checkout-derived manifest did not match Git's LF archive. The corrected manifest verifies all 1,242 archive entries and records 92 CRLF/LF-only differences; no semantic substitution or relaxed hash check.

## Executed checks

- [Browser results](../browser/browser-results.json): **297/297 PASS**, zero browser errors, 14 screenshots, original authored scenario SHA-256 `71613342cdc43f72625466f1a33e555ce7605dda85ec052ab4e9a8b369b42bb7`. No fix/rerun loop, no weakened assertions.
- [Focused QS output](../machine/preflight/qs-focused.stdout.log): **270/270 PASS**, including all three measured-copy helper regressions and the mounted-component markup test. [Command receipt](../machine/preflight/qs-focused.json).
- [Full TypeScript receipt](../machine/preflight/typecheck.json): exit 0. [Source verification](../machine/preflight/results.json).
- [Scoped lint](../diagnostics/full-suite-missing-fixtures/scoped-lint.json): exit 0, **0 errors / 16 warnings**. Warnings are preserved in its stdout log; not a warning-free claim.
- The established broad machine gate remains **1951/1951 on frozen pack 9abf4c807030**. An additional current-source `npm test` diagnostic was **not green**: the transfer omitted the unchanged `engine/fixtures/*.pdf` inputs, causing `documents.test.ts:126` ENOENT after 203/203 and 795/796. [Preserved failure](../diagnostics/full-suite-missing-fixtures/full-tests.stdout.log), [receipt](../diagnostics/full-suite-missing-fixtures/full-tests.json). It is not claimed as a current full-suite pass; no test was deleted or skipped. The SC-10 browser and focused results above are independent, completed runs.

Exact browser command:

```powershell
& ./scripts/invoke-dans1-fast-cdp.ps1 -Scenario 'C:/Users/danie/repo/xray-by-looplet/proof/growth/2026-09-19-sc10-qs-rate-delta/sc10-qs-rate-delta.scenario.json' -RemoteWorkspace 'C:\Users\danie\XRayBuilds\preflight\sc10-11d72a23a0c5\source' -EvidenceRoot 'C:/Users/danie/repo/xray-by-looplet/.temp/sc10-current/campaigns' -RunId 'sc10-545d25f-current-dev1' -PreviewPort 8080 -CdpPort 9337
```

The returned evidence was copied byte-for-byte into this campaign. [Runner/source binding](../browser/run-binding.json), [artifact hashes](../browser/sha256-manifest.json), [launcher and cleanup](../browser/launcher-results.json): browser exited and all owned preview descendants stopped.

## Human acceptance — all 14 captures inspected

The lead inspected every screenshot at desktop 1600×1000 or tablet 1024×768. The comparison drawer is readable, its new/removed/modified labels are distinguishable, keyboard focus stays in the modal, text-contrast predicates pass, and the exact decimal is visible. Bounded table scrolling is intentional; this is not acceptance of every surrounding preview control or device.

| Visible requirement | Screenshot |
| --- | --- |
| Supplier revision/hash, currency and explicit GST basis | [Supplier provenance](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-supplier-provenance-desktop-1600x1000.png) |
| Proposed option excluded from accepted total | [Proposed option](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-proposed-option-excluded-desktop-1600x1000.png) |
| Accepted option contributes only scope delta | [Scope delta](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-option-scope-delta-desktop-1600x1000.png) |
| Unknown tax withholds prices and new revision | [Tax blocker](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-unknown-tax-withheld-desktop-1600x1000.png) |
| Actual pointer edit changes only selected measured run | [Geometry edit](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-real-geometry-edit-desktop-1600x1000.png) |
| Stale geometry withholds costs | [Stale blocker](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-stale-geometry-pricing-blocker-desktop-1600x1000.png) |
| Explicit copy retains `5.999999930955706 m`; evidence remains Unverified | [Exact measured copy](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-exact-measured-copy-desktop-1600x1000.png) |
| Quantity +17.16 and rate +17.42 reconcile to +34.58 | [Exact quantity/rate delta](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-exact-quantity-rate-delta-desktop-1600x1000.png) |
| Distinct new, removed and modified rows, desktop | [Desktop comparison](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-new-removed-modified-desktop-1600x1000.png) |
| Same comparison, tablet | [Tablet comparison](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-new-removed-modified-tablet-1024x768.png) |
| Base AUD120.38 separate from accepted AUD189.02 | [Tablet totals](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-accepted-base-totals-tablet-1024x768.png) |
| Four frozen cost revisions and saved project status | [Recorded history](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-recorded-history-tablet-1024x768.png) |
| Normal reload retains source, rates, options and totals | [Reloaded totals](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-reloaded-cost-plan-tablet-1024x768.png) |
| Reload retains immutable comparison | [Reloaded comparison](../browser/proof/growth/2026-09-19-sc10-qs-rate-delta/captures/sc10-reloaded-immutable-comparison-desktop-1600x1000.png) |

## Precision and remaining boundaries

The campaign first proves that typing `6` and using rebind-only remains stale and unpriced. It then clicks the real “Use measured quantity and rebind” button and checks persisted quantity/unit/binding byte equality with the current measurement. Evidence and source geometry remain unchanged. Only currency components round to minor units; the measurement is not silently rounded to make the test pass.

Controlled calibrated SVG and supplier CSV fixtures were used, not a live supplier or construction certification. This is development-server proof; a production-built SC-10 campaign was not executed in this pass. Missing reviewed FX is explicitly blocked; conversion arithmetic is covered by source tests. SC-09 remains partial for room-area/roof-plane families. SC-11 remains pending/unmounted. Native/deployment and whole-day acceptance belong to later slices. Existing historical FAIL receipts remain intact. No claim that all 375 catalogue requirements are complete.

The subsequent ledger/catalogue correction and generated dashboard have their own [documentation diff, executed checks and visual record](SC10-DASHBOARD-02.md). This product receipt and the documentation record are awaiting Daniel's explicit-path checkpoint approval.
