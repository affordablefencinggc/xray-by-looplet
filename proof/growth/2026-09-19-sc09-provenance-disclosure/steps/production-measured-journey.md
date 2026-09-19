# SC09 tested wall-run production journey

Requirement: bind measured entities, select the exact same geometry in 2D/3D, then a real canvas edit makes only that item's binding stale and withholds its pricing. This step proves wall/construction runs only, **not SC09's missing room-area/roof-plane families**.

Source: frozen `9abf4c807030`, archive SHA-256 `363046a1168bf312022a3d8e3ed23844dd44cf6e4bbc3e658b3bac0da993af4f`; [source manifest](../../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/source-manifest.json), [ledger/styles diff](../source.diff). [Full build/fixture/method record](../PRODUCTION.md).

DANS1 production browser **89/89 PASS**, zero browser errors, cleanup complete: [executed results](../campaigns/sc09-9abf4c807030-built2/output/browser-results.json). A changed revision 1→2, point `(100,120)`→`(100,168)`, while B remained byte-equivalent in persisted data. Same exact selected run appears in both mounted measured surfaces.

Screenshots visually inspected: [two current bindings](../campaigns/sc09-9abf4c807030-built2/output/production-captures/sc09-two-current-bindings-desktop-1600x1000.png), [real native-pointer vertex edit](../campaigns/sc09-9abf4c807030-built2/output/production-captures/sc09-real-canvas-vertex-edit-desktop-1600x1000.png). [Tablet A-only stale evidence](../campaigns/sc09-9abf4c807030-built2/output/production-captures/qs-evidence-card-qs-wall-a-tablet-1024x768.png) is captured in the same result.

Limits: controlled source fixture; no deployment, physical-device or other geometry-family claim. No ledger promotion.
