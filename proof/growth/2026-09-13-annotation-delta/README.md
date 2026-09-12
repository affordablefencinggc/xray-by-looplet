# Thin workspace row, Charcoal colours and revision annotation follow-up

User clarified the description belongs in the NEXT div below main tabs, requested a very thin tools strip, confirmed colours should update the existing Charcoal view, and asked to resume prior work after that correction.

## Changes
- Description centered in Workspace tools, alongside its left-hand controls. Main navigation is back to one line. Tools strip defaults to 32 CSS pixels of content (33 including the rendered border), with no separate bottom arrow gutter. Existing explicit heights lose that 18-pixel gutter once and then retain their resized height; collapsed states survive. The middle main-navigation row remains because its removal was tentative.
- Charcoal now has softer grey panels, warm light text, blue accents and dark input fields. Selected pill buttons have readable light text and a blue border. Cream remains supported.
- Continued D-15 review with separate drafting changes: lines, circles, arcs, grids, room tags, dimensions, section marker and project notes. New issues freeze notes. Annotation-only changes appear in the report and its summary while geometry/quantity totals remain unchanged. Missing historical notes are explicitly unavailable, never treated as blank or used to claim an identical revision.

## Evidence
- 112 architect tests passed; includes four new annotation tests for identity/order independence, adds/removals/field changes, historical isolation, annotation-only summaries and missing legacy notes.
- 44 final development CDP operations passed: 28 navigation/theme operations plus 16 annotation component-fixture operations. Desktop/tablet images inspected. The fixture executes the actual ArchitectSheets component with clearly synthetic saved issues; it is not a claim about a user's design.
- 11 migration operations passed: saved 90-pixel row becomes 72 exactly once, remains 72 after another reload, and Home resets to the thin default.
- DANS1 build e70f70c78376 passed typecheck, worker regression tests and production web build. 28 compiled-app operations passed for navigation, compact height, Charcoal settings/render and page switching; screenshots inspected. All ten task source hashes match the build snapshot. Annotation-specific UI interaction was development fixture proof, not a production/native fixture run.
- Browser launch, sandbox-diagnostic and navigation failures were rejected; representative evidence retained. A slash-format mismatch in Edge launch cleanup was resolved by comparing the exact recorded PID, creation milliseconds, executable and command before closing the owned process. Final accepted Chrome runs retained sandbox checks.

## Recovery and scope
Source list: FILES.md; code diff: changes.patch. Navigation diff starts before the caption iterations; other existing-file diffs start at this follow-up. Pre-existing and concurrent work retained. No commit, push, install or release. Owned browsers, tunnel and remote preview cleaned with identity receipts; existing user preview PID 57888 remains. Broader D-15 and native/cloud acceptance remains open.
