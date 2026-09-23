# 06 — Release

**When:** Wed 11 – Wed 18 Nov 2026 (6 days) · **Depends on:** 01–05 · **Owner input:** a Windows code-signing certificate (order by Fri 25 Sep); a clean Windows machine or VM (by Tue 10 Nov); approval to merge to `main`

## Goal
Ship the signed v1.0 installer and cross the finish line in `FINISH-LINE.md`.

## Starting state
- **SC-18 pending:** the exe, NSIS and MSI build, but are Authenticode NotSigned. There is no certificate, no `signCommand` / `certificateThumbprint` in `tauri.conf.json`, and no keys. See `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md` SC-18.
- **SC-20 pending:** DAY-01..08 have passed on an earlier exe; this needs SC-18, a published report, release notes and signed artifacts.
- **A–Z:** Q-13 (installed-app verification) failed; Z-02 (install/upgrade) is a gap; Z-03 (installed cold start) and Z-13 (release notes) are partial.
- `LATEST-VERIFIED-BUILD.md` still points at 8e14ac427997 (9 Sep).
- Daniel's app has been installed silently over the normal profile several times on 23 Sep without data loss. That is not yet a formal Q-13 run.

## Steps
1. Install the certificate on the Dans1 build host. Add `bundle.windows.certificateThumbprint` (or a `signCommand`), a timestamp URL and digest to `src-tauri/tauri.conf.json`. Keep secrets out of the repo.
2. Build the release candidate on Dans1 with the qualified engine (toolkit step 2). Verify `Get-AuthenticodeSignature` is **Valid** for the exe, NSIS and MSI.
3. Run the full Dans1 release campaign in the pattern of `proof/growth/2026-09-09-az5-release/`: all gates, production and native scenario runs, and native graceful shutdown (which must pass after 01).
4. Q-13 / Z-02: install over the normal profile, with Daniel's app closed and data backed up. Verify the upgrade keeps projects, price books, the MiniMax key and assistant chats. Verify a cold start (Z-03), then uninstall and reinstall.
5. On the clean VM: fresh install, first run, a fence journey and graceful close.
6. Run DAY-01..08 at 1024×768 and 768×1024 on the installed signed build, with screenshots.
7. Write user-facing release notes (Z-13): what's new since 9 Sep, known limits and the post-v1 backlog link.
8. Sign off SC-18 and SC-20 in the closeout ledger with proof. Promote `LATEST-VERIFIED-BUILD.md` to the signed build, keeping the previous pointer's report.
9. Open the pull request `feat/closeout-sc09-remainder` → `main` with the proof index. Merge with Daniel's approval and tag `v1.0.0`.

## Exit check (the finish line)
All six conditions in `FINISH-LINE.md` are true with proof:
- SC-01..20 are done.
- The signed installed build passes DAY-01..08 at both sizes.
- Every close is graceful.
- `LATEST-VERIFIED-BUILD.md` has been promoted.
- Fence → quote works on the real job.
- No in-scope TODO is open.

## Proof
`proof/growth/<date>-v1-release/`: signature checks, the campaign run table, install and upgrade logs, clean-VM log, DAY-01..08 screenshots, release notes, hashes and a README.
