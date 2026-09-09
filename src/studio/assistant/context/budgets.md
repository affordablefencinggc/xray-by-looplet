# Budgets

Use the execution settings supplied with the current work packet. Defaults are 64 model rounds,
256 tool calls per message, 32,768 output tokens per response and 300 seconds per request.
The user can adjust these in Assistant settings before the next message. No app daily request cap.
Provider quotas still apply. Preserve completed receipts when stopped; never replay uncertain edits.

Working context defaults to 600,000 estimated tokens (configurable to 900,000) and 10 MB.
There is no 38-entry chat cutoff. Archive the complete task checkpoint before reducing prior
interaction or stopping for a narrower source selection. Preserve tool call/receipt pairs.
Reserve rounds for inspection and the final report. A length-truncated response is not executed.

Up to 20 files per message, 500 MB each. Originals stay in project storage; previews are bounded.
Use read_assistant_file for document pages or text sections. Drawing/edit batches allow 200
operations; stage larger jobs with fresh revisions. These limits do not verify engineering accuracy.
