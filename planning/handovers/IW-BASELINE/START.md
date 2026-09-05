# IW-BASELINE startup handover

Status: in progress. Scope: industry-wide construction baseline; fencing is optional, not the product boundary.

This is a reused-thread contingency. The orchestrator reported two fresh-agent spawn failures due to the thread limit; this assignment is not a fresh context. Authority is the current runtime packet and current repository.

Branch: feat/v1-production-ready. Baseline HEAD from prior read: 7ba4a14d1eccdcde1cfc15293adbf08918524c4f. Initial tracked worktree clean; pre-existing untracked .agents/, .autopilot/, .claude/, .grok/skills/ledger/, engine/bin/, planning/handovers/, scripts/chat-autopilot-cdp.cjs preserved.

Owned surfaces: startup.sh, startup.ps1 if needed, scripts/industry-baseline*.mjs, this handover directory, proof/audit/IW-BASELINE/, screenshots/industry-baseline/. No application edits, dependencies, commits, migrations, unknown binaries or autopilot execution.

Plan: narrowly remove unrelated preview termination from startup; add hidden idempotent Windows startup; inspect live browser baseline at desktop/mobile; execute actual supported UI interactions; capture console/network evidence; leave healthy development server running. Build-only validation excludes db:migrate and requires coordination.

Completion requires exact diff, executed commands/results, inspected screenshots and truthful limitations. Existing screenshots and fake transport do not prove native engine execution.

Read: project instructions, browser QA/revive references, computer-use skill; ledger skill read during this thread. Current environment is Windows PowerShell, not the Linux environment described in template instructions.
