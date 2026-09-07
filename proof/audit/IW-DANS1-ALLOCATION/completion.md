# Dedicated Dans1 allocation — 2026-09-07

User authorization: "make it highest priority on dans. use all the pc ! and share 20% on here if you need to". Branch `feat/architect-cad-engine`, baseline `3e422f0`; no commit or deployment.

Installed operational scripts under `C:\Users\danie\XRayBuilds\` on the verified DANS1 host. `scripts/dans1-build-worker.ps1` is the new worker entry point, with a process-scoped execution-policy override when launched. Existing historical workers, source snapshots and build evidence are preserved.

The worker uses Windows High priority and all 16 logical processors for Cargo, Rayon, CMake and libuv. All 31.8 GiB physical RAM remain available to the workload under normal Windows memory management; no claim of forced RAM utilization. A Windows Job Object enforces High priority on the worker and descendants. A direct parent-priority-only probe failed because Windows started the child at Normal; the scoped Job Object fixed this. The real build wrapper and a child process both then reported priority -14 (High), with 16 Cargo/Rayon workers. No unrelated processes were reprioritized, no forced process closure, and no machine-wide execution-policy change.

Executed checks: four existing local build-resource tests passed; generated worker parsed successfully on Dans1. Actual remote priority/environment probe passed. See `remote-probe.log`, `code.diff` and source snapshots alongside this record.

The previous build was already finished. This configures subsequent builds; it does not rerun a completed package merely to consume CPU. Web and native packaging remain sequential. Optional local assistance is limited to at most 20% aggregate CPU; no local build assistance was launched, and a hard process-tree quota must be established before using it. Thread counts alone are not a CPU quota.

Source: `scripts/build-resources.mjs`, `scripts/dans1-resource-policy.ps1`, `scripts/dans1-build-worker.ps1`, `scripts/prepare-dans1-worker.mjs`, `scripts/dans1-resource-probe.mjs`. User allocation supersedes earlier six-worker/BelowNormal guidance for future Dans1 builds.
