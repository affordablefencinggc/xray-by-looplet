# Reading the user's own attachment was gated as if it were an edit — 2026-09-10

## What was seen

A user attached an elevation drawing, asked about it, and the assistant was refused:

> **Read an attached file** — Not run: Workflow prerequisite missing. Next step: read the workflow route.

The user handed the assistant a file and the assistant was told it needed permission to look at it.

## Why it happened

`workflowRouting.ts` gates any tool not in `UNBOUND_READS` behind workflow selection. That set held only five entries, so `read_assistant_file` fell through to the default and was routed like a mutation.

The router exists to stop an edit running against stale or unverified state. A read changes nothing, so gating one buys no safety. It costs a round trip and shows the user a refusal they cannot act on.

Three other inspection tools had the same problem: `read_price_books`, `read_draftsman_status` and `read_source_building`.

## The fix

Those four are now unbound reads. `read_assistant_file` still verifies the project through `expectedJobId` inside the tool, so the project binding is unchanged; only the ordering requirement is lifted.

Verified by executing the router directly:

| Tool | Before | After |
|---|---|---|
| read_assistant_file | read_workflow_route | runs immediately |
| read_price_books | read_workflow_route | runs immediately |
| read_draftsman_status | read_workflow_route | runs immediately |
| read_source_building | read_workflow_route | runs immediately |
| draw_architect_elements | read_workflow_route | read_workflow_route |
| calibrate_source_sheet | read_workflow_route | read_workflow_route |
| export_design_file | read_workflow_route | read_workflow_route |

**Every mutation is still routed.** That is asserted directly, across all six edit tools, so the safety property this router exists for is measured rather than assumed. A further test proves an ungated read cannot be mistaken for having read the design: a drawing edit after reading an attachment still has to establish project and design state for itself.

## Gates

3 new tests in `workflowRouting.test.ts`; that suite 13/13; full suite 1,151 across 88 suites, up from 1,148; `tsc --noEmit` exit 0.

## Also confirmed working from the same screenshot

Both fixes from the previous slice are visible and correct:

- The refusal reads as a sentence, not raw JSON: "Not run: Workflow prerequisite missing. Next step: read the workflow route."
- `read_assistant_file` renders as "Read an attached file" rather than underscore-derived text.

## Still open

Whether MiniMax completes a full multi-round drawing task as reliably as Gemini.
