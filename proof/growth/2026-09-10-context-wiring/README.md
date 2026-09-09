# SC-22 context system wired into the send path — 2026-09-10

The assistant context system was built and unit-tested on 2026-09-09 but never called. `compactTranscript` and `upsertPinnedPair` had no caller anywhere in the application, and `contextTurn.ts`, which composes them, was imported only by its own test. The modules worked; nothing used them.

This slice closes that wiring and proves it, and fixes a release-gate defect found while doing so.

## What changed

`src/studio/assistant/useAssistantChat.ts` — the send path now composes, in this fixed order:

    chooseBase -> shortInteraction -> readCarriedContext -> assembleTurn

- A long transcript is compacted **by entries, never by tokens**, and a `functionCall` is never separated from its `functionResponse`.
- The saved profile and project digest ride as **one pinned pair at index 0**, upserted by sentinel so a second turn replaces the pair rather than appending another.
- The array stored on the record is the **compacted base without today's entry**, so compaction persists to the next turn and the context meter reflects what is actually sent.
- Both reads are **fail-open**. `readCarriedContext` settles rather than throws, so a storage failure still sends the user's message and surfaces `CONTEXT_CARRIED_UNAVAILABLE` as a notice. Losing carried context must never cost the user their message, and it must not be silent either.

The composition into `ASSISTANT_OPERATING_MANUAL` and the matching Rust `SYSTEM_INSTRUCTION` were already in place, with a parity test that compares the **composed** result rather than a source literal. That detail matters: a bare brief would leave `SAFETY_MANUAL` a dead constant and still pass a naive test, shipping the assistant without its 21 safety clauses.

## Proof

| Gate | Result |
|---|---|
| New wiring suite | 8 tests pass (`wiring-tests.log`) |
| Full focused suite | 1,119 tests, 88 suites, 0 failures (`full-suite.log`), was 1,111 |
| `npm test` | 999 pass |
| `tsc --noEmit` | exit 0 |
| eslint on changed files | clean |

**The tests are mutation-checked, not merely green.** A passing test proves nothing unless it fails when the code is wrong, so both wiring points were deliberately broken:

- Replacing `chooseBase` with the raw transcript (no compaction) → **1 test fails**.
- Replacing `readCarriedContext` with an empty profile (no carried context) → **4 tests fail**.
- Restored → **8 of 8 pass**.

`shortInteraction` lives in `workPacketRuntime.ts`, which reaches into the React store and cannot be imported under bare Node. It is mirrored in the test file and guarded by a drift test that reads the real source and asserts the copy still matches, so the mirror cannot quietly rot.

## Release-gate defect found and fixed

`proof/growth/2026-09-09-az6-release/worker.ps1` hardcoded its focused-test list. That list had drifted to **64 suites while the project had 116**. Every suite added since it was written would have passed a Dans1 release gate without ever running, including the entire SC-22 context system this slice wires up.

The step now derives the list from `package.json`'s `test` script and throws if it resolves fewer than 100 suites, so a thinned gate fails loudly instead of passing quietly. Verified by running PowerShell directly: the script parses with no errors, derives **117 suites** including the new one, and every derived path exists on disk.

This was not part of the request. It is reported because a build gate that silently skips half the suites undermines every release claim made through it.

## What is not claimed

Development-level proof only. Still open for this row: a live Fast CDP journey showing a long chat compacting, the pinned pair carrying a profile and digest into a later turn, and the unavailable notice under an induced storage failure; then the Dans1 az6 build with production and native runs. No build was produced and the verified-build pointer is unchanged at 8e14ac427997.

## Files

- `src/studio/assistant/useAssistantChat.ts` — wiring, 23 lines added.
- `src/studio/assistant/contextWiring.test.ts` — new, 8 tests over the composition.
- `package.json` — new suite registered so it gates CI.
- `proof/growth/2026-09-09-az6-release/worker.ps1` — derived test list plus the floor check.
- `wiring-tests.log`, `full-suite.log`, `mutation-evidence.md`.
