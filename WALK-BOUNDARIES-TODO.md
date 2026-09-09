# Walk boundaries and interactive doors

Approved: 2026-09-08. User: "walk up stairs and step ups, can only walk through doors only . anything else solid is a boundary"; "add a button popup when at doors and to open door and make a animation of a arm reach out and either open the door or slide it open".
Baseline: `5d35437`, branch `feat/architect-cad-engine`.

Preserve the current arrival animation, free Fly, top settings and five bottom controls. Standalone X-Ray only; no normal user-data writes or CRM changes. Build on Dans1 High priority / 16 workers. Existing source/evidence publication remains held by automatic approval review; no new upload attempted.

- [x] SC-01: Collision module implemented and executed: 11 geometry tests pass. Actual Redburn source integration passes closed/open passage, threshold step-up/down, 100-frame traversal in each direction, full stair ascent/descent, ceiling/window/wall boundaries and unsupported edges. [Exact geometry log](proof/growth/2026-09-08-walk-boundaries/collision-tests-final.log), [actual model integration + source hashes](proof/growth/2026-09-08-walk-boundaries/source-integration-final.log), [source diff](proof/growth/2026-09-08-08-walk-boundaries-source/code.diff). This is module acceptance; browser/release acceptance remains SC-03/04.
- [x] SC-02: Door interactions and body reach accepted within tested scope: actual swing/slide/lift, body safety and occlusion; E/button/reduced-motion/missing-arm recovery verified. Compact-view hand occlusion remains disclosed polish.
- [x] SC-03: Complete development and final production journeys pass: Source158, Architect126, real thresholds/stairs, invalid starts, Fly and original controls. Native183 complete pass includes retained working data in the isolated QA profile.
- [x] SC-04: Dans1 five build gates/145tests, production/tablet/Windows-native checks, frozen source/artifact identity and inspected Stage09 HTML/PNG accepted. Whole A-Z rows remain partial.
- [x] SC-05: Four approved local checkpoints published to the specified GitHub branch; remote tip independently verified as 1f725b6. See proof/growth/2026-09-08-walkthrough-polish/publication-verified.json.

Known model limitation: Redburn has an approximately 0.92 m unsupported connection beyond the upper stair, so walking correctly stops at the edge. No floor was invented. Door directions inferred from source geometry/labels are visualization assumptions, not construction details. A–Z R-02 remains partial pending wider coverage.

Earlier source browser attempts `walk-boundaries-dev-01/02/03` remain preserved. Their opening wait, overly strict safety-prompt assertion and omitted outside step-back failed. The complete corrected user journey is `walk-boundaries-dev-04`, executed successfully; no earlier attempt is counted as a completed journey.

Frozen source: 15 files, scope SHA256 `47df19d2548b7bcb0d3d3afaba25d0904eb2bccb74d9335293ca49558ce5110c`. Dans1 run `197ab630793e`: dependency/typecheck/tests/web build gates passed High / 16 workers; native build and final acceptance still running. No installation or publication.

## User refinement — active, 8 September

User: "Pick your walkthrough starting point"; clean plan or existing high-quality aerial imagery; hand reaches out from the body.

- [x] SC-06: Development acceptance: exact title in both viewers; clean SVG plan with valid and unsupported world-coordinate selection. No aligned aerial asset found. Desktop and both tablet sizes visually inspected; Start/Close targets >=44px. [Executed acceptance](proof/growth/2026-09-08-walk-boundaries/clean-picker-final-development-acceptance.json), [frozen code diff](proof/growth/2026-09-08-09-walkthrough-polish-source/code.diff). Production acceptance remains SC-09.
- [x] SC-07: Camera/body-mounted CC0 rig visibly reaches from the lower-right edge; real mesh animation and transparent-world ordering verified. Reduced motion and missing-asset recovery pass. Compact overlays can partly cover the hand.
- [x] SC-08: Development acceptance: measured tablet popup/hint overlaps corrected with 8px spacing; Architect door and picker buttons >=44px. Both tablet orientations and original top/bottom controls inspected. [Frozen source diff](proof/growth/2026-09-08-09-walkthrough-polish-source/code.diff). Production repeat remains SC-09.
- [x] SC-09: New frozen38a64f0b8c2b release passed production and complete native journeys; inspected Stage09 HTML/PNG and earlier evidence preserved.

Candidate `197ab630793e` is preserved as an intermediate build: all five gates/140 tests pass, production source 144 commands pass. Tablet QA found real layout failures; Windows full journey also has a retained failed run being diagnosed. It is **not** final acceptance and will be superseded by the refinement build.

Current freeze: 21 source files, scope `420a03c0d9916921e895bed85e855c5df14dda46443dab8a09fb80e09aa78bcd`, plus separately hashed CC0 arm asset/licence. Dans1 refinement build requested. [Intermediate Stage08 illustrated report](proof/growth/2026-09-08-08-walk-boundaries/index.html) preserves previous failed checks. New full journey first attempt failed an overly strict post-screenshot animation-time window; the captured image shows the arm correctly, and the corrected test will record elapsed progress without treating screenshot latency as an application failure.


## 2026-09-08 - Walkthrough boundaries and polish accepted within tested scope

Source checkpoint 844e091 on feat/architect-cad-engine. Both pickers say "Pick your walkthrough starting point" and use clean aligned plans. Solid geometry, real stair/threshold traversal, E/button door operation and a body-mounted CC0 reaching rig are implemented. Original Fly, arrival animation and bottom controls remain verified. Dans1 candidate38a64f0b8c2b: five gates and145tests pass; High/16 CPU policy observed;631source files without drift. Production Source158commands, Architect/tablet/reduced-motion/asset recovery330commands and Windows-native183commands pass (671total). All relevant screenshots inspected. Native retained13sheets,2pricebooks,saved view and unchanged backup review verified; isolatedQAapp closed normally. [Stage09 illustrated proof](proof/growth/2026-09-08-09-walkthrough-polish/index.html).

Full A-Z rows remain PARTIAL: wider model/platform coverage is open. The real ~0.92m unsupported Redburn stair connection remains blocked; inferred door styles are presentation approximations. Instruction overlays partly cover the hand in compact views. No physical tablet, macOS/Linux-native, installation or whole-industry certification claimed. Remote publication remains held by the previously recorded automatic approval rejection; no new push attempted.


## Walkthrough publication verified

User approved the four named checkpoints and exact destination. Push succeeded: 93a94a8..1f725b6. Independent git ls-remote confirmed 1f725b6619a3a12a5683c072c1018df26c8a655d on feat/architect-cad-engine at https://github.com/affordablefencinggc/xray-by-looplet.git. This supersedes the earlier publication hold. No merge, installation or unrelated working-file changes. Exact result: proof/growth/2026-09-08-walkthrough-polish/publication-verified.json.
