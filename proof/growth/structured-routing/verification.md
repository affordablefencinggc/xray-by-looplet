# WR-01 — structured Live assistant routing

2026-09-10 Brisbane. Implemented and tested in the development app. No package build, installation, deployment or commit.

## Behaviour

`read_workflow_route` selects one of six versioned processes: discussion, inspection, architectural creation/editing, takeoff, rendering and export. Gemini interprets the user's intent and selects the process; the governed chat runtime enforces its tool prerequisites. No keyword-based guessing supplies geometry or permissions.

- Prerequisites run before an edit-permission prompt and before any pending mutation is recorded. A deferred call receives a structured `not-executed` receipt with the required tool, arguments and reason.
- Architectural actions require current project context, a mounted controller and a successful current-revision design read. Each completed edit invalidates earlier design/readback/image receipts. The final authored result requires a new read, current Model mount and actual image capture, or an explicit failed/refused outcome.
- Source/takeoff routes require the current source register and evidence for the target sheet. Project, source, design and active-sheet changes invalidate relevant observations. Existing calibration, source identity and authority gates remain responsible for validating actual measurements.
- Rendering requires capture of the requested view. Exporting requires the corresponding design or sheet record and an actual delivery receipt.
- A proposed final answer that omits selected workflow obligations is withheld and returned to Gemini with the missing step. Two consecutive ignored corrections stop with a saved checkpoint. Actual errors and refusals are recorded as blocked rather than forcing indefinite retries. Discussion does not require geometry edits.
- The work packet persists routing state and the audit events retain actual receipts, deferrals and completion checks. Older packets without routing state remain readable.
- The stale 25-operation workbench reference now uses the same 200-operation constant as draw/edit validation and tool schemas.

This is orchestration of existing tools. It does not implement procedural geometry, arrays, parametric regeneration, engineering checks or a general claim-verification engine. Selecting a route is not permission; successful tool/image receipts are not engineering approval.

## Executed proof

| Check | Result |
| --- | --- |
| Focused routing, conversation, work-packet and app-tool tests | 54 pass |
| Main regression suite | 990 pass, 89 suites, zero failures |
| Final typecheck | exit 0 |
| Final scoped ESLint | exit 0, no output |
| Browser preflight regression | Missing route deferred before permission/execution; controller recovery directed; stale readback prevented; premature final corrected; declined edit did not run or leave uncertainty; audit verified |
| Real Gemini creation | Selected architecture route and created a two-level pavilion through tools; eight walls, nine openings, two slabs, one roof |
| Live skipped step | After changing a level, Gemini attempted another draw without fresh readback. Router deferred it; Gemini read the new revision and continued |
| Real Gemini follow-up edit | All eight windows widened from 1500 to 1800 mm; stable IDs, centre offsets and all unrelated geometry preserved |
| Reload | Exact final design and both work packets preserved; both journals verified |
| Browser errors | No uncaught errors recorded; existing Three.js PCFSoftShadowMap deprecation warning remains |
| Cleanup | Owned browser closed, zero remaining profile processes; user development server retained |

The first synthetic browser fixture incorrectly read an unsaved default project's generated level ID from persistence instead of the live design tool. The controller correctly rejected it. The fixture was corrected to use the tool receipt, then passed. The independent window-centre check initially treated offset as an edge; engine/model code defines it as the centre distance. That checker was corrected and now independently checks against half the host-wall length. Neither was a Gemini defect.

## Evidence

- [Exact implementation diff](implementation.diff) and [source identities](source-manifest.json).
- [Actual tool sequences](executed-routes.json).
- [Live creation with packets/events](live-build.json), [follow-up edit](live-edit.json), [independent change checks](live-validation.json).
- [Reload proof](reload-proof.json).
- [Desktop](../../../screenshots/structured-routing-desktop.png) and [tablet](../../../screenshots/structured-routing-tablet.png) screenshots, visually inspected.
- Browser regression: `../runner/2026-09-09T14-39-46-182Z-structured-routing.log`.
- `full-tests.txt`, `focused-tests.txt`, `typecheck.txt`, `lint.txt`, `cleanup.json`.

## Changed files

New: `src/studio/assistant/workflowRouting.ts`, `workflowRouting.test.ts`.

Updated in that directory: `workPacket.ts`, `workPacketRuntime.ts`, `useAssistantChat.ts`, `conversation.ts`, `conversation.test.ts`, `appTools.ts`, `appTools.test.ts`, `architectBridge.ts`, `skills.ts`, `workbenchStructure.ts`. `package.json` registers the routing tests. Task evidence and checklist/walkthrough entries are separate from these source changes.

## Remaining limits

The model still selects intent and plans geometry; the router supplies and checks process rather than proving every natural-language requirement. Capture establishes that pixels were returned, not that Gemini's visual assessment is correct. The enforcement applies to governed Live assistant turns; direct UI actions retain their existing tool validation. The real-provider proof covers architecture creation and editing; takeoff/render/export route prerequisites have deterministic test coverage, not new end-to-end provider acceptance. Tablet Model controls remain crowded with both rails open. No production/native acceptance or construction-ready claim.
