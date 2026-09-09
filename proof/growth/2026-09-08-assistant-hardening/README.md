# Live assistant: right-side restoration and hardening

Requirement: user-directed Live Assistant restoration and guardrails; ASSISTANT-MCP conversational UI. Branch: `feat/architect-cad-engine`. Source snapshot: `72804bfa9facd9f85ff24867ff328bd6f359607e253f6fce534f2d3aad08cb95`.

## Changes

- Restore the bottom-right default and earlier silver/white palette. A new layout storage version restores that default once while preserving the old layout key and subsequent user drag/resize choices.
- Keep uploads, image purposes, reference library, voice, resizing, keyboard movement and New chat. Restore 44 px assistant button targets.
- Add eight in-app workflows: project evidence, drafting, tour, status, architectural edit planning, takeoff readiness, materials research and reference comparison. The existing Sketch walkthrough remains available too.
- Both provider adapters use the same tested operating instructions: tool receipts before success claims, current project/revision, source/calibration boundaries, untrusted-document handling, research citations and no unsupported engineering or commercial claims.
- Filter live-assistant tool declarations and enforce an explicit tool allowlist at execution. Drawing edits, undo and save require the visible per-message permission. Permission resets after the message and on project change. Unknown/new tools fail closed. Inspection, navigation, existing-model playback, canvas capture and web research remain available.
- Validate response identity and payload before the conversation executes tools, reject repeated call IDs across retained history, and cap a message at 24 tool attempts/eight provider rounds. Preserve executed receipts and mark unexecuted calls explicitly.
- Lock overlapping Send submissions and avoid clearing a new project's composer when an old request returns.
- Fix a real Stop/Send event bug discovered during browser verification: React could reuse the Stop control as Submit during the same click, resubmitting the cancelled message. Separate keyed controls and cancel the original click default before stopping.

## Exact evidence

`code.diff` is the delta against copies taken immediately before this task, not against an older committed tree that would include other chats' edits. `task-source-manifest.json` lists all 13 changed/added application files and before/after hashes. Baseline copies are preserved. No pricing, sheet-lifecycle or protected-save implementation files were edited.

Local: 45 focused tests pass; typecheck passes; scoped whitespace check passes. Tests cover existing MCP/app-tool contracts plus permissions, response validation, replay protection, budgets, native/web instruction parity and layout geometry.

Development browser proof: `layout.scenario.json` and `guards.scenario.json`. Production proof: `production-layout.scenario.json` and `production-guards.scenario.json`. `browser-runs.json` links successes and the preserved failed attempts. Early layout failures were incorrect test selectors/counts; cancellation failures reproduced the Stop/Send bug and were fixed in source. Final pointer Stop check asserts exactly one user submission.

Screenshots inspected:

- `screenshots/growth/assistant-hardened-desktop.png`
- `screenshots/growth/assistant-hardened-tablet.png`
- `screenshots/growth/assistant-hardened-guardrails.png`
- `screenshots/growth/assistant-hardened-tool-guards.png`
- `screenshots/growth/assistant-hardened-stop.png`
- Corresponding `assistant-hardened-production-*` images.

Desktop: 1440 x 900. Tablet: 1024 x 1366. No horizontal overflow or uncaught browser errors in the final checks. Phone testing is excluded by the current project instructions.

The guard scenarios use a clearly labelled deterministic provider fixture with real workspace tools in isolated test profiles. They demonstrate that an unpermitted edit never executes, an explicitly permitted save produces an actual readback receipt, a repeated save call ID is rejected, permission resets, and cancellation does not resubmit. They are not live-model accuracy or prompt-injection-resistance certification. No private project data or live provider quota was used in these scenarios.

## Build and acceptance

All seven gates passed on Dans1, sequentially, High priority/16 workers: dependency setup, typecheck, focused tests, web build, Windows native build, native assistant tests and native material tests. The worker is an isolated derivative of the previously verified Dans1 worker, preserving its archive/hash checks and resource policy. Existing previews were preserved; production QA uses its own forwarded preview.

Artifact verification, native visual proof and final cleanup are recorded in the completion addendum below.

### Completion addendum

Build 72804bfa9fac passed 251 selected TypeScript tests, nine assistant Rust tests and five material Rust tests. Both web and Windows builds passed. Downloaded archives were hash-verified before extraction; all extracted files and the injected build ID matched their frozen manifests. See `release-72804bfa9fac/artifacts-verified.json` and `build-identity-verified.json`.

Windows-native Fast CDP passed 21 steps on the actual new executable at CSS 1440 x 900: right-side default, silver palette, guardrail drawer, workflow selection and permission toggle. Both native screenshots were inspected (`assistant-hardened-native.png` and `assistant-hardened-native-guardrails.png`). No live provider request was made in native UI QA; provider contract behaviour is covered by the native tests.

Native executable SHA-256: `96f933a4a2e32df08772f65989e2e11f5ac541b2910b020aa0582a584272efb4`. Native process 14500 closed gracefully without force. All three task browser sessions closed. The remote preview and its verified descendants stopped; the owning SSH session exited. Existing local preview 51016 and development server 44196 were retained. See `native-cleanup.json` and `remote-cleanup.log`.

Final whole-tree drift audit detected independent changes after the freeze in `src/lib/pricingResearch.server.test.ts`, `src/lib/pricingResearch.server.ts`, `src/studio/pricing/PricingResearchPanel.tsx`, `src/studio/pricing/pricingResearch.test.ts`, and `src/studio/pricing/pricingResearch.ts`. Those were preserved and are not covered by this frozen artifact's acceptance. `task-source-verified.json` separately confirms that all 13 assistant files still match the tested snapshot. No claim of current whole-application acceptance is made.

Coordination records: `LIVE-ASSISTANT-HARDENING-TODO.md` plus append-only task entries in `walkthrough.md`, `ASSISTANT-MCP-TODO.md` and `COMPLETE-CHECKLIST.md`. No existing checklist rows for Claude's slices are modified.

## Boundaries

No calibration/source/evidence approval tools, quote issuing, external messaging or publishing capabilities were added. Manual instructions guide the model; execution permissions, schema checks, revision checks and budgets enforce the supported action boundaries. These protections do not certify general model truthfulness, arbitrary external MCP clients or construction suitability. No model reconstruction, verified quantity, installation, deployment, commit or push is claimed.
