# Linux RPM bounded packaging — October 12, 2026

## Requirement

Finish remote native packaging without an unbounded silent job. Preserve DEB/RPM/AppImage targets, fail-closed transport and all existing product/resource gates.

## Observed failure evidence

Run `38146549601`, source `738445d3`, had successful web/SC-07/Windows jobs. Its Ubuntu job was canceled as superseded after the build step remained active more than 40 minutes. Reading the canceled job log established:

- Release compilation finished in 4m17s at `2026-10-11T14:29:48Z`.
- DEB bundling started at `14:29:50Z` and progressed to RPM at `14:30:00Z`.
- No additional bundler output appeared until cancellation at `15:09:13Z` (approximately 39 minutes after the RPM message).
- Therefore this is an observed RPM-stage stall, not a compiler failure or verified AppImage/FUSE fault. No CPU snapshot exists for the canceled run; slow gzip versus blocked work remains unproven.

The primary upstream Tauri tracker issue `tauri-apps/tauri#15698` reports a similar stall with CLI 2.11.4 / bundler 2.9.4; maintainer discussion distinguishes slow Rust compression from alleged idle hangs. This report is corroborating context, not a proven root cause for X-Ray. The installed config schema and tagged bundler source support explicit Zstd; default RPM compression is gzip level 6.

## Scoped diff

- `src-tauri/tauri.linux.conf.json`: RPM Zstd level 3 overlay only. Base targets, resources, hooks and Windows configuration preserved; no dependency upgrade or upstream draft binary used.
- `scripts/ci-run-bounded.sh`: generic GNU-timeout runner, 30-second process/file heartbeat, real exit propagation and task-owned monitor cleanup. Linux CI uses a 20-minute child deadline/25-minute step deadline with verbose bundler output.
- `.github/workflows/ci.yml`: Linux bounded build step; Windows build unchanged except an explicit 25-minute step deadline.
- `scripts/desktop-build-contract.test.mjs`: compression-schema/overlay and deadline/heartbeat regression checks.

## Executed checks

- Node configuration/proof-parser regressions: 14 passed, 0 failed.
- Shell syntax: Git Bash `bash -n` exit 0.
- Live shell-runner checks: child success propagated 0; deliberate child failure propagated 7; one-second deadline terminated five-second child and propagated 124. No full local native rebuild; these checks are lightweight.
- Syntax/JSON/whitespace checks passed. No package target was dropped to manufacture a green matrix.
- **Remote acceptance passed:** run `38150581911`, tested `c93ae1e7`, Ubuntu job `114503720609` completed successfully at `2026-10-11T15:38:33Z`. Actual DEB/RPM/AppImage build finished at `15:37:04Z`, `NATIVE_BUILD_EXIT=0`, 14m31s after the bounded step started. Tar/upload succeeded; [full package identity and remaining limits](ci-matrix-final.md).

## Visual evidence and limits

Nonvisual step; no new screenshots. Root cause, Linux installed launch, bundled runtime qualification, macOS and deployment remain separate. Future DANS1/native snapshots must include both Windows and Linux overlays, not the historical single-config manifest.