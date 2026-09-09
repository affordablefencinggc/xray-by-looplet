# Adversarial verification and fixes — assistant surface slices (2026-09-09)

Three read-only verifier agents reviewed the slices after implementation (each ran the unit tests and `tsc --noEmit`). Every major finding was fixed before the live proof; minor items were fixed where cheap and are otherwise listed as known limits. Evidence for the fixes: the unit suites (85/85 after the fixes), `tsc --noEmit` exit 0, and the Fast CDP runs in `README.md`.

## SC-14 rail mode — verdict REFUTED (2 majors) → fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | major | Docked panel at z-index 38 covered the Settings drawer (z 30), which renders in the same box; with settings open the rail controls are hidden, so rail mode could not be left | `assistantRail.css`: docked panel z-index 20 (below settings 30 and the seam controls 35/36) |
| 2 | major | The panel edge sat over the seam resizer (z 35) and both toggles (z 36): resizing and the exit toggle were barely reachable | Same z-index change; the seam controls float over the docked panel as they do over the rail |
| 3 | minor | `.live-assistant-panel { margin-bottom: 8px }` left an 8 px strip at the bottom of the dock | docked rule `margin: 0` |
| 4 | minor | Entering rail mode from a collapsed menu docked into a stale collapsed rect for one frame | rects carry `collapsed`; the dock effect ignores rects measured while collapsed |
| 5 | minor | Closing from the panel header focused the hidden launcher | focus moves to the "Exit assistant mode" toggle |
| 6 | note | `assistant-closed` action existed but was not dispatched | the close→exit effect now goes through `nextRailState` |
| 7–9 | note | restore path safe; toggle hit box 44×44 via `::before`; untested clamps | tests unchanged; clamps exercised by the live run |

## SC-15 canvas right-click menu — verdict NOT REFUTED (1 layout blocker) → fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | major (layout) | Menu and pick banner at z 60 rendered under the floating assistant panel (z 80) | `canvasContextMenu.css`: z-index 90 for both |
| 2 | minor | Unhandled rejection if the design could not be described (menu stuck "loading") | `.catch` falls back to a view reference |
| 4 | minor | A finished right press gated a later keyboard-invoked menu for 2.5 s | press cleared on pointerup/pointercancel |
| 5 | minor | Escape reached the plan's own key handler (dropped the active tool) | `stopPropagation` on Escape; Tab closes |
| 7 | minor | Programmatic drafts bypassed the composer's 1,500-character limit | `mergeDraft` respects `DRAFT_MAX_CHARS` (intent dropped first, then the draft is left unchanged) |
| 8 | minor | The dismissing click also drew on the plan | dismiss pointerdown is swallowed |
| 3 | minor | macOS/Linux fire contextmenu on mousedown (pan vs menu) | not changed — X-Ray is Windows tablet/desktop only; recorded |
| 6, 9–15 | minor/note | focus restore, scene re-parse cost on first part right-click, pointer-locked walk mode, blocked-session caption, a11y notes, test brittleness | recorded as known limits |

## SC-16 context guard + rich replies — verdict REFUTED (4 majors) → fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | major | The seeded handover note was parsed into clickable pills (would re-send past actions) | `ConversationView` skips entries starting with the handover prefix |
| 2 | major | Numbered "steps taken" recaps and headings became pills | `parseReplyOptions` only returns options when the reply asks for a choice (question mark / options / choose / which one / pick / prefer / let me know), before or after the list; recap test added |
| 3 | major | Provider caps (40 contents, 12 MB) fired while the meter said "ok" and no Continue button existed | `measureContext` returns tokens, bytes and count; `contextState` is full at ≥ 36 contents or ≥ 10 MB and warn at ≥ 30 / ≥ 8 MB; the "conversation is full" error counts as outstanding in the handover |
| 4 | major | Handover omitted `undo_architect_change` receipts | `isStateChangingTool` derives from the edit-tool set in `skills.ts` plus the prefix list |
| 5 | minor | Stale pills near-invisible but clickable | stale pills disabled |
| 6 | minor | A pill click consumed pending attachments | pills and inline answers send without attachments; attachments stay with the draft |
| 7 | minor | Focus after Continue was a no-op | effect keyed on a `continued` counter |
| 8 | minor | Live-region spam; meter without a role | suggestions moved outside the `role=log` region; meter is `role="meter"` with `aria-valuenow` |
| 9–10 | note | token maths, stop path, seed validity confirmed; untested hook/view branches | covered by the live run |

Additional QA aid added by the coordinator: `xray:assistant-context-floor` (localStorage, positive integer) raises the estimate to at least that many tokens so the warn/full states can be exercised in a real session; it can only make the guard stricter (`contextBudget.test.ts`).

## SC-18 assistant projects — verdict NOT REFUTED (one rare two-window race, two UI-state minors) → fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | major (rare) | Rollback removed the shelf slot unconditionally, so two windows shelving the same project at once could lose the winner's shelf copy when the loser's main-key CAS failed | `projectSwitch.ts`: the switch records each slot's previous value before writing and restores it on rollback (regression test "restores the shelf slot's previous bytes…") |
| 2 | minor | After the main-key commit the tidy-up (free shelf, tabs, registry) was unguarded; a throw left the store on the old project | recovery block is set immediately after the commit; the tidy-up is try/caught and still re-hydrates |
| 6 | minor | The composer stayed enabled while a switch was in flight | textarea and send are disabled while `switching` |
| 8 | minor | Pill close button 36 px wide | 44 px |
| 3 | minor | Another window sees a switch as "newer revision of this project" (store.ts wording) | not changed — store.ts belongs to the other workstream; recorded |
| 4, 5, 7, 9–11 | note | crash windows recoverable but undocumented; unused registry helpers; hydration verified stale-free; corner z-order under the composer; tabs without roving tabindex; no DOM tests | recorded as known limits |
