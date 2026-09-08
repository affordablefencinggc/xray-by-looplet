# Live assistant and MCP execution

Approved: 2026-09-08, user requested real MCP drawing, professional tools, web search during chat, image display and LLM capabilities.
Baseline: feat/architect-cad-engine, 1f725b6619a3a12a5683c072c1018df26c8a655d; existing daily-recovery edits preserved.

- [x] SC-01: Real in-process MCP client/server initialization, discovery and tool calls using the official SDK. Connection status follows executed handshake. Accepted with development SDK calls and production/native discovery in build 71f5b012342b.
- [ ] SC-02: Gemini conversational transport on web and Windows native, including function calls, image input/output, cancellation and grounded web search.
- [ ] SC-03: Real drawing tools: project/design context, workspace navigation, walls/openings/lines/rooms, undo, verified save and image capture. Existing data and revision checks preserved.
- [ ] SC-04: Live conversation UI with pinned composer, image attachments/results, source links, tool activity, stop/retry and per-project session history.
- [ ] SC-05: Protocol/provider failure tests and actual browser journeys, inspected desktop/tablet screenshots, source snapshots and HTML/PNG evidence.
- [ ] SC-06: Dans1 High/16 sequential web/native builds, tested production identity, native acceptance and staged publication.
- [ ] SC-07: Expand professional capability matrix across the existing A–Z requirements. No claim that these initial tools cover every architectural/engineering/computer task.

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
