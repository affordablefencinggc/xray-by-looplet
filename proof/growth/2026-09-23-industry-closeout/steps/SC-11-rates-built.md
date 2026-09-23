# SC-11 — rate display and exported amounts

Built-browser qualification is complete for the bounded rate-formatting change. Source price precision remains intact; display/export shows at least two decimal places. Original [precision tests and exact product diff](../../2026-09-23-fencing-v1/steps/SC-11-rate-display.md) are supplemented by DANS1 built output `c56ad63e9ee7`.

[58/58 quote operations](../closeout-quote-issue-c56ad63e9ee7/browser-results.json) and [157/157 stock/export operations](../closeout-fencing-stock-c56ad63e9ee7/browser-results.json) pass. Root inspected [3.00 and 18.50 rates](../closeout-quote-issue-c56ad63e9ee7/captures/quote-issued-desktop.png), [built PDF 10.00 and 18.50](../built-stock-exports/quote-page-1.png) and [dated Bunnings rates](../closeout-gate-hardware-reviewed-c56ad63e9ee7/captures/gate-hardware-issued-desktop.png). [Actual export verification](../built-stock-exports/export-verdict.json) checks the downloaded PDF, ZIP, JSON and material-coverage CSV. No-rate quantities are disclosed and excluded from the amount.

[Proof diff](../fencing-proof.diff), [ledger diff](../fencing-ledger.diff), [audit](../fencing-audit.json). Formatting qualification does not establish supplier fit, a whole-job price, native installation or external delivery. The later assistant-only source change still requires its own final build.
