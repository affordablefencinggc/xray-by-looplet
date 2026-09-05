# Industry-wide delivery control

This is a local read-only tracker outside the deployed product. `ledger.json` is the sole authoritative state; HTML is generated. No localStorage, HTTP writes, auth, database, package changes or deployment route is added.

Run from the repository: `node scripts/industry-ledger.mjs validate`, `node scripts/industry-ledger.mjs render`, `node scripts/industry-ledger.mjs serve` (127.0.0.1:8097). Run tests with `node --test scripts/industry-ledger.test.mjs`. The renderer is the build gate for this standalone Node/HTML surface. Product build/typecheck gates remain owned by the runtime baseline worker; the package build includes migrations and is intentionally not run by this tracker task.

The server serves only its generated dashboard, the canonical JSON, two fixed assets, historical baseline and explicit proof attachments. It validates the ledger on each request, binds loopback, rejects non-GET/HEAD requests, checks Host/Origin, rejects traversal and symlink escapes, sends no-store/nosniff and a restrictive CSP. It does not expose arbitrary source files, directories or secrets. Never move these files into the public app.

## State and ownership

Only the parent-assigned ledger writer edits JSON. Implementers produce their own startup/completion handovers and request an update through the parent. JSON updates are reviewed file diffs, never dashboard toggles. `queued`, `ready`, `running`, `blocked`, `awaiting-verification`, `verified`, `superseded`, `intentional-off` are the only states. Ready/running/verified tasks require verified declared dependencies. Blocked requires a reason; superseded requires a replacement and disposition; intentional-off requires an explicit disposition. Slice verification requires all tasks closed with valid disposition. The current contract discovery task may run independently of SC01; later slice verification still follows the declared slice dependency chain.

No task begins verified. Submitted evidence moves implemented work to awaiting-verification. A separate reviewer must reproduce its gate and attach a review before a writer can mark verified. The validator rejects missing or stale inputs, patch, executed output, before/desktop/mobile captures for visual tasks, self-review, missing review attachments, invalid states, missing inventory rows and dependency misuse. SHA-256 integrity proves attachment consistency, not that an agent's assertion is true; the independent reviewer must inspect the content and reproduce behavior.

For verification, task `inputs` names the exact implementation files. `inputDigest` is SHA-256 of JSON-serialized `[path, SHA-256(file bytes)]` pairs in that order. Every evidence record has `kind`, `path`, `sha256`, `revision`, `inputDigest`. Review has `reviewer`, `decision: approved`, `path`, `sha256`, `reviewedAt`, `revision`, `inputDigest`. Any input edit invalidates all prior records. Do not include the ledger, evidence itself or generated dashboard HTML as an input: this creates self-referential hashes. Review attachments remain local files; the dashboard only links safe explicit artifact paths.

## Scope and historical reconciliation

All construction trades. Source→verified estimate. Universal count/length/area/volume. Optional proven packs; fencing is not the core. AUD. Existing cream/charcoal visual language. Local-first browser and Windows x64. Auth/database off.

All 139 historical feature IDs and 359 acceptance rows are retained verbatim with exact source line and source hash. These are frozen baseline counts, not a cap on industry-wide work: the separate `coverage` collection adds new task-bound machine/human acceptance rows. Prefix-based historical assignments are provisional indexing, not a completed crosswalk. IW-002 must reconcile individual semantics, owning slice, acceptance, removal/supersession and explicit off decisions. Historical checked items and claims remain untrusted until fresh proof; originals are untouched. Release validation rejects any provisional row.

## Fresh-agent startup packet

Read AGENTS.md, any AGENTS.project.md, ledger skill, this file, `ledger.json`, and the assigned task handovers. Check current branch/HEAD and dirty files. Confirm the named owner, exact allowed files, dependencies and acceptance. Write startup handover before edits. Never overwrite unknown files, use git add -A, create worktrees/commits, run migrations or unsafe autopilot/sweeper. Root orchestrates only. Submit exact files, commands, outputs, hashes, before/after captures and patch in completion handover. Request independent verification via parent. Do not self-verify or change another worker's scope. The dashboard's per-task Copy startup packet button supplies the current assignment.

## Known capability limitation

BROWSER-TOOL-01: CUA getState failed twice with trusted Node process unexpectedly exiting; agent-browser was unavailable (PowerShell script policy, then absent package/cache EPERM). Per browser-qa fallback, installed Playwright is used to execute UI interactions and persist desktop/mobile screenshots. This limits the live supported-browser glimpse, not the saved executed proof. Runtime baseline thread reuse was explicitly assigned after two fresh spawn rejections; DEC-005 records that exception.

## Historical assessment and current work

The frozen150-feature assessment is preserved byte-for-byte. Serve its reviewed source snapshot with `node scripts/industry-ledger.mjs serve 8097 --historical`. Validate with `node scripts/industry-ledger.mjs validate --historical`. Default validation remains against current sources and never falls back when they change.

Historical mode validates the pinned manifest in proof/audit/IW-HISTORICAL-SOURCE and its nine exact input files from4dcc3ee, then retains all original artifact, image, run, revision and reviewer checks. It cannot approve new current work. planning/control/current-work.json shows separate Caroline reconstruction and commit/push state. No model/release completion or successful push is inferred from historical evidence.

Current-work product statuses are restricted to in progress, awaiting independent review, or blocked. Complete/verified/done reject until a separate current-source proof and independent-review gate is implemented. Historical approval cannot be reused for current acceptance.
