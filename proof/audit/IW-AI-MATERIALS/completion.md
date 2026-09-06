# AI material review - implemented and installed; live accuracy open

Authorized by "continue on with whats next". Architectural requirements supplied in sascscsc.md are recorded in ARCHITECTURE-ROADMAP.md. Branch feat/model-wireframe-navigation, baseline 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. No staging, commits, merge, push or worktrees. Existing shared changes and application profile retained. Before copies are in before/; the prior full workspace snapshot is retained under snapshots/.

## Implemented scope

- SC-01: strict AI proposal/request/run schemas, source and revision binding, persistent review queue, no automatic inventory counting, physical-item deduplication and signoff protection.
- SC-02: fixed-host Gemini HTTPS adapters for web and desktop, user-initiated bounded page images, cancellation and error handling; native credentials kept in process memory. Web provider disabled by default. Live external provider behavior remains LIVE-01.
- SC-03: PDF image preparation and hashes, source-region preview, material draft promotion, evidence linking, reasoned exclusions, reload and transactional backup/restore.
- SC-04: per-run reference import and benchmark export; precision, recall, exact quantity recall and errors separated by unit. Model confidence is labelled uncalibrated. The benchmark reference is supplied by the user and must match the page/scope.
- SC-05: fabricated Copilot connection/results removed; honest AI tools dialog, tested packages and installed app. Temporary test listeners stopped; normal updated app reopened.

## Executed proof

- Typecheck passed: [log](typecheck.log).
- npm test: 652 passed (198 script tests + 454 TypeScript tests), zero failures: [log](tests.log).
- Rust library tests: 27 passed, including three new AI tests: [log](rust-all-tests.log).
- Web and NSIS builds passed: [web](build.log), [desktop](native-build.log).
- AI UI scenarios: 12 dev + 12 built + 11 packaged desktop + 11 installed desktop = 46 successful scenario runs, zero console/page errors: [dev](dev-qa.json), [built](built-qa.json), [native](native-qa.json), [installed](installed-qa.json).
- Existing project-material UI regression: 13 passed, including real local OCR, 79 prepared source lines, quantities/volume/weight, readback exports and blocked-recovery preservation: [report](../../../screenshots/ai-materials-regression/dev/report.json). Total UI scenario runs: 59.
- Desktop/mobile render smoke passed, no overflow or console errors, production does not diverge from dev: [dev](../../../screenshots/ai-materials/smoke-dev.json), [built](../../../screenshots/ai-materials/smoke-built.json). Screenshots visually inspected. Existing optional utility share-card note remains; no new branding work was required for this takeoff utility.
- Actual dev/built HTTP endpoints were probed for unconfigured status and cross-origin rejection without calling a provider: [report](http-checks.json).
- Exact task-only changes against before copies: [code diff](code.diff), [file hashes and verification manifest](manifest.json). Whitespace check accepts Windows carriage-return line endings via cr-at-eol while retaining blank/space checks.

## Visual proof

[Installed source evidence region](../../../screenshots/ai-materials/installed/03-evidence-region.png)

[Installed AI tools dialog](../../../screenshots/ai-materials/installed/06-ai-tools.png)

[Mobile AI tools dialog](../../../screenshots/ai-materials/dev/06-ai-tools.png)

The proposal/benchmark screenshots use clearly labelled TEST FIXTURE data, not live AI results or counted materials from the displayed drawing.

## Installed identity and recovery

Installed executable SHA-256: 049b20be822462199ebb492f4c5a6b4cb04127edf6fab6ae164a663c1724187e

Tested build SHA-256: 2704fe86f099719b6a829a3917b502722b0ed822ebe59215047aa359a92488d5

Only Tauri's single UNK-to-NSS bundle marker differs: [identity](bundle-identity.json). [Install and executable backup](install.json), [normal app/shortcut](installed.json), [final process state](final-process-state.json). Existing data retained. Normal app PID at launch: 75056. No development, preview or debugging listeners remain.

## LIVE-01 remains open

No API key or local model was available. No live Gemini interpretation was performed, so real extraction accuracy and whole-building completeness remain unmeasured. The web request adapter was executed with deterministic provider fixtures. Web UI tests rendered the real public PDF and intercepted only the AI endpoint. Native session-key configuration used real IPC; native review tests imported a labelled fixture backup because the native IPC bridge correctly prevents reassignment. Native HTTPS interpretation still needs a configured live run. The tested benchmark's synthetic 50% quantity score is not a real drawing accuracy result.

Configure Gemini in Components > Project material takeoff > AI review > Connection, then interpret one selected sheet and compare it with independently checked quantities. Do not paste keys in chat. [Operating guide and test method](README.md). The architectural drafting roadmap remains planned work; it does not imply automatic compliance or fabrication-complete drawings.
