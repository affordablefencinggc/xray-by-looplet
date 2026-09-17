# X-Ray Live assistant — final reviewable map

**Scope.** The in-app assistant surface of `xray-by-looplet`: its tools, routes, gates, budgets and prohibitions, assembled from nine independently verified cluster maps plus one completeness critique. Source reading only; see the closing note.

**How this document treats disagreement.** Where a cluster's claim conflicts with a verifier correction backed by a cited `file:line`, the correction is carried and the overturned claim is recorded in §6 rather than silently deleted. Two counts at the centre of the document were re-verified directly while assembling: `VIEW_TOOLS` holds **27** names and `APP_PANES` holds **10** (`src/studio/assistant/skills.ts:91-115`, `src/studio/assistant/appTools.ts:33`).

---

## 1. Orientation

**Tools: 39 callable names.** 38 are registered through `createAppTools` in `src/studio/assistant/appTools.ts`; the 39th, `web_search`, is declared inline at `src/studio/assistant/session.ts:16-25`. They partition into `VIEW_TOOLS` (**27**) and `EDIT_TOOLS` (**12**) at `src/studio/assistant/skills.ts:91-119`. Five are pure industry calculators with no project access. One — `review_takeoff_item` — is registered but permanently blocked (see below), so the reachable count is **38**.

**Routes: 6** — `discussion`, `inspect`, `architecture`, `takeoff`, `render`, `export` (`src/studio/assistant/workflowRouting.ts:7-14`). Route names are declarative rationale; enforcement lives in `nextToolStep` (`workflowRouting.ts:68-98`) and `completionStep` (`:150-165`).

**Gates: nine admission gates, in evaluation order.**
1. `prohibit-all-tools` — objective-level ban (`useAssistantChat.ts:144,184,194`)
2. `providerSupportsTool` (`provider.ts:38-44`)
3. `checkProfessionalAction` (`workPacket.ts:73-75`)
4. `assistantToolAllowed` — the VIEW/EDIT allowlist (`skills.ts:122-123`)
5. `permissionVerdict` / `gateToolCall` — mode + human prompt (`permissions.ts:29,125`)
6. `workflow router` — prerequisite refusal (`workPacketRuntime.ts:121-126`)
7. `checkPacketAction` / `workPacketRuntime.call` — identity, recovery, pending action, staleness, journal (`workPacket.ts:77`, `workPacketRuntime.ts:43,115,116,165`)
8. `session single-active-tool` (`session.ts:42`)
9. `declaration filter` — gates 2 and 4 applied early, so a denied tool is usually invisible to the model (`useAssistantChat.ts:184`)

**Budgets: four surfaces** — execution limits (`executionBudget.ts`), per-send round and tool-call caps (`conversation.ts:153,177,179`), transcript context budget (`contextBudget.ts:57`), and the work-packet context guard (`workPacketRuntime.ts:86`).

### The single most important finding

**The human permission gate keys off allowlist membership, not actual effect.** Because prompting, the readonly block and the uncertain-outcome replay gate are all driven by `isAssistantEditTool` (i.e. `EDIT_TOOLS` membership, `skills.ts:121`), five tools that demonstrably mutate live device/viewer state or spend provider quota are admitted as *reads*: `navigate_workspace` (`appTools.ts:252`, writes the pane), `show_design_in_model` (`:433`, writes `designedBuilding` and the pane), `hide_designed_model` (`:461`), `control_draftsman` (`:316`), and `generate_render_visualisation` (`:432`, consumes Gemini quota under a 30/day server cap). None of the five prompts in any mode, and none trips the "an earlier tool has no durable outcome" edit gate. Conversely, the one genuine edit whose prompt matters most — `review_takeoff_item` — never reaches the permission gate at all: `checkProfessionalAction` fires at `workPacketRuntime.ts:119`, before the `authorize` callback at `:127` and before `callAssistantTool` at `:145`, so in readonly mode it returns neither `READONLY_MESSAGE` nor a prompt. Net effect: **the tools that should ask, don't, and the one that shouldn't run, can't be governed by the mode switch at all.** Two of the three clusters that contain these tools (architect-design, render-capture-draftsman) note the mismatch in their own verdicts; the takeoff verifier confirmed the ordering defect from source.

A related critic finding — that the approval prompt itself reads argument keys no tool sends — is **not** cluster-verified and is listed as open question 1 rather than folded into the finding above.

---

## 2. Every tool

Effect is the **actual** effect from source, not the declared tier. Gate is the rule that admits it. `[tier mismatch]` marks a tool admitted as a read that does not behave like one.

