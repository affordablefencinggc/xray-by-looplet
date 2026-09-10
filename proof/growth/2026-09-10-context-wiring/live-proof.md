# Live proof of the context wiring — 2026-09-10

Fast CDP runs against the development server on 127.0.0.1:8091, which had hot-reloaded the wiring commit. Desktop 1280x800 and tablet 1024x768.

## What was proven

**The carried context reaches the provider request.** The scenario seeded a profile (`role: fencing contractor in Queensland`, `units: millimetres on every drawing`) and one digest entry (`Northern boundary fence`) into the context store, reloaded, then sent a message. The on-screen meter read **369 tokens**, on both desktop and tablet, from independently seeded projects.

That number is the evidence, so it was checked rather than asserted. `measure-pinned.mjs` rebuilds the same transcript under bare Node from the same seed data and measures it with the same estimator the meter uses:

| Transcript | Tokens | Entries | Pinned |
|---|---|---|---|
| With carried context | **369** | 3 | yes |
| Without carried context | 31 | 1 | no |

The reproduction matches the browser exactly (`matchesBrowser: true`, `measure-pinned.json`). A bare send measures 31 tokens; the observed 369 means **338 tokens of profile and digest rode with the live message**. The wiring fires in the browser, not only in unit tests.

**The pinned block never reaches the user's eye.** `SENTINEL_VISIBLE_TO_USER:false` on every leg. It is provider context, not conversation, and it stays out of the transcript the user reads.

**Fail-open works, verbatim.** With only the context store broken (`indexedDB.open` throwing for `xray-assistant-context-v1`), the message still sent and the notice appeared word for word:

> Carried context (your saved profile and project digest) could not be read, so this message was sent without it. Your message was still sent.

Screenshot `desktop-04-carried-context-unavailable.png` was inspected: the user's message sits in the transcript, the assistant is working, and the notice is a non-blocking amber banner. Nothing was lost.

## A first attempt that failed, and why it was wrong

The first fail-open scenario asserted `NOTICE_PRESENT:false`. That was a fault in the test, not the product. Breaking **all** of `indexedDB` also breaks the work-packet store, which `beginGovernedWork` reads before the context read runs, so the send aborted earlier with `IndexedDB unavailable` and never reached the wiring. Narrowing the break to the context database alone produced the notice. Both runs are preserved.

This is worth stating plainly: the over-broad mutation revealed that a total IndexedDB failure fails the send at the work-packet stage. That behaviour predates this slice and is unchanged by it, but it means the fail-open guarantee proven here is scoped to the **context store** specifically.

## What the provider quota blocked

Gemini returned **HTTP 429 (quota)** for every send attempt across three separate runs, so **no model reply was produced**. What that does and does not affect:

- **Unaffected**: transcript assembly, the pinned pair, the meter, the fail-open notice, and the sentinel staying hidden. All of these happen before the request leaves the browser, and a 429 proves the request was built and dispatched.
- **Not proven live**: a completed reply, and therefore compaction of a genuinely long multi-round transcript, which needs many real rounds to reach the trigger. Compaction remains proven by unit test and by the mutation evidence, not by a live long chat.

This is a quota limit on the configured key, not a defect, and retrying will not change it. The remaining leg should be re-run when quota is available.

## Runs

| Session | Commands | Exit | Result |
|---|---|---|---|
| wiring-desktop | 27 | 0 | seeded, meter 0 → 369 → 475, sentinel hidden, 429 on reply |
| wiring-failopen-2 | 14 | 0 | notice verbatim, message sent, sentinel hidden |
| wiring-tablet | 16 | 0 | seeded, meter 369, sentinel hidden |
| wiring-diag / diag2 | 12 each | 0 | diagnosis of the first fail-open attempt |

Logs, saved scenarios and their SHA-256 values are under `proof/growth/runner/` with the `wiring-` prefix. Screenshots are in `screenshots/growth/2026-09-10-context-wiring/`, and the four referenced above were inspected.

## Still open for SC-22

A live long-chat compaction round and the az6 Dans1 build with production and native runs. The verified-build pointer is unchanged at 8e14ac427997.
