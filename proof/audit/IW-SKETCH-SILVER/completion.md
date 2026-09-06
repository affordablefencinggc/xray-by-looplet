# Sketch example, silver title bar and Live assistant

Completed on branch feat/model-wireframe-navigation. User authorized each change. No staging, commit, merge or push. Existing changes and credentials preserved.

The visible installed app was operated via Playwright/CDP and its real native Open dialog. MCP screen control was attempted and returned Transport closed; the fallback was disclosed. The user said go before the slow filming demonstration. The labelled practice source was imported beside Crown Wharf, calibrated with A-B = 6 m, and two real annotations saved: 20.008568 m perimeter and 3.000738 m divider (mouse-position precision), zero quantity runs. The second trace was realigned after the markup list changed the canvas size. These annotations do not construct CAD walls or establish stock quantities.

Live assistant is a recoverable bottom-right footer with an expanding source-context composer, real provider-configuration status, instruction suggestions, and a Sketch guide with a working practice-plan opener. Prepare review preserves the selected document ID/hash, page and prompt when opening the existing AI review workflow. It does not pretend to execute free-form chat, claim MCP connection, or send a drawing automatically. Removed the misleading M hint on Manual layer; M currently switches to Measure.

The native Windows title bar uses light silver #e2e6eb, dark text and a silver edge, preserving native window controls. Rendering was verified by inspecting the native window capture and 11,262 matching caption pixels. DwmGetWindowAttribute rejects readback of the color attribute here; the native rendered pixels are the successful verification, not that API readback.

Validation: typecheck passed; 652 existing tests passed; 2 new source-handoff tests passed; packaged and installed app each passed 4 multi-step UI scenarios, including actual Sketch calibration/trace/persistence and page-2 AI handoff; desktop and mobile built-app layout checks passed with no console/page errors. AI status in browser layout checks is an explicit fixture. No live AI interpretation was called by these tests.

Desktop NSIS build installed successfully. Previous executable backed up, expected Tauri bundle marker verified byte-for-byte, local-settings desktop shortcut retained. The user continued opening their own drawing after installation; their active source was left alone.

- Source changes: [code.diff](code.diff)
- Saved demo: [demonstrated-job.json](demonstrated-job.json)
- Visible demo: [finished Sketch](../../../screenshots/sketch-example/05-finished-on-screen.png)
- Assistant: [desktop](../../../screenshots/sketch-example/assistant/settled-desktop.png), [mobile](../../../screenshots/sketch-example/assistant/settled-mobile.png)
- Native chrome: [capture](../../../screenshots/sketch-example/08-native-titlebar.png), [pixel verification](titlebar-proof.json)
- Checks: native-qa.json, installed-qa.json, layout-qa.json, tests.log, assistant-unit.log, typecheck.log, build-final.log, bundle-identity.json.
