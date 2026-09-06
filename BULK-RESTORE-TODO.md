# Bulk material import and backup restore

Approved: user "start with bulk import and backup restore", 2026-09-06. Adopted feat/model-wireframe-navigation; preserve shared changes, no staging or publication.

- [x] SC-01: Strict CSV parsing, template and paginated preview; explicit duplicate/update policy, unknowns/source identity and reversible current CSV text encoding.
- [x] SC-02: Versioned backup export, legacy support, validated replacement and previous-snapshot download/archive. Failed writes and conflicts preserve saved data.
- [x] SC-03: File controls and explicit apply/cancel integrated with dirty-draft guards; desktop/mobile previews inspected.
- [x] SC-04: 567 tests, typecheck/build, 11 new browser scenarios per environment and 20 existing built tool scenarios pass. Exact diff/screenshots: proof/audit/IW-BULK-RESTORE/completion.md. Temporary dev/preview services stopped and ports verified clear.
