# SC15-CONTAINER-01 — portable archive implementation (WIP)

Status: **incomplete and unverified**. No machine test, browser execution, screenshot or production build exists for these changes. SC-15 remains pending. Source inspection and a clean source `git diff --check` are not product-test evidence.

Baseline: `417082881c26d880244b2ff7e3f4beb39c67ce2e`, branch `feat/closeout-sc09-remainder`.

[Exact implementation diff](../source/sc15-container-wip.patch) contains the packager, nine registered tests, Project Library controls, manifest adjustments and qualification allowlist/lint updates. New tests have been written, **not run**. The previous 2097-test gate belongs to older source and cannot establish acceptance here.

## Implemented in source

- `.xray` ZIP packager with `manifest.json`, untouched drawing entries under `drawings/`, photo entries and canonical `data/workspace.json` carrying the existing backup's job and saved records.
- Version, project identity, optional declared client, timestamp, byte sizes and SHA-256 entries; manifest seal checked before asset and workspace validation.
- Strict ZIP-directory/local-header reconciliation, membership checks, bounded inflation, traversal/duplicate/overlap rejection. Parsing accepts no storage callback, so it cannot partially write an invalid archive.
- Empty projects retain their workspace record; legal long project names and whitespace survive the manifest.
- Project Library's named export/import actions, optional client input and verified import preview feeding the existing impact review and recovery journal. Legacy JSON imports still use the existing reader.
- Tests cover captured-record/raw-byte round trip, empty projects, name/client sealing, tampering, manifest/workspace disagreement, file membership, asset identity substitution, ZIP bounds and duplicate-key JSON.

## Original SC-15 acceptance still required

1. Execute the registered tests and full type/lint checks on DANS1; obtain an actual code-linked screenshot and inspect desktop/tablet layout.
2. Demonstrate export, clear the isolated test browser's workspace storage, import and restore all saved records and original bytes; inspect the restored drawing, design and schedules. Container round-trip assertions alone do not prove this journey.
3. Preserve **original DWG bytes**. Current `ArchitectCadExchange.tsx` converts DWG to DXF reference geometry but does not retain the input bytes; `StoredPlanContent` supports PDF/DXF/SVG. This must be implemented, not waived or replaced by a DXF-only claim.
4. Measure the complete user export action with a genuine 20 MB PDF against the original **under two seconds** criterion. The initial adapter still passes through the legacy base64 backup reader; no performance claim is made. Its 200 MB encoded reader limit is enforced before export so this implementation does not knowingly emit an archive its own reader cannot reopen.
5. Audit every original record requirement against the existing backup exclusions, including source-model settings and construction-runtime jobs; do not equate the existing backup subset with the full ledger requirement.
6. Run the required production build and browser journey, with actual downloaded-file verification. No deployment, native or live-device acceptance is implied.

## Verification availability

DANS1 failed two bounded SSH checks this turn, first by timeout and then by [connection closure](../source/dans1-connection-failure.log). Both clients terminated; no new remote product process was started. The preceding development-reload candidate also remains unverified. This is a verification dependency, not a reason to mark either change complete.

The qualification helper explicitly includes the new untracked source files and registered test path. On restored connectivity, inspect the earlier `hvac4-11862358151f` directory before deciding whether to resume it; its bytes cover only the reload candidate. A fresh snapshot is required for this SC-15 source.

### Verification blocker rechecked

[Third consecutive goal-turn check](../source/verification-blocker.json): DANS1 SSH timed out; the client exited with code 1. Source diff whitespace checks passed, but no changed-behaviour test or screenshot exists. Preserve this WIP checkpoint. Resume by checking host identity and the earlier candidate directory, creating a fresh snapshot containing all archive files, then running registered tests/typecheck/lint and the failing development reload before the full archive browser journey. The full ledger scope remains unchanged.

