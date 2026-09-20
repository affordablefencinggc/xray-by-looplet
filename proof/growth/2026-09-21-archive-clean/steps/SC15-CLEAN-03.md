# SC15-CLEAN-03 — corruption rejection, clean-storage recovery and tablet polish

Host: Daniel, authorized local execution. Base: d7bc0d60 on feat/closeout-sc09-remainder.

Bounded requirement: reject a ZIP containing a modified raw drawing; restore the exported controlled project after clearing the isolated test profile's localStorage and IndexedDB; correct archive controls and shared restore-review checkbox layout.

- [Exact code diff](../source/clean-stage.patch): shared checkbox styles now follow BackupRestoreReview wherever it mounts; Project Library buttons align their icon and label while retaining 44 px targets.
- [42/42 browser operations PASS](../trial1/browser-results.json), zero unexpected browser errors. [Launcher and owned-process cleanup PASS](../trial1/launcher-results.json).
- [Corrupted archive rejected](../trial1/captures/corrupt-archive-rejected.png): inspected. Raw SVG bytes were changed while the manifest hash remained original; the UI reported the SHA-256 failure and offered no restore preview. The localStorage snapshot remained identical.
- [Portrait tablet](../trial1/captures/clean-restore-tablet-portrait.png) and [landscape tablet](../trial1/captures/clean-restore-tablet-landscape.png): inspected. Checkbox is 20×20 inside a label at least 44 px high; buttons meet 44 px height, page has no horizontal overflow. Icons and labels align.
- [Restored workspace](../trial1/captures/clean-workspace-restored.png): the executed check verifies the original project ID, two annotations, one source and SHA-256 of the actual restored SVG bytes. The scenario guards its isolated seeded profile, unloads the app before clearing storage and fails if an unexpected database exists. User browser data is never targeted.

This is development proof for a small controlled SVG project. SC-15 stays pending: original DWG preservation, all record classes, real 20 MB PDF timing and production-build acceptance remain open. The 2,106-test gate from the base commit is historical to this CSS-only product change; the current changed behavior was tested in the browser, not by claiming a new full suite or build.
