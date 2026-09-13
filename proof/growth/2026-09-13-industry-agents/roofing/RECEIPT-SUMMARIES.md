# Readable receipts for the three draft calculators

Root delegated `src/studio/assistant/toolReceipt.ts` and `toolReceipt.test.ts`. No other shared files changed.

Dedicated titles and summaries now expose the actual result rather than only project revision:

- Roofing: gross, opening and net true areas in m².
- HVAC: lateral area in m² and sheet mass in kg, or explicit missing mass operands. Missing mass never displays as zero.
- Quantity classification: exact decimal quantities separated by supplied unit/evidence plus unclassified count. Uses report totals, never ancestor rollup sums. Large results show complete groups plus an omitted-group count; values and units are not truncated.

All successful calculation summaries begin “Draft · not for verified quotes”. Unknown/malformed status or a quote-eligibility flag other than false does not produce the normal quantity summary. Original input references remain in the stored tool record; no new references or verified status are inferred. The existing ToolRow renders these summaries; this slice does not add clickable detail controls or expose hidden raw JSON.

DANS1: 11 tests passed, zero failed (`toolReceipt-tests.txt`). Scoped TypeScript exit0 (`toolReceipt-typecheck.txt`, no diagnostics). Cases include live roofing100/5/95 result fields, duct missing/supplied mass, mixed-unit exact decimal classification, bounded long results and malformed/failed receipts. Existing receipt tests also pass. `git diff --check` passed. `toolReceipt.patch` records exact diff.

No browser reload or model request in this slice; visual confirmation waits for root's source freeze. Foreground test/typecheck processes exited, no background process created.
