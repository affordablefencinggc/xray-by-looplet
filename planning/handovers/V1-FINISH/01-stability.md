# 01 — Stability blockers

**When:** Fri 25 – Wed 30 Sep 2026 (4 days) · **Depends on:** 00 · **Unblocks:** 02, 06

## Goal
Remove the two defects that stop the release: the shared development-reload failure, and the app not closing cleanly.

## Starting state
- **Development reload:** new sources fail the development reload at 118/135 (SC-09), and HVAC fails the full dev run at 37/46. Production reload passes. This blocks SC-09, SC-12, SC-13 and SC-14. See `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md` SC-09/12/13/14 and `HVAC-CLOSEOUT-TODO.md` L11–17.
- **Native graceful shutdown** failed in AZ-WAVE3 SC-06 (`AZ-WAVE3-LEDGER.md`, `walkthrough.md`).
- **Close requests ignored:** on 23 Sep, native test copies of builds 929fb881 (runs 2–4) and 8a6226fc93a6 ignored a window-close request (`CloseMainWindow`) and had to be stopped by PID. Runs after share/email actions and long CDP sessions were affected; earlier runs closed. See the proof READMEs in `proof/growth/2026-09-23-quote-handover/` and `2026-09-23-tidy-up/`.
- COMPLEX-PLAN-TRIAL: production smoke 404 / hydration failure.

## Steps
1. On Dans1, run the hydration measurement `SC09RR-RELOAD-11` named in HVAC-CLOSEOUT L17. Record where development hydration diverges from production: the timing of the first store write versus recovery playback.
2. Fix the root cause in the persistence/hydration path. Suspects are the new recovery journal (`src/studio/persistence/recoveryJournal.ts`), the workspace lock and startup restore. Add a unit test that reproduces the dev-order race.
3. Re-run the SC-09 development journey (expect 135/135) and the HVAC full dev run (expect 46/46). Production must stay green.
4. Reproduce the close hang: launch a Dans1 exe, run the fence setup plus Download PDF and Email with Gmail, then `CloseMainWindow`. Capture which Rust `CloseRequested` handler or webview promise blocks. Candidates: pending `navigator.share`, BOM, CAD or assistant cancel paths in `src-tauri/src/lib.rs` `on_window_event`.
5. Fix it so the window closes within 5 s every time. Add a Rust or integration check where possible.
6. Run the native graceful-shutdown gate from the AZ release scripts, the `cleanup-owned.ps1` pattern: 10 consecutive graceful closes, 0 forced.
7. Fix the COMPLEX-PLAN-TRIAL production smoke 404/hydration failure, or prove it is the same defect.

## Exit check
- SC-09 dev reload is 135/135 and HVAC dev is 46/46, on Dans1.
- 10 of 10 graceful native closes, including after share/email/BOM activity.
- The production smoke passes.

## Proof
`proof/growth/<date>-stability/`: measurement logs, the root-cause note, diffs, runner reports, the close-test log with PIDs and exit times, and a README. Update SC-09/12/13/14 remaining notes in the closeout ledger.
