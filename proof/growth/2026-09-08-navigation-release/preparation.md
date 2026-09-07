# Navigation build preparation - 8 September 2026

Preparation only: no source snapshot, dependency install or build has run for this wave. Root owns the source freeze, application edits and acceptance ledger. This folder owns the next isolated worker scripts and evidence only.

The scripts derive from successful tablet run `c32e640187e9`. Web/native explicit allowlists, credential-URL rejection, archive hashes, pre/post source verification, isolated extraction and artifact verification remain unchanged. Native cache now copies from that latest verified run into an absent independent target, after checking its native source identity and executable SHA-256 `44271fdc59f7f28636e38b703e2fa0aa508e3fca545915ee7d6bb7663a41f641`. No cache is shared or moved.

Read-only SSH verification returned DANS1, cache native-build exit0, native source SHA-256 `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7`, and the expected executable hash. C: has 889,045,565,440 bytes free; the target cache is 4,498,713,661 bytes across 4,407 files. Existing dedicated policy records High priority, 16 logical processors/Rayon/Cargo workers and 31.8 GiB memory.

The worker retains the 11-file suite that passed 95 tests in the previous run. Navigation-specific test files will be added explicitly at root's freeze; no future test count is assumed. Full typecheck, focused suite, web build and native NSIS build remain sequential on Dans1. Runtime is the established portable Node24.20.0 snapshot. New production preview uses unused port8088 with its owning SSH session retained; prior previews, runs, artifacts and profiles are preserved.

No phone QA, CRM modifications, application installation, account integration or external messages are included. Tablet/laptop/desktop are the target devices. Native macOS/Linux packages remain blocked by the Windows-only `build:cad` path; this build verifies Windows plus separately tested browser behavior only.
