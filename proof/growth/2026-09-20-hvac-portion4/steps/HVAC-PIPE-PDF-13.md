# HVAC-PIPE-PDF-13 - actual pipe export readback

Requirement: the exported commissioning draft distinguishes pipe service, outside/inside diameter, liquid flow and unknown values.

Product source: [exact diff](../source/pipe-coordination.patch), committed in 0933f492, frozen as hvac4-e671ee8bcecf. [Actual captured exports and hashes](../exports-pipe-built1/manifest.json): [PDF](../exports-pipe-built1/hvac-pipe-draft.pdf), [CSV](../exports-pipe-built1/hvac-pipe-draft.csv), [sealed JSON](../exports-pipe-built1/hvac-pipe-draft.json). Files were reconstructed without alteration from the real application Blob downloads captured in [production browser receipts](../campaigns/hvac4-pipe-built1/output/browser-results.json).

Executed on DANS1: [PDF readback](../campaigns/hvac4-pipe-pdf1/output/browser-results.json) 7/7 PASS. PDF.js verifies the served bytes match SHA-256 1946039252853ff47066068610bffc18981900ea59f2bb97c0cfd0137d6bff83, renders its one page and checks every text item's page bounds. Required pipe fields and draft/unknown/not-tested labels are present. [Desktop](../campaigns/hvac4-pipe-pdf1/output/captures/hvac-pdf-desktop.png) and [tablet](../campaigns/hvac4-pipe-pdf1/output/captures/hvac-pdf-tablet.png) screenshots inspected.

Calculation/package tests are part of the [2083-test machine gate](../pipe-machine/results.json); browser checks verify actual CSV/JSON values and service separation. PDF source is unchanged by the subsequent tablet-only table polish. This completes the bounded export-readback step, not SC-13/14: no measured commissioning, issued certificate, hydraulic loss, fabrication fitting or deployment acceptance is claimed.
