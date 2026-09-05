# Approved document workspace contract - implemented, final browser acceptance pending

Parent authorized exclusive store.ts/domain.ts ownership and safe selectDocument(documentId): Promise<void>. Do not route selection through importPlan; existing import clears measurements.

Proposed backward-compatible optional fields on v2 job:

- annotations: sketch/area records with original document ID/SHA, page, coordinate-space marker, exact points, existing computed value/unit and stable ID.
- documentWorkspaces: inactive document snapshots containing calibrations, runs, gates, annotations, photos, BOM/quote/review state/history and last page. Existing active job arrays remain authoritative, so established commands and formula validation do not need wholesale rewriting.
- componentRegistry: optional existing named trade/component registry, shared at project level.

Boundary requiring parent agreement: photos and their reciprocal run/gate links are currently validated against active arrays. The bounded safe design snapshots the complete per-document evidence package, including photos. Inactive evidence survives and reappears on return; active photo list belongs to selected document. Global cross-document photo-link semantics would require substantially broader evidence-command/schema changes and are not silently assumed.

Selection sequence:

1. Reject unfinished pending trace/calibration capture with finish/cancel instruction; preserve all current state.
2. Resolve existing document record and load original bytes from existing verified browser plan repository.
3. Validate original size, SHA and kind before selection. Reject missing/tampered content without changing active state.
4. Prepare target workspace. Existing old inactive documents without known snapshots receive empty evidence; do not guess old coordinates.
5. Compare source job/reference/version after asynchronous reads to reject stale concurrent selection or edits.
6. Snapshot current committed workspace and atomically publish target source, arrays, page/calibration/selection state. Preserve inactive package bytes. Persist through existing job repository.

Import must also snapshot prior active document before initializing newly imported source. New sketches/areas persist as job annotations immediately and restore through markupsFromJob. Existing unmarked in-memory sketch coordinates cannot be promoted to verified source coordinates; preserve as legacy-unverified if retained. No formula changes.

Required tests: two different verified source documents roundtrip with distinct scales, runs, gates, sketch/area points, photos/links/review state; schema/storage reload; missing or tampered source rollback; async race rollback; page identity; legacy coordinate guard; annotation deletion persistence; optional component names reload. Real browser switch/draw/reload screenshots are still required.
