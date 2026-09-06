# Altitude source takeoff - completed bounded implementation

User authorization: "gooo" after proposed traceable component takeoff and stock-volume/weight workflow. Branch feat/model-wireframe-navigation adopted; baseline HEAD 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared files retained; no staging, commit, merge or publication.

## Delivered

Source-bound Components view for the exact Altitude source SHA-256. Two provisional entrance allowances (252 apartment, 209 hotel) inferred from labelled units/rooms and explicit floor ranges, plus unknown residential windows, hotel windows and structural members. These are not verified door-leaf or structural schedule quantities. Source evidence opens the original page, floor lists and source identity are inspectable, and other drawings do not show this takeoff.

Dedicated durable takeoff inventory uses project and source identity. Explicit Save inventory / Save group and JSON export. Original demonstration graph is preserved separately and its inspector is suppressed in the tower view. Changed counts require notes; changed counts or stock specification advance revisions and invalidate review. Saved unreadable/future/foreign records fail closed without overwriting; compare-before-write detects concurrent edits; failed writes preserve previous data and can retry.

Packaging inputs calculate ceil(quantity/items per package) x length x width x height in metres. Weight sums quantity x specified kg per counted item. Supplier/specification reference required. Unknown stays null, partial group coverage is shown, and whole-building stock totals remain explicitly unknown. Aisles and handling excluded.

## Proof

- Exact implementation delta: implementation.patch; SHA-256 5c1c6f6996f90396fa6f49ed5213c1708fe18a421f3938dd75bf771b94659092. Pre-edit copies and source-hashes.json retained.
- Typecheck passes. Production build exits 0 (build-exit.json); build.txt retained.
- Full tests pass: 195 script + 346 TypeScript = 541 tests, including eight new source takeoff regressions; tests.txt retained.
- Actual 58-page / 20.5 MB Altitude file imported via file picker in isolated Edge profiles on dev and built output. Browser-proof.mjs covers source-linked count/export, evidence page 48, review invalidation, packaging math, reload, mobile, future-schema byte preservation/recovery and switching to Caroline. Both reports have zero console/page errors. Screenshot evidence: screenshots/altitude-takeoff/{dev,built}/report.json. Desktop, mobile and protected-restore screenshots visually inspected.
- Synthetic packaging values were used only in isolated QA (reference explicitly says fictional test values), then cleared. Actual project reference remains unknown for packaging/weight.
- Generic dev/built smoke screenshots also render cleanly and were visually inspected. Generic baseline reports canvas/text differences for dev-only diagnostics/annotation chrome. Its game/brand heuristic sees a drawing canvas; this construction utility is not labelled as a game. Settled source-takeoff behavior passes on both builds. Earlier stale production asset-404 condition is absent after restarting the newly built preview.

## Remaining drawing dependencies

Door/window schedules, structural plans/legend/member and connection schedules, floor exceptions, and supplier packaging/weights are not in the architectural early-design source. Full material orders and whole-building storage/weight totals remain unverified. Tower 3D reconstruction is not created by this slice and requires coordinated levels/dimensions. The existing 3D Caroline model is not used as tower evidence.

User-facing count reference: output/takeoff/altitude-component-takeoff.md and altitude-component-allowances.json.