| # | Tool | Effect | Gate | Purpose |
|---|---|---|---|---|
| 1 | `search_standards_library` | network | `VIEW`; workflow-gated | Fetch standards excerpts for a topic/edition from `/api/standards-library` |
| 2 | `read_workflow_route` | read | `VIEW`; router short-circuit (`workflowRouting.ts:69`) | Return the static ordered step list for one workflow |
| 3 | `read_project_context` | read | `VIEW`; `UNBOUND_READS`, no id binding | Return one live project snapshot (id, revision, pane, documents, counts, hydration) |
| 4 | `navigate_workspace` | device | `VIEW`; workflow-gated | `[tier mismatch]` Switch the pane; for `sketch`, open the Architectural workspace |
| 5 | `read_workbench_structure` | read | `VIEW`; `UNBOUND_READS` | Return the static workbench structure reference (panes, entities, tool list) |
| 6 | `read_assistant_file` | read | `VIEW` | Read a stored attachment or the active source bytes, with paging |
| 7 | `read_work_packet` | read | `VIEW` | Return one stored work packet in full, or up to 20 recent summaries |
| 8 | `read_work_packet_event` | read | `VIEW` | Return packet journal metadata, or one paged event |
| 9 | `capture_project_backup` | project-edit | `EDIT`; prompts "Save a workspace backup" | Capture and store a revision-bound workspace backup |
| 10 | `read_source_geometry` | network + device | `VIEW` | POST the active PDF to `/api/source-geometry` for lines, text, region close-up |
| 11 | `prepare_source_room` | network + device | `VIEW` | Turn selected segments + one door into drawable room operations and an overlay |
| 12 | `read_source_building` | read | `VIEW` | Summarise a Model-viewer scene's parts, storeys, evidence tallies |
| 13 | `read_source_sheets` | read | `VIEW` | Return the active source's sheet register from the lifecycle sidecar |
| 14 | `manage_source_sheet` | device | `EDIT`; prompts "Change a sheet" | Rename, archive or recover one sheet in the localStorage sidecar |
| 15 | `read_architect_design` | read | `VIEW` | Return the live architect project plus workspace flags |
| 16 | `draw_architect_elements` | project-edit | `EDIT` | Append a bounded batch of design operations, commit, read back |
| 17 | `undo_architect_change` | project-edit | `EDIT` | Pop the workspace undo stack and commit |
| 18 | `edit_architect_elements` | project-edit | `EDIT`; prompts "Edit design elements" | Apply ID-addressed edits and commit |
| 19 | `show_design_in_model` | device | `VIEW` | `[tier mismatch]` Build a designed scene, mount it in Model, select the pane |
| 20 | `hide_designed_model` | device | `VIEW` | `[tier mismatch]` Clear the mounted designed scene |
| 21 | `read_takeoff_evidence` | read | `VIEW` | Return per-sheet calibration, traces, items, readiness blockers |
| 22 | `calibrate_source_sheet` | project-edit | `EDIT` | Two-point manual calibration of one source page |
| 23 | `trace_takeoff_run` | project-edit | `EDIT` | Draw one 2–500-vertex length trace on a locked-calibration page |
| 24 | `review_takeoff_item` | project-edit | **blocked** by `checkProfessionalAction` before every other gate | Approve/reject one run or item as a named reviewer — unreachable |
| 25 | `remove_takeoff_trace` | project-edit | `EDIT` | Remove one measured run and the items placed on it |
| 26 | `read_price_books` | read | `VIEW` | Return a library-level summary of imported price books |
| 27 | `import_price_book` | device | `EDIT`; prompts "Import a price book" | Parse, validate and append a price book or a new revision |
| 28 | `export_design_file` | device | `EDIT`; prompts "Export a design file" | Generate one export (dxf/ifc/drawing-pdf/material-pdf/sheet-register) and download |
| 29 | `generate_render_visualisation` | network | `VIEW` + **Gemini only** | `[tier mismatch]` Capture the viewer, POST `/api/render-ai`, return receipt + image |
| 30 | `capture_workspace_image` | read | `VIEW` | Capture the live 3D canvas as a downscaled PNG |
| 31 | `control_draftsman` | device | `VIEW` | `[tier mismatch]` Drive the mounted Model viewer's draftsman playback |
| 32 | `read_draftsman_status` | read | `VIEW` | Return draftsman status, model identity, active flag |
| 33 | `save_project` | project-edit | `EDIT` | Compare-and-swap save of the main job record with storage readback |
| 34 | `calculate_draft_roof_area` | read | `VIEW` | Draft roof-plane slope/gross/opening/net areas |
| 35 | `calculate_draft_duct_material` | read | `VIEW` | Draft straight-duct lateral area and optional sheet mass |
| 36 | `classify_draft_quantities` | read | `VIEW` | Organise measured items into a hierarchy with inclusive rollups |
| 37 | `calculate_draft_roof_sheet_coverage` | read | `VIEW` | Draft rectangular sheet columns, courses and sheet count |
| 38 | `calculate_draft_duct_wrap` | read | `VIEW` | Draft insulation wrap area for straight duct sections |
| 39 | `web_search` | network | `VIEW` + **Gemini only** | Run a grounded nested web search; return answer + sources |

