# Governed memory foundation — 2026-09-09

Scope: first local foundation of GP-01 in planning/assistant/GOVERNED-PROJECT-MEMORY.md. Not completion of Phase 1 or the full redesign; no ISO compliance claim.

## Implemented

- IndexedDB packet/event stores with atomic compare-and-swap, unique event sequence, hash-linked event payloads and no automatic eviction. Raw intake, previous interaction, model requests/responses and tool results retained separately from the short live window.
- Fresh project/design/source snapshot before each model call and tool action, with an additional revision/identity check after asynchronous intent persistence. Existing source revision/status/authority gaps explicitly remain unknown.
- Saved tool intent before execution and result afterward; an uncertain edit blocks subsequent editing while allowing a fresh inspection task. Audit-write failures cannot silently continue or clear a durable pending intent.
- Current task checkpoint on failure/completion. Successful model replies remain review-required, never professionally approved or issued.
- Short interaction window replaces chooseBase/KYC/log injection in the live send path. Prior raw interaction is archived before it is shortened. Estimated input budget includes operating instructions and declarations, with a 65% checkpoint/reduction boundary, retained in-flight task exchanges, and durable blocking when a task cannot fit. Transport array/byte safety caps remain.
- Read-only work-packet/event retrieval tools, project-filtered; paged raw event text. Source candidates cannot acquire governing status from filenames, hashes or upload dates.
- Professional action gate in packet runtime, session entry and the MCP server itself. Current implementation blocks AI takeoff approval and external/professional issuance; it does not invent a human approval identity.
- Expandable packet summary and audit export in the existing assistant rail; restored after reload. Interaction display no longer labels entry-count exhaustion as a 300,000-token context failure.

## Executed evidence

84 focused tests passed, zero failed: workPacket, mcp, conversation, appTools, skills, permissions, contextTurn, contextBudget. Typecheck exit 0. Scoped lint exit 0.

Local Fast CDP JSON scenarios, per AGENTS.project.md local-first rule:

- runner/2026-09-09T10-11-55-607Z-governed-memory.json: real Gemini read_project_context request; truthful unknown governing revisions/authority; 8 durable events.
- runner/2026-09-09T10-13-39-042Z-governed-memory.json: 15-command audit verification, reload recovery, isolation and concurrent-writer scenario. One writer accepted, one rejected; state/event sequence remained consistent.
- runner/2026-09-09T10-15-42-831Z-governed-memory.json: tablet composer bounds and injected uncertainty test. No actual design mutation in the injected test; later editing blocked and inspection permitted.
- runner/2026-09-09T10-20-23-162Z-governed-memory.json: archive retrieval, unknown packet rejection, 100-entry interaction shortened to four messages, session approval bypass blocked.
- Raw MCP client bypass additionally tested through a real SDK handshake in mcp.test.ts.

Screenshots inspected: screenshots/governed-memory-desktop.png, governed-memory-expanded.png, governed-memory-tablet.png. No browser runtime errors reported. Earlier scenario failures retained: CSS selector used instead of accessible textarea label, stale imported module during HMR, and test expecting a thrown exception where tool errors are returned as isError. Tests corrected and rerun.

## Material limits and next work

- Packet creation currently occurs per send; multi-message task grouping, explicit resume/reconciliation UI and task closure acceptance are pending.
- No shared authenticated role registry, approved document-status workflow, full evidence graph, structured issue/RFI registers, citation-linked finding creation or change-impact propagation yet. Finding/source resolver schemas are foundations, not an implemented engineering checker.
- Local audit hashes are not authenticated signatures or server-enforced immutability. They verify event linkage; production needs trusted identities, protected storage and anchors. Main project backup does not yet include this new sidecar; explicit task-record export is available.
- Input tokens are conservative local estimates, not provider tokenizer counts. Image retrieval from archived events is paged data; dedicated visual rehydration remains future work.
- General model text is unreviewed; not every sentence has validated evidence citations yet. No claim of source-based engineering acceptance, automatic approval or safe issue.
- No Supabase deployment, external messages, production build or native package qualification performed. Shared deployment choice is pending; work remains local and standalone.

Changed existing files also contain prior shared-tree edits. The scoped diff must not be attributed wholesale to this foundation.
