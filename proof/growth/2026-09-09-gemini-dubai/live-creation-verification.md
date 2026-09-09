# Canvas expansion and live Gemini creation — 2026-09-09

## Changes

- Draggable top/bottom divider hover is one solid black pixel line. Side rail hover uses the same black line.
- Fixed Sketch grid specificity: the right inspector had occupied the middle grid track, publishing a false seam at x=260 and expanding chat to 1180px on a 1440px viewport. Sketch now reserves the saved right-column width.
- Canvas focus expands the architectural workspace with its drawing tools, or the Model centre column with the left model navigation retained. The assistant remains at its saved width. Full-height panel stays square and flush to the bottom.
- Pencil controls respond to the width of their actual canvas column, wrapping the scrubber on narrow columns so playback, speed, finish and close remain available.
- Web Gemini failures distinguish response-length exhaustion, malformed tool calls and blocked/incomplete output. Rejected responses still execute no tools; completed earlier actions remain. Unknown provider diagnostics are not echoed.

Changed files in this step: src/studio/adjustableTopRow.css, src/studio/assistantRail.css, src/studio/canvasFocus.css, src/studio/draftsman.css, src/lib/assistantAi.server.ts, src/lib/assistantAi.server.test.ts. Preserve all preexisting working changes.

## Live provider results (real Gemini; no mocked creation)

Isolated test project: Gemini created an editable 8×6m two-storey pavilion in one small batch. Revision 2 contains 8 walls, two floor slabs and a pitched roof; Model rendered 29 parts. Gemini invoked show_design_in_model and draftsman_control play. DOM telemetry independently reported 29 meshes and five pencils.

Executed playback controls: replay, pause during wireframe ascent, increase pencil size, resume and finish. All 29 parts became visible. Screenshots inspected: five-pencils-wireframe.png and gemini-pavilion-complete.png under screenshots/gemini-dubai-capacity.

User's existing Edge tab, Dubai — Gemini canvas capacity: requested a single island ground slab and preserved existing geometry. Gemini reported a successful append/readback from design revision 4 to 5: one 8-point slab, illustrative 150×135m outline and 1.5m thickness; 15 walls and door D01 retained. The updated model was mounted and the pencil sequence started by Gemini. Independent DOM telemetry showed 48 meshes, five pencils, 48 visible meshes on completion. Clicked Open canvas and Page.bringToFront, then replayed the sequence on the user's screen. Chat remained 330px wide at x1718; canvas occupied x200–1718, preserving the left model rail. Visually inspected the live screenshot during wireframe ascent.

This proves real editable creation, saved-model extension, canvas mounting and animated drawing. The Dubai tower remains a coarse five-tier scaffold; no claim that three Dubai buildings, detailed facades, pools, water or greenery are complete.

## Checks and evidence

- 45 focused service/tool/rail/draftsman tests pass.
- Typecheck exit 0.
- Scoped lint: zero errors; existing WorkspaceRails dependency warning retained.
- Fast CDP local development verification per AGENTS.project.md local-first instruction; not DANS1 evidence.
- Live creation submission: runner/2026-09-09T09-27-37-578Z-gemini-work.json.
- Generated scene/pencil telemetry: runner/2026-09-09T09-28-29-257Z-gemini-work.json.
- 17-command pencil playback + black hover proof: runner/2026-09-09T09-29-55-510Z-gemini-work.json.
- 25-command final desktop/tablet canvas + resize + collapse proof: runner/2026-09-09T09-34-58-793Z-gemini-work.json. Tablet screenshot inspected; primary pencil controls fit the dock.
- Earlier failed runs retained: false Sketch seam, tablet resize expectation exceeding existing width cap, and hover targeting the separator underneath its handle. Corrected implementation/test targeting before final pass.
- Browser errors empty. Console warning: THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead. Existing Three.js renderer fallback warning; no runtime failure. No production build performed.

Cleanup: isolated gemini-work test browser closed at completion. User's Edge tab, Dubai project and active preview retained and left visible.