Provider note: only `web_search` and `generate_render_visualisation` are provider-restricted (`provider.ts:38-39`). In the native Tauri build MiniMax is denied entirely (`transport.ts:16`).

---

## 3. The six routes

Route step lists are surfaced verbatim to the model by `routingBrief` (`workflowRouting.ts:167-171`); they are instruction strings, not tool calls. "Complete" = `completionStep` returns `null`.

**`discussion`** (`workflowRouting.ts:8`) — Explain or correct supplied information without calling tools; claim no project action. **Completes** with no context stamp at all: `workflowRouting.ts:154` exempts `discussion` from the context check, so it falls straight to `return null`. Auto-selected for discussion-only objectives and for completed project-bound calculator calls (`:117-118`).

**`inspect`** (`:9`) — Ordered: read project context → retrieve the relevant design / source sheets / attachments / evidence → answer with source and revision, naming unknowns. **Completes** after selection plus a matching context stamp; `read_architect_design` / `read_source_sheets` / `read_takeoff_evidence` requested first are refused with `next=read_project_context`.

**`architecture`** (`:10`) — Ordered: read project context → open Sketch when the controller is absent → read the current design and IDs → draw or edit a bounded batch → read back the new revision → mount in Model and capture actual pixels → inspect the image, correct or report. **Completes** only after an edit's invalidation is repaired: `ARCHITECT_EDITS` sets `designChanged`, nulls `designRead`/`mounted`/`captured` and increments `mutationCount` (`:131`); `mounted` is keyed to `designKey([projectId,designRevision])` and `captured` requires a real image part.

**`takeoff`** (`:11`) — Ordered: read context and source sheets → read evidence on the target sheet → use calibration/trace tools with their real inputs and permissions → re-read the evidence; report exclusions and unknowns. **Completes** after `TAKEOFF_EDIT` (`:133`) nulls `evidenceRead`, so `read_takeoff_evidence` is mandatory first (`:159-160`); evidence is keyed by `evidenceKey(context + sheet)`.

**`render`** (`:12`) — Ordered: read context → for newly authored geometry, read and mount the current revision → capture the requested view → generate a visualisation of that view (explicitly not new geometry or verified evidence). **Completes** only on a real `generate_render_visualisation` receipt (`:134`); `captured` is keyed to `captureKey(context + designKey + pane + renderedSceneSha256)` and is nulled by `navigate_workspace`, `control_draftsman` and `hide_designed_model` (`:146`).

**`export`** (`:13`) — Ordered: read context → read the current authored design, or source sheets for a sheet register → finish any outstanding design readback and capture → export the format and inspect the delivery receipt. **Completes** only when the receipt's `downloaded === true` (`:136-137`); otherwise a delivery failure is recorded.

---

## 4. Gates and exact membership rules

**`prohibit-all-tools`** (`useAssistantChat.ts:144`) — `noTools = reviewOnly || prohibitsAllTools(text)`. One detection, three consequences: declarations emptied (`:184`), `editsDeclared` forced false (`:145`), any emitted call throws (`:194`).

**`providerSupportsTool`** (`provider.ts:38-44`) — Gemini admits all. MiniMax is denied exactly `web_search` and `generate_render_visualisation`. Native build denies MiniMax outright (`transport.ts:16`).

**`checkProfessionalAction`** (`workPacket.ts:73-75`) — refuses unconditionally: the name `review_takeoff_item`, or any name matching `/^(send_|issue_|approve_|certify_|publish_)/`. Independent of provider, permission mode and `allowProjectEdits`. Called on three paths: `session.ts:38`, `mcp.ts:23`, and `workPacket.ts:82` via `checkPacketAction` inside `governed.call` (`workPacketRuntime.ts:119`).

**`assistantToolAllowed(name, allowProjectEdits)`** (`skills.ts:122-123`) — `VIEW_TOOLS.has(name) || (allowProjectEdits && EDIT_TOOLS.has(name))`. Closed on both sides: a name in neither set is denied even with edits allowed.

**`isAssistantEditTool`** (`skills.ts:121`) — `EDIT_TOOLS.has(name)`. The single definition of "state-changing", consumed in four places: `permissions.ts:29` (verdict), `contextBudget.ts:93,95` (handover, plus the `STATE_CHANGING_TOOL` regex superset), `workPacket.ts:82` (professional action), `workPacketRuntime.ts:116,134` (pending-action gate).

**`permissionVerdict` / `gateToolCall`** (`permissions.ts:29,125`) — non-edit → `allowed`; edit → `blocked` in readonly (`READONLY_MESSAGE`), `allowed` in auto or when granted for the chat, else `ask`. In ask mode one prompt resolves to Allow once / Allow for this chat / Deny; a superseded prompt is treated as a denial, not queued. `useAssistantChat.ts:197` bypasses `gateToolCall` entirely when `allowProjectEdits` is true — the mode path is the live gate and the flag is the legacy shortcut.

