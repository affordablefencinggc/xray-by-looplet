# Live assistant and MCP execution

## Live Gemini accepted — 2026-09-08

- User authorized `.env.local` and clipboard extraction. Clipboard key matched the existing local file and was configured in the open native app without logging or saving it in evidence.
- `gemini-3.8-flash` verified with real native and web backend replies and grounded searches. Native and development-web conversation UI journeys also passed: generic replies, actual MCP `web_search`, returned source links and zero chat/browser errors.
- [Live configuration and acceptance evidence](proof/growth/2026-09-08-gemini-live/README.md). This supersedes earlier “Gemini unconfigured” observations for the current native session and development server; historical candidate tests remain unchanged.
- SC-02 remains open for image input/output and live cancellation; broader SC-03..SC-07 gates remain open. No release promotion. The proposed project-context transfer was rejected by automatic review and was not executed; generic/public-search checks completed instead.

## Active continuation — Stop/retry receipts (2026-09-08)

- SC-02/SC-04/SC-05: fixed loss of completed tool receipts when Stop or a project switch interrupts a multi-tool response. Remaining calls receive explicit non-execution results; retry retains the completed exchange.
- Both new deterministic regressions failed before the fix; 36 focused tests and local typecheck now pass. Scoped diff check passes. These tests do not establish live Gemini acceptance.
- Fresh source snapshot: `591a4b8b5452e2ca35c634d28985dbf9a0ef975d21527e023d187269f448f7c8`. All seven High/16 Dans1 gates passed: 221 TypeScript tests and 14 Rust tests. Production desktop/tablet checks (14 commands) and native assistant checks (11 commands) passed with inspected screenshots and zero runtime errors.
- No release promotion: `src/studio/MagicPencilDraftsman.ts` changed concurrently after the snapshot; the current-source drift gate correctly failed. That edit remains preserved. Frozen artifact hashes and build identity passed verification; live Gemini remains unconfigured.
- Successful elevated process lookup found original shutdown PID 53296 absent. No termination was needed; absence does not establish a causal shutdown fix.
- Evidence: [continuation report and code diff](proof/growth/2026-09-08-assistant-stop-receipts/README.md). Broad slices remain open.

Approved: 2026-09-08, user requested real MCP drawing, professional tools, web search during chat, image display and LLM capabilities.
Baseline: feat/architect-cad-engine, 1f725b6619a3a12a5683c072c1018df26c8a655d; existing daily-recovery edits preserved.

- [x] SC-01: Real in-process MCP client/server initialization, discovery and tool calls using the official SDK. Connection status follows executed handshake. Accepted with development SDK calls and production/native discovery in build 71f5b012342b. Proof: `proof/growth/2026-09-08-gemini-live/README.md`.
- [ ] SC-02: Gemini conversational transport on web and Windows native, including function calls, image input/output, cancellation and grounded web search. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] SC-03: Real drawing tools: project/design context, workspace navigation, walls/openings/lines/rooms, undo, verified save and image capture. Existing data and revision checks preserved. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] SC-04: Live conversation UI with pinned composer, image attachments/results, source links, tool activity, stop/retry and per-project session history. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] SC-05: Protocol/provider failure tests and actual browser journeys, inspected desktop/tablet screenshots, source snapshots and HTML/PNG evidence. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] SC-06: Dans1 High/16 sequential web/native builds, tested production identity, native acceptance and staged publication. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] SC-07: Expand professional capability matrix across the existing A–Z requirements. No claim that these initial tools cover every architectural/engineering/computer task. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]

The initial MCP server is hosted inside X-Ray and exposes the current app through real MCP messages. External-server connections and arbitrary computer control are separate unfinished capabilities. It does not configure or connect Looplet CRM. Test fixtures must be labelled; live provider calls must be distinguished from deterministic tests.

## Takeover checkpoint — 2026-09-08

