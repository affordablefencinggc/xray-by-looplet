# Assistant tool audit

Authorized: user said "take over", 2026-09-10.
Baseline: `82612db`, branch `feat/architect-cad-engine`.
Proof: `proof/growth/2026-09-10-tool-audit/`.

- [complete] SC-01: discovered 31 real MCP declarations and executed representative attachment/drawing/readback/save workflows on DANS1. This is not exhaustive positive coverage of every tool.
- [complete] SC-02: completed tool calls replace their progress rows; structured errors become readable receipts. Existing authority and permission guards retained.
- [complete] SC-03: 1,235 tests, typecheck and web build passed on DANS1. Final dev and built browser checks passed; desktop/tablet screenshots inspected. See proof README.

User correction: "chats a dispearing . models are swapping all over the shop".
- [complete] SC-04: saved chat archives, retained old conversations, recovered available task journals, verified reload/project isolation/New chat/history reopening and stale-write refusal.
- [complete] SC-05: user clarified models meant AI providers (Gemini credits exhausted). Removed automatic Gemini search fallback, pinned provider for each message, excluded and refused Gemini-only tools under MiniMax. Real MiniMax reply and zero-request refusal proof passed. The temporary 3D-selection changes were reverted; older model proof is superseded.

Do not infer tool availability from a manually reconstructed declaration list or first-call selection. Tests use an isolated browser project. No deployment or native release is included.
