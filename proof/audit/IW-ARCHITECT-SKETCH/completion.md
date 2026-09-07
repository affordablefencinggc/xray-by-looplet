# Architectural Sketch, navigation and voice delivery

Branch: feat/architect-cad-engine. Architectural implementation commit: 43ee320; continuation baseline: 3e422f0. No staging, commit, merge or push performed.

The linked architectural workspace, Fly/Walk-through in both 3D viewers, and Deepgram dictation/read-aloud are implemented and verified. Native design confirmations now use the visible workspace dialog. Boolean geometry canonicalization fixes the reproduced near-aligned layered-wall crash without changing stored design coordinates.

## Evidence

- [Continuation code diff](continuation.diff), including all new product files. Prior architectural code is recoverable at 43ee320.
- Typecheck, 680 JavaScript/TypeScript tests, and 27 Rust tests pass: [typecheck](typecheck.log), [tests](tests.log), [Rust](rust-tests.log).
- Final web and desktop builds: [web](web-build.log), [native](native-build.log).
- Editing, schedule updates, material sync and repeat sync, source evidence PDF, scaled sheets and exports, roundtrip identities, pointer drawing, precision operations, backup/reload/restore: [dev-qa.json](dev-qa.json), [web-qa.json](web-qa.json), [native-qa.json](native-qa.json), [installed-qa.json](installed-qa.json).
- Real pointer capture, WASD signs, flight altitude, mouse look, level walking eye height, start picker, resize, Escape and reduced motion: [web](web-navigation.json), [native](native-navigation.json), [installed](installed-navigation.json).
- Actual MediaRecorder using a synthetic speech fixture through live Deepgram, transcript appended to existing instructions, read-aloud playback, cancellation and stream release: [dev](dev-voice-qa.json), [web](web-voice-qa.json), [native](native-voice-qa.json), [installed](installed-voice-qa.json). The user's physical microphone and speaker were not used by automation.
- [Live hosted voice proof](voice-live-proof.json); [active Supabase deployment](edge-deployment.json); [private credential boundary](secret-boundary.json). The ignored local settings and Supabase secrets contain DEEPGRAM_API_KEY and the backend edge token. Neither value appears in the browser bundles or this report.
- [Reproduced clipping regression](clipping-regression.json) and [regression tests](geometry-regression.log). The old implementation fails on the recovered isolated test fixture; the fixed implementation produces 104 solids and one closed room.
- [Independent export proof](independent-export-proof.json): 1.74 m� expected wall matches 1.7400000000000004 m� read from IFC; 9,000 mm prints at 180 mm at 1:50; vector PDF has zero raster images.
- Dev/built desktop and mobile smoke checks match with no runtime errors; screenshots visually inspected in screenshots/architect.

## Installed identity and recovery

Installed executable SHA-256: 99f72193c763a7e2cf4920a6c81f906a34b7d27618d1cd31faf269a106e654df.
Installer SHA-256: 6c300b12555ccf537f02e5839d9d523b9a53b759d4ee6a55fb36f5bf2f2208b4.
Tauri changes only its three-byte bundle marker from UNK to NSS inside the installer. [Exact normalized identity proof](bundle-marker-proof.json) matches the tested build byte-for-byte after that documented marker change; installed workflows were tested independently.
[Install and previous-executable backup record](install.json). Existing application data and index retained; all automated mutations used isolated profiles. Normal app launched through the local settings launcher so voice configuration is inherited: [normal launch and restored shortcut](normal-launch.json).

## Visual proof

![Installed Fly](../../../screenshots/architect/installed-source-fly.png)
![Installed Walk-through](../../../screenshots/architect/installed-architect-walk.png)
![Installed voice transcript](../../../screenshots/architect/installed-voice-transcript.png)
![Mobile voice](../../../screenshots/architect/installed-voice-mobile.png)

## Boundaries

Native DWG still requires a licensed translator. DXF, IFC and vector PDF are available. Walking is free navigation without collisions. Voice dictates review instructions and reads current assistant messages; it is not an autonomous continuous conversation. Recordings are sent only after the user stops recording (or the 60-second cap); native cancellation discards late results but cannot interrupt an already-sent provider request. Web/edge hourly limits are per process or isolate, not a durable global quota. No engineering certification, regulatory compliance or fabricated supplier pricing is claimed. The production website itself was not publicly deployed; the Supabase voice function was deployed.
