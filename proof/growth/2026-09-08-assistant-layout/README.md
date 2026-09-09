# Live assistant and floor construction correction

Requirement: ASSISTANT-MCP-TODO conversational UI; user-directed correction to the one-floor demo. Branch feat/architect-cad-engine, shared uncommitted tree preserved.

Final source: a570fcaf7e77b2e91cebc70566c16be02536b552a37ce08efbe5a48705001687. Native source: c10aa511259f3a497f15613633aa2c255c16354f97f1739710707cd38c5a4231.

Changes: 360 ? 400 default assistant, bottom-left, pointer/keyboard drag and resize with saved bounds; lower composer with 29 px visual +/Send faces in 44 px controls. + menu holds uploads, References, Skills, Help, voice/settings and New chat. PNG/JPEG/WebP drag/drop and paste; two selected images per turn, twelve session references; purpose labels and six building style briefs. Images go to the provider only on Send. New chat preserves the reference library and project.

Floor: twelve stages, beginning with under-slab plumbing/electrical then reinforcement and concrete; framing followed by wall/ceiling services, insulation and linings/finishes. Two reinforcement mats inside slab bounds; actual geometric service penetrations, bars cleared around penetrations, stud-bay insulation batts. Expose services also removes the slab and insulation. Floor studio remains an authored illustrative apartment, not a surveyed or engineered installation.

## Exact source edits

- src/studio/LiveAssistant.tsx
- package.json
- src/studio/floorConstruction.ts
- src/studio/FloorConstructionStudio.tsx
- src/studio/floorConstruction.css
- src/studio/floorDrawing.test.ts
- src/studio/assistantPanel.css
- src/studio/assistant/panelGeometry.ts
- src/studio/assistant/useAssistantPanel.ts
- src/studio/assistant/referenceImages.ts
- src/studio/assistant/panelGeometry.test.ts

Exact delta against the pre-task assistant and previously accepted floor source: code.diff. No dependencies added, no key exposure, no auth/db changes.

## Local execution

- Typecheck passed.
- Eight targeted tests passed, including service/slab bounds, ray tests through penetrations and bar clearance, stage sequence, drawing deposition and panel geometry.
- Fast CDP: local-assistant.json, local-floor-pointer.json, local-paste-validation.json and local-live-image.json with matching logs.
- Mouse drag/resize and keyboard handles, viewport clamps and persistence, skill/style prompts, attachment/reference purpose, New chat retention, paste and unsupported-file rejection exercised.
- Live configured provider identified a generated red square: screenshots/growth/assistant-live-image-reply.png. No private user image sent.
- Inspected desktop1440?900 and tablet1024?1366 screenshots, captured in screenshots/growth. Phone excluded by project instruction.

## Release acceptance

Accepted final artifact a570fcaf7e77. Seven gates passed on Dans1 sequentially at High priority /16 processors: dependencies, typecheck,233 selected TypeScript tests, web build, Windows native build,9 assistant Rust tests and5 material Rust tests. EXE SHA2565736483c39e9bbd3a28448a0ad81e209958078f2ffaa9e64f00fc7b2765df43d. Archives verified before extraction and build identity matched before launch. Earlier snapshot5f3a3e1bc5bf is superseded; see superseded-build.json.

Production assistant1.28s + pointer/floor1.30s; Windows assistant1.68s + pointer/floor1.65s Fast CDP batches passed with no uncaught errors. Real image transmission to the configured Gemini provider passed in development, production3.52s and Windows3.15s using generated red squares. Desktop/tablet web screenshots and native desktop screenshots visually inspected. Native viewport opcode applied dimensions but returned an EOF acknowledgement error; desktop1440?900 verified through DOM and further emulation omitted, see native-tool-limitation.json.

Preview startup now loads the existing .env.local server configuration without copying keys into artifacts or logs. Native QA configuration was memory-only. New browser tabs opened for the final floor playback and assistant + menu. Owned native31368 required termination after graceful close timed out; remaining:false. Agent-browser sessions closed. Current preview51016 and authorized dev44196 retained; superseded previews8956 and44308 stopped. Remote build/transfer commands exited. See cleanup.json and final-retained-processes.json.

At final drift audit, independent sheet/recovery files had changed after packaging: src/routeTree.gen.ts, src/studio/ProjectRecoveryNotice.tsx, src/studio/SheetManager.tsx, src/studio/persistence.test.ts, src/studio/persistence.ts, src/studio/projectRecoveryStore.test.ts, src/studio/sheetLifecycle.test.ts, src/studio/sheetLifecycle.ts, src/studio/store.ts. These edits are preserved. This task's eleven source files still match the accepted snapshot (task-source-verified.json). Acceptance applies to the frozen build, not to those subsequent unrelated edits.

## Boundaries

Reference library lasts in the mounted project session, including across New chat; it is not durable across reload or project changes. Style buttons supply editable briefs, not stock-photo downloads. Source evidence and calibration remain untouched; no verified takeoff, quantities or quote claim. No installation, deployment, commit or push performed.
