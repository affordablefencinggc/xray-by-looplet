# Drawing history follow-up

Authorized by "proceed" following the Gemini review. Branch `feat/architect-cad-engine`; existing changes from the previous turn preserved. The task began 2026-09-12 and finished 2026-09-13 Brisbane time. No commit, push or release performed.

## Changes

- Issued drawings use their saved geometry, annotations, levels, section, title metadata, north angle and scale. New issues save project address and section endpoints. `issuedDrawing` validates reconstruction and the layout hash; it never receives the live project as a fallback.
- Incomplete older records show an explicit unavailable message with no rendered sheet. Their existing register/layout data remains in storage. This is intentional: missing historical geometry or section placement cannot be recovered from current edits.
- The historical inspector is read-only and shows the issued revision and layout values. Every sheet in the selected historical issue is selectable, including sheets absent from the active set. Automatic default viewports also render, fixing blank historical first sheets.
- Reissuing a subset supersedes only overlapping current sheets, preserving each sheet's successor issue ID, revision and timestamp. The issue stays current until all its sheets are superseded; the UI labels mixed sets PARTIALLY SUPERSEDED. Existing fully superseded audit records are preserved rather than retroactively rewritten. Duplicate issue IDs are refused.

## Verification

- 105/105 architect tests passed, including frozen geometry/title/section after live edits and JSON reload, incomplete/corrupt history refusal, partial reissue and later successor lineage. See `architect-tests.log`.
- `development-history/`: 25/25 raw-CDP operations against the existing local development preview. Captured live baseline geometry, changed the active design, then verified historical drawing geometry is equal using canonical SVG attributes. Desktop 1440x900 and tablet 1024x768 screenshots were inspected, including the superseded watermark with visible geometry, read-only issued metadata, and incomplete-history refusal. No collected runtime errors or unhandled rejections.
- Initial DOM-string comparison failed solely because React reordered SVG attributes; the canonical comparison retains every attribute/value and child geometry. Screenshot inspection additionally found the automatic viewport rendering issue, which was fixed and verified with an explicit nonempty-geometry predicate. A separate intermittent browser navigation failure is preserved.
- DANS1 official web-only worker run `4c845d09e718`: 736 web source files and 101 native source files verified, typecheck passed, 86 regression tests passed, production web build passed. High priority and all 16 workers recorded. No native package built.
- `production-regression/`: 78/78 Visualise/NCC operations passed against compiled Vercel output on DANS1 using a loopback SSH tunnel and local browser. This verifies compiled app regression behavior; the history-specific fixture remains development-browser evidence.
- Exact follow-up patch: `changes.patch`; source paths: `FILES.md`. All 736 packaged source files were rechecked against the working tree after verification. No source-backed quantity, quote or construction approval is asserted.

## Cleanup and limits

Task-owned browsers, production preview and SSH tunnel were stopped after identity checks. Existing development preview PID 57888 remained running. Cleanup receipts are stored alongside browser/build evidence.

No native package, multi-party revision branching, historical PDF re-export, cloud revision vault or retroactive repair of previously incorrect supersession records is claimed. The broader D-09 checklist stays partial for those boundaries.
