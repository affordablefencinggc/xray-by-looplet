# Desktop rebuild completed - 2026-09-06

Authorized: "re build the app please". Branch feat/model-wireframe-navigation. No product source edits; rebuilt existing shared source. No staging, commit, merge or push.

- Typecheck passed; all 652 JS/TypeScript tests passed (198 script tests + 454 TypeScript tests).
- Desktop frontend and Rust/NSIS packaging passed: build.log.
- Final packaged executable and installed app each passed 11 UI scenarios with no console/page errors: native-qa.json and installed-qa.json. AI responses were explicit fixtures; this does not measure drawing extraction accuracy.
- Installed binary matches the tested build after the single expected Tauri bundle marker: bundle-identity.json.
- Previous installed executable backed up before replacement; user profile retained. Updated app reopened through private local-settings launcher, shortcut retained, test debugger closed: install.json, installed.json, final-process-state.json.
- Visually inspected source evidence and installed AI-tools screenshots. Screenshots: ../../../screenshots/desktop-rebuild/installed/ (repository screenshots directory).
- Source inventory: source-manifest.json; existing source differences: source-diff-stat.txt. Product code diff for this rebuild is empty; existing changes were preserved and compiled.

Proof images: [Evidence region](../../../screenshots/desktop-rebuild/installed/03-evidence-region.png) and [AI tools](../../../screenshots/desktop-rebuild/installed/06-ai-tools.png). These images use an isolated QA profile.
