# Final production MCP/UI acceptance - 71f5b012342b

**PASS: both full scenarios completed cleanly on the final production preview.** 130 passed browser commands across two runs (53 + 77). This is a command count, not 130 unique test cases. Earlier candidate, development and report-render checks are excluded.

| Run | Commands | Time | Scenario | Result | Raw log |
|---|---:|---:|---|---|---|
| Design / save / undo / reopen | 53 | 3.732 s | [Scenario](01-design.json) | [Result](../../runner/2026-09-08T03-57-09-407Z-growth-takeover-final-71f5-mcp.json) | [Log](../../runner/2026-09-08T03-57-09-407Z-growth-takeover-final-71f5-mcp.log) |
| MCP / assistant desktop and tablet | 77 | 3.505 s | [Scenario](02-assistant.json) | [Result](../../runner/2026-09-08T03-57-22-992Z-growth-takeover-final-71f5-mcp.json) | [Log](../../runner/2026-09-08T03-57-22-992Z-growth-takeover-final-71f5-mcp.log) |

Build 71f5b012342b was verified from the rendered badge at http://127.0.0.1:8095/. Isolated session: growth-takeover-final-71f5-mcp. No application source, normal user data or CRM edits. No provider turn, web search, voice call or external message.

## Verified behavior

- Actual UI line creation, verified automatic design save, preservation of existing demo walls, undo, redo and exact saved-state reopen. A second edit and undo after reopening also persisted through another reload.
- Job job-3cd0d850-e898-406f-91b3-46a15bac8060 retained identity. Final saved design revision 7 contains five demo walls, three openings and one QA reference line. Actual local storage was read for comparisons; product writes used UI controls. Only a QA sessionStorage expected-state marker was written directly.
- Actual MCP discovery lists nine local application tools plus web_search. Known local /draw, pause drawing and /draftsman commands run through real MCP. Immediate play returned active=true and status. UI exit removed the dock; subsequent MCP status returned active=false/status=null. In Sketch, /draw failed without implicit navigation.
- Desktop panel/right-rail width 400 px; panel/composer bottoms 914/901 px. Tablet responsive inspector and assistant width 1024 px; bottoms 682/669 px. Guide and capability scrolling did not move the composer. Measured assistant buttons met 44 px targets. Shift+Enter newline and draft persistence across collapse/reopen passed.
- Browser uncaught-error checks were empty. An existing Three.js warning counter remains visible and is not represented as zero console messages.

## Inspected visual evidence

- [Drawing saved](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-ui-drawn.png): The Courtyard demonstration retains its five walls and three openings. A QA reference line is selected and saved at revision 3.
- [Same saved workspace reopened](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-ui-reopened.png): Both reopen cycles retained exact saved data and job identity. Final revision 7 contains the demo plus one QA line.
- [Actual MCP discovery](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-assistant-desktop.png): Ten tools discovered. Desktop panel and right rail are 400 px wide, with the composer pinned 13 px above the panel bottom.
- [Tablet guide and retained draft](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-assistant-tablet-guide.png): At 1024 x 768 the inspector and assistant span the full viewport width. The open panel is an overlay over the underlying navigation.
- [Scrolling preserves the composer](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-assistant-tablet-scroll.png): Guide/capability content scrolls independently; panel bottom 682 px and composer bottom 669 px remain unchanged.
- [Playback with bottom model controls](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-playback.png): MCP started and paused the actual prepared reconstruction. The approximately 1% datum-grid phase is intentionally sparse. The restored bottom navigation is visible below the drafting dock.
- [An unavailable action fails honestly](../../../../screenshots/growth/takeover-final-71f5b012342b-mcp-unmounted-refused.png): The failed control_draftsman result is visible. Sketch remains open; the tool does not navigate implicitly.

All seven original PNGs were opened and inspected, and are embedded in the self-contained [HTML report](acceptance.html). [Evidence hashes](evidence.json) record exact images and runner identities.

## Limits

This is production MCP playback/status plus production UI geometry persistence. MCP geometry dispatch was separately proven in development; no production /src imports, internal bundle hooks or arbitrary-tool test UI was used. Unknown raw MCP dispatch, native acceptance, blueprint/PDF exports and live provider inference are outside this slice. The preview correctly shows the assistant provider unconfigured and voice unavailable.

The tablet assistant is a full-width overlay over navigation, not a narrow right sidebar. The early paused playback screenshot is datum-grid evidence, not full wireframe geometry. The desktop playback image visibly includes the restored bottom controls, but no independent tablet drafting-dock clearance claim is made here; root owns that separate check.

Both final runs are clean. Earlier candidate failures and corrections remain in their original evidence folders; they have not been relabelled as final-candidate runs. Application session was released in Sketch at 1440 x 1000 with the assistant collapsed.

Report-only QA then opened the local HTML in that isolated browser: all seven embedded images loaded, all eight artifact links resolved on disk, and no horizontal overflow or text encoding issues were found. The opening and embedded-image report screenshots were inspected. Runner `2026-09-08T04-00-00-899Z-growth-takeover-final-71f5-mcp` passed eight report commands, excluded from the 130 application-command total. The browser currently displays the local report; saved application data is retained.