**Workflow router** (`workPacketRuntime.ts:121-126`) — returns, without executing, `{status:"not-executed", reason:"Workflow prerequisite missing.", requestedTool, next}` when `nextToolStep` yields a step. Exempt: `read_workflow_route` (short-circuit `:69`) and the `UNBOUND_READS` set (`workflowRouting.ts:57-60`, confirmed members include `read_project_context` and `read_workbench_structure`). `search_standards_library` and `navigate_workspace` are **not** exempt. When no route is selected, a first mutation auto-derives one (`:70-74`).

**`checkProject`** (`appTools.ts:124-127`; `takeoffTools.ts:67`) — `persistenceHydrated && !persistenceRecoveryBlocked && hydrationStatus === 'ready'`; then `job.id === expectedJobId`; then, where the tool takes it, `job.revision === expectedRevision`.

**`checkPacketAction`** (`workPacket.ts:77-82`) — packet identity, recovery not blocked, `pendingAction === null` whenever `isAssistantEditTool` is true, and exact equality of project revision, design revision and the source-set JSON. `workPacketRuntime.call` adds the uncertain-prior-packet refusal (`:116`), journal verification (`:43`), and the audit-storage refusals (`:115`, `:165`).

**`session` single-active-tool** (`session.ts:42`) — a second concurrent tool call gets `"Another assistant tool is running. Wait before retrying."`

**Budgets.**
- Execution limits (`executionBudget.ts:3,11-12`): `maxRounds` 1..512 (default 64), `maxToolCalls` 1..4096 (default 256), `maxOutputTokens` 1024..65536 (default 32768), `timeoutMs` 10000..600000 (default 300000), `contextTokens` 16000..900000 (default 600000). Corrupt or absent storage silently yields the defaults.
- Enforced in `conversation.ts`: rounds (`:52`, throw `:179`), tool calls (`:153` per-call refusal, throw `:177`). `maxOutputTokens` and `timeoutMs` are enforced downstream (`assistantAi.server.ts:59`, `minimaxAi.server.ts:181`, `src-tauri/src/assistant_ai.rs:340,403`) — **not** in `conversation.ts`.
- Transcript context (`contextBudget.ts:57`): `full` at 300,000 tokens **or** 36 contents **or** 10 MB; `warn` at 240,000 / 30 / 8 MB. QA lever `xray:assistant-context-floor` raises the estimate only (`:69-82`).
- Work-packet context (`workPacketRuntime.ts:86`): trims at 7 MB or 65% of `contextTokens`; blocks the packet at 10 MB or 100%. The full request is archived before any reduction, and the trim can never remove the message being answered.

---

## 5. Prohibitions, by how they are actually enforced

This split is the document's most important output: only one column can fail loudly.

### 5a. Enforced by removed declarations (the tool does not exist in the registry)

A model cannot call what is not declared. Confirmed against `createAppTools` (`appTools.ts:187-477`) plus `web_search`: no `import_*`, `quote_*`/`bom_*`, restore/delete, `place_*`, vertex-edit, source-mutation or model-space-authoring tool is registered.

| Prohibition (source: `context/app-atlas.md`) | What is absent | Note |
|---|---|---|
| Importing a plan is UI-only (`:35`) | any `import_*` tool | `read_assistant_file` reads already-persisted sources; it does not import |
| No quote or bill-of-materials tool (`:35`) | any `quote_*`/`bom_*` tool | rates can be imported/read, never quoted |
| Backups are captured but never restored or deleted (`:35`) | any restore/delete backup tool | the capture half is a real, gated tool |
| Trace vertices cannot be edited one by one; located items cannot be placed (`:36`) | any vertex-edit or `place_located_item` tool | `trace_takeoff_run` takes a whole 2–500-point polyline; `remove_takeoff_trace` removes a whole run |
| Source identity, hashes and classes cannot be changed (`:37`) | any identity/hash/class mutation tool | `read_source_geometry` detects change but cannot forbid it |
| Geometry is authored through Sketch tools only (`:37`) | any direct model-space authoring tool | `show_design_in_model` only mounts a scene |
| *(runtime mechanism)* no tools for this message | `declarations: []` when `noTools` (`useAssistantChat.ts:184`) | the only one that can be exercised against a model mid-turn |

### 5b. Enforced by a thrown error

