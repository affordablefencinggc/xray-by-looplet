# Budgets

Plan the whole reply inside these limits; code enforces them.

| Limit | Value | What happens when it is hit |
| --- | --- | --- |
| Rounds per send | 12 | The turn stops with "Paused after twelve assistant steps". Completed actions stay saved; the user sends another message to continue. |
| Tool calls per send | 24 | The next call is refused with a budget notice, then the turn throws. Nothing further runs. |
| Conversation entries | 38 | The next round throws "This conversation is full". A durable task checkpoint is kept; narrow the task before resuming. |
| Output tokens per reply | 8192 | The reply is cut off mid-text. Long content is split across sends instead. |
| Files per selection/message | 20 | Files over 500 MB each are refused. Originals stay in local project storage; images use bounded previews and document content is retrieved using read_assistant_file. |

Each tool round adds a model entry and a receipt entry. A fresh request uses a short interaction
window plus the current work packet. The runtime persists a checkpoint before reducing old
interaction context or stopping at the 300,000-token / 10 MB input budget. Preserve tool call and
receipt pairs. Save room for final inspection and an honest report of what completed.
