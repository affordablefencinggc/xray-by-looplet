# Final production export and navigation proof

**PASS within the stated browser scope — build 71f5b012342b.**

The running build badge was checked in both isolated sessions. All six relevant source files match the exact worker source manifest.

- **Rapid PNG export: PASS.** Frame count 8 → 8; Solid Finish applied; 2,180 / 2,180 meshes visible. Actual PNG decoded and visually inspected.
- **Actual PDF download: PASS.** Five real A4 landscape image pages parsed, rendered and visually inspected; 33 supplied levels retained; truthful preview labels.
- **Bottom model navigation: PASS.** Zoom changes camera distance; Front and Rear place the camera on opposite Z sides; Reset restores its original distance.
- **Desktop and tablet reachability: PASS.** 1440×900, 1024×768 and 768×1024. All five navigation buttons, drafting buttons/select and assistant launcher meet 44×44 targets and hit tests. No drafting/top-toolbar overlap.

The control journey ran 66 commands in 5.222 seconds; the export journey ran 30 commands in 3.311 seconds. Both exited successfully with empty runtime error lists. Actual downloaded PNGs and all five PDF pages were inspected, as were the desktop and both tablet scroll states.

## Evidence

- [Self-contained illustrated HTML](acceptance.html)
- [Machine-readable acceptance and hashes](acceptance.json)
- [Actual download inspection](download-inspection.json)
- [Immediate PNG](downloads/2026-09-08-8095-pencil-final-01-01.png)
- [PDF](downloads/2026-09-08-8095-pencil-final-01-03.pdf)

Source archive: 71f5b012342be7887a29bbf051131b57e5ed998ada46c5c79b5c22cd1325f14c

Web archive: a128b1e411d3f8431f5ee22641e48e3e2f3321fb5c40a4885ec1537929576b00

- C:\Users\danie\repo\xray-by-looplet\proof\growth\runner\2026-09-08T03-56-55-380Z-growth-pencil-production-r4.log: 4 commands, 1.340 seconds, exit 0.
- C:\Users\danie\repo\xray-by-looplet\proof\growth\runner\2026-09-08T03-56-55-556Z-growth-pencil-controls-r4.log: 66 commands, 5.222 seconds, exit 0.
- C:\Users\danie\repo\xray-by-looplet\proof\growth\runner\2026-09-08T03-57-28-179Z-growth-pencil-production-r4.log: 30 commands, 3.311 seconds, exit 0.

## Scope limits

- This is a Windows production browser acceptance. Native package and macOS/Linux checks are separate.
- The PDF contains illustrative raster model projections with triangulation and occluded lines, not clean section drawings or editable CAD.
- The source fixture has 33 supplied levels. This does not claim a newly authored 52-storey multidisciplinary drawing package.
- The tablet drafting panel scrolls internally to preserve top and bottom controls; it still covers part of the model while open.

Earlier missing-navigation and toolbar-overlap screenshots are retained and labelled historical in the HTML. No app source was changed during final QA; no normal user data, phone testing, installation or paid provider calls were involved.
