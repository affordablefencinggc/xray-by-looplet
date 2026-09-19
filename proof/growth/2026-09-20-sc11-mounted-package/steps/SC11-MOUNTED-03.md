# SC11-MOUNTED-03 — real worksheet download, reopen and restore

Requirement: mount the cost-plan package panel in the real QS worksheet, download actual files, reopen the disk ZIP with SHA-256 checks, require explicit restoration, and reject changed bytes without promoting draft evidence.

Result: **PASS 379/379**, zero unexpected browser errors, on DANS1. The unchanged 297-operation SC-10 setup is followed by 82 SC-11 operations. This is a development-app result, not production/native/deployment acceptance.

## Source and exact command

[Six-file product diff](../sc11-mounted.source.diff), based on `6f82b9340b2fd33d195c78ee9029cc4deee84644`; [source manifest](../machine/source-manifest.json), frozen source `sc11-c9b41fd82e89`, all 1,244 input hashes unchanged before and after the run. Neither shared IndustryDraftWorkbench nor IndustryDraftHost was edited.

```powershell
ssh tonys-test-pc powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\danie\XRayFastCdp\runs\sc11-c9b41fd82e89-mounted-dev2\input\run-mounted.ps1 -SourceRun sc11-c9b41fd82e89 -RunId sc11-c9b41fd82e89-mounted-dev2
```

The invocation used an equivalent UTF-16 encoded PowerShell command over SSH. Bypass is process-scoped; no machine policy was changed. An earlier invocation without that process flag was rejected before the script ran and produced no browser receipt. The preserved `mounted-dev1` attempt stopped before app startup because its npm runtime directory was absent from PATH. `mounted-dev2` adds that directory explicitly; no product change was needed for either launch issue.

[Browser results](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/browser-results.json), [executed scenario](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/scenario.json), [application binding](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/application-binding.json), [download readback](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/download-inspection.json), [launcher and cleanup](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/launcher-results.json).

## Executed behavior

- Actual mounted panel prepares revision 4 with its predecessor, full worksheet, transmittal, estimate basis, assumptions, exclusions and saved-draft delivery record.
- Native download clicks produce ZIP, PDF and CSV. Chromium download events, received byte counts and disk hashes agree; the separately downloaded PDF/CSV exactly match their ZIP members.
- Reopening the actual downloaded ZIP verifies all seven payload members plus the manifest. Opening does not mutate the worksheet. The explicit confirmation gate starts unchecked.
- After a deliberate worksheet edit, explicit restore returns the entire original worksheet, including four immutable revisions and unchanged Unverified evidence, through the normal host. Save readiness and exact full-form equality pass again after reload.
- A separate ZIP with one PDF byte changed is rejected with `Package file cost-plan.pdf failed SHA-256 integrity verification.` No trusted manifest/restore is offered; original selected bytes are retained for inspection/retry; the saved worksheet remains unchanged.

## Download identities

| Download | Bytes | SHA-256 |
| --- | ---: | --- |
| ZIP | 100979 | `6f61a77dc1d75c15438d9fce1bbfeeaf18fd25673cae4202eb1a7058d37478d2` |
| PDF | 12728 | `0fa7fcfe2bacdbc065f66d8f23dac565947095ae8635a5f4073bf753931213ef` |
| CSV | 2187 | `d43dd506c8630b006bb41d79eaf60761a45d4b7c5dec3e48ac8bf808dfe221cb` |

## Screenshot review

Root inspected all 22 returned captures at their original desktop/tablet aspect ratios: the 14 retained SC-10 setup states plus these eight mounted-package states. Text and error boundaries are readable; tablet SHA values wrap inside the panel, confirmation is separate from validation, and draft/Unverified language remains visible. Input boxes naturally scroll long authored values. The worksheet table has a deliberate horizontal scroller on tablet rather than losing columns.

- [Mounted export details, desktop](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-mounted-export-details-desktop-1600x1000.png)
- [Prepared draft package, desktop](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-prepared-draft-package-desktop-1600x1000.png)
- [Disk reopen hashes, desktop](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-disk-reopened-sha256-desktop-1600x1000.png)
- [Disk reopen hashes, tablet](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-disk-reopened-sha256-tablet-1024x768.png)
- [Unchecked restore gate, tablet](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-explicit-restore-gate-tablet-1024x768.png)
- [Saved state after explicit restore, tablet](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-explicit-restore-saved-tablet-1024x768.png)
- [Tamper rejected, tablet](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-tamper-rejected-tablet-1024x768.png)
- [Tamper rejected, desktop](../campaigns/sc11-c9b41fd82e89-mounted-dev2/output/captures/sc11-tamper-rejected-desktop-1600x1000.png)

The restored-state screenshot shows the reset confirmation gate and normal save indicator; exact restored content and persistence are established by executed full-form comparisons and reload, not by the screenshot alone.

## Limits

This controlled construction-run fixture does not certify a real estimate or source geometry, send an external transmittal, prove room/roof families, or establish native/platform/deployment support. Same-version package reopening is proven; legacy PDFs generated by older layout renderers remain an explicit compatibility limitation. Separate all-page PDF rendering subsequently passed in [SC11-PDF-04](SC11-PDF-04.md). No newer broad full-suite pass is claimed.
