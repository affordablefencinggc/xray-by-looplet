# IW-ENGINE-PROTOCOL startup packet

Status: implementing; final handover must remain awaiting-verification, not overall SC08 complete.

Thread reuse exception: parent explicitly reassigned an existing agent because fresh spawning was unavailable. This is a new standalone packet; current instructions and source were reread rather than relying on prior task conclusions. No child agents.

Authorization: parent states user approved implementation of the full industry-wide plan. This packet only adds the existing optional fencing compatibility CLI protocol; it makes no generic construction capability claim.

Baseline: branch `feat/v1-production-ready`, HEAD `1bf54983bb3ff168358f4987c8481e8cc23fb760`. Startup dirty tracked paths: `SWEEPER-VERIFICATION-LEDGER.md`, `startup.sh`. Existing untracked paths include `.agents/`, `.autopilot/`, `.claude/`, `.grok/skills/ledger/`, industry ledgers, `contracts/construction/`, `engine/bin/`, `planning/control/`, handovers, `planning/industry-contract.md`, `proof/audit/`, industry scripts, `src/studio/construction/`, `startup.ps1` and `{}`. None are owned here.

Ownership: only `engine/python/xray/cli.py`, new `bom_protocol.py` and `test_bom_protocol.py` in that directory, this handover directory and `proof/audit/IW-ENGINE-PROTOCOL/`. Existing kernel, frozen contract, Rust, TypeScript, dependencies, requirements and shared ledgers are read-only. No migrations, installs, commits or staging.

Read: current AGENTS.md/AGENTS.project.md and ledger skill, CLI/entrypoints, pure `job_bom` kernel, frozen JSON contract/tests, and host invocation/status/result-handling code. Host runs `contract-status --json` and `job-to-bom --request-stdin --result <absolute scratch path>`. Limits: request 1 MiB, result 4 MiB, stdout/stderr 64 KiB, status 4 KiB/2 seconds. Host creates an isolated scratch directory, uses it as the child working directory, and requires a regular, non-symlink result file in that directory. It reads results only on exit 0.

Plan: lazy-load existing takeoff dependencies only for `run`; implement bounded strict JSON input, existing-kernel validation/evaluation, complete validated result serialization and exclusive atomic no-overwrite publishing; safe fixed diagnostics. Prove actual subprocess status/stdin/file behavior, all golden cases and failure paths. Do not execute unknown `engine/bin` binaries. Native freezing/installed-host proof stays pending.
