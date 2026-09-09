# Live assistant restoration and hardening

Approved 2026-09-08: "move live assitant back over to right side. change the colouring back. harden the live assitant. and give it the approriate skills and guard rails"

Branch: feat/architect-cad-engine. Scope: assistant panel, conversation execution, assistant operating manual and matching native provider instruction. Preserve Claude's pricing/recovery/sheet slices. Baseline copies: proof/growth/2026-09-08-assistant-hardening/baseline.

- [x] SC-01 Restore right-side default (including old saved layout migration) and silver/white palette; preserve draggable/resizable controls.
- [x] SC-02 Install matching runtime skills/manual; enforce tool allowlist and per-message drawing-edit permission, duplicate call protection, call budget and cancellation boundaries.
- [x] SC-03 45 focused tests, typecheck, local Fast CDP desktop/tablet actions and inspected screenshots; Stop/Send resubmission bug reproduced and fixed.
- [x] SC-04 Frozen build 72804bfa9fac: 251 selected TypeScript tests, 14 Rust tests, web/Windows builds, production browser and Windows-native UI proof; source diff and cleanup recorded.

No source calibration, verified quantity, quote-finalisation or external-send capabilities are being added. Skills guide only supported operations. New tools must be explicitly classified before the live assistant can call them.

Evidence: proof/growth/2026-09-08-assistant-hardening/README.md. All 13 assistant files match the verified build. Five later pricing-research edits belong to the other chat and are excluded from this artifact acceptance. No installation, publication, commit or push. Owned native app closed gracefully; QA browsers and remote preview closed; existing user previews preserved.
