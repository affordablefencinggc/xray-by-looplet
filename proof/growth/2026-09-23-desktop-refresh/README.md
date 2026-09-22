# Desktop refresh candidate — 23 September 2026

Why: the installed desktop app (built 7 Sep, SHA-256 40b624e5…) predates 30 assistant commits, so live-assistant changes never appeared in it.

## Candidate
- Built locally with `npm run tauri:build` from the working tree (HEAD 6e283f03 + uncommitted changes; identities in `source-identity.txt`). Nothing committed.
- `src-tauri/target/release/xray-by-looplet.exe` SHA-256 `7de46b74da0612d01f5936ce54ef888e71add160ef469b5879c33711e990377d`; installers in `src-tauri/target/release/bundle/{nsis,msi}`. Not installed; installed app untouched.

## Bug found and fixed before the build
Uncommitted SC-16 recovery journal bound the journal to the first project ever saved; every save of any other project was refused ("Recovery journal belongs to another project. The target was not written."). New project / project switch therefore could not save.
- Fix: `src/studio/persistence/recoveryJournal.ts` — a fully committed journal moves to the project being saved; an in-flight entry for another project is still refused.
- Tests: new regression in `recoveryJournal.test.ts`; `projectSwitch.test.ts` and `projectRegistry.test.ts` updated for the journal keys.

## Gates
- Typecheck exit 0 (`typecheck.log`, re-run after fix).
- `npm run test:src` cannot start on Windows ("The command line is too long", `test-src.log`); ran the same 204 files directly: before fix 1921/1927 (6 project-switch failures, `test-src-direct.log`); after fix 1928/1928 (`test-src-after-fix.log`).
- Build exit 0 (`tauri-build.log`); fix confirmed present in `dist/assets/index-DMh3RgZd.js`.

## Native check (isolated profile `.temp/desktop-refresh-candidate`, CDP 9291)
- `candidate-start.png`: new Drawings/Takeoff/Design/Visualise/Estimate layout, docked live assistant with History, work packet, project and permission selectors.
- `second-project.png` + runner log: "Save and start new project" created job-b7128d6d…, first project shelved, journal committed and bound to the new project, no journal error on screen.
- App closed gracefully (CloseMainWindow, exited, port 9291 free).

## Limits
- MiniMax (the default provider) shows "Unavailable in this desktop build" — by design in `ProviderSwitch.tsx`; the desktop assistant needs Gemini selected.
- Not a Dans1 release run; `LATEST-VERIFIED-BUILD.md` not changed. Switch back to the first project was covered by unit test, not driven natively.

## Installed (Daniel approved "go", 23 Sep ~04:45)
- Previous installed exe backed up to `.temp/installed-backup-2026-09-07/xray-by-looplet.exe` (SHA-256 40b624e5…).
- Ran `X-Ray by Looplet_0.1.0_x64-setup.exe /S` (SHA-256 37f6f296…), exit 0.
- Installed exe SHA-256 603f4259…; `cmp` against the tested build differs in exactly 3 bytes at offset 271014187 — the Tauri bundle-type marker the NSIS bundler patches in. Application code is identical.
