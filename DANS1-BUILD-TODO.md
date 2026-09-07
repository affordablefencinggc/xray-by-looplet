# Dans1 build worker

Authorized 2026-09-07: user “we have a another pc for you to use. use ssh - look for Dans1”.
Use the existing trusted SSH alias `tonys-test-pc`, which resolves to `192.168.1.113`; authenticated hostname is `dans1`.

- [x] Read-only connection and capacity check: Windows, i9-11900K, 16 logical processors, approximately 32 GB RAM and 941 GB free disk.
- [x] Bootstrap an isolated portable Node/npm runtime under `C:\Users\danie\XRayBuilds`, without altering other repositories or system PATH.
- [x] Transfer an explicit source snapshot, excluding credentials, `.env` files, git data, local profiles and generated build outputs; verify hashes on Dans1.
- [x] Run dependency installation, type checking and web build on Dans1 at lower priority with bounded concurrency; retrieve logs and artifact identity. Run `6e8adc3db8cc`; final build 3.22 seconds, BelowNormal, six workers. Production desktop/mobile smoke passed and both screenshots inspected. Public auth build flag matched after an initial parity failure.
- [x] Establish native Windows build prerequisites separately: Microsoft signed C++ Build Tools installed successfully; checksum-verified Rustup installed Rust/Cargo 1.98.0 under the isolated toolchain. Logs: `native-toolchain.log`, `native-toolchain-rust.log`; setup source: `native-toolchain.ps1`.
- [x] First native Windows package built and retrieved executable/installer hashes verified. Six Cargo jobs, six Rayon workers, BelowNormal; run `2c7d6511ecf4`, 432.58 seconds, exit 0. Installed native smoke passed; evidence in `proof/audit/IW-REDBURN-ENCLOSURE/native-completion.json`, `installed-identity.json` and `installed.log`.

No further full local builds. Preserve the independent build-responsiveness changes already present in this workspace. X-Ray remains standalone; no CRM code changes.

- [x] 2026-09-07 | Dans1 resource allocation updated at user request: High-priority Windows Job Object for the build process tree, all 16 logical processors, no artificial memory quota. Actual Node launcher/child priority and worker environment verified; four local resource tests pass. New worker installed on Dans1; prior build records preserved. Optional local build assistance remains unused and requires a 20% aggregate CPU cap. Proof and source: proof/audit/IW-DANS1-ALLOCATION/completion.md. No CRM changes, commit, merge, push or app installation.
