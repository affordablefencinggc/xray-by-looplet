# MiniMax verified live — 2026-09-10

The credential works and the transport returns a clean reply through the same contract Gemini uses.

## Direct API probe

`probe-minimax.mjs` sends one real request and prints status only, never the key.

| Field | Result |
|---|---|
| Endpoint | `https://api.minimax.io/v1/chat/completions` |
| Model | MiniMax-M3 |
| HTTP status | 200 |
| `base_resp.status_code` | 0 |
| Round trip | 1.75 s |
| Key echoed in response | false |

## End-to-end through the transport

Driving `minimaxAiTurn` with the real credential and the app's own request contract returned:

    { ok: true, model: "MiniMax-M3", totalTokens: 2824, reply: "READY", containsThinkTag: false }

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

`MINIMAX_API_KEY`, `MINIMAX_MODEL=MiniMax-M3` and `MINIMAX_GROUP_ID` are in `.env.local`, which is gitignored and untracked. The GroupID is stored for MiniMax APIs that require it; the chat-completions endpoint does not.

## Not claimed

No drawing or tool-calling session has been run through MiniMax yet. Whether the model drives X-Ray's tools as reliably as Gemini is an open question, and its stated limits stand: no image input, no grounded web search.

## MiniMax-M3 confirmed and set as the default (2026-09-10)

The account accepts M3. Each candidate id was probed with a bounded request and its status read:

| Model id | HTTP | base_resp |
|---|---|---|
| MiniMax-M3 | 200 | 0 |
| MiniMax-M2 | 200 | 0 |
| minimax-m3 | 200 | 0 |
| MiniMax-Text-01 | 200 | 0 |
| abab6.5s-chat | 400 | bad_request_error |

`MINIMAX_MODEL=MiniMax-M3` is set in `.env.local`, and the code default now matches so a missing value resolves the same way.

End to end through the transport on M3:

    { ok: true, model: "MiniMax-M3", totalTokens: 2917, reply: "READY", containsThinkTag: false }

**Tool calling works**, which is what drawing depends on. Given one declared tool and an instruction not to guess, M3 returned a correct `read_project_context` call with the sentence "I'll read the current project context using the tool."

### A second reasoning defect, found only by calling for real

The first tool-calling run returned `text: "</think>"`. On M3 with tools the reasoning arrives already open, so only the **closing** tag reaches the content, and neither earlier rule matched it. The chat would have shown a bare `</think>` beside the tool receipt.

Everything up to and including a lone `</think>` is now treated as reasoning and dropped. A reply that merely uses the word "think" is untouched, which is asserted. Re-run live: the tool call now arrives with a proper sentence.

Both reasoning defects were invisible to unit tests written from the documented shape. Only a real call exposed them.

Gates after the change: 20 tests in this suite; full suite 1,145 across 88 suites; `tsc --noEmit` exit 0; eslint clean.

## Still not claimed

No full drawing session has run through MiniMax. One correct tool call is not proof that it drives a multi-round design task as reliably as Gemini, which remains the default provider in the switch.
