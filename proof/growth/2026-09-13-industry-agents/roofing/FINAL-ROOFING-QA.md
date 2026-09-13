# Frozen-source roofing live acceptance slice

**PASS: supplied-input draft calculation, readable receipt, final answer and reload persistence.** Host DANS1, target5109CD8477EBCCE9F4120D7C41B7DA12, Edge port9341/PID13316. Root froze source before this run. No source edits during this check.

One actual UI request sent09:45:39.720Z. It requested the explicit QA80m² horizontal plane, pitch36.86989764584402°, 4m² opening, with synthetic QA references; no workflow workaround was requested. Model chose `read_workflow_route` then actually called `calculate_draft_roof_area`. Both persisted receipts have executionOrigin:model. Final answer09:45:58.727Z reports gross100m²/opening5m²/net95m², draft-calculation and quote eligibilityfalse, with limitations. Developer review confirms actual tool execution. Its phrase “verified receipts” refers to successful calls; the result remains explicitly unverified for source/quotes and should not be paraphrased as verified measurement.

The calculator ToolRow itself now visibly reads “Calculated draft roof areas” and “Draft · not for verified quotes · gross100m² · openings5m² · net95m²”. `final-roof-readable-receipt.png` was captured after reload and visually inspected; no raw JSON is displayed. `final-roof-review.png` shows the actual Developer review and was visually inspected.

Complete original project JSON is identical before/after execution and after the persistence reload. Job49e99a2e-4d40-4a80-ba85-40a5b9df1141 remains revision1, no imported source, no geometry or quantity mutations. Reload preserved exact chat entries, model contents and active chat ID. Archive envelope revision135→136 and busytrue→false reflect final persistence completion; the entire envelope was not falsely claimed identical. No alerts; real hydrationready, provideridle. `final-roof-checks.json` and `final-roof-chat-checks.json` record those comparisons.

Evidence: `final-roof-send.json.result.json`, `final-roof-after.json.result.json`, `final-roof-persisted.json.result.json`, screenshots above and `final-roof-hashes.json`. The initial reload cleared prior HMR interruption; the second reload tested persistence. No additional provider request or mutation was used.

This proves draft arithmetic from explicit user operands through the live assistant. It does not prove roof tracing, source calibration, engineering verification, stock layouts, native packaging or whole-industry completion. Browser remains visible on the readable receipt for root/user handoff; existing root tunnel retained. All foreground CDP runners exited and sockets closed.