- SC-01/SC-03 development proof: official SDK calls executed; walls/openings, save/reload, undo, stale-revision rejection and actual playback receipts verified. See [MCP acceptance](proof/growth/2026-09-08-gemini-takeover/mcp-acceptance.html).
- SC-02 remains open: web provider deterministic tests pass; native tool allowlist guard implemented, 14 Rust tests await Dans1 execution. Live provider/search not yet exercised.
- SC-04/SC-05 partial: 52 focused tests pass, typecheck passes, tablet control access inspected. Downloaded PNG and five-page PDF inspected. See [takeover report](proof/growth/2026-09-08-gemini-takeover/takeover-report.html).
- SC-06 next: freeze final source and execute Stage 11 Dans1 gates, then production/native acceptance. Helpers prepared; no new release claimed.
- SC-07 remains open: current animation uses the existing Crown Wharf model. The newly authored 52-storey professional drawing package is not complete.

Broad requirements remain unticked until their remaining acceptance gates pass.

## Dans1 candidate — 71f5b012342b

- PASS: all seven sequential High/16 build gates; 219 TypeScript tests and 14 Rust tests.
- PASS: 226 production browser commands and 97 Windows-native commands, with inspected screenshots. Drawing, save/reopen, undo/redo, local MCP playback, restored bottom navigation, tablet clearance and actual PNG/PDF downloads are documented in the [illustrated report](proof/growth/2026-09-08-assistant-mcp-r4/release-report.html).
- SC-06 remains OPEN: native window closes but its process remained alive after the normal close request and debugger disconnection. Diagnosis is in progress; candidate is not yet promoted over the previous latest verified build.
- SC-02 remains OPEN: Gemini is unconfigured in the tested environments; live replies and web searches are not accepted.
- Full professional A–Z coverage, external MCP servers, the newly authored 52-storey package and native macOS/Linux acceptance remain open.

## Staged publication checkpoint

- Source saved as `476f39511b234fd65050a92a5550a14281277392`. Publication remains blocked by automatic approval review; no push occurred. See [exact publication record](proof/growth/2026-09-08-assistant-mcp-r4/publication-blocked.json).
- Fresh startup-only baseline and candidate both exit normally. The original extended test process remains under diagnosis; SC-06 stays open.
- Resume with [stage recovery record](proof/growth/2026-09-08-assistant-mcp-r4/stage-checkpoint.md).


### Native shutdown comparison - 2026-09-08
Fresh startup-only baseline38a64 and candidate71f5 both close normally. A second isolated candidate repeated the full97-command native workload without viewport emulation: all passed, then normal close completed with process and direct children absent (~514ms observation). Original PID53296 remains an unresolved windowless process; the failed emulation/session difference is a possible factor, not established cause. No force termination. [Comparison evidence](proof/growth/2026-09-08-assistant-mcp-r4/candidate-workload-shutdown/README.md). Source unchanged; release promotion stays held pending the remaining diagnosis.


## MCP candidate publication verified

User explicitly approved source checkpoint `476f395` and evidence checkpoint `39a50dc` for `https://github.com/affordablefencinggc/xray-by-looplet.git`, branch `feat/architect-cad-engine`. Push succeeded; independent `git ls-remote` confirmed remote tip `39a50dc7358ae4058d73296ab0c9f338d0df57dd`. This supersedes the earlier publication hold; original rejection evidence remains preserved. No merge or installation occurred. Shutdown diagnosis and live-provider acceptance remain open. Exact record: `proof/growth/2026-09-08-assistant-mcp-r4/publication-verified.json`.

## 2026-09-08 - Cinematic pencil choreography

Verified bounded animation slice on feat/architect-cad-engine: five near-vertical pencils, 0.2-second scribble beats at 1x, irregular curved transfers rising around sampled wire edges, metallic details and fading trails. No dependency added. Existing reveal behavior and concurrent edits preserved.

