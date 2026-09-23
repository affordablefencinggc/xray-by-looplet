# SC-03: HVAC development and production reload

Status: current scenario gates PASS.

The original 46-op scenario fails at op 29 before reload: it changes a junction to reducer without a declared fitting reference/dimension. Diagnostics also show the current conservative fitting envelope requires more than the old ceiling void. Preserve that failure; it is not the historical reload timeout.

The versioned current fixture explicitly declares a synthetic 1 m reducer with collinear legs and 0.6 m ceiling voids. It retains zero-issues, zero beam-clash, export, saved-edit and reload assertions. It does not relax application validation or claim real construction dimensions.

DANS1 development 46/46 and production 46/46; newer full fitting edit/export/reload scenario 75/75. [Old fixture diagnostic](../hvac-46-diagnostic-results.json), [current dev](../hvac-46-dev-results.json), [current production](../hvac-46-production-results.json), [75-op report](../hvac-current-results.json), [inspected screenshot](../captures/hvac-46-dev-reloaded-tablet.png), [exact fixture diff](../changes.diff).

No HVAC product-code fix; current source matches the prior native/web build. Hydraulic/engineering qualification and remaining SC-12/13/14 work are unchanged.
