# Mutation evidence — do the wiring tests actually fail when the wiring is wrong?

A green suite proves nothing on its own. `contextWiring.test.ts` reproduces the send-path composition, so the risk is that it passes whether or not the application is wired. Both wiring points were therefore broken deliberately and the suite re-run.

## Mutation 1 — remove compaction

`chooseBase(stored)` replaced with the raw transcript and an empty compaction result, which is what the code did before this slice.

    const chosen = { contents: stored, compaction: { compacted: false, carriedCallIds: [] } };

Result: **1 failed, 7 passed.**

    ✖ a long transcript is compacted before it is sent, and the stored base is the compacted one

## Mutation 2 — remove carried context

`readCarriedContext(jobId, readers)` replaced with an empty profile and no log entries, simulating the send path never reading the store.

    const carried = { profile: emptyProfile(), entries: [], failed: false, reason: "" };

Result: **4 failed, 4 passed.**

    ✖ the send path carries the saved profile and digest as a pinned pair at index 0
    ✖ a failed profile read still sends the message and reports the loss
    ✖ both reads failing degrades to an unpinned send rather than blocking the user
    ✖ a second turn upserts onto the same pinned pair instead of growing a new one

## Restored

Original file restored: **8 passed, 0 failed.**

## Reading this

Every test that should be sensitive to a mutation was. The four tests that survived mutation 1 concern carried context and the schema contract, which that mutation does not touch; the four that survived mutation 2 concern compaction, ordering and the mirrored-function drift guard, which that mutation does not touch. Neither mutation left the suite fully green, so neither wiring point can be removed without a test failing.

One test deserves separate mention. The drift guard reads `workPacketRuntime.ts` from disk and asserts the mirrored `shortInteraction` still matches it. It passed under both mutations because neither changed that function, which is correct: it guards a different failure mode, namely the mirror silently falling out of step with the real implementation.
