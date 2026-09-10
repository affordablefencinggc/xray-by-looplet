# Tool check: is the MiniMax assistant missing tools? — 2026-09-10

Short answer: **no tools are missing.** All 31 arrive. Two real defects were found, both fixed, and one genuine behaviour difference was measured.

## The measurement

`tool-check.mjs` sends 18 plain requests through the real MiniMax transport with the full 31-tool declaration set, and records which tool the model reached for. Tools are not executed; this measures declaration fidelity and selection.

| Metric | Result |
|---|---|
| Declarations sent | 31 |
| Cases | 18 |
| Reached the expected tool first | 3 |
| Reached a read tool first instead | 15 |
| Reasoning tags leaked | 0 |
| Transport errors | 0 |

Raw output: `tool-check.json`.

**The 15 "misses" are almost all `read_project_context` or `read_architect_design` called first.** That is not a missing tool. Asked to open the Sketch workspace, MiniMax called `read_project_context`. Asked to back up the workspace, it called `read_project_context` then `read_workflow_route`.

This is the behaviour the app asks for. The operating manual says "read current state first", and `workflowRouting.ts` **enforces** it: every bound edit tool refuses until a read has established the project. MiniMax follows that instruction more literally than Gemini does, spending its first turn reading. Over a multi-round conversation the read is a prerequisite, not a dead end, so the correct measure is whether the task completes, not whether the first call matches.

What this check does establish: the whole surface reaches the model, descriptions are understood well enough to select correctly once state is known, and no request errored.

## Two defects found and fixed

**1. `web_search` was broken on MiniMax.** Reported live: "Grounded web search is not available on MiniMax. Switch the provider to use it."

`web_search` is an ordinary MCP tool whose handler makes its own second request with `webSearch: true`. Only Gemini serves grounded search, so routing that inner request by the user's selected model made the tool fail for a reason the user could not act on. A grounded request now always goes to the provider that supports it, while the conversation stays on the selected model. Selecting MiniMax no longer costs you web search.

**2. Raw JSON was displayed in the chat.** Reported live: a tool row showed `{"status":"not-executed","reason":"Workflow prerequisite missing.","requestedTool":"read_source_sheets","next":{...}}` verbatim beside a red warning icon.

The refusal payload is written for the model to read. The failed-receipt path printed it unchanged, breaking the no-code-in-the-chat rule. It now reads: *"Not run: Workflow prerequisite missing. Next step: read the workflow route."* Four tools also had no human title and were rendering as underscore-derived text; `read_workflow_route`, `read_work_packet`, `read_work_packet_event` and `read_assistant_file` now have proper names.

## Gates

Three new tests in `toolReceipt.test.ts` built from the exact payload seen on screen; full suite 1,148 tests across 88 suites pass, up from 1,145; `tsc --noEmit` exit 0.

## Confirmed working from the screenshots

The provenance work from the previous slice is visible and correct: the banner reads "New project · no drawing imported", and a completed receipt reads *"pane sheets · project "New project" · revision 1"*. That is the per-receipt project stamp working live, which the previous slice recorded as open.

## Still open

Whether MiniMax completes a full multi-round drawing task as reliably as Gemini. First-call selection is measured here; task completion is not.