| Prohibition / limit | Exact message | Site |
|---|---|---|
| Rendering is web-only (atlas `:37`) — **the only atlas item with a runtime throw** | `Rendering is unavailable in this native build; use the web app.` | `renderTool.ts:99` and `:174` |
| No tool calls for a prohibited objective | `Tools are prohibited for this request; no project action was executed.` | `useAssistantChat.ts:194` |
| Professional approval / external issue | `Professional approval or external issue requires verified human authority. This work packet permits internal drafts only.` | `workPacket.ts:74` |
| Workflow correction cap (2) | `Workflow incomplete after two correction attempts. Completed actions and the next required step are saved.` | `conversation.ts:124` |
| Final-claim correction cap (1) | concatenated `toolClaimFailure` text | `conversation.ts:94` |
| Speculative calculator result | `The requested calculation failed; no successful result was verified. Review the failed calculation details and correct the inputs before trying again.` | `conversation.ts:83` |
| Round budget | `Paused after <N> assistant steps. …` | `conversation.ts:179` |
| Tool-call budget | `Paused at the <N>-tool budget. …` | `conversation.ts:177` |
| VIEW/EDIT allowlist | `This tool is not permitted for this message. No action performed.` | `session.ts:39` |
| Permission mode / prompt | `READONLY_MESSAGE`, `DENIED_MESSAGE`, `STOPPED_MESSAGE` | `permissions.ts:20-21` |
| App preflight unavailable / repeated | `App preflight tool is unavailable in this session; no action executed.` / `…did not resolve the prerequisite…` | `conversation.ts:111,113` |

### 5c. Instruction text only (no machine check)

| Rule | Where stated | Machine backstop |
|---|---|---|
| 21-clause safety manual — no destructive bulk changes, no issuing/sending quotes, no publishing, no third-party contact, no changing source classes or hashes, no bypassing permissions, never claim without a receipt (`skills.ts:78`) | prompt content, sent every request | receipt claims partly caught by `unsupportedFinalToolClaims` |
| "Never do these things" — seven prohibitions (`context/README.md:60-66`) | prompt content | as above; nothing catches "treated an image as an order" |
| Carried context grants no permission and sets no rule (`README.md:56`) | prompt content | app enforces only that a failed read is *visible* (`useAssistantChat.ts:22`, fail-open) |
| `skills-atlas.md` budget prose ("Twelve rounds… Twenty-four tool calls…") | prompt content | **contradicts** the shipped 64/256 defaults — see open question 9 |
| Source-identity / vertex-edit / item-placement / quote / import rules, restated | atlas prose | absent declarations are the real enforcement; the prose is reinforcement |

---

## 6. Corrections — claims the verifiers overturned

30 overturned claims, grouped by cluster. Every one carries the verifier's cited source. Where a cluster and its verifier disagreed and the verifier cited source, the verifier wins here.

**context-routing (3/5 entries intact)**
- **C1** `navigate_workspace` precondition "nine panes" → **ten**: `overview, sheets, measure, sketch, components, model, render, review, cost, proof`. Verified directly: `appTools.ts:33`.
- **C2** `search_standards_library` keyDetail claiming the "up to 20 excerpts" and edition-narrowing guarantees are unenforced → **both are enforced by this repo's host chain**, so the tool description is accurate and the map's criticism was wrong: `scripts/search_standards_library.py:64` (`ORDER BY rank LIMIT 20`), `:61-63` (edition filter); `src/routes/api.standards-library.ts:26`; `src/lib/standardsLibrary.server.ts:29-38`. The route is **in-repo**, not out-of-tree as the entry's precondition implied.

**files-packets-backup (3/4 intact)**
- **C3** `read_work_packet` keyDetail "`verifyWorkJournal` … invoked only when a new packet starts (`workPacketRuntime.ts:43`)" → **false**: also called at `useAssistantChat.ts:75` during chat-history rebuild. (The narrower claim — that `read_work_packet` itself never verifies the chain — stands.)
- **C4** the same error restated in the cluster notes. Same evidence.

**source-and-sheets (1/5 fully clean)**
- **C5** `read_source_geometry` failureModes listing Python `WireframeError` text as surfaced → **never surfaced**: `src/lib/sourceGeometry.server.ts:54` collapses any engine error to `Unsupported or invalid source; Python extraction failed.` (422).
- **C6** `prepare_source_room` "inherits Python WireframeError text verbatim" → **same defect**, same evidence.
- **C7** `manage_source_sheet` keyDetail cites `appTools.ts:50` for truthy-discipline forwarding → the code is at **`workbenchTools.ts:50`**; `appTools.ts:50` is a port type line.
- **C8 & C9** `read_source_building` "checkProject, twice for designed scenes" → **twice for every building**, catalog or designed: `appTools.ts:343` and `:346`.
- *Omissions:* `read_assistant_file` (the other active-source VIEW tool, `appTools.ts:207`); `parseSourceBuilding` also throws `Source trace is outside the original sheet.` (`src/studio/sourceBuilding.ts:226`); return shapes omit `shortSegmentsExcluded`/`totalSegments`/`minimumLengthPt`/`omissions` and `internalAreaMm2`/`innerBoundaryPt`/`centerlinePt`/`sourceSegmentIds`/`scaleMapping`.

