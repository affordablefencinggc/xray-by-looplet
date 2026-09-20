# HVAC-FITTINGS-PDF-17 - exported fitting schedule readback

Requirement: declared fitting identities, types and source references survive the actual sealed commissioning draft export.

Source: [exact diff](../source/fittings.patch), [frozen manifest](../source/fittings-freeze.json). Actual application downloads: [PDF](../exports-fittings-built1/hvac-fittings.pdf), [CSV](../exports-fittings-built1/hvac-fittings.csv), [sealed JSON](../exports-fittings-built1/hvac-fittings.json), [file hashes](../exports-fittings-built1/manifest.json). Full byte lengths were compared with browser Blob lengths when reconstructing capture chunks; no export was edited.

DANS1 [production download checks](../campaigns/hvac4-fittings-built1/output/browser-results.json) verify three fitting rows and three commissioning equipment rows. [PDF readback](../campaigns/hvac4-fittings-pdf1/output/browser-results.json): 7/7 PASS, SHA-256 ebf61ffffd31d3c8ee44f51fe53b1eedf8efc038b2cef857eb8660e15ce3df70. PDF.js renders the one-page actual file, verifies identity, checks required fitting/source/draft text and confirms every text item remains within physical page bounds. Inspected [desktop screenshot](../campaigns/hvac4-fittings-pdf1/output/captures/hvac-pdf-desktop.png) and [tablet screenshot](../campaigns/hvac4-fittings-pdf1/output/captures/hvac-pdf-tablet.png).

Complete for this export-readback requirement only. The package is unverified draft data with no measured commissioning, fabricated quantities, issued certification or deployment claim.
