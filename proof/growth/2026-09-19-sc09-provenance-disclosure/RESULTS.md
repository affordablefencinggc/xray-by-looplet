# SC09 full provenance and diagnostics source qualification

Owner: `/root/sc09_review`. **DANS1 dev-source PASS**, not deployment or physical-tablet verification. Snapshot `9abf4c807030`; source archive SHA-256 `363046a1168bf312022a3d8e3ed23844dd44cf6e4bbc3e658b3bac0da993af4f`.

Campaign `sc09-9abf4c807030-combined2`: **84/84 operations**, 12 screenshots, zero browser errors, native accessible clicks, context disposal and owned-process cleanup complete. Ran `2026-09-19T12:47:09.0991867Z`–`12:47:21.7032057Z` including launcher. [Browser results](campaigns/sc09-9abf4c807030-combined2/output/browser-results.json), [launcher/cleanup](campaigns/sc09-9abf4c807030-combined2/output/launcher-results.json), [remote artifact hashes](campaigns/sc09-9abf4c807030-combined2/output/sha256-manifest.json). All 21 returned evidence files matched that remote manifest.

The original 69-operation SC09 campaign is preserved, with 15 extra disclosure/diagnostics operations before the final error gate. [Scenario](combined.scenario.json), [source receipt](combined.source.json), SHA-256 `4b96005d24e6114ebe61ae709cb8d894c3cfc700f40fc314f06bab3d9b393581`.

The ledger's abbreviated hash was intentional, not CSS clipping. The actual usability defect was that the full geometry identity depended on hover. The new native disclosure exposes full geometry/source SHA-256 and calibration identity with explicit at-binding labels. Its measured touch target is **459×44 px**; both 64-character hashes wrap within the evidence cell. Stale status and pricing withholding remain unchanged.

- [Expanded full-provenance screenshot](campaigns/sc09-9abf4c807030-combined2/output/proof/growth/2026-09-19-sc09-provenance-disclosure/captures/sc09-full-binding-provenance-tablet-1024x768.png)
- [Expanded diagnostics screenshot](campaigns/sc09-9abf4c807030-combined2/output/proof/growth/2026-09-19-sc09-provenance-disclosure/captures/sc09-diagnostics-expanded-tablet-1024x768.png)
- [Tablet evidence card](campaigns/sc09-9abf4c807030-combined2/output/proof/growth/2026-09-19-dashboard-refresh/qs-visual-captures/qs-evidence-card-qs-wall-a-tablet-1024x768.png)
- [Desktop exact 2D/3D selection](campaigns/sc09-9abf4c807030-combined2/output/proof/growth/2026-09-19-dashboard-refresh/qs-visual-captures/sc09-current-exact-2d-3d-desktop-1600x1000.png)
- [Exact ledger/styles source diff](source.diff)
- [Full source preflight: 1,951 tests, focused 130, runner/state 13, TypeScript and lint](../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/REPORT.md)

The four linked screenshots were visually inspected. Full hashes are visible without hover. Expanded diagnostics header width/content are both 600 px and content height/scroll height both 216 px; tabs, toggle and status remain contained. No diagnostics source edit was needed. Its existing 37px collapsed toggle was checked for clipping, not claimed as a new 44px-control compliance result.

Failed historical campaign [combined1](campaigns/sc09-9abf4c807030-combined1/output/browser-results.json) is retained: all original interaction/visual gates ran, then new fragment op70 used an unsupported bare selector-click opcode. This was an infrastructure authoring error, not a product defect. Only the three new fragment click opcodes changed to supported native accessible clicks; no assertion or source was weakened. Combined2 executed the corrected proof on the same immutable source.

No ledger is promoted here. At this dev checkpoint production qualification had not yet run. The later frozen-source build and genuine measured production journey are recorded in [PRODUCTION.md](PRODUCTION.md); they do not qualify later SC10 edits or the missing room-area/roof-plane families.
