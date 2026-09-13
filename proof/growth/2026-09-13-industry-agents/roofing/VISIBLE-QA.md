# Roofing: actual live-assistant QA on DANS1

2026-09-13, one read-only model request; no retries. Verdict: **inspection works; roofing takeoff remains unproven and capability explanation incomplete**.

Host verified `dans1`. Existing user-visible Edge, CDP loopback 127.0.0.1:9341, target `5109CD8477EBCCE9F4120D7C41B7DA12`, project `job-49e99a2e-4d40-4a80-ba85-40a5b9df1141`. `browser-owner.txt` records Edge PID 13316, creation time and exact launch command. The worker reused this browser and the root-owned preview tunnel. No browser, context or tunnel was created/stopped. Raw-CDP foreground runners closed their sockets and exited. Browser is retained for active user/root viewing; last worker activity 2026-09-13T09:05:38Z.

The single prompt in `send.json` asked for an actual project/tool inspection, whether a source-backed pitched-roof takeoff could run, actual executed actions and a developer review. It prohibited edits and invented measurements. Permissions were switched through the UI to Read only before sending once.

## Actual evidence

`receipts.json.result.json` contains the persisted assistant conversation including full tool results. Six actual receipts match the response's execution list:

1. `read_workflow_route`: inspect route, no geometry/evidence/authority changed.
2. `read_project_context`: New project revision 1, sheets pane, no annotations/traces/items, architect controller unavailable, saved revision 1.
3. `read_source_sheets`: available false because source is bundled sample. This was an unavailable read, **not an executed attempt to organise sheets**.
4. `read_takeoff_evidence`: placeholder source SHA null, unlocked unverified calibration, no traces/items. Three blockers: document, calibration, runs.
5. `read_assistant_file`: no files.
6. `read_price_books`: zero books and worksheet lines.

Complete before/after project objects compare identical (JSON serialization equality), revision 1. Source remains No source plan, no runs/gates/BOM/quote. `before.json.result.json` and `receipts.json.result.json` contain the comparison inputs. Assistant chat history and permission preference changed as expected; project did not.

## Fact-check versus developer overview

Correct: no source-backed takeoff was possible with the inspected placeholder source and unlocked scale. No source, dimensions or successful takeoff was fabricated. All six claimed tool calls have persisted receipts. The Developer review was actually returned.

Incomplete: the answer does not state whether the tools support roof pitch development, true surface areas, unequal-pitch hip/valley lengths or sheet layout. It implies importing, calibrating and tracing are the remaining path, while the isolated roofing area helper is not wired to assistant tools. The prerequisite list alone is not proof of roofing capability.

Misleading phrasing: it describes `read_source_sheets` as having “refused to organise”; the call was a read, and no organising action was requested or run. It also says prerequisites cannot be supplied “through tools”, although the listed calibration tool can apply a user-stated known distance once an actual source exists. The missing input should be distinguished from tool unavailability.

Developer review says “Friction: None in execution” and focuses improvement on opening with yes/no. It misses the incomplete roofing capability explanation and redundant action-like pills. The rendered UI turns ordinary blocker and executed-tool lists into eight numbered suggestion pills plus Other; the screenshot shows these occupying much of the chat. No pill was clicked.

## Visual proof and limits

- `before.png`: actual empty project and assistant before request.
- `after.png` and `developer-review.png`: completed response at original tiled width.
- `desktop-review.png`: resized window with redundant pills visible, captured and visually inspected (1256×761 content).
- `desktop-developer-review.png`: actual developer section, captured and inspected; final target viewport 950×900 after shared desktop arrangement changed. No fixed-1280 acceptance claimed.

Only this empty-project read-only inspection was tested. No source import, measured geometry, drawing action, successful roof-area workflow, production build or installed package was tested. Root owns shared fixes and follow-up with real evidence.
