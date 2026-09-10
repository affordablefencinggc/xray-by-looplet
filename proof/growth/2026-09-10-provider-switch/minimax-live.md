# MiniMax verified live — 2026-09-10

The credential works and the transport returns a clean reply through the same contract Gemini uses.

## Direct API probe

`probe-minimax.mjs` sends one real request and prints status only, never the key.

| Field | Result |
|---|---|
| Endpoint | `https://api.minimax.io/v1/chat/completions` |
| Model | MiniMax-M2 |
| HTTP status | 200 |
| `base_resp.status_code` | 0 |
| Round trip | 1.75 s |
| Key echoed in response | false |

## End-to-end through the transport

Driving `minimaxAiTurn` with the real credential and the app's own request contract returned:

    { ok: true, model: "MiniMax-M2", totalTokens: 2824, reply: "READY", containsThinkTag: false }

The reply validates against `assistantResponseSchema`, the same schema the Gemini route answers.

## A real defect the live call exposed

MiniMax M2 returns its reasoning inline as `<think>…</think>` before the answer. No unit test would have caught this, because the fixtures were written from the documented shape rather than the actual output. Left alone, two things would have happened:

1. The user would read the model deliberating with itself in the chat.
2. With a small budget the reply ends *inside* an unterminated `<think>`, so the visible "answer" would have been a cut-off thought.

Both were observed directly. The first probe with a 32-token budget returned nothing but a truncated thought and `finish_reason: "length"`.

`stripReasoning` now removes closed blocks and discards an unterminated one. When that leaves nothing, the reply says the model spent its budget reasoning and nothing was changed, rather than showing an empty bubble or the raw thought. Tool calls survive reasoning removal, which matters because a tool call with only reasoning as its text is a normal turn.

## Gates

19 tests in `minimaxAi.server.test.ts` including three for reasoning; full suite 1,144 across 88 suites, up from 1,141; `tsc --noEmit` exit 0; eslint clean.

## Configuration

`MINIMAX_API_KEY`, `MINIMAX_MODEL=MiniMax-M2` and `MINIMAX_GROUP_ID` are in `.env.local`, which is gitignored and untracked. The GroupID is stored for MiniMax APIs that require it; the chat-completions endpoint does not.

## Not claimed

No drawing or tool-calling session has been run through MiniMax yet. Whether the model drives X-Ray's tools as reliably as Gemini is an open question, and its stated limits stand: no image input, no grounded web search.
