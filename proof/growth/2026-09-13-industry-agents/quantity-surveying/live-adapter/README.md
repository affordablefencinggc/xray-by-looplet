# Live QS classification adapter — real assistant execution

On DANS1 Edge target `E3CFBAA17EA003603A29822C2EA9F368`, port 9343, this agent sent one explicit synthetic fixture at 2026-09-13T09:31:21.796Z with Read only permissions. The configured assistant actually called **classify_draft_quantities**; it did not substitute prose arithmetic.

The fresh receipt at 09:31:41.191Z gives exact total **0.3 m2**, classified **0.1 m2**, unclassified **0.2 m2**, residue item **b**, `classificationComplete:false`, `status:draft-classification`, `verifiedQuoteEligible:false`. Both items retain sample evidence and null sources. Root/node rollups are 0.1, excluding unclassified residue. Project ID/revision are correctly bound. Exact before/after project comparison is unchanged, revision 1. Final answer and Developer review report the actual numbers/tools. No edit or save tool executed.

## Session failure found

Although the arithmetic and reporting pass, the session UI displays a persistence error: `threads[0].entries[20]` rejects unrecognised key `executionOrigin`. Screenshot `after.png` was visually inspected and visibly shows this error. Root was notified; no retry/reload was performed. A clean persisted-chat outcome is not claimed.

The assistant additionally exposed internal workflow-reminder wording before its final answer; the Developer review did not recognise that UI friction. This is secondary to the persistence error.

Evidence: exact prompt `sent-input.json`, fresh transcript `fresh-turn.json`, parsed tool `receipt.json`, state comparison `comparison.json`, full readback `after.json`, screenshot `after.png`. Edge PID 7348 remains open, provider idle; last target activity 09:31:41.191Z. Socket closed after capture. No source edits or new background processes in this test.
