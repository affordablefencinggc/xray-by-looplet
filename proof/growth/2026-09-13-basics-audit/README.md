# Edge manual basics audit — 2026-09-13

Status: core manual journeys and development/compiled desktop-tablet verification passed. Revision overlay continues separately.

Browser: user's Edge, separate task tab at 127.0.0.1:8091, viewport 1440×900. Original localhost:8080 Terrace Court revision 3 reopened from its library after the earlier native prompt left a New project active. Test project: QA — basic drawing and takeoff.

Executed through visible UI:
- Opened New project in an in-app dialog, saved and created, renamed test project. No browser confirmation.
- Loaded Redburn BR250157.pdf (13 pages), navigated page 3. SHA-256 b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38.
- Entered 6.31 m known dimension, picked two endpoints, selected candidate and locked scale. Approximate pointer placement is interaction proof, not a surveyed measurement.
- Drew and committed four-point Area: 6.55 m², visible outline and evidence row.
- Drew and committed Run 01: 8.53 m. Undo removed it; redo restored it.
- Expanded compact Saved views, saved QA ground detail, navigated page 4, restored saved view: page 3, locked scale and zoom restored.
- Design / Sketch & redesign / Source annotations: drew and committed Manual trace: 6.52 m.
- Architectural workspace: drew Wall 1, changed length to 6000 mm and height to 3000 mm. Material face quantities: 18.000 m².
- Placed door D01 (900×2100 mm) on Wall 1. Schedule showed host, dimensions and swing. Material face quantities updated to 16.110 m² (18 - .9×2.1).
- Visually inspected live 3D wall and expanded architectural layout after removing unused right column. Screenshot in conversation.
- Estimate displayed run and required trade/source evidence; did not fabricate an approved quantity or prices.
- Visualise: loaded Crown Wharf preview, confirmed source-unverified classification. Opened walkthrough, selected Level 01 from left rail, clicked clear spot, moved pointer to aim 90°, clicked again to enter, Escape returned to orbit. Screenshot and accessibility proof in conversation.
- Visualise AI rail button opened connected assistant and focused composer; exit rail and collapse assistant worked. No AI message sent.
- Reloaded test project: original PDF, sheet selection and all three annotation/measurement rows restored.
- On uncalibrated page 4, Run/Area/Gate disabled with explicit scale instructions; Known distance enabled after PDF load.

Fixes:
- Native New-project confirm replaced with WorkspaceDialog with busy/error handling.
- Saved views collapsed by default into one disclosure.
- Design navigation exposes Sketch & redesign.
- Measurement tools require locked scale, avoiding misleading legacy-coordinate error on fresh pages.
- Architectural grid reserves external right column only when an actual external rail exists.
- Fixed Windows case-insensitive module-name collision between overlay UI and geometry helper (renamed helper and explicit TSX import).

Validation: npx tsc --noEmit exit 0. Focused node tests: 18 passed, 0 failed (calibration, overlay geometry, site-file validation).

Limitations: this is a core-journey audit, not exhaustive qualification of every CAD command, provider, export format or pricing import. AI generation was not invoked. NCC reference files have not yet been supplied. Broader release review remains pending.

## Final verification
- DANS1 source snapshot 2f46514c2abd7cc98543e343c5511d47c037f1da0020bb00892dae86c9c293af: dependencies, typecheck, focused tests and web build exit 0. See build/completion.json.
- Development and compiled browser campaigns: 38/38 operations each, PASS. Screenshots inspected at 1440×900 and 1024×768. See dev-final and production.
- Two initial custom scenario errors (illegal return and redeclared local) corrected in test code; failed evidence retained in dev and dev-recheck.
- Checks issue navigation opened the correct run specification; supplying QA-labelled trade/source made 8.53298497 m available in Estimate, still draft.
- Original preview briefly had no listener and a stale PDF worker; after the existing server returned, reload recovered the PDF. No project evidence edited. Toolbar reset to compact 32 px using its UI reset.
- Task Edge tab closed and temporary viewport reset. Automated browser helpers, remote production preview PID 15512 and tunnel stopped. User previews retained.
