# Architectural Sketch delivery

Authorized: finish the architectural Sketch workspace; restore Fly and Walk-through; add Deepgram voice locally and to Supabase Edge Functions/secrets.
Branch: feat/architect-cad-engine. Existing architectural implementation: 43ee320. Continuation baseline: 3e422f0.
Preserve existing user data, index, source evidence and manual trace workflow.

- [x] SC-01 Fast source-model generation / integrity / live preview command. Prior measured runtime: 21.567 seconds (`fast-preview.log`).
- [x] SC-02 Parametric walls, hosted openings, levels, slabs and roofs; stable IDs, healing, persistence and undo/redo. Executed architecture integrity tests and existing IFC-reader proof.
- [x] SC-03 Precision model operations, snaps, dimensions, rooms, grids and schedules. Final end-to-end UI rerun remains part of SC-07.
- [x] SC-04 Linked 3D/elevation/section views and scaled sheets. Independent export reader confirmed 9,000 mm prints at 180 mm at 1:50; no embedded PDF raster images.
- [ ] SC-05 Native Windows DWG implemented using MIT-licensed ACadSharp after delegated platform choice. Independent geometry readback, actual native import/export/cancel/undo/redo and web DXF fallback pass. Final installed update waits the existing app closing; see DWG-TODO.md. DWG contains drawing geometry, not editable X-Ray assemblies.
- [x] SC-06 Material register synchronization and explicit supplier-rate inputs; constrained, reviewed AI layout proposal. Prior real Gemini execution retained in `live-ai.json`.
- [x] SC-07 Final browser/native proof, web build, packaging and installed update. Typecheck, 680 JS/TS tests, 27 Rust tests, dev/production browser workflows, native/installed workflows, navigation and real voice pass. Installed profile retained; desktop shortcut restored and normal app reopened. See proof/audit/IW-ARCHITECT-SKETCH/completion.md.
- [x] SC-08 Restore Fly/Walk-through in source model and architectural viewers. Real pointer capture, WASD directions, altitude, eye height, mouse look, resize and Escape passed on dev and production web. Verified in the built and installed desktop app; proof in SC-07.
- [x] SC-09 Deepgram speech input/read-aloud and private edge endpoint. Local ignored configuration and Supabase encrypted secrets saved. Live hosted synthesis/transcription and unauthenticated rejection passed; actual MediaRecorder with synthetic speech fixture, append-to-draft, playback and cancellation passed on dev. Verified in the built and installed desktop app; proof in SC-07.

Proof: `proof/audit/IW-ARCHITECT-SKETCH/`; screenshots: `screenshots/architect/`.
Voice currently dictates review instructions and reads assistant messages aloud. It does not conduct an autonomous voice conversation or submit a drawing without review.
No engineering/regulatory certification, collision-aware walking or fabricated supplier rates. Source takeoff and authored design quantities remain distinguishable.

Desktop regression closeout: replaced native synchronous confirmation bridging with the existing workspace dialog; fixed near-aligned wall boolean precision using the recovered failing fixture. Typecheck, architecture regression tests and independent IFC/PDF volume/scale proof pass.
