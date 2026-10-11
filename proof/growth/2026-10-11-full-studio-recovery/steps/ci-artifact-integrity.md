# CI artifact integrity and matrix exit propagation — October 12, 2026

## Requirement

Verify artifacts from the exact branch CI source, preserve deployment metadata and Linux executable permissions, and prevent a Windows PowerShell step from hiding the first of two Cargo failures.

## Source and remote results

- Tested source: `738445d371f2abdd39829288d445ec1be96692b5`.
- Run: `38146549601`.
- Web Studio & Vector Engine Audit: success.
- SC-07 Transport Contract Proof: success.
- Windows desktop build and artifact upload: success (job `114492053692`).
- Ubuntu desktop build was still running at this record's first checkpoint; the superseded run was later explicitly canceled. See the [successful final matrix](ci-matrix-final.md) for the later accepted exact source.

## Downloaded and inspected evidence

Inspections ran under a verified 20% aggregate CPU Job Object cap on DANIELS. Archives were read as ZIPs without extracting or executing their contents. Hashes were compared with GitHub's immutable artifact digest.

| Artifact | ID | ZIP SHA-256 | Checked contents |
| --- | --- | --- | --- |
| `xray-web-release` | `11704813220` | `c894656432284edb3feeb332326b5a2c7d6ef828602d0a85115491d4883ce3bb` | 244 entries, 277676711 bytes; `config.json` and `functions/__server.func/.vc-config.json` both present and parseable. Function metadata selects `nodejs22.x` and `index.mjs`; routes resolve through `/__server`. |
| `sc07-transport-proof` | `11704653067` | `882014e7781c2d57c73b263cc446124939a2e340e63254299bb36a0c6567edfb` | 8 entries; manifest `ok: true`, mode `ci-executed`, Linux/x64 Node `v22.23.3`, 33 verified/2 partial BR rows. Host log: 36 passed/0 failed/1 ignored. Separate Unix descendant proof: 1 passed. Tauri: 52 passed. |
| `xray-desktop-windows` | `11704304989` | `1f10204fec025f5eae40e5ad0d084803a1b540f0383b8f9ae50d4f70c495eba2` | 2 entries, 532284065 ZIP bytes; MSI `X-Ray by Looplet_0.1.0_x64_en-US.msi` (266272768 bytes) and NSIS `X-Ray by Looplet_0.1.0_x64-setup.exe` (266152757 bytes). No installation/execution. |

The host log includes the then-current delayed-status, short-deadline/nonzero and descendant-status tests. The manifest's two Windows-only partial rows are not closed merely by Linux success. The status-success gap found in this first checkpoint was subsequently closed with the raw integration fixture and remote Linux/Windows execution; see the final matrix proof.

The Windows job log was independently read through the GitHub jobs API: host 37 passed/0 failed/1 ignored, including the actual junction and protected-DACL tests; Tauri 54 passed. Windows CAD compilation verified all five pinned dependency checksums. MSI and NSIS installers were produced and uploaded. This confirms both test commands passed in the earlier combined step rather than relying only on its final exit status.

The initial web audit helper completed download/hash verification but failed on an unbalanced local path regex; the regex was repaired and the already-downloaded archive rechecked successfully. Original failed logs were preserved. This helper bug did not change source or remote artifacts.

## Workflow follow-up diff

- `.github/workflows/ci.yml`: separate host/Tauri matrix test steps, one Cargo command per step; tar Linux bundles before uploading instead of relying on ZIP permissions.
- Cache configuration now maps both actual independent manifests (`engine/host -> target`, `src-tauri -> target`) rather than the absent root workspace. It keeps dependency-cache defaults; no historical application binary is substituted for current compilation.
- `scripts/desktop-build-contract.test.mjs`: regression checks for separate command steps and mode-preserving upload.
- `node --test scripts/desktop-build-contract.test.mjs`: 7 passed, 0 failed. Syntax and whitespace checks: exit 0.
- This follow-up was subsequently accepted by run `38150581911` at `c93ae1e7`; preceding job success is not attributed to later source. Final workflow/config regression count became 9 plus 5 proof-parser tests (14 total).

## Visual evidence and limits

Nonvisual step; no new screenshot. Separate saved-screenshot review identifies inspected visible states. No installer was installed or executed, no serverless function was deployed, no qualified frozen runtime was manufactured or staged, and no signing/macOS acceptance is asserted.