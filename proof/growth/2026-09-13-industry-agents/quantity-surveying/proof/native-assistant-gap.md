# Native assistant provider and screenshot gap

Read-only source audit, 2026-09-13. No provider requests, credential inspection, source changes or runtime verification performed. This describes current source, not a claim about an already packaged executable.

## Actual routing

- `src/studio/assistant/provider.ts:20-30` offers Gemini and MiniMax, defaults to MiniMax, and persists provider selection. This selects a provider, not an exact model ID.
- `src/studio/assistant/transport.ts:9-25` explicitly reports native MiniMax unavailable and rejects its turns. It does **not** silently call Gemini. Native Gemini invokes `xray_assistant_turn`; web uses the selected same-origin API route.
- `src-tauri/src/assistant_ai.rs:474` accepts no provider selector. It retrieves Gemini credentials from `MaterialAiState` and calls `request_gemini`, whose destination is Google's generateContent endpoint.
- `src-tauri/src/material_ai.rs:13-35` loads only Gemini/Google environment credentials and a Gemini model; configuration accepts only Gemini IDs. Credentials live in Rust process memory. Existing native AI review also offers a session-only Gemini key input; that path passes through frontend state and does not meet a stricter requirement that credentials never enter the webview.
- `src/lib/minimaxAi.server.ts:30-45` defaults to **`MiniMax-M3`**, with server-only `MINIMAX_MODEL` override. `mm-3` is not the implemented default identifier. Status requires a configured key/model and `XRAY_AI_WEB_ENABLED=true`; configuration is explicitly not proof of a working credential. This audit did not query the running preview's actual configured model.

## Images and capability gates

`providerSupportsTool` excludes grounded `web_search` and `generate_render_visualisation` for MiniMax. The chat hook filters declarations through that gate. The MiniMax server separately rejects grounded search and translates the shared request/response contract to chat completions, preserving tool call/result identity. Its image branch sends `image_url` data only when the configured ID equals `MiniMax-M3`; other IDs get an explicit text-only notice. A different alias does not automatically inherit image support.

`capture_workspace_image` is already a read tool and needs no separate user screenshot: the operating manual instructs the assistant to request it when needed. `appTools.ts:147-174,289` captures **only a visible architect or source-building 3D canvas**, after rendered frames, bounded to 1536 pixels. It checks project identity and returns actual PNG pixels plus frame/revision metadata. `conversation.ts:155-162` carries those image results into subsequent model input. Native Gemini also validates inline images. This is model-initiated capture, not a deterministic screenshot after every task, and not a full desktop, HTML controls, takeoff overlay or 2D workspace screenshot. PDF/source evidence has the separate `read_assistant_file` path. Native MiniMax cannot reach any of these tools because its turn is blocked first.

## Misleading interface details

1. `ProviderSwitch.tsx` renders both provider options without a native capability check, despite the comment in `provider.ts` calling the switch web-only. A new native profile defaults to an unsupported MiniMax choice. The menu promises M3 screenshots without qualifying native availability. The transport error is honest, but arrives after an apparently usable selection.
2. The switch is labelled “Model” while selecting a provider only. The actual model comes from server/native configuration; changing this menu cannot set `mm-3` or another ID.
3. `LiveAssistant.tsx:205-224` refreshes status on open/refresh, not provider selection. Its connected light and displayed provider/model can therefore be stale after changing the menu while open. Status is configuration availability, not a successful live request, yet the light says “Connected”.
4. Generic “capture” wording should retain the canvas-only scope rather than suggest the assistant can inspect the whole screen.

## Minimal supported implementation boundary

There is **no existing native M3 configuration-only fix**. Add a Rust-owned MiniMax transport alongside Gemini, reusing the current validated assistant envelope and the server adapter's tested message/tool/image conversion semantics. Pass an explicit allowlisted provider identifier to native status and turn commands; capture that choice per turn. Keep request IDs, cancellation, bounded bodies/timeouts, declared-tool validation, permissions, truthful receipts and no-fallback behavior. Preserve the actual model ID in status and responses. Native M3 should use the official configured HTTPS service directly from Rust, not a preview address or browser-side key.

The smallest credential boundary is Rust reading `MINIMAX_API_KEY` and an explicitly validated model from its launch environment, analogous to the existing native Gemini environment path. Report only nonsecret configuration status to the webview. A later persistent setup can use the OS credential store with native-owned retrieval; do not place keys in localStorage, project backups, frontend bundles, tool packets or logs. A production authenticated broker is another architecture, but no such supported endpoint was established here and it is not a reason to embed the current local preview URL.

Until that adapter is implemented, label native MiniMax as unavailable at selection time and refresh status on the selected provider. Do not switch providers automatically. To satisfy full-workspace screenshots beyond the existing canvas, implement a separate explicitly scoped native capture capability with real pixel receipts; do not relabel the existing canvas tool as desktop capture.

Acceptance for a future slice: same explicit selected-provider request reaches the native M3 adapter; exact model reported; no Gemini request on failure; paired tool call/result and real captured image reach the next request; cancellation and invalid/undeclared calls remain blocked; no keys returned or persisted to frontend/project data. Verify the installed native executable independently from the web preview.
