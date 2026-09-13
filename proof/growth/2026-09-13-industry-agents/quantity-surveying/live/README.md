# DANS1 visible quantity-surveying assistant check

Host: `dans1` (SSH hostname checked). Target: `E3CFBAA17EA003603A29822C2EA9F368`; loopback CDP `127.0.0.1:9343`, browser PID 7348. Existing root-owned Edge session and preview tunnel reused. Window resized to 1280 x 900; no new browser/process launched.

At 2026-09-13T09:03:07Z, one request was sent through the actual configured assistant UI with permissions set to **Read only**. It requested project/tool inspection, a factual assessment of classification and cost-plan capabilities, actual executed actions, and a developer review. Exact prompt: `sent-input.json`.

## Result: blocked

At 2026-09-13T09:03:32Z, the UI displayed: **“An assistant turn is already running. Wait before retrying.”** The work packet displayed `blocked`. No assistant answer, tool execution receipt or developer review was delivered. This proves a rejected request, not successful industry capability execution. No automatic retry was performed.

The actual project object was read before and after. It is exactly unchanged, revision 1, with no runs, gates, BOM or quote draft. Its only document is the `No source plan` sample placeholder, SHA null, calibration unverified and unlocked. See `project-before.json`, `after.json`, and `comparison.json`.

`after.png` was visually inspected: the error and Read only permission are visible. Browser remained open for root handoff. Last target activity: screenshot/readback at 2026-09-13T09:03:32.429Z. Raw-CDP sockets closed after each bounded script. Root retains ownership of browser/tunnel lifecycle; this agent stopped neither. No project source code was changed by this check.

## Root-sequenced retry

Root authorized one retry after roofing and HVAC requests completed. Sent at 09:06:36Z; response read at 09:07:15.914Z. Original blocked evidence remains unchanged. See `retry/`.

Six actual receipts were captured: `read_workflow_route`, `read_project_context`, `read_source_sheets`, `read_takeoff_evidence`, `read_price_books`, `read_workbench_structure`. The sheet read returned the sample-source refusal; other reads exposed an empty project and zero price books. Assistant correctly declined to claim a produced cost plan. Independent exact before/after project comparison is true, revision 1. No mutation tool executed. Developer review was present.

Fact-check findings prevent a clean answer-quality pass:

- The answer suggests naming a professional authority and decision owner will unblock `review_takeoff_item`. Its own structure receipt explicitly says a name alone is not verified authority, so this suggested fix is unsupported.
- The final `read_workbench_structure` is a static capability description, not a project-state readback. Independent agent readback confirms unchanged state; the assistant did not perform that final state reread itself.
- Developer review reports no material friction or specific improvement, missing the earlier busy rejection and the above overstatement.
- Past-action summaries became six reply-option pills. These are receipts, not meaningful next-action choices; screenshot shows the confusing result.

No claim that classification or costing was executed. The isolated classification helper remains unwired. The current window is left open with the developer review scrolled into view for root/user handoff; provider is idle.
