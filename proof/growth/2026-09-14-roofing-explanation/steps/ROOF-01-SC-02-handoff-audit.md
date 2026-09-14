# ROOF-01-SC-02: recovered live retest audit

Recorded 2026-09-14 by Codex after recovering Claude's repository conversation. This is an audit of existing evidence, not a new provider run or screenshot capture.

Requirement: actual assistant and Developer explanation must correctly describe course boundaries and lap policy, and persist after reload.

Source: branch feat/architect-cad-engine, baseline bcc5c3e; existing exact patch [source.diff](../source.diff), identities [source-hashes.txt](../source-hashes.txt). Existing uncommitted implementation was preserved. Historical tests are in [focused-tests.log](../focused-tests.log); no tests or builds were rerun for this documentation-only audit.

Executed evidence: [original live2 log](../../runner/2026-09-14T09-48-41-048Z-roofing-live2.log) and [scenario](../../runner/2026-09-14T09-48-41-048Z-roofing-live2.scenario.json). Provider pinned to MiniMax. Poll released with ready=true, entries=6, busy=false, error=null, ticks=56. Reload readback retained six entries. Two model-origin coverage receipts returned 9.8 m -> 2 courses / 20 sheets / 100 m ordered, and 9.81 m -> 3 courses / 30 sheets / 150 m ordered. The second receipt explicitly returns coveredRunM=14.6 and excessRunM=4.79; the excess value was not invented by the answer.

Visually inspected original [desktop reply](../screenshots/live2-desktop-02-reply.png) and [tablet after reload](../screenshots/live2-tablet-02-after-reload.png). Both show an actual generated Developer review, including the unresolved statement below. The tablet assistant overlays part of the empty drawing prompt; this evidence does not establish whole-app tablet acceptance. No new console-clean, production, native or cross-platform claim.

Verdict: boundary and lap explanation improved, but ROOF-01 remains OPEN. Contrary to Claude's proposed clean-pass conclusion, the Developer review asserts per-sheet waste "is 0.19 m of the third course's 5 m". That value is unsupported by the receipt and incompatible with treating the 4.79 m coverage excess as a qualified cutting/waste schedule. The tool explicitly does not provide cutting or reusable-offcut schedules. The prose also promises a correction that is not present. Developer review is same-model self-review, not independent acceptance.

Next: constrain unsupported waste/cutting extrapolation and test the contract before requesting another live acceptance turn. The latest user choice in Claude was roofing-only; no additional paid provider calls were made during this takeover. QS live acceptance remains unattempted by the coordinator.

Cleanup audit: queried Win32_Process for Claude's recorded campaign PID 35100 and preview PID 91660. PID 35100 is absent, so no termination needed. PID 91660 remains node.exe, created 2026-09-14 18:19:35 local, running this repository's Vite dev server on 8080; retained as the user-facing preview per prior instruction. No new background processes launched.

All inputs are synthetic QA references; no source-backed measurement, validated supplier reference or verified quote is claimed.
