# SC11-PDF-04 — Reopen the mounted app's disk-downloaded PDF

Result: **PASS, 47/47 browser operations, zero browser errors** on DANS1. Five PDF pages rendered and inspected at desktop 1600×1000 and tablet 1024×768. This is the PDF downloaded from the real mounted QS package panel, not a sidecar export.

## Requirement and source identity

SC-11 requires a complete cost-plan PDF with transmittal, classification breakdown, basis, assumptions/exclusions, revision variance, source/rate audit, and SHA-256 readback. This step proves the exported PDF's disk identity and rendered pages. The mounted export/ZIP reopen/explicit worksheet restore are separately recorded by the 379-op application campaign.

- Product snapshot: `sc11-c9b41fd82e89`, source digest `c9b41fd82e892df8d8630ed73dc48c94f1208aa51058c7bf2a9fb1d723bd6ba7`, based on `6f82b9340b2fd33d195c78ee9029cc4deee84644` plus the [named product diff](../sc11-mounted.source.diff), SHA-256 `8df0f257bbea2f83f0c19ec42551a056ccb86172a8fe5b466335d300b77b9fdd`.
- [Actual disk-downloaded PDF](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/downloads/pdf/cost-plan-r4.pdf): **12,728 bytes**, SHA-256 **`0fa7fcfe2bacdbc065f66d8f23dac565947095ae8635a5f4073bf753931213ef`**.
- [Application disk inspection](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/download-inspection.json) independently checks the separately downloaded PDF and CSV match the corresponding ZIP entries.
- Frozen source's 1,244 manifest entries were checked before and after this readback; no application source changed. No product PDF-renderer edit was made for this step.

## Executed command and receipts

After the mounted application campaign completed successfully:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\danie\XRayBuilds\sc11-mounted-pdf\sc11-c9b41fd82e89-pdf2\input\run-pdf.ps1 -Campaign C:\Users\danie\XRayBuilds\sc11-mounted-pdf\sc11-c9b41fd82e89-pdf2 -Source C:\Users\danie\XRayBuilds\preflight\sc11-c9b41fd82e89\source -BrowserOutput C:\Users\danie\XRayFastCdp\runs\sc11-c9b41fd82e89-mounted-dev2\output
```

[Worker source](../machine/run-pdf.ps1), [worker result](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/results.json), [browser results](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/browser-results.json), [exact scenario](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/pdf-render.scenario.json), [PDF identity](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/expected.json), [renderer manifest](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/renderer-manifest.json), [returned evidence manifest](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/sha256-manifest.json).

The canonical raw-CDP runner executed the scenario on DANS1, 2026-09-19 15:26:46–47 UTC. PDF.js 6.3.289 read the actual downloaded bytes; PDF-lib counted pages from those same disk bytes. No PDF was regenerated. The existing server helper was copied byte-for-byte to `preview-built-sc11-pdf.mjs` to satisfy the canonical launcher's existing-preview recognition; the launcher was not weakened or edited.

Checks cover exact SHA-256, all five section headings, source/item identities, preserved full exact measurement, page footer numbering, all extracted text within physical page bounds, nonblank rendered pixels, canvas containment at both viewports, and zero runtime/browser errors. Page 3's quantity cell contains `5.99999993095` followed by `5706` on its next line; geometrically bounded reconstruction is exactly `5.999999930955706`, with no tolerance or rounding.

## Individually inspected screenshots

Both the PDF proof agent and root inspected all ten returned images. No clipping, overlap, missing page content, or ambiguous row boundary was observed. The long decimal wraps inside the same bounded quantity cell, above the row separator.

| Page | Desktop 1600×1000 | Tablet 1024×768 |
| --- | --- | --- |
| 1 — Executive summary/transmittal | [Desktop page 1](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-01-desktop-1600x1000.png) | [Tablet page 1](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-01-tablet-1024x768.png) |
| 2 — Basis/assumptions/exclusions | [Desktop page 2](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-02-desktop-1600x1000.png) | [Tablet page 2](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-02-tablet-1024x768.png) |
| 3 — Elements and exact-quantity schedule | [Desktop page 3](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-03-desktop-1600x1000.png) | [Tablet page 3](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-03-tablet-1024x768.png) |
| 4 — Cost variance | [Desktop page 4](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-04-desktop-1600x1000.png) | [Tablet page 4](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-04-tablet-1024x768.png) |
| 5 — Source/rate audit | [Desktop page 5](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-05-desktop-1600x1000.png) | [Tablet page 5](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/captures/sc11-downloaded-pdf-page-05-tablet-1024x768.png) |

## Preserved failed first run and bounded harness correction

[PDF1 browser receipt](../pdf-campaigns/sc11-c9b41fd82e89-pdf1/output/browser/browser-results.json) remains **FAIL**, 3/47 completed, operation index **3**: `Exact measured decimal absent from exported PDF text after removing layout whitespace`. [Failure screenshot](../pdf-campaigns/sc11-c9b41fd82e89-pdf1/output/browser/failure-op-3-default.png) and all original inputs are preserved.

PDF text extraction emits neighbouring table cells between a multiline quantity's fragments. Concatenating the whole page was therefore the wrong assertion, despite the exact digits being present. With root's explicit approval, only the proof viewer and scenario generator changed: expose existing text item coordinates, identify the Quantity–Unit column and QS-WALL-A–QS-WALL-C row bounds, concatenate the selected cell fragments in visual order, and require the full exact decimal. No PDF bytes, product source, expected decimal, or acceptance tolerance changed.

- [Viewer telemetry diff](../diagnostics/pdf-harness/viewer-cell-telemetry.diff): old SHA `989329562340205cb54d89aff6f3b26dbcbb57daff3f0e7d22517f5395cc07f2`, new SHA `716bc7a25ad4eb95064719fc5657fe66a127078b89d510d0f3337eec7fa14c67`.
- [Quantity-cell assertion diff](../diagnostics/pdf-harness/quantity-cell-assertion.diff): old SHA `c59948068349c618bf39e9f32ca2cf5a57cf75d52205db13c56751a30d2ccbe3`, new SHA `21f7c93d9794055bc591cd34f0cdc8ee0f17b0aba8ee506d15328df926486e7e`.
- Both run input manifests and original/generated scenarios remain on disk. Returned manifest entries were SHA-256 checked before copying into this proof folder.

## Cleanup and limits

PDF2's owned server PID **16704** was identity-checked against creation time/executable/command, offered graceful closure, then terminated after recording diagnostics because no GUI window was available. Chrome PID **15212** exited through CDP; its context was disposed successfully. PDF1's server PID **9256** was likewise stopped. [Launcher cleanup](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/browser/launcher-results.json) and [server cleanup](../pdf-campaigns/sc11-c9b41fd82e89-pdf2/output/results.json) are preserved. A subsequent read-only DANS1 port check found no listeners on 8090 or 9338. Profiles and evidence were retained, not deleted.

Visible limitation: unsupported em dashes appear as literal `\u{2014}` in the PDF. Page 2 explicitly discloses this renderer behaviour; the original text is retained in the package JSON/CSV. This is not a claim of full Unicode typography support. The decimal and long identifiers use explicit line wrapping rather than shortened values.

Scope: same-version saved-draft package generated from controlled construction-run/supplier fixtures, desktop/tablet browser viewport rendering. Integrity is not source verification or professional approval. This does not prove physical-device, native executable, deployment, cross-version package migration, or room-area/roof-plane acceptance. PDF.js is the existing available renderer; no tools were installed and no new sidecar exporter was used.
