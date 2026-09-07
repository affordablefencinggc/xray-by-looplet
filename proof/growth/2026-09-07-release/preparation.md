# Dedicated Dans1 release preparation

State: preparation only; source freeze, snapshot and builds pending. No product installation or deployment is part of this worker task.

Read-only host verification resolved trusted alias `tonys-test-pc` to `danie@192.168.1.113`, strict host-key checking enabled; remote hostname returned `dans1`. Source transfer remains the user's explicitly authorized standalone Xray repository, excluding `.env`, `.git`, local profiles, dependency/build trees and symlinks. Credentials in dependency URLs reject packaging.

Remote resource-policy SHA-256 matches local `scripts/dans1-resource-policy.ps1`: `4486fd205df8657855951bc0a9780879da209589d87cf0182e4a5875002538b5`. Existing policy record reports DANS1, High priority, 16 logical processors/16 Rayon workers/16 Cargo jobs, 31.8 GiB memory. Read-only verification did not rerun or alter that policy.

Read-only capacity check: C: free 903,122,411,520 bytes; prior successful native target cache 4,494,761,097 bytes across 4,394 files. Capacity is sufficient for an independent target copy and release artifact materialization.

Proof-owned packers derive from the previously verified release workflow. They write a new `transfer` directory and preserve existing snapshots. The worker is a copy of `scripts/dans1-build-worker.ps1`; its sole planned delta is the focused test file list resolved at final source freeze. The dedicated High-priority Windows job-object resource policy applies only on Dans1, using its logical processor count. Web and native builds remain sequential. Native target cache is copied into the new isolated run from successful `44c9a5bdd386` only after native source/archive identity and previous executable hash checks.

The production preview helper reserves port8086, refuses an occupied port and keeps its owning SSH process alive; prior preview profiles and processes remain untouched. Artifacts are collected only after a successful native build and verified with SHA-256 before local QA. Root owns browser screenshots and native product verification.
