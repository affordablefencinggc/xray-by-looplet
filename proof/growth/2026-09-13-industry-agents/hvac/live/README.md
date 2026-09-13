# DANS1 visible HVAC assistant QA ? 2026-09-13

First request was blocked by the shared provider running guard. The visible error was ?An assistant turn is already running. Wait before retrying.? No assistant tools or developer review ran on that attempt. `before.json`, `after.json`, `blocked.png`, and `receipt.json` preserve this finding. Root confirmed the shared-server guard and authorized exactly one serialized retry after roofing finished.

The serialized retry completed through the configured provider. Persisted conversation entries in `retry-receipts.json` prove five actual read calls: read_workflow_route, read_project_context, read_source_sheets, read_takeoff_evidence, read_assistant_file. No mutating call occurred. The full project snapshots in `retry-before.json` and `retry-after.json` are identical, revision 1. Permission select was confirmed `readonly`.

The assistant correctly reported no real source/hash, no locked calibration and no traces; these match the raw receipts and the visible empty source area. It did not claim to have drawn or measured a duct. The developer review was actually returned and visible. Statements about future calibration/trace capabilities were NOT executed by this test. The unconnected duct arithmetic helper was not run or promoted to takeoff by this conversation.

Verdict: read-only evidence inspection works when serialized; HVAC duct takeoff remains unproven and unavailable in this empty project. Initial concurrent assistant request failed. No claim of successful engineering sizing, imported document, trace, or quote.

Primary visual proof: `retry-developer.png` (1256 ? 761 content viewport in a 1280 ? 900 Edge window), visually inspected. `retry-result.png` was captured during a smaller window state and is diagnostic only. `retry-review.png` shows final response bottom. No arbitrary project data was seeded.

Host DANS1; Node executable C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe. Browser PID10208, creation epoch1789289962884, Edge profile-hvac. CDP 127.0.0.1:9342 target C881A561953E464791A17AF4579C59F6. Root owns browser and reverse tunnel. All short CDP scripts closed sockets and exited. Visible browser retained for root/user handoff by explicit instruction. Last task activity 2026-09-13T09:07:08Z. No source files, provider settings, full builds or shared files changed by this QA worker.
