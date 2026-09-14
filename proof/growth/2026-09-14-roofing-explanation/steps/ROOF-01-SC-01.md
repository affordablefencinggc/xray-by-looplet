# ROOF-01-SC-01 — Correct the sheet-course explanation at its source (receipt + tool description)

Status: **code fix COMPLETE and executed-proof verified. Live assistant/Developer verification BLOCKED** by an assistant-provider request failure on the reused dev server. The model-explanation defect is therefore **NOT yet proven closed**; it is proven *addressed in the tool output*, which is a narrower claim.

Worker B (Roofing, IND-29). Baseline commit `bcc5c3e`, branch `feat/architect-cad-engine`. All changes left UNSTAGED; no git mutation was run.

## Requirement

INDUSTRY-REMAINING-WORK-PLAN.md ROOF-01: "Correct and freshly verify assistant/Developer sheet-course explanation. Keep correct calculator arithmetic. With 5 m sheets and 0.2 m end lap, 9.8 m is exactly two courses; 9.800000001 m and 9.81 m require three. Explain effective cover/side lap separately from end lap. Require actual receipt, accurate independent review and conversation reload."

This is a model-explanation accuracy defect, not a calculator defect. The arithmetic in `sheetCoverage.ts` was already correct and is unchanged.

## Root cause (evidenced, not assumed)

Traced the full path from tool definition to model. The receipt is **not** truncated or filtered on the way to the model: `appTools.ts:71` JSON-stringifies the whole returned object and `conversation.ts:153` caps it at 100,000 characters, far above the ~1.2 kB receipt. The nested `calculation` object and `limitations` array reach the model intact. The "Developer review" is not an independent reviewer — it is the *same* model self-reviewing in the same turn (`developerMode.ts:5`), so it saw the identical receipt.

The defect was therefore a **missing fact, not a missing channel**. The old receipt stated only the single evaluated instance (`1 + ceil((9.8 - 5) / (5 - 0.2)) = 2`) and never stated where the course count changes. The reviewer needed a boundary, had none, and extrapolated one — wrongly. Verbatim from the preserved prior turn (`proof/growth/2026-09-13-industry-agents/roofing/sheet-coverage/fresh-actual-thread.json`, entry `.entries.2.text`):

> **Friction:** The course formula prints `1 + ceil((run - ordered length) / (ordered length - end lap))` and that equals exactly 2 here only because `9.8 / 4.8` lies just below `2` once the leading course is counted — a value at `9.81` would still be 2, but at `9.800001 + endLap` behaviour changes by one sheet

Both claims are false: `9.8 / 4.8 = 2.0833…` (above 2, not below), and 9.81 m needs **3** courses, not 2. Contributing cause for the self-contradictory lap prose: the old `limitations[0]` fused two different laps into one sentence ("End laps between courses are included. Effective sheet cover already includes side lap…"), which the model could paraphrase into "transverse laps excluded" while also saying end laps are included.

## Exact diff

[`../source.diff`](../source.diff) — 3 files, +50/−6, all inside `src/studio/industries/roofing/`.

Post-change SHA-256 ([`../source-hashes.txt`](../source-hashes.txt)):

```
a80e05c5298dc724fd4400f39841ce3259001eee55f58f717e2e08f1ab9d650b  sheetCoverage.ts
60425e029ff4014557d30c0fe61ba5ae609daa2eec0cf495d1c8cea03c46c4c1  sheetCoverageTool.ts
e2ceeda6e6bfae16b0bc61fbcefccc0ad56a63464a218c51cd3a5c6b9e7ef561  sheetCoverage.test.ts
```

Changes, all making the correct explanation *derivable from tool output* rather than guessed:

1. `sheetCoverage.ts` — added to `calculation`: `coursesExpanded` (worked first-course-then-remainder wording), `courseBoundary` (the exact inclusive run range for this course count), `maxRunAtThisCourseCountM` and `minRunForAnotherCourseM` (the boundary as exact numbers), and `wrongFormulaWarning` naming and refuting the substituted formula.
2. `sheetCoverage.ts` — split the fused `limitations[0]` into two sentences: end lap (a.k.a. transverse lap) **is** included; side lap is a **separate** lap already inside effective cover. Each explicitly forbids the contradictory phrasing.
3. `sheetCoverageTool.ts` — description now forbids extrapolating a boundary and directs the model to quote `courseBoundary`/`maxRunAtThisCourseCountM`/`minRunForAnotherCourseM`, and to call the tool again for a different run rather than predicting it.

Arithmetic, exact nine-decimal-place decimal handling, and domain bounds are untouched. No product defaults, no opening deductions.

## Executed logs and receipts

Focused tests ([`../focused-tests.log`](../focused-tests.log)), command exactly as briefed:

```
node --experimental-strip-types --test src/studio/industries/roofing/sheetCoverage.test.ts \
  src/studio/industries/roofing/assistantTool.test.ts \
  src/studio/industries/roofing/roofArea.test.ts \
  src/studio/industries/roofing/roofForm.test.ts
→ tests 20 | pass 20 | fail 0
```

Baseline before the change was 19/19; the added test is `receipt states the exact course boundary instead of leaving it to be extrapolated`.

`npm run typecheck` (`tsc --noEmit`) → **exit 0**, no output.

Boundary receipts captured from the real helper ([`../receipt-boundary-samples.json`](../receipt-boundary-samples.json)) — the three ROOF-01 values, unchanged by this work:

| run (m) | courses | maxRunAtThisCourseCountM | minRunForAnotherCourseM |
| --- | --- | --- | --- |
| 9.8 | **2** | 9.8 | 9.800000001 |
| 9.800000001 | **3** | 14.6 | 14.600000001 |
| 9.81 | **3** | 14.6 | 14.600000001 |

