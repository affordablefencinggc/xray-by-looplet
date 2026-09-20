# SC13-ORIENTED-10 - match beam checks to the rendered duct orientation

Requirement: SC-13 spatial coordination and red structural-clash highlights. This bounded correction is complete; SC-13 remains partial.

Source frozen as hvac4-440603927c1f, based on 94a7c98a. [Source manifest](../source/oriented-freeze.json), [exact code diff](../source/oriented-clashes.patch).

DANS1 execution: [machine results](../oriented-machine/results.json) 2075/2075 tests, TypeScript exit 0 and scoped lint exit 0 without warnings. Seven new behavior tests cover vertical tall sections, finite end caps, diagonal separation, sloping insulation, touching faces, near-vertical orthonormality/reversal, conservative round sections and zero-length solids. [Required build worker](../oriented-build/results.json) PASS. [Development browser](../campaigns/hvac4-oriented-dev1/output/browser-results.json) 41/41 PASS; [built browser](../campaigns/hvac4-oriented-built1/output/browser-results.json) 41/41 PASS, no browser errors.

Inspected screenshots: [vertical missed-clash correction, desktop](../campaigns/hvac4-oriented-built1/output/captures/oriented-vertical-hit-desktop.png), [end-cap gap, desktop](../campaigns/hvac4-oriented-dev1/output/captures/oriented-end-gap-desktop.png), [sloping insulation clash, tablet](../campaigns/hvac4-oriented-built1/output/captures/oriented-slope-hit-tablet.png), [removed insulation clears the beam, tablet](../campaigns/hvac4-oriented-built1/output/captures/oriented-slope-clear-tablet.png), [round conservative label, tablet](../campaigns/hvac4-oriented-dev1/output/captures/oriented-round-conservative-tablet.png).

Implementation uses the installed Three.js OBB separating-axis implementation against axis-aligned declared beam bounds. Preview and checks share one orthonormal frame; endpoint caps stop at the declared endpoints. Touching surfaces count as a clearance issue. Round runs are screened with enclosing boxes and labelled potential clashes. No cylinder-solid, fabricated fitting, hydraulic, native or deployment acceptance is claimed. Existing dev reload failure and remaining full-ledger work stay open. No live Jev call; this is deterministic geometry.
