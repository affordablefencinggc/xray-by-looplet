# CI/native build preflight — October 12, 2026

## Requirement

Continue on `recovery/full-studio-20261011`; leave `main` at the stable promoted commit. Require successful CI for the tested source identity and distinguish package production from runtime acceptance.

## Observed starting point

- Branch starting commit: `0c33eac71168ec7784ae9ab6248f65a5c4b57ff4`.
- Main: `be29918ad5aa466ec0f67a0d5742af23634483a9`.
- Latest actual run: `38145192679`, source `28dfaf4c943a26f97d37176564cf248060d65d94`, completed with failure on October 11, 2026.
- Web Studio & Vector Engine Audit succeeded: install, typecheck, tests, BOM parity, web build, Python/MCP suites, built-output smoke and dry-run sidecar validation.
- SC-07 stopped on rustfmt: two malformed line joins in `JsonStatusFactory`. Desktop matrix skipped. The previously reported run `38143141105` returns HTTP 404; it is not acceptance evidence.

## Source changes

- `engine/host/src/lib.rs`: split the two line joins exactly as rustfmt requires; no production transport behavior change.
- `src-tauri/tauri.conf.json` and `tauri.windows.conf.json`: default hook builds the cross-platform SPA; Windows overlay preserves checksum-gated DWG translator compilation. `build-cad.mjs` still rejects non-Windows invocation rather than claiming a translator exists.
- `.github/workflows/ci.yml`: include hidden files only within `.vercel/output/` so release output retains build metadata.
- `scripts/desktop-build-contract.test.mjs`: regression tests for default/Windows hooks, declared scripts and artifact upload scope; included in `npm test`.

## Executed checks

- Local host and Tauri `cargo fmt -- --check`: exit 0 after the line-join fix.
- `verify-sc07-transport-proof.mjs --source-only`: exit 0, no source problems. All 35 requirements remain partial in source-only mode; this is not executed transport acceptance.
- Local Windows host transport suite under a verified Windows Job Object 20% aggregate cap: 37 passed, 0 failed, 1 ignored harmless fixture.
- Local Windows host clippy `--all-targets -- -D warnings`, same cap: exit 0.
- `node --test scripts/desktop-build-contract.test.mjs`: 4 passed, 0 failed; syntax check exit 0.
- `git diff --check`: exit 0; package and lockfile dependency declarations remain aligned and unchanged.
- Subsequent CI run: pending at this checkpoint; no green remote acceptance claimed.

## Visual evidence

No UI changes in this preflight; no new screenshots taken. Existing browser proof is historical evidence for its recorded source identities, not new native acceptance.

## Remaining limits

Native packages are not accepted until CI actually produces them. Empty engine directories and dry-run packaging do not qualify a bundled calculation runtime. Current qualified runtime staging is DANS1-only and source/hash gated; this campaign does not loosen it. Native launch/runtime, macOS packaging, signing and remote deployment remain separate acceptance gates.