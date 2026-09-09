# Prepared production MCP/UI acceptance

Status: prepared only. No browser launch, application edits or build performed for this preparation. Command counts below are planned and must not be added to passed acceptance totals until runner results exist.

Target: `http://127.0.0.1:8093/` after root confirms the verified release preview/tunnel is ready.

Use a new isolated persistent session, suggested name `growth-takeover-production-mcp`. Do not reuse the normal application/browser profile. Run both scenarios in order in the same session. The second depends on the first's saved test workspace and its default collapsed assistant. If a scenario fails, preserve its runner evidence and adapt a uniquely named resume scenario; do not blindly rerun the fresh-design guard against the now-populated fixture.

```powershell
node scripts/fast-cdp-test.mjs growth-takeover-production-mcp proof/growth/2026-09-08-gemini-takeover/production-mcp-ui-01-design.json
node scripts/fast-cdp-test.mjs growth-takeover-production-mcp proof/growth/2026-09-08-gemini-takeover/production-mcp-ui-02-assistant.json
```

## Fixture setup

No uploaded file, credentials, provider turn or external message is required. Scenario 01 opens the fresh automatically persisted job, enters Architectural workspace, refuses a pre-existing populated design, and uses the actual **Load demonstration** UI to create the Courtyard fixture. It reads the real architecture local-storage record for verification only. All product mutations use UI controls and pointer events on the real plan SVG. The only direct storage write is a QA-only sessionStorage expected-state marker.

Scenario 02 uses the actual **Explore & Draw 3D Model** UI for the prepared Redburn reconstruction. The bundle must serve its normal prepared-model assets. This preview is disclosed reconstruction geometry; matching or importing the original PDF is not required or claimed.

## Planned coverage

- `production-mcp-ui-01-design.json` — 53 commands: real UI reference-line creation and automatic verified save, existing-wall preservation, undo, redo, exact saved-state reopen with durable job identity, another edit/undo after reopening, then a second reopen. Screenshots capture the drawn and reopened workspace. Final fixture retains the Courtyard demo plus one added reference line.
- `production-mcp-ui-02-assistant.json` — 77 commands: `/mcp` real discovery of all ten current tools; settled assistant width/right-edge match to the visible right rail at 1440x1000 and 1024x768; composer remains at the panel bottom while guide/capability content scrolls; 44px buttons; Shift+Enter newline and draft retained through collapse/reopen. `/draw`, `pause drawing` and `/draftsman` are the implemented local command aliases that call real MCP without a provider turn. Immediate play receipt and live status are checked. The real UI closes the draftsman; subsequent MCP status must be inactive/null. `/draw` in Sketch must fail without implicit navigation.

This separates **production MCP playback/status** from **production UI geometry persistence**. Production drawing/save/undo dispatch through MCP is not claimed by these UI-only scenarios. The development MCP transport already verified those operations. The production app does not expose a public arbitrary-tool invocation UI; these scenarios do not import dev `/src` modules, discover minified internal exports or add test hooks.

There is currently no local `/exit` alias. Closing uses the real **Close Draftsman mode** button and validates its effect via MCP status. Unknown/unsupported tool dispatch remains covered by the development MCP tests; arbitrary unknown chat text is not sent here because it would invoke the configured provider. Regular draft text is never submitted. No Blueprint suggestion, external search, attachment upload, voice or paid model request is executed.

## Proof requirements

Runner creates exact scenario copies, hashes, results and raw logs. Inspect the produced `screenshots/growth/takeover-production-mcp-*.png` files before acceptance. Preserve failures and record whether a failure is application behavior, missing release assets or a test assumption. These prepared scenarios have not yet been executed against production and therefore carry no pass claim.
