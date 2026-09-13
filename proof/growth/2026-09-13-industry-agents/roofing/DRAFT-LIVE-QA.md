# Real roofing draft tool through live assistant

2026-09-13, DANS1 Edge9341. **Successful on the single authorized retry**: actual `calculate_draft_roof_area` tool result is saved, produces net95m², and the visible final response and Developer review report that execution. No project mutation.

## Inputs and actual result

One explicitly synthetic QA plane80m² horizontal gross, pitch36.86989764584402° from horizontal, opening4m² horizontal. Measurement and pitch reference strings all explicitly state QA supplied synthetic inputs. Actual model-origin tool receipts on retry: `read_workflow_route` (discussion), then `calculate_draft_roof_area`.

Receipt: slope factor1.25; gross true100m²; opening true5m²; net true95m²; status draft-calculation; verifiedQuoteEligible:false. Original supplied reference strings retained. It explicitly excludes source/calibration validation, overlap/containment, hips, valleys, sheets, laps, waste, drainage and compliance. No source-backed takeoff claim.

Retry user timestamp09:35:24.781Z, final assistant09:35:37.005Z. Complete before/after project JSON equal for job49e99a2e-4d40-4a80-ba85-40a5b9df1141 revision1; no alerts. `draft-live-retry-after.json.result.json` contains persisted chat receipts including executionOrigin:model and the final answer. `draft-live-retry-review.png` was visually inspected and shows the actual Developer review confirming tool execution and quote ineligibility.

## Initial attempt and recovery must not be hidden

The first request09:31:31 produced two model text-only candidates claiming a tool ran and net95m², but its raw persisted journal contains **zero tool-result events**. Both were withheld as workflow-incomplete. Their Developer reviews falsely claimed execution/no friction. `draft-live-recovery-read.json.result.json` preserves those candidates and gate events. A correct number alone was not execution proof.

Root's necessary development updates interrupted hydration during capture; the UI showed Checking saved work and a transient initialization job. That transient state was not treated as a saved project change. Root authorized one reload and one retry after freezing source edits. Reload restored the original project/history and an interrupted-response notice. Retry explicitly required actual tool API use before answering and succeeded with real receipts.

Initial test runner JSON had an unescaped quote and failed before any browser operation; corrected before the first send. Thus two model requests total: original and root-authorized retry, no extra provider retries by this worker.

## Remaining limits and handoff

A later attempt to scroll specifically to the numeric result during further HMR found no matching heading (`found:false`); `draft-live-95m2-result.png` is diagnostic only, not proof of those numbers. Numerical proof is the persisted actual tool receipt. The successful final review screenshot was taken before that later interruption. Root owns final stable visual handoff and routing changes. No source changes made by this worker in the live slice.

Provider idle was reported to root after successful capture. Last worker browser action09:37:09.872Z; Edge PID13316/root tunnel retained for active viewing; foreground CDP runners exited. This proves draft supplied-input arithmetic through the assistant, not roof tracing, verified quantities or a complete roofing workflow.
