# Independent live assistant dev QA

No application source edits. Existing isolated session `growth-authored-sheets-final2` was reloaded on dev8080 and waited for `[data-hydration-status=ready]`. No normal user profile, paid AI call, recording, practice-plan import or MCP execution was used. Only transient assistant drafts were entered; ordinary message text was not sent to a chat transport.

## Executed runs

- Open/ready inspection: 5 commands, exit0, 0.348068s. `proof/growth/runner/2026-09-07T20-29-43-025Z-growth-authored-sheets-final2.{json,log,scenario.json}`.
- Assistant journey: **39 commands, exit0, 1.207651s**. `proof/growth/runner/2026-09-07T20-31-10-312Z-growth-authored-sheets-final2.{json,log,scenario.json}`. Scenario SHA256 `ff915cebc6ef7c228a07e8da7e05f2aadf3d50018fa2f86ff08d75693b11fc83`.
- Expanded diagnostics: 8 commands, exit0, 0.1541144s. `proof/growth/runner/2026-09-07T20-32-13-810Z-growth-authored-sheets-final2.{json,log,scenario.json}`.

Reusable source scenarios are `pricing-agent-open.json`, `pricing-agent-journey.json`, and `pricing-agent-diagnostics.json` in this folder. They target the real Sheets pane with its visible right rail. The journey waits for the panel's animations to finish before initial geometry and screenshots; it does not use timed sleeps.

## Actual measured behavior

| Viewport | Visible rail / launcher / panel width | Right edge | Panel bottom | Composer bottom |
|---|---:|---:|---:|---:|
| 1440×1000 | 400px / 400px / 400px | 1440px | 914px | 901px |
| 1024×768 | 368.625px / 368.625px / 368.625px | 1024px | 682px | 669px |

The input composer remains 13px inside the panel bottom. Showing the Sketch guide and capability response, then scrolling the body, did not move the composer at either viewport size. All assistant buttons measured at least 44px in both dimensions. Panels stayed within the viewport.

Enter on `/mcp` displayed that MCP is not connected, assistant execution is unavailable and no tool has run; the recognized command cleared the input. Shift+Enter inserted a newline without submission. Enter on ordinary coordination text displayed the unavailable-transport explanation and retained the exact text. Collapse/reopen preserved that draft.

Expanded diagnostics showed `Development` as the build label and `Not connected to live assistant` as MCP status. This is distinct from a configured provider: the header legitimately showed `Gemini configured`, but did not claim chat/MCP execution was connected.

The fresh runtime error/unhandled-rejection monitor stayed empty. Browser `errors` and the cleared `console` outputs were empty on the assistant and diagnostics journeys.

## Screenshots inspected

- `screenshots/growth/live-assistant-pricing-agent-desktop-open.png`
- `screenshots/growth/live-assistant-pricing-agent-desktop-capabilities.png`
- `screenshots/growth/live-assistant-pricing-agent-tablet-guide.png`
- `screenshots/growth/live-assistant-pricing-agent-tablet-capabilities.png`
- `screenshots/growth/live-assistant-pricing-agent-diagnostics-status.png`

The assistant panel is opaque after its entry animation; text and controls are readable. Long body content scrolls behind the pinned footer/composer with no body content painted over the input. At tablet size the expanded floating panel extends into the upper navigation area while remaining on screen; its collapse control remains visible. No claim is made for other panes' rail configurations, production/native packaging, microphone/voice service execution, actual chat transport or MCP tool execution.

Session released with assistant collapsed and diagnostics expanded, viewport1440×1000. No application data records changed during this QA task.