Snapshot 0fa105ba7599 passed seven sequential Dans1 High/16 gates: 223 TypeScript and 14 Rust tests, typecheck, web and Windows builds. Six local focused tests passed. Development/production desktop and tablet plus Windows-native motion checks passed, screenshots inspected. Production canvas video recorded. Task-owned QA sessions and preview cleaned up; native test process required bounded termination after close, so no native shutdown fix is claimed. Existing user apps preserved. No publication, installation or promotion. Broader assistant epic remains open.

[Video and verification](proof/growth/2026-09-08-cinematic-pencils/README.md).

## 2026-09-08 - Ring overflow and pencil flutter verified

Fixed a reproduced polygon-clipping enclosing-ring recursion for six overlapping return walls by canonicalizing boolean inputs at existing 0.001 mm editor precision. Saved geometry unchanged. Added bounded flutter at pencil departure/arrival. Local 21 geometry and seven motion/controller tests pass; typecheck passes. Snapshot 925531795d82 passed seven Dans1 High/16 gates (224 selected TypeScript tests, 14 Rust tests). Local Fast CDP crash and desktop/tablet motion checks, production motion and Windows-native fixture/motion checks passed; screenshots inspected. Original user drawing reopened in the fixed same-origin preview, six walls and zero errors. No installation or publication. See proof/growth/2026-09-08-ring-overflow/README.md.

## 2026-09-08 - Independent pencil timing accepted

Five distinct cycle lengths and wider offsets keep the pencils out of lockstep; different orbital rates and per-transfer sideways feints add irregular movement. Local-first Fast CDP desktop/tablet motion and Windows-native/production motion passed with inspected screenshots. Eight local focused tests and typecheck passed. Snapshot 20dcf423e6dd passed all seven sequential Dans1 High/16 gates (225 selected TypeScript and 14 Rust tests); artifact hashes and final source drift verified. User preview replaced on the same origin and Magic Pencil played in the existing Chrome tab. QA helpers/native test app closed; user preview and local development retained. No installation or publication. Evidence: proof/growth/2026-09-08-pencil-independent/README.md.

## 2026-09-08 - One-floor drawing/construction
User narrowed scope to one floor. Live slices and evidence: REAL-DRAWING-CONSTRUCTION-TODO.md and proof/growth/2026-09-08-one-floor/README.md. Local implementation and Fast CDP proof complete; final packaged verification pending. No whole-tower or Dubai trade-model claim.


## 2026-09-08 - One-floor construction studio accepted

Bounded one-floor unit complete on feat/architect-cad-engine, source snapshot 8de25142183515a5083915793e615e388703d3b02a79d9ba65369f0cf07e915c (shared uncommitted tree). 416 illustrative components across nine stages. Five vintage graphite pencils and fifty matching-colour pencils deposit persistent real edges/hatching in independent 0.1-second bursts. Existing viewer palette/weather controls wired. Local-first Fast CDP, production 3.61s and native 4.65s acceptance, inspected desktop/tablet/native screenshots, 229 selected TypeScript and 14 Rust tests; seven build gates and source/artifact identity pass. User preview opened; owned test apps/helpers closed. Evidence and code diff: proof/growth/2026-09-08-one-floor/README.md. No installation, commit, deployment or whole-tower/Dubai accuracy claim.


## 2026-09-08 - Live assistant layout and floor correction accepted

Requirement: ASSISTANT-MCP conversational UI and user-directed one-floor correction. Compact bottom-left draggable/resizable assistant, lower +/Send composer, image drop/paste, reference library/style briefs, Skills, Help, voice/settings and New chat. Floor sequence corrected: under-slab services, reinforcement/concrete, framing, wall services, insulation, linings/finishes; real slab penetrations and reinforcement clearance. Final snapshot a570fcaf7e77b2e91cebc70566c16be02536b552a37ce08efbe5a48705001687. 233 TypeScript +14 Rust tests; local-first Fast CDP, final production and Windows UI checks and live Gemini image replies passed. Proof/diff: proof/growth/2026-09-08-assistant-layout/README.md. User preview opened; owned QA processes closed. Native shutdown still required bounded termination. Independent sheet/recovery edits after packaging were preserved and excluded from artifact acceptance. No verified takeoff/engineering claim, installation, deployment or commit.


