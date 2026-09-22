# Live assistant layout

Approved 2026-09-08: user requested smaller bottom-left assistant, dragging/resizing, a + menu for image upload/skills/new chat, bottom-aligned compact send, and removal of standalone New chat.
Branch: feat/architect-cad-engine. Shared dirty tree preserved. Requirement: ASSISTANT-MCP-TODO conversational UI; no takeoff/provenance changes.

- [x] SC-01 Compact draggable/resizable panel, viewport bounds and keyboard controls. Proof: `proof/growth/2026-09-08-assistant-layout/README.md`.
- [x] SC-02 Chat-style composer, + menu, real image attachments, skills, New chat; retain voice/settings and tool receipts. Proof: `proof/growth/2026-09-08-assistant-layout/README.md`.
- [x] SC-03 Local Fast CDP UI/attachment/drag/resize checks, desktop/tablet screenshots, focused tests and typecheck. Proof: `proof/growth/2026-09-08-assistant-layout/README.md`.
- [x] SC-04 Sequential Dans1 build, production/native proof, diff, walkthrough and completion ledgers, user preview and process cleanup. Proof: `proof/growth/2026-09-08-assistant-layout/README.md`.

Scope: LiveAssistant.tsx, assistantPanel.css, assistant panel positioning helper/tests, conversation scrolling/presentation where needed. No new dependencies. Existing image provider transmission stays user-triggered by Send. New chat only clears this app conversation, not project data. Tablet/desktop scope overrides skill phone QA. Small visual button faces retain usable hit areas.

User steering: include image drag/drop and paste, Help, session reference library with image purpose and building-style briefs. Correct floor sequence: under-slab plumbing/electrical before reinforcement/concrete, wall/ceiling services after framing, insulation before gyprock. Actual slab penetrations and reinforcement clearance included.

Local proof: 8 targeted tests, typecheck, assistant 2.50s, pointer/floor and paste batches pass; live provider correctly identified a generated red test image. Final build snapshot a570fcaf7e77 accepted; earlier 5f3a3e1bc5bf superseded by supported drafting-status shortcut.

Proof: proof/growth/2026-09-08-assistant-layout/README.md. Accepted 233 TypeScript +14 Rust tests, production/native Fast CDP and real image replies. Final preview opened. Independent later sheet/recovery source edits remain outside this frozen artifact acceptance.
Document status: closed
