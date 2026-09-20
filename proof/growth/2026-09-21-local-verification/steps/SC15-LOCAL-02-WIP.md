# SC15-LOCAL-02 — portable archive local trial (WIP)

SC-15 remains pending. Archive source is committed at 3f4df26c1721ffe1498b154349af78bfaa7fcab5; [original exact archive diff](../../2026-09-20-sc15-portable/source/sc15-container-wip.patch). [This stage's source diff](../source/local-stage.patch).

The previously unexecuted archive tests now pass on Daniel: [19/19 manifest and ZIP tests](../machine/archive-tests.log). The full registered suite also passes 2,106 tests; see [local execution record](LOCAL-DEV-01.md).

The browser trial uses an isolated profile, a controlled SVG source and two annotations. It captures the actual export Blob, checks it through the archive reader, feeds that file into the UI, reviews restore impact, and requests journalled restoration. This establishes neither a real 20 MB PDF performance result nor full storage-wipe fidelity.

Historical attempts retained:
- [Trial 1](../archive-ui1/browser-results.json): 22/26, infrastructure failure when reload destroyed a pending readiness evaluation.
- [Trial 2](../archive-ui2/browser-results.json): 22/26, incorrect scenario expected the editor before clicking Open workspace. [Inspected screenshot](../archive-ui2/failure-op-22-default.png) shows the product reporting restored original files verified.
- [Restore review screenshot](../archive-ui1/captures/archive-restore-review.png) was inspected; it shows client, source counts, integrity verification and replacement review. The oversized reference-rates checkbox is a visible polish issue, not silently accepted as polished.

Final local trial: [29/29 PASS](../archive-ui3/browser-results.json), [process cleanup PASS](../archive-ui3/launcher-results.json). Visually inspected [archive controls](../archive-ui3/captures/archive-controls.png) and [reopened drawing](../archive-ui3/captures/archive-restored.png). The executed predicate verifies project ID, two annotations and original SVG hash after restoration. This is a successful controlled round trip into the same isolated workspace, not the full SC-15 fidelity campaign. The fixture itself has text extending beyond its SVG bounds; that screenshot is not a layout-polish acceptance.

Remaining acceptance: original DWG-byte retention, complete record coverage, clean-storage restoration, large real-PDF export under two seconds, corruption tests through the UI, production build and required viewport polish. No native or deployment acceptance is claimed.