## 2026-09-08 - Live assistant right-side restoration and hardening

User-authorized assistant slice on feat/architect-cad-engine. Restored right-side default and silver/white palette while retaining drag/resize and references. Added eight evidence-aware workflows, matching web/native operating instructions, a fail-closed tool allowlist, per-message edit/save permission, duplicate call-ID protection and a 24-tool budget. Fixed Stop changing into Submit and resubmitting a cancelled message.

Proof: [assistant hardening report](proof/growth/2026-09-08-assistant-hardening/README.md), [exact task diff](proof/growth/2026-09-08-assistant-hardening/code.diff), [desktop](screenshots/growth/assistant-hardened-production-desktop.png), [tablet](screenshots/growth/assistant-hardened-production-tablet.png), [Windows](screenshots/growth/assistant-hardened-native.png). Frozen build 72804bfa9fac passed 251 selected TypeScript tests, 14 Rust tests, typecheck, web/Windows builds, development/production Fast CDP guards and Windows UI checks. All 13 assistant files match the frozen artifact. Five later pricing-research edits by the other chat are preserved and excluded from this artifact acceptance; no pricing/sheet/recovery checklist rows are promoted here.

No verified quantity, construction/compliance or quote claim; no installation, publication, commit or push. Provider adversarial scenarios used labelled deterministic fixtures with real workspace tools, not live model certification. Native QA app closed gracefully; task browsers and remote preview cleaned up; existing user previews retained. Recovery details, commands, manifests and limitations are in the report.


## 2026-09-09 - User direction: the assistant must attempt anything asked, especially wireframes

User (2026-09-09 01:2x): "the assistant should be able to do anything the user askes it too !! expecialy draw wire frames or anything the user wants". Recorded as the governing goal for the next assistant wave (AZ-WAVE3-LEDGER.md SC-08). Current audited tool surface (src/studio/assistant/appTools.ts): read_project_context, navigate_workspace, read_architect_design, draw_architect_elements (walls, hosted doors/windows, lines, room labels on the active level), undo_architect_change, capture_workspace_image, save_project, control_draftsman, read_draftsman_status. No tool yet draws wireframes or 3D edges, creates storeys/roofs/slabs, extrudes a footprint, traces/measures/calibrates source pages, manages sheets, price books or backups, or performs arbitrary UI actions. Unbounded "anything" is not provable as a single requirement; it is delivered as an expanding, tested tool matrix plus an assistant policy that always attempts the request through real tools and reports truthfully what it cannot do yet.


## Governed project memory redesign ? 2026-09-09
- [ ] GP-01: Local packet/audit foundation executed; full task lifecycle, visual evidence rehydration, reconciliation and production proof remain open. See proof/growth/governed-memory-verification.md. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]
- [ ] GP-02..GP-06: Registry/authority, evidence graph, engineering workflows, rule engines and supervised issue integrations. See planning/assistant/GOVERNED-PROJECT-MEMORY.md. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]

- GP-01 follow-up (2026-09-09): blocker scope guidance corrected and deterministic gates checked (47 tests). Live-provider behavior remains unverified for this correction. See proof/growth/blocker-scope-verification.md.

- Execution debug (2026-09-09): 294 tests pass; real eight-round cutoff reproduced and fixed with 12-round window; Model display selection now tool-accessible and renderer-confirmed. Live provider final inspection passed. Broad reconstruction acceptance remains open. See proof/growth/gemini-debug-verification.md.

- Large attachment slice (2026-09-09): 500 MB files / 20-file selection, local originals, read_assistant_file page/text retrieval; 308 tests and live-provider/big-file proofs recorded. Full backup integration and CAD/BIM interpretation remain open. See proof/growth/large-files-verification.md.
Document status: open (8)
