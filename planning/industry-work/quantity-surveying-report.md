# Quantity surveying: classified quantity report

Bounded slice: existing manual worksheet, not a priced or issued cost plan. Storage schema unchanged. Manual quantities retain source:null and unverified/inferred/sample evidence; no measured or authority promotion.

Implemented report contract:

- Whole-draft totals count each actual item once, split by exact unit and evidence. Classified/unassigned columns and item counts remain visible.
- Report filters show all/classified/unassigned rows or a classification subtree. Shown-item totals are distinct from whole-draft totals. Choosing unassigned resets the branch filter; filtering does not edit draft quantities.
- Expandable whole-draft hierarchy shows direct and inclusive quantities. Inclusive parent/child values overlap and are never summed into the report total.
- Download shown item rows exports one CSV record per actual item, including quantities directly assigned to a nonleaf classification. No rollup records. Columns retain hierarchy, classification path, evidence, all supplied source-reference fields, draft status and quote-ineligible flag. Manual source absence explicitly says unavailable.
- CSV quotes every cell, escapes quotes/newlines and prefixes formula-like values starting with =,+,-,@ after whitespace/control characters. Exact decimal strings remain unchanged. This is a CSV text fidelity guarantee, not control of spreadsheet import type inference.
- Any form edit/reassignment clears the calculated result and removes its export action; report preferences are transient and do not change stored schema.

Verification so far:16focused DANS1 tests pass:6report/domain-export,3actual rendered-panel,7existing form. Tests cover0.1+0.2, parent-direct+child totals, mixed unit/evidence, unassigned/subtree/empty views, source preservation, CSV quoting/formula safety, stale/invalid report hiding and disabled download. Browser verification pending shared freeze; no whole-industry readiness claim.

New package test entries for root integration: src/studio/industries/quantity-surveying/report.test.ts and QuantityReportView.test.ts. No shared package/source files edited by the QS agent.

## Live QA update

Actual DANS1 desktop filters, nested rollups, real CSV downloads, edit invalidation and saved-input reload passed. See report-upgrade/live/REVIEW.md and captured files. Assistant initial routing failure was narrowly fixed and tested; fresh delivery/reload passed, but answer content and Developer review remain inaccurate about CSV hierarchy fields and why inclusive totals are safe. Do not mark assistant review quality or the whole industry complete. Tablet report QA remains pending.

### QS-01 current qualification, 2026-09-14

One DANS1 MiniMax user turn made two classification attempts, both rejected for malformed or omitted explicit nulls. It then incorrectly excluded unassigned item d from export/totals. QS-01 remains OPEN; no successful live receipt or accurate export explanation is claimed. [QS-01-SC-02 proof](../../proof/growth/2026-09-14-continuation/steps/QS-01-SC-02.md) retains the full archive, reload and screenshots. Existing deterministic CSV/hierarchy tests still pass.
