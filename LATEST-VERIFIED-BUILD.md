# Latest verified X-Ray build

Build **8e14ac427997** — live assistant unlock: edits design elements by ID, calibrates, traces and approves takeoff evidence for a named person, imports pasted price books, exports DXF/IFC/PDF with hash receipts and delivers an AI "real life view" on the web app; plus everything in b1117e054a71 (wireframes, workbench tools, guardrails) and the wave-3 saves/sheets/pricing work.

- [Open the executable](proof/growth/2026-09-09-az5-release/release-8e14ac427997/artifacts/src-tauri/target/release/xray-by-looplet.exe)
- [Installer](proof/growth/2026-09-09-az5-release/release-8e14ac427997/artifacts/src-tauri/target/release/bundle/nsis/X-Ray%20by%20Looplet_0.1.0_x64-setup.exe)
- [Read the illustrated proof](proof/growth/2026-09-09-16-az5-release/index.html)
- [Verification notes](proof/growth/2026-09-09-az5-release/verification.md)

Executable SHA-256: `aac8c5e5718cd5adf04dac38cfd428d3689bcba2ba3884867e315a872c606ca1`. Installer SHA-256: `7f8f1226b4ca84b3ea1beb48586b5d0c6442cacf7a8ca9c7300ea157d24b3894`.

This is a separately packaged, tested executable. The normal installed app and its shortcut were not replaced. GitHub publication does not update an installed executable.

Verification: seven Dans1 gates (358 focused tests); 40 production and Windows-native scenario runs, 765 scenario commands (proof/growth/2026-09-09-az5-release/qa/runs.md); native graceful shutdown passed. Known limits: an eight-tool assistant request pauses once at the eight-step cap; AI rendering is web-only (the native build refuses with a clear message); the native two-window stale notice is not drivable through CDP. Previous pointer: b1117e054a71 (report preserved at proof/growth/2026-09-09-14-az4-release/index.html). This pointer will change only after a newer build passes its required checks.
