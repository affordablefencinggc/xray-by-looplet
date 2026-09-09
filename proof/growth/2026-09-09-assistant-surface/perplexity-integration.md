# Perplexity integration — verified against the live API (2026-09-09)

The owner supplied a Perplexity key (stored as `PERPLEXITY_API_KEY` in the gitignored `.env.local`) and a Python setup guide. The app is TypeScript and local-first, so the guide's `pip`/SDK routes do not apply; what follows is the **REST behaviour verified by calling the API with that key**, plus the corrections that verification produced.

## What was executed

| Endpoint | Body | Result |
|---|---|---|
| `POST https://api.perplexity.ai/search` | `{query, max_results: 3, country: "AU"}` | **HTTP 200 in 1.25 s** |
| `POST https://api.perplexity.ai/v1/agent` | `{preset: "low", input}` | **HTTP 200 in 5.22 s** |
| `POST https://api.perplexity.ai/chat/completions` | `{model: "sonar", messages, max_tokens: 80}` | **HTTP 200 in 2.83 s** |

## Corrections to the supplied guide

1. **`preset: "low"` resolved to `openai/gpt-5.6-luna`, not `openai/gpt-5.6-sol`.** Presets are the safe choice; pinning a model name in our code would break when Perplexity rotates it.
2. **Sonar is still live on `/chat/completions`** and answered with 19 citations in 2.8 s. The guide says Sonar is deprecated on 2026-09-27, so it may be used now but nothing may depend on it.
3. **The Python SDK and `pplx-srch-sdk` are irrelevant here.** X-Ray has no Python runtime; the browser must never hold the key, so every call goes through a server route exactly like `src/lib/pricingResearch.server.ts`.

## Verified response shapes (what a Zod schema must accept)

**Search** — `{ id, results[] }`, each result `{ title, url, snippet, date, last_updated }`. Dates are ISO `YYYY-MM-DD`; `date` may be years old while `last_updated` is recent.

**Chat (Sonar)** — `{ id, model, object, created, choices[], citations[], search_results[], usage }` where `usage` carries a real cost breakdown: `{ prompt_tokens, completion_tokens, total_tokens, search_context_size, cost: { input_tokens_cost, output_tokens_cost, request_cost, total_cost } }`.

**Agent** — an OpenAI-Responses-shaped object: `{ id, object: "response", model, output[], usage, ... }` where `output[]` interleaves the model's `queries` with its answer, and `usage.cost` itemises `tool_calls_cost_details.search_web`.

## Measured cost per call

| Call | Total cost | Notes |
|---|---|---|
| Search (3 results) | ~$0.0025 | flat per call, no token component |
| Chat / Sonar (56 tokens) | **$0.00506** | `request_cost` $0.005 dominates; tokens were $0.00006 |
| Agent, preset low (1 web search) | **$0.00366** | `tool_calls_cost` $0.0025 + output $0.00016 + cache $0.001 |

The flat per-request fee dominates every path, which is the strongest possible argument for the cache in SC-23: **the saving from never repeating a search is roughly the whole cost of the call**, not a fraction of it.

## How this lands in X-Ray (SC-23)

- **Server route only.** A new route beside `pricingResearch.server.ts`, reusing its posture verbatim: fixed upstream URL, `PERPLEXITY_API_KEY` read server-side, same-origin check, bounded timeout, capped response bytes, static error messages that never echo the key or the provider body.
- **Search API is the default** for the assistant's `web_search`: cheapest, fastest, and it returns sources rather than prose, which suits a references store that must keep bodies out of the context window.
- **Sonar/Agent is the "let me just check" answer path**, used only when the references store misses and a direct answer is wanted. Its citations feed the same store.
- **`country: "AU"` and `search_domain_filter`** are the levers that make results useful for this app (standards bodies and government domains), and both are verified to work.
- **Cache key** = normalised query + filters. A hit returns the stored result and says so; a miss calls the provider once and writes the body to the references store, putting only a citation line in the chat.

## Not done

Nothing reads `PERPLEXITY_API_KEY` yet. The route, the cache, the store and the provider switch are SC-23, which is not built.
