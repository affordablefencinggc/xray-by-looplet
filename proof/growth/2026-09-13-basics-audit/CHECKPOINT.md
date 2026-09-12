# Proposed checkpoint: reviewed-workflows

Branch: feat/architect-cad-engine; baseline d128382; 7 existing commits ahead of upstream before this checkpoint. Normal branch push only, no merge or force push.

48 product/test source files plus documentation and preserved proof. Covers Visualise rails/walkthrough, compact navigation/theme/saved views, in-app project creation, calibration guidance and Sketch sizing, NCC local reference selection, historical drawings/annotation differences/plan overlay, and Looplet site transfer. NCC source files and configured external providers are still required for their respective real-data workflows. Native packaging is not part of this checkpoint.

Checks: 748 source hashes match the successful DANS1 build; typecheck, 39 review tests, manual Edge core journeys, 38/38 development and compiled navigation/layout operations, 26/26 overlay component operations. See README.md and ../2026-09-13-revision-overlay/README.md.

Excluded: unrelated planning/industry-specs/validate.test.mjs and old live-preview logs. No bulk clean/reset/stash. Proof files intentionally retained, including failed test-run diagnostics.

Repository scripts/guardrails/hook.mjs requires Daniel to name the checkpoint before commit/push. Staging is complete; commit/push awaits that named checkpoint.
