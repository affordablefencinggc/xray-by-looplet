# Roofing worksheet visible QA — 2026-09-13

Manual worksheet PASS; assistant comparison BLOCKED by model tool-call omission.

Executed on DANS1 in the existing visible Edge target 5109CD8477EBCCE9F4120D7C41B7DA12, CDP 9341. Existing QA job job-49e99a2e-4d40-4a80-ba85-40a5b9df1141, revision 1. No source edits during this QA. Source hashes captured in form-browser-source-hashes.json remained identical through final readback.

At 10:15 UTC opened Estimate and blank Industry worksheets; root paused entry for shared HMR. After freeze, stale page required one reload; no inputs had been entered before recovery. Frozen checks ran 10:18–10:24 UTC using form-browser-runner.mjs. Initial open used the remote visible-qa runner, preserved before extension under the new runner name (original SHA256 299DC4394736B6D35B47B6E8DC6D0A0FF6DDADF2DBBA5D821772A16D9373A522). Historical local visible-qa.mjs was restored to exact HEAD bytes.

## Observed manual behavior

- Blank calculation shows an explicit area error and no result.
- Real DOM input/change events entered Synthetic QA roof, horizontal area 100 m², pitch 0°, explicit synthetic area/pitch references, and Synthetic QA opening, horizontal area 5 m² with synthetic reference.
- Calculate shows gross 100, openings 5, net 95 m²; clearly draft and not eligible for verified quotes.
- Editing gross area to 101 immediately removes the stale result. Restoring 100 and recalculating returns 95.
- Switching to HVAC and back retains all input values and result. Reload retains them again with data-draft-save=saved.
- Tablet 1024×768: document width 1024; all field horizontal bounds inside viewport. Visually inspected tablet fields/result and desktop final screenshots: readable, no horizontal clipping. Vertical form scrolling is expected.
- Final exact project JSON equals the initial project; no geometry, calibration or quote mutations. Only draft form storage and requested assistant messages changed. Final screenshot leaves the working 95 m² form result visible.

## Actual assistant failure — not a worksheet failure

Prompt 10:20:13.369Z explicitly supplied the observed synthetic inputs and asked for the real calculator tool. Packet 93480e0d-0b26-4a2f-9efa-89c71361ec41 contains zero tool calls, two unreviewed model text responses and a blocked checkpoint. Model text falsely claimed executed calls and a matching result; the execution gate withheld those claims. No current-turn Developer review was delivered.

Root authorized one concise retry at 10:21:41.490Z. Packet 8e9cdaa1-fc21-4cdb-9ab2-bda70124dd36 again contains zero tool calls, three unreviewed model text responses and a blocked checkpoint. Internal correction explicitly instructed actual requested-tool execution with supplied operands and showed current-turn outcomes []. Checkpoint still requested workflow selection, but the model called neither router nor calculator. No runtime route rejection or budget-exhaustion event establishes a calculation failure. Provider answered with text instead of tool calls; this is an execution reliability issue.

Visible error: “Requested tool calculate_draft_roof_area was not executed in this turn; no successful result was verified. Unsupported execution claims were withheld.” Older 09:45 successful receipts are preserved history and do not prove either new request. The intermediate *model-review.png captures may show that older review; use model-retry-failed.png and current packet journals for the new outcome.

Reload preserved exact conversation entries and blocked error. Final checks in form-browser-checks.json show projectEqual, chatEntriesEqual, errorRetained, sourceHashesUnchanged all true. Captured scenario errors arrays are empty. No further model retry was sent.

## Evidence

- form-browser-fill.json.result.json — blank rejection and actual input/result receipts.
- form-browser-edit-reload.json.result.json — invalidation, recalculation and worksheet switching.
- form-browser-persist-tablet.json.result.json and screenshots — reloaded form and tablet geometry.
- form-browser-model-retry.json.result.json — complete first failed packet journal before retry.
- form-browser-model-final-journal.json.result.json — complete retry packet journal.
- form-browser-model-retry-failed.png — actual new blocked message.
- form-browser-final-persisted.json.result.json — final archive/project/form readback.
- form-browser-final-visible.png — user-visible working worksheet left open.

Scope is a manually entered draft roof-area worksheet. No source-linked takeoff, geometric overlap checks, product quantities, waste, drainage or compliance qualification is claimed.
