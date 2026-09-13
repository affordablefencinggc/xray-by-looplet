# Quantity-surveying concurrent-turn regression

Root submitted three parallel read-only prompts at 2026-09-13T09:10:02.528Z after its concurrency fix. This agent observed only the existing DANS1 Edge target `E3CFBAA17EA003603A29822C2EA9F368` on loopback port 9343. It sent no additional prompt and did not reload.

## Observed result

At **09:10:47.875Z**, the turn had finished, no assistant error was present, and no “already running” error appeared for this fresh turn. The response contained the correct QS project ID `job-1f3f51c1-4210-4d76-820b-4508cdf59918`, revision 1; no other project ID appeared. Exact project comparison against root's pre-turn snapshot is unchanged. The fresh reply included a Developer review. Screenshot `after.png` was visually inspected.

The concurrency/error and observed project-isolation checks pass. This does not prove quantity classification or costing capabilities.

## Action-reporting finding

The only fresh visible tool receipt is **read_workflow_route**, returning `discussion`. The final answer also says it executed `read_project_context` and list-only `read_assistant_file` this turn; neither has a fresh visible receipt. Automatic context assembly may provide those data, but it must not be represented as a visible executed model tool without corroboration. Root is checking the server/provider trace. Therefore answer-quality accuracy is not marked passed.

Files: `before.json`, `after.json`, `fresh-turn.json`, `comparison.json`, `after.png`, and the raw-CDP read script/output. Root owns all source edits and final commit. No browser/tunnel was stopped; Edge PID 7348 remains visible, provider idle. Last target activity: 09:10:47.875Z. CDP socket closed after capture.
