# BK-R01 research evidence

Date: 2026-09-08. Branch observed: `feat/architect-cad-engine`.

## Scope

Public source acquisition and foundations-to-façade gap analysis. This is a research slice, not acceptance of any A–Z application requirement. Existing working-tree modifications were observed and preserved. All writes are confined to `research/burj-khalifa/`; the shared checklist and shared walkthrough belong to the other chat.

## Delivered files

- `README.md`: source register, evidence limits, staged work packages and acquisition failures.
- `drawing-request.md`: concrete, unsent document request.
- `acquire-sources.ps1`: acquisition procedure with overwrite protection, content checks and SHA-256 manifest generation.
- `sources/manifest.json`: acquisition results and original-byte identity.
- `sources/som-project.html`: retrieved SOM project page.
- `sources/besix-project.html`: retrieved BESIX project page.
- `sources/icc-typical-floor-plan.jpg`: retrieved published typical-floor illustration.
- `walkthrough.md`: this evidence record.
- `research.diff`: exact textual additions for review, excluding itself and downloaded third-party material. Downloaded bytes are identified in the manifest.

## Executed evidence

1. Read project instructions and X-Ray evidence doctrine; checked branch and working-tree status.
2. Queried and opened official project, architect, contractor, supplier and engineering-publication sources.
3. Direct engineering PDF retrieval attempts failed: domain/404 and DNS failures are recorded in README. No valid PDF was acquired or represented as an inspected PDF.
4. Ran `acquire-sources.ps1`: three successful acquisitions; official structures and Guardian direct downloads returned HTTP 403. Their web-readable information remains linked research evidence, not archived original binaries.
5. Recomputed byte lengths and SHA-256 for all three acquired files and compared them to the manifest: all matched.
6. Visually inspected the 300 x 234 ICC JPEG: Y-shaped typical floor diagram is visible; dimensions and calibration are absent. It is not an issued full-size drawing sheet and cannot support verified quantities.
7. Reviewed textual additions via `research.diff`. No application code or UI was changed; application builds and desktop/tablet render acceptance do not apply to this research-only slice.

## Result and limitations

Initial public source pack assembled. Full plans remain unavailable in the acquired material. Drawing-request draft is ready for review but has not been sent. No permission to publish third-party snapshots is assumed; retain them as local source evidence and use links/attribution for shared outputs.

All acquired documents are source class `web`, evidence state `unverified`, uncalibrated and not quote-ready. No source-backed takeoff, procurement quantity or price claim is made. No background app, server or browser process was launched by this research task.