**architect-design (5/6 intact)**
- **C10** `read_architect_design` attributes the short `"The active project changed…"` to `controller.read` → the controller throws the longer `"The active architectural project changed. Read project context again."` at `ArchitectWorkspace.tsx:529`.
- **C11** notes: "`prepareArchitectElements`/`prepareArchitectEdits` are pure and append-only" → **only the first is append-only**; `prepareArchitectEdits` splices and object-assigns (`architectBridge.ts:252`).
- **C12** notes: "if it is unmounted every design tool throws" → **false for two of six**: `hide_designed_model` needs no controller (`appTools.ts:462-464`); `show_design_in_model` opens the workspace instead (`:438-441`).
- *Omissions:* `export_design_file` (`appTools.ts:414`, an EDIT tool operating on the same design), `read_workbench_structure`, and `read_source_building` with `building:"designed"`.

**takeoff (3/5 intact)**
- **C13** `review_takeoff_item` permissionClass: "`checkProfessionalAction` … before the permission gate" in a way that still permits `gateToolCall` → **the professional-action throw at `workPacketRuntime.ts:119` pre-empts `authorize` (`:127`) and `callAssistantTool` (`:145`)**, so no `READONLY_MESSAGE` and no prompt ever occur for this name.
- **C14** `review_takeoff_item` keyDetail attributes the refusal to `session.ts:38` → it is reached from `checkPacketAction` (`workPacket.ts:82`) inside `governed.call`; `session.ts:38` is never reached for this tool.
- **C15** `review_takeoff_item` failureModes listing the allowlist message → **unreachable** (`session.ts:39` never runs).
- **C16** `review_takeoff_item` keyDetail claiming it is uniquely missing `requireImportedPage` while "the other three writers enforce it" → **`removeTrace` also never calls it** (`takeoffTools.ts:265-275`); only `calibrateSheet` (`:126`) and `traceRun` (`:184`) enforce sample/page-range/busy-pane.
- **C17** `remove_takeoff_trace` "the only takeoff mutator with no `requireImportedPage` call" → **false**; `reviewTakeoffItem` also lacks it (`:239-240`).
- *Omissions:* the readonly declaration filter that hides `review_takeoff_item` entirely; `storeError` fallback strings `Calibration capture did not start.` (`:138`) and `Calibration point N was not captured.` (`:143`); the `governed.call` layer in the gate-order note.

**pricing-export (3/3 intact)**
- **C18** notes group `port.architect` with optionally-undefined ports producing "unavailable in this session" → **`architect` is a required port** (`appTools.ts:44`, wired `:510`); the real message when no controller is mounted is `Open Sketch → Architectural workspace before using this design tool.` (`architectBridge.ts:367`).

**render-capture-draftsman (4/5 intact)**
- **C19** `save_project` keyDetail: "there is no readback … the verification is of store bookkeeping, not of persisted bytes" → **refuted**: `saveFencingJob` re-reads the stored string and compares it to the serialized value, returning `ok:false` on mismatch (`src/studio/persistence.ts:120`, via `store.ts:2226`). The description's "readback-verify" is accurate.
- *Omissions:* `capture_project_backup`; `control_draftsman`'s controller-level messages `Open the model preview or its matching source before using drawing playback.` and `The model viewer is not ready. Wait for it to finish loading.` (`SourceBuildingViewer.tsx:933,935`).

**industry-calculators (4/5 intact)**
- **C20** `classify_draft_quantities` permissionClass cites `skills.ts:93` → it is on **line 92** (verified directly).
- **C21** `web_search` purpose and keyDetail quote `{answer, sources}` as the return → the handler returns an MCP envelope `{ content:[{type:"text", text: JSON.stringify({answer, sources})}] }` (`session.ts:23`).
- *Omission:* none of the five calculators rejects the caller; every listed failure is an `isError` result produced by the `appTools.ts:191` wrapper, not an exception.

**workflow-routes (9/11 intact)**
- **C22** `workflow:discussion` failureModes[0]: "any mutation attempted while `selected='discussion'` is refused; the router re-derives a real route (`:70-74`)" → **neither half holds**: `:70-74` is guarded by `if (!s.selected)`, and `nextToolStep` has no discussion branch — with matching context and `designRead`, a mutation **executes** under `discussion` (`workflowRouting.ts:70,78,97`).
- **C23** `behaviour:completionStep` keyDetail: every selected route requires the context stamp → **false**: `:154` explicitly exempts `discussion`, which completes with no `read_project_context`.
- *Omissions:* `nextToolStep` (`:68`, the actual enforcement predicate), `routingBrief` (`:167`), `completionStepForObjective` (`completionPreflight.ts:31`).

