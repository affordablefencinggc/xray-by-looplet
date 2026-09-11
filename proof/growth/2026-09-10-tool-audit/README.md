# Chat persistence and provider routing repair

User authorized take-over and reported disappearing chats and changing models. The final clarification was exhausted Gemini credit: model means AI provider here. Baseline was `82612dbdce15a5f31fb602bbbdc88f8125d3f511` on `feat/architect-cad-engine`.

## Findings and changes

- MiniMax's nested `web_search` was unconditionally routed to Gemini. The real baseline call returned HTTP 429. The message now captures its chosen provider once; all conversation rounds and nested search use that choice. MiniMax excludes and refuses Gemini-only search/image-generation tools before a request. There is no automatic provider fallback.
- Chat state lived only in memory. Project-scoped IndexedDB archives now retain transcripts and old threads. History reopens earlier conversations; New chat and context handover preserve them. Writes use an atomic revision check so another tab cannot silently overwrite saved history. Interrupted turns are shown as interrupted, never replayed.
- Existing task journals can reconstruct previously recorded objectives/replies/tool results. Recovery explicitly labels these records unreviewed and warns that older chat-only messages may be unavailable. It cannot recover data that was never saved.
- Completed tool receipts now replace their running rows, including repeated tool names and failures. Unknown structured error payloads no longer appear as raw JSON.
- Temporary 3D model-selection changes were removed after the user's clarification. `history-model-*` and `production.json` are historical scenarios and are superseded by the final chat-only scenarios below.

## Executed evidence

All execution was on **DANS1**, via SSH `tonys-test-pc`; local activity was limited to source/proof editing, transfer and visual inspection. Raw CDP contexts were disposed after every scenario.

| Evidence | Result |
| --- | --- |
| `provider-verified/result.json` | 23/23 operations. Real MiniMax attachment read and saved reply; reload retained reply/selection. Gemini-only tools and direct grounded MiniMax requests refused before network. Explicitly pinned MiniMax transport remained MiniMax despite a changed global selection. The pin/refusal part uses an identified fetch fixture; the attachment reply uses the real provider. |
| `history-final/result.json` | 30/30 operations. Synthetic chat fixture, project isolation, reload, New chat, two retained threads, reopening, second reload, atomic stale-write refusal, tablet history. |
| `recovery/result.json` | 10/10 operations. Synthetic legacy task journal recovered with honest recovery notice. |
| `production-final/result.json` | 20/20 operations. Built output restored the dev-created chat archive and MiniMax selection, rendered history at desktop and 1024×768 tablet sizes, no uncaught exceptions. Production preview intentionally carries no provider secrets; its connection notice is expected. |
| `provider-full-tests.log` | 198 script tests + 1,037 TypeScript tests = **1,235 passed**, zero failed. |
| `provider-typecheck.log` | TypeScript check exited zero. |
| `completion.json` | Dependency install, typecheck, focused tests and production web build passed; High priority, 16 workers through the mandated worker. |

Build source SHA-256: `5d09604883c5b3e745089f140034c99b7703374260c29035c0afa8fa441ebe08` (1,050 source files). Immutable build: `C:\Users\danie\XRayBuilds\runs\5d09604883c5`. Browser evidence: `C:\Users\danie\XRayBuilds\tool-audit-20260910`. Checklist/report edits after this build are documentation only.

Visually inspected final real-chat screenshot, desktop restored production chat, tablet production history and development tablet history. Screenshots have SHA-256 values in each result file.

## Coverage boundaries and failed attempts

The live baseline discovered 31 genuine MCP tools and completed representative file-read, four-wall drawing, model readback/capture and save workflows. It did not prove every tool operational. The rapid direct-tool harness stopped at controller-update readiness during editing; professional review remains intentionally authority-gated. Claude's earlier 3/18 first-call selection exercise with hand-reconstructed schemas is not an execution qualification.

`live-final` preserves the reproduced Gemini 429. `provider-fixed` initially failed because its test setup selected the wrong module instance/provider during lazy loading; the final scenario seeds the persisted selection before loading and verifies the actual network routes. Earlier staging/harness failures remain historical; final pass files are identified above.

No commit, push, deployment or native package was performed. Web-only build is an explicit option on the existing worker; its normal native workflow is preserved. Chats are saved in the current device/browser, not cloud-synced. Previously unsaved messages cannot be promised recoverable.

## Cleanup

`cleanup-final.json` and `cleanup-preview-old.json` record checked process identities. Task-owned dev/production processes were stopped; the attached SSH job ended its Chrome descendants. The user's existing local preview and unrelated sessions were retained. No user runtime logs were reverted.
