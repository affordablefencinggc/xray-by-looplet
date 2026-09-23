# SC-01 / production SC-09 — QS measured-item workflow

Requirement: qualify room/roof item binding, real geometry changes, selective stale withholding, explicit rebind, reload and report interactions on development and built output, including both tablet orientations.

Executed on DANS1, source `281f2479`, web build `c56ad63e9ee7`:
- [Development 163/163](../closeout-qs-complete-dev01/browser-results.json), [cleanup](../closeout-qs-complete-dev01/launcher-results.json).
- [Built 163/163](../closeout-qs-built-c56ad63e9ee7/browser-results.json), [cleanup](../closeout-qs-built-c56ad63e9ee7/launcher-results.json). Zero browser errors. Both CSV strings are recorded in the linked `browser-results.json` operation values; the runner verifies item headers and SUMMARY_NODE/LEAF_ITEM disclosure. Filtering preserves the canonical total.
- [Additional built tablet readability 149/149](../closeout-qs-readable-c56ad63e9ee7/browser-results.json): uses the existing collapse-assistant control in landscape. No CSS or product state override.
- [Build/typecheck/88 focused tests](../build-c56ad63e9ee7/results.json); preceding full source regression 1,964/1,964 is unchanged.

Inspected screenshots: [current bindings](../closeout-qs-built-c56ad63e9ee7/captures/dev-two-current-area-bindings-desktop-1600x1000.png), [only edited room becomes stale](../closeout-qs-built-c56ad63e9ee7/captures/dev-selective-room-stale-tablet-1024x768.png), [explicit rebind](../closeout-qs-built-c56ad63e9ee7/captures/dev-explicit-roof-rebind-tablet-1024x768.png), [reloaded roof highlight](../closeout-qs-built-c56ad63e9ee7/captures/dev-reloaded-roof-highlight-desktop-1600x1000.png), [portrait report](../closeout-qs-readable-c56ad63e9ee7/captures/qs-report-portrait.png), [landscape report](../closeout-qs-readable-c56ad63e9ee7/captures/qs-report-landscape.png). Inherited filenames beginning `dev-` inside the built run are capture labels; the launcher records built mode and exact workspace. With the rail open, narrow table cells wrap; the collapse control provides the inspected full-width reading view.

Exact implementation diff remains [room/roof source patch](../../2026-09-20-sc09-room-roof/source/sc09-room-roof.patch), with earlier construction-run acceptance [recorded here](../../2026-09-19-sc09-provenance-disclosure/PRODUCTION.md). Current campaign changes are [proof tooling](../proof-tools.diff) and [ledger](../ledger.diff). [Input manifest](../transfer/source-manifest.json) identifies the current build. [Evidence audit](../evidence-audit.json) checks linked files, captured hashes and verdicts.

SC-09 is complete within this browser worksheet contract. Historical failed attempts are retained; their intermittent reload cause is unconfirmed. These controlled fixtures do not certify a customer drawing, native installation, physical tablet, cross-platform package or every graphics driver. Industry-agent live explanation and final combined journey acceptance remain separate.