The exact sentence the earlier reviewer would have had to read instead of guessing:

> "2 course(s) cover any run greater than 5 m and up to and including exactly 9.8 m. A run of 9.800000001 m or more needs 3 courses."

Self-correction during this step: the first version of `wrongFormulaWarning` rendered "would give 3 instead of the correct 3" for the 9.81 case — a sentence asserting a difference that does not exist, i.e. the same class of misleading receipt text as the original bug. It is now conditional and states plainly when the wrong rule coincidentally agrees. Caught by inspecting my own output, not by a test.

## Screenshots (named for what they actually show)

Campaign `roofing-explanation`, scenario sha256 `ce7fd35882ab6497a5f15b0fa5f8b0fe963eeeaf46e5a57ae5651c938bb442c2`, runner log `proof/growth/runner/2026-09-14T07-31-45-988Z-roofing-explanation.log`.

- [`desktop-01-composer-ready.png`](../screenshots/desktop-01-composer-ready.png) — desktop 1600x1000, assistant composer ready before send.
- [`desktop-02-assistant-working-no-reply.png`](../screenshots/desktop-02-assistant-working-no-reply.png) — desktop 1600x1000, the sent prompt visible and the panel showing **"Assistant is working…"**. **No model reply and no Developer review are present.**
- [`tablet-01-provider-failed-to-fetch.png`](../screenshots/tablet-01-provider-failed-to-fetch.png) — tablet 1024x768, the turn ended in **"Failed to fetch"** with the work packet state **blocked**, provider MiniMax.

These two files were initially written as `desktop-02-assistant-reply.png` / `tablet-01-assistant-reply.png` by the scenario. They were **renamed** because those names asserted a reply that did not occur. No screenshot here is evidence of a model explanation.

## Observed result

- Code fix: **verified** by executed tests and typecheck. The correct explanation is now fully derivable from tool output.
- Live assistant answer and Developer review: **BLOCKED — not obtained.** No genuine model response was produced, so nothing is claimed about whether the model now explains it correctly.

Blocker, exactly: the assistant turn failed client-side with **"Failed to fetch"** and the work packet moved to `blocked`; a follow-up read of the page failed with **`os error 10060`** (connection timed out). A `wait --fn` in my scenario briefly matched the string "Developer review" — that match came from the *injected prompt text echoed in the DOM*, not from a model answer; the screenshots disprove any reply. Diagnosis narrowing, so the blocker is not overstated:

- General egress works — `https://example.com` → 200.
- Both provider hosts are reachable from this machine — `api.minimax.chat` and `generativelanguage.googleapis.com` both return HTTP 404 to a bare GET, i.e. a live response.
- Provider config is present and enabled: `.env.local` has `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `XRAY_AI_WEB_ENABLED=true`. `assistantAiStatus` (`src/lib/assistantAi.server.ts:11`) returns 503 only when disabled, which is not the case here.
- The server route needs those keys from **process** env (not `VITE_`-prefixed). The dev server on port 8080 is **PID 100416, started 17:24:35, parent 73204 — not started by me** (my own `npm run dev` failed with `Error: Port 8080 is already in use`). I could not confirm it was launched through `scripts/with-app-env.mjs`, and its command line read back empty. A server started without those keys in its environment is the most probable cause, but I did not prove it and do not assert it as fact.

Per the brief I performed **no repeated retries** to obtain a better-looking answer. One campaign, one recovery read, both recorded as they happened.

## Conversation reload

**Not achieved.** The scenario's reload leg failed: the page went to `chrome-error://chromewebdata/` and the post-reload hydration wait timed out at 25 s, so `tablet-02-after-reload.png` was never captured. With no model reply to persist, the reload check has nothing to verify and is deferred with the live-model work.

## Cleanup

- I started **no** surviving process. My two `npm run dev` attempts both exited immediately (the first detached and exited 0; the second failed with "Port 8080 is already in use"). Verified by PID, creation time and command line — see [`../dev-server-identity.json`](../dev-server-identity.json).
- The Vite server on 8080 (PID 100416, start 17:24:35, parent 73204) was **already running** and is **not mine**; per the brief I reused it and left it running for its owner. An earlier version of `dev-server-identity.json` wrongly recorded `ownedByWorkerB: true`; that file now carries the correction and the evidence for it.
- The `agent-browser` process for my campaign — **PID 37032, created 14/09/2026 17:31:46**, matching my scenario launch at 07:31:45Z — was **stopped and confirmed gone**. Identity was checked on name + creation time before stopping.
- Two other `agent-browser` processes (PID 72184 at 17:23:33, PID 47276 at 17:35:58) bracket my run in time, belong to the other concurrent workers, and were **left running**.
- No other background helper was started by me.

## Remaining limits

- ROOF-01 stays **OPEN**. The model-explanation and Developer-review accuracy — the actual defect — is unverified against a live provider.
- No claim is made that the model now explains the boundary correctly. The fix makes a correct explanation derivable; only a genuine live turn can show whether it is used.
- Both prior turns are preserved unedited under `proof/growth/2026-09-13-industry-agents/roofing/sheet-coverage/` (`fresh-actual-thread.json`, `formula-actual-turn.json`, `fresh-verdict.json`, `formula-verdict.json`).
- Unchanged and out of scope: hips, valleys, penetrations, openings, stock nesting, flashings, fixings, product suitability. Results remain draft and quote-ineligible.
- Not run: full regression suite and any build/native packaging. Only the four briefed roofing test files plus repository typecheck.
