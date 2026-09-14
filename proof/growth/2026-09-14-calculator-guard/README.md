# Calculator continuation ? 2026-09-14

Two scoped fixes completed; broader Claude checklist remains open.

- [QS-01-SC-03: withhold failed-calculator final speculation](steps/QS-01-SC-03.md).
- [ROOF-01-SC-04: correct boundary extent and precision](steps/ROOF-01-SC-04.md).

Each step links its tests, visible screenshots and exact source diff. [Test runner](guard-check.mjs) uses controlled provider responses; no live provider response was accepted or scored in this campaign. All product execution was on DANS1. Metadata/checklist updates record these results only.

Preserved harness failures: 12:43:49 used an invalid test model name; 12:44:39 omitted the project-bound tool envelope (QS safeguard passed, roofing call failed); 12:45:51 used an invalid self-review layout, triggering the existing review reminder and failing the harness's two-request assertion. Corrected harness passed at 12:46:34. No product source was changed to accommodate these harness failures.

`build-input/source.tar` is a transfer archive, excluded from Git; the complete source manifest and build identity are retained. Campaign files retain original bytes through a scoped `.gitattributes` entry. Browser fixture JSON is synthetic. Screenshots demonstrate the corresponding visible app state, not live-provider or deployment acceptance.

Record verification: [source/artifact hashes and evidence links](metadata-verification.json); [checklist and evidence-byte policy diff](metadata.diff). Accompanying screenshots linked in each step demonstrate the app states those records describe.
