This conversation belongs to a Grok project. The project's files are mounted at `/workspace/artifacts` — look there for user-provided sources before concluding the workspace has no project files. Files written there persist to the project across conversations.

## X-Ray standalone scope (user instruction, 2026-09-07)

X-Ray is a separate standalone application. Do not modify the Looplet CRM repository or code. CRM integration is for conversion of finished products; embedded use remains optional. Prioritize making the standalone product complete and reliable.

## Build resource policy (user instruction, 2026-09-07)

Updated user allocation: run full web and native builds sequentially on Dans1 using `scripts/dans1-build-worker.ps1`, High priority across its process tree and all 16 logical processors. Earlier BelowNormal/six-worker guidance is superseded for Dans1. Optional local background builds must have an aggregate CPU cap of at most 20% established before launch; thread count alone is not a quota. Avoid unnecessary rebuilds and preserve capacity for the user's browser. Do not change historical build evidence.

## Supported device scope (latest user instruction, 2026-09-07)

User: "disregard mobile use full stop ! tablet , laptop. pc. mac.linux thats it!!"

Target tablets, laptops and desktop PCs across Windows, macOS and Linux. Phone use and further phone-specific testing are excluded from the current requirements. Preserve existing responsive behavior and historical phone evidence; do not remove code merely to enforce this scope. Tablet-specific layouts and each operating system/package require their own evidence before claiming support. Current verified Windows-native and browser scenarios do not establish tablet or native macOS/Linux acceptance.


## Background process cleanup (user instruction, 2026-09-08)

User: "make a rule kill if not using with 10 mins".

- Agent-owned X-Ray test apps, CDP helpers, preview servers, SSH tunnels and build helpers must be stopped when their task finishes. Reuse is allowed only while actively needed; unused processes must never be retained beyond 10 minutes after their last task activity. This applies on this PC and Dans1.
- Record owner, PID, creation time, executable/command, purpose and last task activity when launching a background process. Check cleanup at task boundaries, before ending a turn and at least every 10 minutes during ongoing work. Process age or low CPU alone is not proof of inactivity.
- Attempt graceful close first. If an owned test process remains alive after a short bounded wait, capture minimal diagnostics then terminate that verified process. Keeping a failed test alive indefinitely for diagnosis is prohibited. The user has authorized this cleanup; no repeated confirmation is needed.
- Recheck PID plus creation time and executable/command before termination to avoid PID reuse. Stop only verified task-owned processes and descendants; never broadly kill node, browsers, SSH, all X-Ray apps or other users' sessions.
- Preserve the current user-facing preview while it is serving the user. Stop superseded previews and unused tunnels. Never terminate the normal installed app, user projects, unrelated repositories, or active builds solely because they have run longer than 10 minutes.
- Log what stopped and what was retained in proof/growth. Preserve screenshots, logs, profiles and working data; this rule terminates processes, it does not delete files.

## Local-first verification (user instruction, 2026-09-08)

Reproduce and verify changes against the local development app using Fast CDP JSON batches before starting full builds. On Windows the user explicitly approved keeping the development-server session attached during testing (XRAY_STARTUP_WAIT=1); this overrides the non-blocking startup requirement for that testing session. Default startup remains non-blocking. Full build resource policy and task-owned cleanup rules still apply.

## Top menu layout (user instruction, 2026-09-09)
Every top menu/header row must be independently adjustable and collapsible, with a tiny arrow at its right edge. Preserve saved sizes and collapsed states across pages and reloads. Use the shared AdjustableTopRow component for new top-level menu rows.

## Separate proof file for every completed step (user instruction, 2026-09-14)

Each completed checklist step must have its own named proof Markdown file under its campaign's `steps/` directory. Include the requirement, exact source diff or commit, separately named screenshot files for relevant visible states, executed checks, and remaining limits. Link this file from the checklist. Do not substitute a combined campaign summary for individual step records. For nonvisual checks, include executed output and state explicitly what the accompanying screenshot demonstrates. Historical backfills must retain original capture/build identities and must not claim a new screenshot was taken.

## Automatic staged checkpoints (user instruction, 2026-09-20)

User: "ensure that a freeze point between 100 - 150 changes triggers pushing changes in stages, then automaticly proceeding with the next. so you dont stop !"

- Count changed and untracked files, including proof, with `git status --short --untracked-files=all` before each stage and after evidence campaigns.
- At 100 files freeze feature scope, finish evidence, explicitly stage reviewed paths, commit and push the current feature branch to origin. Ceiling: 150 pending files. Checkpoint smaller coherent batches early when evidence would exceed it.
- Ordinary feature-branch commits and pushes are authorized; force pushes, main merges, secrets publication and removal of unrelated work are not.
- Record tests, screenshots, exact diff and limits. Label unproven checkpoints WIP; do not mark them complete.
- Automatically proceed after a successful push, without asking or ending the task. On failure preserve the commit, report the real failure and respect repository protections.

## Authorized local fallback (Daniel, 2026-09-21)

User: "permissiion to fallback to local execution".

Local product tests, browser proof and app execution are authorized while DANS1 is unavailable. This overrides the Fast CDP skill's DANS1-only restriction for this task. Use the existing raw-CDP runner with explicit local authorization; label evidence with the actual host and preserve isolated contexts, loopback binding and task-owned cleanup. Existing full-build resource limits remain in force, including the 20% aggregate CPU cap for local background builds. DANS1 evidence and local evidence are distinct.
