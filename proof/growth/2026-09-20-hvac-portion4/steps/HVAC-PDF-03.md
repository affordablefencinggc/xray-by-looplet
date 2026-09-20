# HVAC-PDF-03 - actual exported PDF visual readback

Requirement: SC-14 exported commissioning PDF is readable and reflects the actual sealed draft.

Product source: `7f043fe6`, HVAC schedules module unchanged in freeze2. [Exact implementation diff](../source/stage1.patch). PDF bytes are the actual application Blob export from the successful 136-operation production campaign, captured in bounded chunks and reconstructed without modifying bytes.

Executed DANS1 [PDF.js readback](../campaigns/hvac4-pdf-readback2/output/browser-results.json): 7/7 operations pass; served PDF SHA-256 matches [expected digest](../pdf-readback/expected.json); all pages rendered (1 page); every text bound within physical page; expected equipment, unknown pressure, untested commissioning, clash and integrity content present; zero browser errors. The first readback attempt hit a missing favicon on the external proof viewer; the viewer was fixed, failed receipt preserved. Poppler was unavailable; repository's existing PDF.js readback approach was reused.

Inspected [desktop screenshot](../campaigns/hvac4-pdf-readback2/output/captures/hvac-pdf-desktop.png) and [tablet screenshot](../campaigns/hvac4-pdf-readback2/output/captures/hvac-pdf-tablet.png). [Actual PDF](../exports-built1/hvac-commissioning-draft.pdf), [CSV](../exports-built1/hvac-commissioning-draft.csv), [sealed JSON](../exports-built1/hvac-commissioning-draft.json).

Scope: readable draft export, not a commissioning certificate. It contains design flows and +/-10% target ranges, no invented measured results. Missing allowance remains unknown. Beam checks are conservative. Unicode beyond the built-in font is substituted in visible PDF text, while the attached original JSON preserves it. This completes visual readback for this bounded fixture, not all SC-14 acceptance or native/deployment certification.
