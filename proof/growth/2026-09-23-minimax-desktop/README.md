# MiniMax on the desktop app — 23 September 2026

Cause: in the browser MiniMax runs through the web server route `/api/minimax-ai` using MINIMAX_API_KEY from `.env.local`. The desktop app has no web server; its Rust backend only spoke Gemini, and the UI blocked MiniMax on desktop.

Change:
- `src-tauri/src/minimax_ai.rs` (new): Rust port of `src/lib/minimaxAi.server.ts` — OpenAI-style chat completions, tool-call translation, `<think>` stripping, base_resp/length/undeclared-tool checks, key never returned or echoed. Commands `xray_minimax_status`, `xray_minimax_turn`, `xray_configure_minimax`. Key from MINIMAX_API_KEY, else `%APPDATA%\com.looplet.xray\minimax.json`.
- `src-tauri/src/assistant_ai.rs`: shared validators made crate-visible; declared-tool check extracted to `declared_tools_only`.
- `src-tauri/src/lib.rs`: state, startup load and command registration.
- `src/studio/assistant/transport.ts`: desktop MiniMax uses the native commands; native string errors are now shown instead of "Assistant failed.".
- `ProviderSwitch.tsx`: MiniMax selectable on desktop. `ExecutionSettings.tsx`: desktop "MiniMax on this computer" key/model fields.

Proof: cargo test --release 51/51 (4 new MiniMax tests); TS suite 1928/1928 after test updates; typecheck 0. Build exe 364832f7…; live check on isolated profile (CDP 9293): status "Configured", read-only question ran read_workflow_route + read_project_context and answered correctly (shots/minimax-desktop-reply.png). Key saved from .env.local through the app's own command (never printed). Installed: setup 7955e2f4…, installer exit 0, installed exe differs from tested exe only in the 3-byte bundle marker.
