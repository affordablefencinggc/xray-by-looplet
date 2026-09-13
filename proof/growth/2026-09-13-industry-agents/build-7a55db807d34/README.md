# Bundled-engine build acceptance

Run 7a55db807d34 uses the exact 943 manifest entries (837 web, 106 native).
Root compared every staged source hash with the working tree: zero mismatches.
Qualified engine e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d
is staged as a generated resource and its hash is supplied to Rust compilation.

The first attempt, 0d0d16d134ec, passed web/typecheck/focused checks but correctly
refused native dependency reuse because the operator supplied a mistyped cache
hash (f0d8 instead of f0c8 in its tail). That run remains intact on DANS1. The
new run identity includes the corrected cache and engine parameters; it reuses
the same source archives and repeats the build gates. No failed proof was
overwritten. The transfer wrapper now compares the cache executable hash before
starting a run.

Runtime integration: 47 native unit checks. Engine staging: 10 positive and
negative functional checks. Production web: 19 operations, desktop and tablet
screenshots inspected, no captured errors; temporary preview cleaned up.
See sibling hvac/bundled-runtime, hvac/bundled-staging and
quantity-surveying/bundled-production directories.

Native package passed (213.26 seconds, High priority, 16 workers). Application
SHA-256 fe6dbb5ddcb6820f4c209b97af47cf3b21e6c0f502063ebd2b528502a2a64a7e;
NSIS SHA-256 13c26fea295ae32318a9d0f3ab470bd15dcc5ec407a2550829f8496d0cef0846.
No-override installer-layout acceptance passed. The extracted app found the
engine with Windows-only PATH, no Python environment and an unrelated working
directory. Actual native full-layout request
`2d87d4bc-5fb4-4766-b9ee-698be72b34b9` returned 2 end posts, 2 ordinary posts,
6 rail cuts, 10 lm rails and 9 sheets for the synthetic 5 m fixture. Its receipt
survived reload; root inspected readable desktop/tablet screenshots. Missing and
tampered resources in separate disposable copies returned unavailable. See
`../roofing/native-ui/7a55-package/README.md` for exact identities and cleanup.

The separate web assistant reviewed this supplied receipt accurately in one
response, with Developer review, zero fresh tools, unchanged project data and
exact visible-entry persistence after reload. This does not claim native AI
execution or whole-industry readiness. See
`../quantity-surveying/bundled-native-review-7a55db807d34/` including the explicit
UTF-8 readback and export-encoding note. Earlier review failures remain intact.

The installer itself was not executed over the user installation. Acceptance
covers its extracted runtime files, not registry/install/uninstall behavior.
Windows execution security has not been disabled or changed.

The installer-extracted executable has a separate expected identity:
19271950158352eeeaea7f75fa2bc9f67b5a2b80c5a8b9e0e250fa14e8583920.
The initial extraction check correctly flagged its difference from the release
binary. Inspection found exactly three changed bytes, `UNK` to `NSS`, in
Tauri's bundle-type marker. The official
[bundler implementation](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle.rs)
patches this marker for NSIS packaging and restores the standalone binary
afterwards. Installer identity and all remaining bytes must be verified; no
binary is patched on disk to force a hash match.
