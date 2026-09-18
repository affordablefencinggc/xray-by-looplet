# SC-04 — the ROOF-01 course count, verified rather than rebuilt

Slice SC-04 of `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md`: *ROOF-01 Assistant Course Calculator & Boundary Lap
Correction*. Written 2026-09-18 on `feat/architect-cad-engine`.

**This slice needed no code.** The ledger lists it as pending and names
`src/studio/industries/roofing/roofingCalculator.ts` — a file that does not exist — as the thing to fix. The
capability is in `sheetCoverage.ts`, it is tested, and the assistant tool already states the correction the
ledger asks for. What was missing was the *proof*: nothing had run the live query the slice's acceptance
names. That is what this bundle is.

## DONE (machine) — met before this slice, verified now

| Criterion | Reading | Carrier |
| --- | --- | --- |
| Effective length is `ordered length − end lap` | `sheetCoverage.ts`: `courses = run <= order ? 1 : 1 + ceil(run − order, order − lap)` | source, and the formula string the tool returns |
| 9.80 m with 5.0 m sheets and 0.2 m lap → exactly 2 courses | `assert.equal(at("9.8").courses, 2)`, and the boundary is returned as a fact: `maxRunAtThisCourseCountM 9.8` | `sheetCoverage.test.ts` |
| 9.800000001 m and 9.81 m → 3 courses | `assert.equal(at("9.800000001").courses, 3)` and `assert.equal(at("9.81").courses, 3)` | same file |
| Side lap and end lap are separate fields, and the assistant says so | `effectiveCoverM` drives `columns`, `endLapM` drives `courses`; the tool's description states that side lap is already inside the supplied effective cover and forbids the contradiction the register found | `sheetCoverageTool.ts` |

`sheetCoverage.test.ts` is in `npm test`, so these ran inside the 1733-test suite the SC-02 commit recorded.

## DONE (human) — the live query, run

*"Live assistant query test: 'Explain course calculation for 9.80m rafter with 5m sheets and 200mm end lap'
returns the exact 2-course proof without hedging."*

Run against the shipped chat UI on the isolated origin, one live provider turn
(`MiniMax-M3`, the provider this app's acceptance records use), by
`.temp/live-rig/build-sc04-live-query.mjs` — the SH-04 rig's own preamble (forced provider, seeded project,
fresh chat) and its own send-and-poll, so the turn is driven the way every recorded live run was.

The archived answer, verbatim:

> **Result** — **2 courses** are needed for a 9.80 m rafter run with 5.00 m sheets and a 0.20 m end lap.
>
> The tool confirms:
> - Per-course contribution after the first: ordered length − end lap = 5.00 − 0.20 = 4.80 m
> - Courses = 1 + ceil((9.80 − 5.00) / (5.00 − 0.20)) = 1 + ceil(1.00) = **2**
> - `courseBoundary`: 2 courses cover any run > 5 m and ≤ 9.80 m; anything ≥ 9.800000001 m needs at least
>   3 courses
> - `excessRun`: 0 m (9.80 m fits exactly)
>
> **Why the common shortcut is wrong**: `ceil(run / (ordered length − end lap))` gives 3 here, because it
> wrongly assumes every course, including the first, is shortened by the end lap.

No hedging, the arithmetic shown, and the trap named. The tool's own result carries
`"courses":"1 + ceil((9.8 - 5.0) / (5.0 - 0.2)) = 2"`.

| Capture | What it shows |
| --- | --- |
| `assistant-answer-composed.png` | 1600×1000, the question typed into the shipped composer before sending |
| `assistant-answer-replied.png` | 1600×1000, the answer as the panel paints it |
| `assistant-answer-replied-1024x768.png` | 1024×768, the same |

### Two turns were sent, and this is why

The first run answered the same question correctly but its capture showed only the answer's tail — the
reply is longer than the panel. The scenario was changed to scroll the answered turn to the top before
capturing, and run again. **No turn was re-sent to obtain a different answer**: both runs answered *2
courses* with the same arithmetic, and the second run's archive is the one recorded in
`archived-answer.json`. The first run is visible in `proof/growth/runner/` under `qa-sc04-live`, including
the model's own typo (`suplierReference`) in its first tool call and its correction on the retry — the
retry behaviour the bundle's D7 work covers, observed again here.

## Sessions and the server

One owned session, `qa-sc04-live`, closed through the CLI's own `close` after an identity check: daemon
gone, its temporary profile directory gone, `exitCode 0`. It is recorded in `process-table.json` **here**
rather than in the assistant campaign's table, which is a committed artifact of that campaign; the campaign's
file was put back byte-identical to the revision it was committed at, and its own check passes 13 of 13.

The owned dev server on `127.0.0.1:8085` was started through `.temp/live-rig/server-8085.ps1` and stopped
through its own identity-checked path: **PID 49020 gone, port 8085 released**.

## Not established here

- The live query is one turn on one provider. The arithmetic is deterministic and the tool returns the
  boundary as a fact, but this bundle does not claim the model never hedges under other phrasings — only
  that the phrasing the ledger names returns the 2-course proof.
