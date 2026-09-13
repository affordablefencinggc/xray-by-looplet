# Independent build snapshot review

DANS1 build a8a4f707ac43. Read-only collection: no source/index edits, new tests/builds or binary copying. verify-staged.ps1 independently checks all834 web and104 native manifest entries against the immutable staged source: all match. Native executable and NSIS installer hashes independently match native-completion.json. Completion receipts and build stdout/stderr are preserved here.

Executable SHA256: f34586aff3970801645cad794ee2ceb0c989ef5e5a55d4b353613f0c8fec1822.
Installer SHA256: 59814d50cd44efc0c7e86b02f91da79975e057ff3f73db38069ffd4f905489a7.

Dependencies, typecheck, focused tests, web build and native build all report exit0. This verifies the build snapshot only. Subsequent native handshake edits to src-tauri/src/lib.rs and engine/host/src/lib.rs are excluded and require their own build/acceptance evidence. Native interactive fencing acceptance remains separately tracked by root.

The34-operation production browser run occurred before native completion and proves the original web dist. Tauri subsequently reran build:desktop and replaced dist. final-asset-comparison.json explicitly separates original web names/hashes from current desktop assets; do not conflate those surfaces. Existing sibling proof has not been overwritten. Reproduce with verify-staged.ps1 and verify-final-assets.ps1 on DANS1; exact audit timestamp is in staged-comparison.json.