**gates-budgets (23 intact)**
- **C24** `gate:view-tool-allowlist` "26 read/inspection tools" → **27** (`skills.ts:91-115`, verified directly).
- **C25** `gate:assistant-tool-allowlist` keyDetail restating "VIEW_TOOLS (26 names)" → same. `EDIT_TOOLS` = 12 is correct.
- **C26** `gate:permission-controls-ui` providerSupport cites `ProviderSwitch.tsx:64` for the render → the render is at **`PermissionControls.tsx:64`**; `ProviderSwitch.tsx:64` is the close of an unrelated effect.
- **C27** `budget:execution-budget` permissionClass (and the cluster notes) say the five-field budget is "enforced in `conversation.ts:28`" → `:28` only **parses**; the file enforces `maxRounds` (`:52`) and `maxToolCalls` (`:153,177,179`) only.
- *Omissions:* work-journal storage gates (`workPacketRuntime.ts:52,115,165`); `assertContext` (`useAssistantChat.ts:199`; `conversation.ts:53,64,100`); the app-preflight gates (`conversation.ts:83,111,113`); the single-in-flight send gate (`useAssistantChat.ts:146`).

**prohibitions-and-limits (26/29 intact)**
- **C28** `short-interaction-window` failureModes: "an image-only entry is replaced by the placeholder" → **it is dropped**: `:27` keeps an entry only if a part has non-`[xray:` text, and an `{inlineData}`-only part can carry nothing else (`contract.ts:43-46`); the fallback at `:29` fires only for a thought-only entry. Test asserts `shortInteraction([imageOnlyMarked]) === []` (`shortInteraction.test.ts:41`).
- **C29** `atlas-geometry-authored-in-sketch` failureModes attribute `"Finish or cancel the current architectural draft before leaving Sketch."` and `"…pending draft before showing the design in Model."` to draw/edit → they belong to `navigate_workspace` (`appTools.ts:257`) and `show_design_in_model` (`:445`); neither draw nor edit contains a `pendingDraft` check.
- **C30** `tool-call-budget` keyDetail: the budget branch is "the only one of the three in-loop refusals that records `invoked=false` and is phrased 'not executed'" → **all three** leave `invoked` false, and the duplicate-ID refusal is also phrased "not executed" (`conversation.ts:153,154,155,158`).
- *Omissions:* the professional-action / internal-draft authority gate (the reason `review_takeoff_item` is declared unavailable — `workPacket.ts:73-74`), and the pending-action edit block (`workPacket.ts:80`).

---

## 7. Open questions — the critic's gaps

Each is a critic finding. Items 1, 3, 8 and 9 are stated from source by the critic but not ratified by a cluster verifier; treat those four as leads to confirm before acting.

1. **The human approval prompt reads argument keys no tool sends.** `describeToolIntent` (`permissions.ts:52-75`) reads `sheetIndex` (line 64) but the takeoff tools send `sheet` (`appTools.ts:385,390`) and `manage_source_sheet` sends `pageIndex` (`:354`); reads `reviewer`/`decidedBy` (line 69) but `review_takeoff_item` sends `actor` (`:395`); reads `knownDistanceM` (line 70) but `calibrate_source_sheet` sends `knownDistance:{value,unit}` (`:385`). The unit test passes only because it feeds the invented keys (`permissions.test.ts:25-27`). Three of six branches are dead — the sheet/page, the named reviewer and the known distance are absent from the text a user approves for the highest-risk edits.
2. **VIEW_TOOLS miscounted as 26** in the allowlist cluster; it is 27 (now corrected in §5/§6, listed here because the critic raised it).
3. **The EDIT set has a second, wider consumer axis than the map described.** `isAssistantEditTool` is re-imported by `permissions.ts:2,29`, `contextBudget.ts:3,93,95` and `workPacketRuntime.ts:5,116,134` — "is this an edit?" is answered in four places.
4. **`generate_render_visualisation` is a VIEW tool and therefore ungated** — `permissions.ts:29` always returns `allowed` for it, the readonly block never fires, and `workPacketRuntime.ts:134` never treats it as a mutation, despite it consuming quota and being singled out by the provider gate.
5. **Tool-name knowledge is hand-duplicated in at least eight places with no parity test.** `skills.ts:91-119`; `permissions.ts:35-48`; `toolReceipt.ts:6-46` + `DRAFT_RECEIPTS:79-85`; `workflowRouting.ts:40-42,57-60`; `contextBudget.ts:93`; `completionPreflight.ts:8-14`; `workbenchStructure.ts:52`; the generated `contextManual.gen.ts`. `toolReceipt.test.ts` never asserts `TITLES` covers the registry, so a new tool silently falls back to a humanised name (`toolReceipt.ts:198`) and no test fails.
6. **Context-budget numbers disagree between prompt and guard.** `contextBudget.ts:11-18,20` guards on 300,000 tokens / 36 contents / 10 MB, while `budgets.md` and `contextManual.gen.ts` tell the model "600,000 estimated tokens (configurable to 900,000)" per `executionBudget.ts:12`. The QA lever `xray:assistant-context-floor` (`contextBudget.ts:69-82`) is uncovered.
7. **`skills-atlas.md:37-38` contradicts the shipped budget** — "Twelve rounds per send / Twenty-four tool calls; the twenty-fifth is refused" vs the 64/256 defaults, with both texts embedded in `contextManual.gen.ts`. This is the material the assistant reads about its own limits.
8. **The correction limits are four distinct caps, not "two corrections".** `conversation.ts:124` (workflow, `> 2`), `:94` (tool-claim, `> 1`), `:80-84` (speculative calculator, no correction), and `:111-117` (single app-preflight read attempt), supported by `finalToolClaims.ts`, `namedToolRetry.ts`, `shortInteraction.ts`, `completionPreflight.ts`.
9. **The carried-context runtime sits outside `context/`.** The directory holds only docs; the machinery is `contextTurn.ts`, `contextCapture.ts`, `contextLog.ts`, `contextLogStore.ts`, `contextProfile.ts`, `pinnedContext.ts`, `compactTranscript.ts`. The reviewer-critical contracts are the Rust byte-parity (`skills.ts:73-75` ↔ `src-tauri/src/assistant_ai.rs:13`) and the replay guard re-seeded by marker receipts (`contextTurn.ts:22-58`).
10. **Persistence is uncovered beyond chat-history restore.** `projectSwitch.ts:77-161` (busy/not-ready refusal, CAS save, plan, rollback-on-CAS-loss, autosave block, re-hydrate, `SWITCH_BUSY_MESSAGE`); the cross-tab CAS revision in `chatHistory.ts:66-84` and `recoverTaskChat` (`:87-106`); the hash-chained journal CAS in `workPacketStore.ts:35-59` and `verifyWorkJournal:9-18`.
11. **Developer review is more than `developerMode.ts`.** The marker is special-cased in the correction loop (`conversation.ts:124` skips the two-correction cap for any `[xray:developer-review]` requirement); the authority caveat is at `developerMode.ts:5` and the toggle store at `developerPreferences.ts:4-9`.
12. **UI surfaces named by the map have no cluster coverage**: `TopDownMindMap.tsx` (+ `mindMapLayout.ts`), `MonkeyPanel.tsx` + `monkeyRecorder.ts`/`monkeyWorkflow.ts`, `NccLibraryPanel.tsx` (+ `nccLibrary.ts`, `standardsLibrary.ts`; publisher check `NccLibraryPanel.tsx:47-57`), `ChatHistoryPanel.tsx`, `AssistantProjects.tsx`, `ExecutionSettings.tsx`, `ProviderSwitch.tsx`, and `LiveAssistant.tsx` itself (1464 lines; the map cites only `:129`). `ConversationView.tsx` is only partly covered (reply-options/suggestion/NCC logic `:33-58,84-137`).
13. **`review_takeoff_item` is declared-but-gated**, so "39 callable tools" is really "38 callable + 1 permanently blocked" — yet it still carries a VIEW/EDIT membership, a permission title (`permissions.ts:44`) and a receipt title (`toolReceipt.ts:34`).
14. **The handover regex and drop rules are unstated.** `contextBudget.ts:98` matches `Paused after (?:\d+|eight|twelve) assistant steps` while `conversation.ts:179` emits numerals only; the handover builder drops oldest requests then oldest receipts (`:127-135`).
15. **`context/` docs are generated, not hand-authored** — `contextManual.gen.ts` is composed from the five Markdown files by `build-assistant-context.mjs`, so a doc edit only reaches the model through a rebuild.
16. **The `review_takeoff_item` description, the block site and `workbenchStructure.ts:52` are three copies of the same claim**; none is derived from the gate, so a future unblocking would not update them.

---

## 8. What this map does not establish

- **It is a source reading, not a live-turn result.** No turn was executed. Nothing here proves a tool returns what its code appears to return, that the mount order holds at runtime, or that a gate fires as written. Where a claim rests on a comment or a schema rather than an executed path, it is stated as source, not as behaviour.
- **It covers no UI surface unless a cluster explicitly read one.** The permission controls, provider switch, execution settings, conversation view, mind map, monkey panel and NCC panel were read only to the extent a cluster cited a specific line. There is no screenshot, no interaction, no DOM verification.
- **Counts and line numbers are as of this reading.** `skills.ts:91-115` (27) and `appTools.ts:33` (10 panes) were re-verified while assembling; the rest come from the nine cluster verifications and were not all re-read here.
- **The Corrections section is the trust boundary.** Everything in §2–§5 reflects a corrected claim; anything a verifier overturned is in §6 and is no longer relied on. Where the critic's finding is uncorroborated by a verifier, §7 says so.
- **Nothing here was run or fixed.** This is a map for deciding what to fix, not evidence that anything works.