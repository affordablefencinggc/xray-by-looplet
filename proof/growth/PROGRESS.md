# X-Ray — proof of growth

Started 2026-09-07. Authorized `/fast-test /ledger` continuation on `feat/architect-cad-engine`, baseline `3e422f0084de607a775c2ede8dfecdf0b032c75e`. Existing source and user data preserved.

Each dated stage gets a self-contained HTML report with embedded PNG evidence, a PNG summary, exact scenarios/logs and a code diff. Earlier evidence is retained. Product acceptance remains open until its complete stated behavior passes; partial milestones are labelled partial.

## Active stage: recovery review, workbook pricing and source-sheet organization

| Checklist ID | Work | State |
|---|---|---|
| B-09 | Complete portable restoration into a clean editor | Partial — recovery coordination and writer exclusion still required |
| B-10 | Restore integrity and impact preview, including source identity collisions | In progress |
| D-06 | Persistent discipline groups and ordered sheet export | In progress |
| D-14 | Saved source-page navigation | In progress; viewport scope must be explicit |
| E-01 | XLSX/CSV preview without formula execution | In progress |
| E-02 | Worksheet/column mapping and row-level errors | In progress |

External dependencies remain open for authenticated staff delivery, live Firecrawl credentials/budget and discipline-specific validation. These do not block the independent work above.

## Stage reports

Reports and evidence will be appended here after each stage is verified. Historical delivered wave: [professional workflows](../audit/IW-PROFESSIONAL-NEXT/completion.md). That package was verified in an isolated native profile, not installed over the user's application.

### 2026-09-07 / Stage 01 / B-10 recovery review

- **Partial:** the read-only impact review passes 14 focused tests and a desktop/mobile browser scenario. B-09 full restoration, B-11 crash recovery and B-12 writer exclusion remain open.
- Added explicit record/original impacts, source identity checks and stale-review detection. Browser assertions confirm unchanged localStorage and zero IndexedDB readwrite transactions during the review. Original plan fixture: Redburn BR250157, 13 pages.
- [Self-contained illustrated HTML](2026-09-07-01-recovery-review/index.html) · [PNG summary](../../screenshots/growth/2026-09-07-01-recovery-review.png) · [Before](../../screenshots/growth/2026-09-07-recovery-before.png) · [Stale review rejected](../../screenshots/growth/2026-09-07-recovery-stale.png).
- [Scenario](recovery-final-dev.json) · [Executed log](recovery-final-dev.log) · [Focused tests](2026-09-07-recovery/preflight-tests.tap) · [Source identity](2026-09-07-01-recovery-source/source-manifest.json) · [Code diff](2026-09-07-01-recovery-source/code.diff).
- All four report images and the PNG summary inspected. This is development proof, not a claim of installed delivery. Subsequent integration clears an obsolete successful review if a recheck fails; final build/source identity will be recorded in the release stage.

### 2026-09-07 / Stage 02 / D-06 sheet groups and D-14 saved views

- **Development acceptance passed; final production/native gate pending.** D-06 discipline grouping, filtering and order survive restart. The actual downloaded ordered JSON register retains all 13 original pages, discipline labels, archive state and saved views. It does not rewrite or reorder the original PDF.
- D-14 restores the original page, zoom and source-relative centre after page switching, resizing and reload. Removal persists; simulated storage failure leaves the previous metadata unchanged. Saved views are device-local project/source metadata, without account synchronization or staff delivery.
- Executed proof: 13 focused tests, typecheck, desktop/mobile journeys, explicit browser-error checks and actual downloaded bytes. The final mobile check confirms all eight lower controls are at least 44 by 44 pixels, visible and reachable. Screenshot inspection is recorded in the slice completion evidence.
- [Self-contained illustrated HTML](2026-09-07-02-sheets-views/index.html) · [PNG summary](../../screenshots/growth/2026-09-07-02-sheets-views.png) · [Inspected restored view](../../screenshots/growth/2026-09-07-02-sheets-views/01.png) · [Final mobile controls](../../screenshots/growth/2026-09-07-02-sheets-views/07.png).
- [Executed scenarios and limits](2026-09-07-sheets/completion.md) · [Unit tests](2026-09-07-sheets/unit-tests.log) · [Download verification](2026-09-07-sheets/download-proof.json) · [Exact source manifest](2026-09-07-02-sheets-source/source-manifest.json) · [Code diff](2026-09-07-02-sheets-source/code.diff).
- Scoped source SHA-256: `76d76f101ff1a5a2cdbd4c09dfa33929b8530c667f86a956dce1a327b025231a`. Original Redburn source SHA-256: `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`. Downloaded register SHA-256: `950f3aa5f51476bb3d22e367a415c155c0a3cebf2fd08d03dc8bbe5a905cee6f` (2,814 bytes).

### 2026-09-07 / Stage 03 / E-01 workbook preview and E-02 reviewed mapping

- **Development acceptance passed; final production/native gate pending.** E-01 accepts bounded XLSX/CSV input for real preview without formula execution. A mapped formula cell is refused even if a cached value exists; malformed input preserves the exact saved library. E-02 exposes worksheet, heading row, SKU, description, unit and rate mapping with physical row/cell errors before reviewed saving.
- A real reload preserved project identity, selected worksheet/header, original workbook hash and physical source rows. Previously applied price-book revisions remained unchanged. Test rates are invented fixtures, not supplier quotations.
- Executed proof: 18 focused pricing tests, typecheck, formula refusal, worksheet/header mapping, reviewed save, reload, malformed-input preservation and desktop/mobile screenshots. The 0.87-second detail batch is a measured hot-session result, not a general testing-speed guarantee.
- [Self-contained illustrated HTML](2026-09-07-03-workbook-pricing/index.html) · [PNG summary](../../screenshots/growth/2026-09-07-03-workbook-pricing.png) · [Inspected mapping](../../screenshots/growth/2026-09-07-03-workbook-pricing/01.png) · [Formula refusal](../../screenshots/growth/2026-09-07-03-workbook-pricing/03.png).
- [Executed scenarios and limits](2026-09-07-pricing/completion.md) · [Focused tests](2026-09-07-pricing/tests-final.log) · [Save/reload journey](2026-09-07-pricing/workbook-flow.log) · [Malformed/mobile journey](2026-09-07-pricing/malformed-csv-mobile.log) · [Exact source manifest](2026-09-07-03-pricing-source/source-manifest.json) · [Wave code diff](2026-09-07-pricing/implementation.diff).
- Scoped source SHA-256: `bf949e0244651eb4d190ac458b611a64068f80e367ad2ea29453913068ea25d9`. Workbook fixture SHA-256: `c950510911d6f27407841922a4ae7bd531162fe6e92f08983a4555e827f02244`.
- Supported source limit is 2 MiB, expanded archive limit 20 MiB. XLS/XLSM, encrypted files, inferred unit/currency conversions and live pricing searches remain outside this slice. Original workbook bytes are not embedded in portable backups; provenance is retained. Worker timeout/cancel paths were implemented but not artificially forced in the development browser proof.

### Current batch checkpoint / final release acceptance still pending

SC-01 reporting framework is complete, with three illustrated stage reports and PNG summaries. SC-02's bounded read-only preflight is complete; B-09 full restoration, B-11 interruption recovery and B-12 protected writers remain open. SC-03/E-01/E-02 and SC-04/D-06/D-14 have development acceptance; their final cross-platform gate and SC-05 remain pending. The earlier active-stage table above is retained as historical state; this appended checkpoint records the update.

Approximately **80% of implementation/evidence work in this five-slice batch** is complete, an estimate rather than an accepted-slice fraction. No completion percentage is asserted for the entire application or its 364-requirement register, which has not been comprehensively audited.

Frozen combined source SHA-256: `a8a8c4946d93cafa283a7875b97337719f4c1bce8884b5b4097ab30fc5b29b84` (510 files); native source SHA-256: `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` (101 files). The [Dans1 build record](2026-09-07-release/README.md) records passing builds, typecheck, 95 tests and verified artifact identities. These build results do not close production/native functional or visual acceptance; coordinating agents are running those checks separately. No installed-delivery claim is made here.

### 2026-09-07 / Stage 04 / integrated release acceptance

- **Pass within the stated built-browser and isolated Windows scope.** D-06/D-14 sheet organisation and saved views; E-01/E-02 workbook preview/mapping; B-10 read-only review remains partial because actual restore is still open.
- [Open self-contained illustrated report](2026-09-07-04-release-verification/index.html) � [PNG summary](../../screenshots/growth/2026-09-07-04-release-verification.png) � [Final source copies and diff](2026-09-07-04-release-source/code.diff).
- Dans1 High/16-worker dependency/typecheck/test/web/native gates all exited 0; 95 tests passed. [Exact build record](2026-09-07-release/release-a8a8c4946d93/native-completion.json). Frozen web source `a8a8c4946d93cafa283a7875b97337719f4c1bce8884b5b4097ab30fc5b29b84`; verified EXE `1a6486a3af6425e61996b1641f5ffdeade546df9fa549e4dcafe43209899aa8b`. Package tested separately; **not installed** over the user's normal app.
- Production sheet flow: 64 commands / 4.638 seconds; actual register and backup downloads verified. [Production evidence](2026-09-07-sheets/production-completion.md).
- Windows pricing: 56 commands / 1.618 seconds; sheets: 66 / 3.735 seconds; three repeat reloads: 43 / 3.462 seconds; backup/preflight: 18 / 3.542 seconds. All exited 0. [Sheet log](runner/2026-09-07T13-22-13-315Z-growth-native.log) � [Backup log](runner/2026-09-07T13-22-44-912Z-growth-native.log). Exact executed JSON scenarios and hashes are archived beside every runner log.
- Native stored backup SHA-256 `ffcc549a40fa2691fcfbda2aa5ce79f3d5b0364eaa516aec1ee1ebdedb289db4`, 9,343,635 bytes: 13 original sheets, groups, saved view, two price books, original PDF hash verified. No applied priced worksheet rows in this fresh integration fixture. Read-only review preserved current job, sheets and pricing bytes.
- All six embedded images and the report PNG were visually inspected; HTML loaded all six data-URI images without external image dependencies. [Render proof](runner/2026-09-07T13-26-24-137Z-growth-report.log).
- Failed test attempts remain recorded: native viewport command EOF, premature saved-view geometry check, and repeated-run disclosure toggle. Geometry readiness and test starting state were corrected; product source was not changed to conceal failures.

### Platform scope update and tablet follow-up

User: "disregard mobile use full stop ! tablet , laptop. pc. mac.linux thats it!!"

Phone use and further phone QA are excluded. Earlier evidence remains historical. Tablet, laptop and desktop workflows are the target; Windows, macOS and Linux need separate acceptance evidence. Browser viewport emulation does not establish real tablet hardware or other OS package compatibility.

A targeted tablet audit at 1024�768 and 768�1024 passed layout/identity/reachability but exposed 24px drawing controls. **Fail � tablet touch size**, recorded before changing code. A scoped tablet control correction is in progress as the next stage; the Stage 04 source and report are preserved unchanged.

### 2026-09-07 / Stage 05 / tablet correction and requested safe pause

- **Pass � bounded tablet browser layouts and Windows persistence checkpoint.** The previous 24px lower controls now measure at least 44�44. Both 1024�768 and 768�1024 pass bounds/hit tests, no horizontal overflow, correct source page and saved centre. [Illustrated HTML](2026-09-07-05-tablet-controls/index.html) � [PNG](../../screenshots/growth/2026-09-07-05-tablet-controls.png) � [Exact 20-line CSS diff](2026-09-07-05-tablet-source/code.diff).
- Final built journey: **99 commands, 9.737 seconds, exit 0**. [Scenario](tablet-production-final.json) � [Log](runner/2026-09-07T13-35-18-576Z-growth-tablet-release.log). Final Windows executable reopened the prior isolated QA profile and retained its job, 13 sheets, two price books, saved view and verified backup: **24 commands, 3.268 seconds, exit 0**. [Scenario](tablet-native-upgrade.json) � [Log](runner/2026-09-07T13-38-14-807Z-growth-tablet-native.log).
- Dans1 High/16-worker candidate `c32e640187e9`: typecheck, 95 tests and web/native builds passed; all 613 source hashes and 10 artifact hashes verified. [Release record](2026-09-07-tablet-release/README.md). EXE SHA-256 `44271fdc59f7f28636e38b703e2fa0aa508e3fca545915ee7d6bb7663a41f641`.
- Five embedded images and the final PNG were inspected. HTML image-load assertions passed. [Report render](runner/2026-09-07T13-41-28-659Z-growth-report.log). Five separately openable stage reports now exist in the [report index](index.html).
- **Platform limits:** tablet browser layout emulation is verified, not actual tablet hardware. Native macOS/Linux builds are blocked by the current Windows-only DWG translator invoked in the Tauri build. Full restore/journaling, staff delivery/auth, live pricing/Firecrawl and broader specialist workflows remain open. Phones are excluded by the user's latest scope.
- User requested: "pause at next safe point and push changes in stages". Application `9db51ed`, tablet `0dd730e` and tooling `f72a839` were each committed and pushed to `origin/feat/architect-cad-engine`. The evidence and ledger release is the commit containing this entry. The final remote-equality result is kept locally in `proof/growth/staged-push/push-result.json`.
- Pausing after this evidence release. No new module work, merge or installed-app replacement. Generated installers, transfer archives, test profiles and raw backup packages remain on this PC; curated reports, screenshots, scenarios, logs and source diffs are included in the evidence stage.

### Final evidence upload held by automatic approval review

The application/tablet/tooling stages are pushed and the remote branch was independently read back at `f72a839c09deec163382a073ac673889ed1d9b52`. Automatic approval review rejected uploading the remaining 803-file, approximately50MB evidence payload because its destination and exact payload authorization were not verified. Public metadata lookup returned404; repository visibility could not be established. No evidence upload was retried.

The full reviewed evidence remains on this PC and is archived in a local commit for review. A specific approval question for this payload and destination is pending. This note supersedes any earlier wording implying the evidence stage has already been published. Work is paused; no new modules or builds are running.

### 2026-09-08 � evidence approval completed; navigation reminder checked

User explicitly approved the evidence upload ("approved,, dont forget walk through and dly buttons please"). Evidence commit7fb5f6c was successfully pushed to origin/feat/architect-cad-engine. The previous upload hold is resolved.

Fly and Walk-through are present, enabled and reachable in the verified Windows package; five lower model controls remain present. Fly entry/mouse capture/Escape exit passed. Walk-through picker and retry entry/Escape exit passed, but immediate re-entry after Fly was refused by mouse capture, and the chosen walking start had an unhelpful close surface view. **Walk start visual quality and rapid re-entry remain open for the next work session.** No application source changes or rebuild were made.

Exact scenarios, screenshots and an HTML/PNG addendum are retained locally at proof/growth/2026-09-08-06-navigation-check/. The follow-up check is not a claim of full navigation/movement acceptance. Work remains paused after this status record; installed app and user workspace are untouched.


### 2026-09-08 / Stage 07 / navigation repair verified

User resumed work with "proceed"; earlier pause is superseded. **Pass — bounded navigation/start/recovery milestone**, with the full professional IDs below still partial. [Open illustrated HTML](2026-09-08-07-walkthrough-release/index.html) · [PNG summary](../../screenshots/growth/2026-09-08-07-walkthrough-release.png) · [Exact ten-file source diff](2026-09-08-07-navigation-final-source/code.diff).

| Checklist ID | What changed and executed result | Status and remaining work |
|---|---|---|
| R-02 | Supported source-room/slab starts and inferred clear heading; real W/S/A/D signed camera displacement at nonzero yaw; ground 1.665 m and upper 4.785 m eye heights; captured/denied input, drag, retry and Escape. Source and architectural viewers tested. | Bounded milestone PASS; full R-02 PARTIAL. Collision, gravity/stairs and wider model coverage remain open. |
| R-01 | Five bottom model controls preserved; zoom in/out, front/rear and reset changed the actual camera in final browser and Windows runs. | Bounded regression PASS; wider pan/scale/aspect/model acceptance remains open. |
| U-02 | WASD, faster movement and exit hints reflect locked/drag state; fresh Capture mouse action provided. | Navigation guidance PASS; whole-app search/command palette/shortcuts remain partial. |
| U-05 | Selected suggestion contrast fixed; labelled choices, focus and editable-input guards, stale request/dispose tests. | Bounded focus/contrast milestone PASS; full accessibility audit remains open. |
| U-06 | Model targets and start action at least 44 px; 1024×768 and 768×1024 hit/bounds tests and normal dialog scrolling; navigation hint clears assistant. | Bounded browser layouts PASS; physical tablets/touch-only movement unverified. Phone QA excluded. |
| U-09 | Unsupported/obstructed starts refused while prior recommendation retained; capture refusal retains usable drag controls. Final executable reopens prior job, 13 sheets, two price books, saved view and backup preflight. | Bounded recovery PASS; full restore/journaling and other validation workflows remain open. |

Before/after: [prior close-surface start](../../screenshots/growth/2026-09-08-walk-retry-active.png) → [final Windows interior](../../screenshots/growth/nav-windows-final-ground-before.png). [Final upper floor](../../screenshots/growth/nav-windows-final-upper-before.png), [tablet hint/buttons](../../screenshots/growth/nav-built-final-portrait-fallback.png), [retained backup](../../screenshots/growth/nav-windows-final-retained-backup.png). Eight embedded images and the PNG report were inspected; all image-load assertions passed.

Exact final executed commands (all exit 0):

- `node scripts/fast-cdp-test.mjs growth-navigation-final proof/growth/2026-09-08-navigation-release/nav-built-final-release.json` — 144 commands, 20.922 s. [Log](runner/2026-09-07T14-51-01-060Z-growth-navigation-final.log).
- `node scripts/fast-cdp-test.mjs growth-navigation-final proof/growth/2026-09-08-navigation-release/nav-built-final-tablet.json` — 25 commands, 1.201 s. [Log](runner/2026-09-07T14-51-58-852Z-growth-navigation-final.log).
- `node scripts/fast-cdp-test.mjs growth-navigation-final proof/growth/2026-09-08-navigation-release/nav-built-final-tablet-fallback.json` — 23 commands, 0.415 s; includes actual rectangle-overlap refusal. [Log](runner/2026-09-07T14-52-00-101Z-growth-navigation-final.log).
- `node scripts/fast-cdp-test.mjs growth-navigation-native-final proof/growth/2026-09-08-navigation-release/nav-windows-final-release.json --cdp 9266` — 168 commands, 25.492 s. [Log](runner/2026-09-07T14-54-33-781Z-growth-navigation-native-final.log).
- `node scripts/fast-cdp-test.mjs growth-report proof/growth/2026-09-08-navigation-release/render-report.json` — 8 commands; self-contained HTML and PNG render. [Log](runner/2026-09-07T14-55-16-919Z-growth-report.log).
- [Architect production acceptance](2026-09-08-navigation-release/architect-production-acceptance.md): 175 commands with exact copied scenarios/logs. Candidate049 used identical controller/architect source; final candidate changes only source-viewer tablet hint CSS.
- Dans1 High/16: typecheck, **110 tests**, web and sequential native build passed. [Exact worker commands and outputs](2026-09-08-navigation-release/README.md). No local full builds were used.

Final candidate `aa8d81a110ac`: source SHA-256 `aa8d81a110ac0aeb94a10d18d0bbd7a899737976f04725171773f60268ca8af3`; native source `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7`. All 617 source hashes and 10 artifact hashes match. EXE `d1a525d5b4a0abe323bb50cef803cef9236b8cda1c8e4974df0c90552c85a5d0`; installer `605d372d1b7e374289bd4d4241f72882dcd7251cf3477b3809af1ab14ffff604`. Scoped source snapshot SHA `6e2ae651e6fc4c9dad6c5710c4c47d1047e37d041c8614925e671ee5ab76ba02`, baseline commit `93a94a8` on `feat/architect-cad-engine`.

Failures are preserved: initial pointer capture/blank walk start; undersized tablet toolbar; assistant overlap found visually despite passing button checks; initial screenshot directory; development reloads; rendered-frame/scroll readiness corrections. Candidate527 is superseded by touch targets; candidate049 passed functional tests but is superseded by final hint clearance. One static movement-image prefix was accidentally reused; only distinct final evidence is accepted. See [development evidence and limits](2026-09-08-navigation-release/dev-acceptance.md).

No full professional checklist item was ticked on partial evidence. Native macOS/Linux remains blocked by the Windows-only CAD build. Full restore, staff delivery/auth, live Firecrawl pricing and wider industry journeys remain open. Installed app, ordinary working data and Looplet CRM were untouched. Application and curated evidence are being published in separate authorized stages; the local push record will contain exact remote equality.

### Stage 07 publication held after automatic approval review

Navigation source commit `6b55950` is local. Build, 110 tests, final browser/Windows journeys and inspected HTML/PNG evidence passed. Automatic approval review rejected uploading the source to `https://github.com/affordablefencinggc/xray-by-looplet.git`, branch `feat/architect-cad-engine`, because it requires trusted user approval naming this payload and destination. Read-only remote verification still shows `93a94a8`; no Stage 07 upload occurred. Curated evidence is being archived as a separate local commit. Explicit approval for both local commits is the only remaining publication step. This note supersedes earlier wording that publication was underway. Exact rejection and file manifest: `proof/growth/2026-09-08-navigation-release/publication-blocked.md` and `proof/growth/staged-push/navigation-evidence-manifest.json`. No installation, merge or CRM changes.


## Active stage: walking boundaries and doors — 8 September 2026

Live task list: [WALK-BOUNDARIES-TODO.md](../../../WALK-BOUNDARIES-TODO.md). Full register: [PROFESSIONAL-A-Z-CHECKLIST.md](../../../PROFESSIONAL-A-Z-CHECKLIST.md).

R-02 remains **partial / in progress**. Collision and door modules have executed geometry proof; 45 focused tests pass. Actual source-model integration verifies thresholds, closed/open passage, stairs and unsupported-edge refusal. Architect browser acceptance passed 104 commands with inspected screenshots. Source browser, frozen production build, Windows-native acceptance and the embedded-image stage report are still in progress. This is not yet a completed release.

- [Exact 15-file source identity](2026-09-08-08-walk-boundaries-source/source-manifest.json), [code diff](2026-09-08-08-walk-boundaries-source/code.diff).
- [45-test execution](2026-09-08-walk-boundaries/focused-tests-02.log), [actual Redburn integration](2026-09-08-walk-boundaries/source-integration-final.log).
- [Architect 104-command acceptance, scenarios and inspected visuals](2026-09-08-walk-boundaries/architect-acceptance.md).

Known model limitation: an approximately 0.92 m unsupported connection beyond the top stair is blocked instead of inventing a walking surface. Failed browser attempts remain preserved. Publication of prior local commits remains held by automatic approval review; no new upload has been attempted.


## 2026-09-08 - Walkthrough polish development acceptance

A-Z R-02 remains PARTIAL. SC-06 and SC-08 have development acceptance; SC-07/09 remain in progress. Exact title is now "Pick your walkthrough starting point" in both viewers. Clean SVG plans replace crowded start maps, with real world-coordinate placement, unsupported-position refusal, and >=44px Start/Close targets at desktop and both tablet sizes. Body-mounted CC0 reach rig replaces the popup hand; transparent-world ordering fixed after inspected screenshots exposed an invisible arm.

- Before/intermediate: [Stage08 illustrated HTML](2026-09-08-08-walk-boundaries/index.html), [PNG](../../screenshots/growth/2026-09-08-08-walk-boundaries.png). Explicitly NOT ACCEPTED; preserves tablet failures and incomplete native run.
- After development: [clean plan](../../screenshots/growth/body-arm-dev-07-plan.png), [body reach](../../screenshots/growth/body-arm-dev-07-reach.png), both visually inspected.
- Exact tests: node --experimental-strip-types --test src/studio/FirstPersonArm.test.ts src/studio/cleanWalkPlan.test.ts src/studio/FirstPersonNavigation.test.ts src/studio/walkCollision.test.ts src/studio/WalkDoors.test.ts src/studio/sourceWalkDoors.test.ts src/studio/walkStartPlacement.test.ts — [50 passed](2026-09-08-walkthrough-polish/focused-tests-final.log). node node_modules/typescript/bin/tsc --noEmit passed.
- Arm journey command: node scripts/fast-cdp-test.mjs growth-navigation-dev proof/growth/2026-09-08-walkthrough-polish/body-arm-dev-07.json — 25 commands, 24.487 seconds, exit0; [exact runner](runner/2026-09-07T16-13-16-527Z-growth-navigation-dev.json).
- Picker/layout executed proof: [acceptance](2026-09-08-walk-boundaries/clean-picker-final-development-acceptance.json).
- [Code diff](2026-09-08-09-walkthrough-polish-source/code.diff), [21-file source identity](2026-09-08-09-walkthrough-polish-source/source-manifest.json), scope 420a03c0d9916921e895bed85e855c5df14dda46443dab8a09fb80e09aa78bcd. [Asset identity](2026-09-08-walkthrough-polish/asset-source-identity.json) and [licence provenance](2026-09-08-walkthrough-polish/asset-provenance.md).
- Remaining: corrected complete development journey; new Dans1 High/16 build; production Source/Architect/tablet and isolated Windows native; final embedded HTML/PNG stage. No macOS/Linux execution claimed. Publication remains held by the previously recorded automatic approval rejection; no new push attempted.


## 2026-09-08 - Walkthrough boundaries and polish accepted within tested scope

Source checkpoint 844e091 on feat/architect-cad-engine. Both pickers say "Pick your walkthrough starting point" and use clean aligned plans. Solid geometry, real stair/threshold traversal, E/button door operation and a body-mounted CC0 reaching rig are implemented. Original Fly, arrival animation and bottom controls remain verified. Dans1 candidate38a64f0b8c2b: five gates and145tests pass; High/16 CPU policy observed;631source files without drift. Production Source158commands, Architect/tablet/reduced-motion/asset recovery330commands and Windows-native183commands pass (671total). All relevant screenshots inspected. Native retained13sheets,2pricebooks,saved view and unchanged backup review verified; isolatedQAapp closed normally. [Stage09 illustrated proof](2026-09-08-09-walkthrough-polish/index.html).

Full A-Z rows remain PARTIAL: wider model/platform coverage is open. The real ~0.92m unsupported Redburn stair connection remains blocked; inferred door styles are presentation approximations. Instruction overlays partly cover the hand in compact views. No physical tablet, macOS/Linux-native, installation or whole-industry certification claimed. Remote publication remains held by the previously recorded automatic approval rejection; no new push attempted.

Exact source/asset identity, code diff, commands, saved scenarios, pass/fail history and remaining work are linked in the Stage09 report. Before: [preserved Stage08](2026-09-08-08-walk-boundaries/index.html). After: [openable HTML](2026-09-08-09-walkthrough-polish/index.html) and [PNG summary](../../screenshots/growth/2026-09-08-09-walkthrough-polish.png).


## Walkthrough publication verified

User approved the four named checkpoints and exact destination. Push succeeded: 93a94a8..1f725b6. Independent git ls-remote confirmed 1f725b6619a3a12a5683c072c1018df26c8a655d on feat/architect-cad-engine at https://github.com/affordablefencinggc/xray-by-looplet.git. This supersedes the earlier publication hold. No merge, installation or unrelated working-file changes. Exact result: proof/growth/2026-09-08-walkthrough-polish/publication-verified.json.


## 2026-09-08 — Live assistant rail/composer increment

Status: PARTIAL / development tested; full MCP integration and production/native gates remain open.

The assistant now follows the actual right rail width and keeps its message composer below scrollable content. /mcp and capability aliases report the disconnected state; unsupported chat retains its draft. Removed the unsupported hardcoded MCP Connected claim. No MCP call, paid model request or CRM change.

Proof: [illustrated HTML](2026-09-08-live-assistant/index.html), [scenario](2026-09-08-live-assistant/root-settled.json), [source diff](2026-09-08-live-assistant/code.diff), [source manifest](2026-09-08-live-assistant/source-manifest.json). Exact command: node scripts/fast-cdp-test.mjs growth-assistant proof/growth/2026-09-08-live-assistant/root-settled.json — six commands passed, screenshot inspected. node node_modules/typescript/bin/tsc --noEmit passed. Scope SHA256 8ef5077469105db69091337dbe4c3bb99437a9be72b1931c4cf486f26c54d307.

Full MCP execution remains unchecked: standalone client, conversation loop, selected-project tool boundaries and runtime packaging require implementation. Latest verified executable remains 38a64f0b8c2b.


## 2026-09-08 — Gemini takeover development checkpoint

- PASS: 52 focused tests, typecheck, inspected PNG/PDF exports, real MCP drawing/save/reload/undo and playback checks. Production/native and live provider acceptance remain OPEN.
- Fixed restoration, tablet bottom-control access, title overlap and an empty PNG race by rendering before capture. Model book now uses real projections and actual five-page A4 PDF output.
- [HTML with embedded before/after images](2026-09-08-gemini-takeover/takeover-report.html), [MCP proof](2026-09-08-gemini-takeover/mcp-acceptance.html), [PDF](2026-09-08-gemini-takeover/exported-model-sheets.pdf), [PNG](2026-09-08-gemini-takeover/exported-blueprint-rendered.png).
- Baseline 1f725b6619a3a12a5683c072c1018df26c8a655d; [source identity](2026-09-08-gemini-takeover/source-identity.json), tracked diff and added-source copies in report. Development only; installed release unchanged.
- Earlier failed automation and empty capture retained. Full A–Z and newly authored 52-storey design remain open.


## 2026-09-08 — Candidate 71f5b012342b, build and feature acceptance

- PASS: Dans1 seven sequential High/16 gates; 219 TypeScript and 14 Rust tests. Frozen source 71f5b012342be7887a29bbf051131b57e5ed998ada46c5c79b5c22cd1325f14c. Executable 38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c.
- PASS: 226 production browser commands and 97 native commands; inspected screenshots and actual PNG/PDF downloads. Restored bottom preview controls, reserved tablet toolbar space, real MCP discovery/playback, drawing/save/reload/undo, synchronous export capture.
- [Open illustrated report](2026-09-08-assistant-mcp-r4/release-report.html); [PNG summary](../../screenshots/growth/2026-09-08-release-71f5b012342b-report.png); [frozen source and complete diff](2026-09-08-assistant-mcp-r4/source-manifest.json); [native exact commands/results](2026-09-08-assistant-mcp-r4/native-acceptance.md).
- OPEN: SC-06 shutdown cleanup. QA window closed, but owned process53296 remained alive after normal close and CDP disconnection. No force termination. Candidate is not promoted over38a64f0b8c2b pending diagnosis.
- OPEN: live Gemini replies/search (provider unconfigured), full52-storey authoring and broaderA-Z/nativeMac/Linux acceptance. No installation or working-data replacement.
- Earlier d0d468747f41 test failure, r2 missing preview-bottom-bar and r3 tablet overlap retained with evidence. Corrected storage success mock only; production lost-write guards remain tested.


## 2026-09-08 - MCP/drafting source checkpoint 476f395

Local source checkpoint `476f39511b234fd65050a92a5550a14281277392` records 56 explicit source/test files. Candidate `71f5b012342b` passed seven Dans1 High/16 gates, 219 TypeScript tests, 14 Rust tests, 226 production browser commands and 97 Windows-native commands with inspected visual evidence. [Illustrated report](2026-09-08-assistant-mcp-r4/release-report.html). Native shutdown after the extended QA session remains OPEN; fresh startup-only baseline and candidate close normally. Live provider/search remains unconfigured. No full A-Z, 52-storey, native macOS/Linux or release-promotion claim.

Publication is BLOCKED: automatic approval review rejected uploading the 56 source/test files to the existing GitHub feature branch because destination trust was not established. No upload or bypass occurred. Exact record: `proof/growth/2026-09-08-assistant-mcp-r4/publication-blocked.json`. User approval naming checkpoint476f395 and the exact repository/branch is required.


### Native shutdown comparison - 2026-09-08
Fresh startup-only baseline38a64 and candidate71f5 both close normally. A second isolated candidate repeated the full97-command native workload without viewport emulation: all passed, then normal close completed with process and direct children absent (~514ms observation). Original PID53296 remains an unresolved windowless process; the failed emulation/session difference is a possible factor, not established cause. No force termination. [Comparison evidence](2026-09-08-assistant-mcp-r4/candidate-workload-shutdown/README.md). Source unchanged; release promotion stays held pending the remaining diagnosis.


Local evidence checkpoint `39a50dc7358ae4058d73296ab0c9f338d0df57dd` preserves 106 explicit report, test, identity and to-do files for source checkpoint `476f39511b234fd65050a92a5550a14281277392`. Both remain local after the source push was rejected by automatic approval review. No further push or workaround attempted. The clean97-command native retry and unresolved original message-loop process are recorded separately.


## MCP candidate publication verified

User explicitly approved source checkpoint `476f395` and evidence checkpoint `39a50dc` for `https://github.com/affordablefencinggc/xray-by-looplet.git`, branch `feat/architect-cad-engine`. Push succeeded; independent `git ls-remote` confirmed remote tip `39a50dc7358ae4058d73296ab0c9f338d0df57dd`. This supersedes the earlier publication hold; original rejection evidence remains preserved. No merge or installation occurred. Shutdown diagnosis and live-provider acceptance remain open. Exact record: `proof/growth/2026-09-08-assistant-mcp-r4/publication-verified.json`.


## 2026-09-08 - 10-minute idle cleanup rule applied

User authorized termination of unused agent-owned X-Ray processes within10minutes. Rule saved in AGENTS.project.md: immediate cleanup at completion,10-minute maximum idle reuse, verified PID/creation/command, bounded graceful close then termination, preserve active user preview and all data. This is an agent operating rule, not an installed scheduler.

Executed cleanup: nine local processes stopped (one lingering test app, six completed test helpers, two superseded SSH tunnels); followup verification found none remaining. Twelve superseded Dans1 previews stopped; only currentcandidate71f5b012342b preview and its wrappers remain. Local8080development and8095currentpreview retained. The old native shutdown issue remains unresolved; terminating the test process is cleanup, not a product bug fix. Evidence: proof/growth/2026-09-08-process-cleanup/.


## 2026-09-08 - A-Z wave 3: protected project saves, source-sheet lifecycle acceptance, bounded Firecrawl contract

Three disjoint slices on feat/architect-cad-engine (ledger AZ-WAVE3-LEDGER.md, entries in walkthrough.md), implemented by parallel agents and each checked by three independent refuters with one repair round. Development-server proof only; no build, installation, commit or publication.

- B-12/B-13/B-02 partial: the main project record refuses stale writes (compare-and-swap), pauses on another window's newer revision with reload/download actions, and survives injected quota failures with retry. 49 focused tests; same-window, two-tab and tablet Fast CDP scenarios with inspected screenshots. proof/growth/2026-09-08-az3-protected-saves/README.md.
- D-02/D-04/D-05 partial (verified in development for source sheets): rename keeps evidence references; the archive review now also lists saved views; recover restores slot, locked scale and a real annotation byte-identically. Redburn fixture SHA b57956f7…45ad38, 37 focused tests, desktop and tablet screenshots. proof/growth/2026-09-08-az3-sheets/README.md.
- P-01/P-02/P-09/P-10 partial, live credential dependency-blocked: server-only Firecrawl v2 search contract with strict response validation, truthful typed failures, single-flight and caps; Cost-pane panel proven in its not-configured state with a seeded price book unchanged across a failure. 27 tests. No live request. proof/growth/2026-09-08-az3-pricing-research/README.md.

Integrated gate on the combined tree: focused suite exit 0 (see proof/growth/2026-09-08-az3-wave/tests-integrated-final.log), typecheck exit 0, git diff --check clean; scope manifest proof/growth/2026-09-08-az3-wave/source-manifest.json. All owned browser sessions closed. No full-application acceptance, Dans1 build, or Burj Khalifa research/model claim.


## 2026-09-09 - Dans1 build 5dfc922f097f: production and Windows-native QA passed; promotion held on native shutdown

Wave-3 tree frozen and built on Dans1 (seven gates exit 0, 287 focused tests, executable SHA-256 2ff012d231570bcbc4e4263334712326e1565acc3f1f1190cdaa99a8711b3b69, 214/214 web artifacts verified). Production preview journeys (saves, sheets, pricing, hardened assistant, live image reply) and isolated Windows-native journeys passed with inspected screenshots; the native two-tab stale notice is a WebView2/CDP platform limitation; two stale assistant-layout scenarios superseded, none edited. Verification lenses re-run by command after a chat restart: not refuted. The native app did not close gracefully within 5 s after the extended QA workload and was force-stopped, so LATEST-VERIFIED-BUILD.md is unchanged and no preview was replaced. Also completed in development (post-freeze, not in this build): the Magic Pencil control dock shrank 335→95 px and became draggable (walkthrough entry MP-DOCK-01). Evidence: proof/growth/2026-09-09-az3-release/ (qa/, verification.md, native-cleanup.json), proof/growth/2026-09-09-draftsman-dock/, report proof/growth/2026-09-09-11-az3-release/index.html. No commit, push, installation or publication.


## 2026-09-09 - Assistant draws multi-storey wireframes; repo skills enforced as harness guardrails

SC-08 (partial, development verified): `draw_architect_elements` now accepts level, slab, roof, footprint and extrude operations, and two permission-free read tools describe X-Ray's structure and the source-building reconstruction. Asked in plain words for a 3-storey 20 m by 12 m wireframe, the real provider issued one extrude call producing 3 levels, 12 walls, 3 slabs and a hip roof (saved revision 2, restored after reload); a second message added a storey and undid it through the undo tool (revision 4). 56/56 focused tests, typecheck exit 0, five inspected screenshots (desktop and tablet). SC-09 (done): `.claude/settings.json` hooks + `scripts/guardrails/hook.mjs` deny whole-tree staging, gate git history mutations on a named checkpoint, gate process kills on an identity-checked cleanup script, guard `LATEST-VERIFIED-BUILD.md`, inject the skill rules at session start and block proof-less completion claims; observed firing live. Evidence: proof/growth/2026-09-09-assistant-wireframe/README.md, proof/growth/2026-09-09-guardrails/README.md, report proof/growth/2026-09-09-12-assistant-wireframe/index.html. Not done: Dans1 build/production/native runs of the wireframe journeys. No commit, push or installation.


## 2026-09-09 - Assistant workbench tools: sheets, takeoff evidence, price books, backups

SC-10 (partial, development verified): five assistant tools — read/manage source sheets (rename, archive, recover through the Sheets pane's own sidecar), read takeoff evidence and readiness blockers, read price books, capture a verified workspace backup — with 65/65 focused tests and typecheck exit 0. With the Redburn set imported, one real-provider request renamed page 3, archived page 12, reported blockers and price books and stored a 9.3 MB verified backup; the Sheets list live-updated and the Backups dialog shows the checkpoint (three inspected screenshots). The existing eight-step conversation cap paused the reply after the eighth tool; a continue message finished it. Evidence: proof/growth/2026-09-09-assistant-workbench/README.md, report proof/growth/2026-09-09-13-assistant-workbench/index.html. Not done: Dans1 build/production/native runs; trace, calibration, quote, export and restore actions stay unavailable by design. No commit, push or installation.


## 2026-09-09 - Release build b1117e054a71 verified; assistant wireframe and workbench tools in production and native; pointer moved

SC-11 (done): Dans1 build b1117e054a71 passed all seven gates (299 focused tests); 26 production and Windows-native scenario runs (519 commands) verified the az3 regressions plus the assistant's multi-storey wireframe (draw, undo, reload) and workbench journeys (rename/archive sheets, takeoff blockers, price books, verified backup) on both platforms with the real provider; the native app closed gracefully, so LATEST-VERIFIED-BUILD.md now points at b1117e054a71 (exe SHA-256 97efa973a7c7d38fac15f54b60c4d35a3c736d2f845ff6a178f3771709d628a2). SC-08 and SC-10 are therefore done. Evidence: proof/growth/2026-09-09-az4-release/verification.md and qa/runs.md; report proof/growth/2026-09-09-14-az4-release/index.html. Not installed, not committed, not published.


## 2026-09-09 - Assistant unlock: design edits, takeoff calibration/trace/review, price-book import, exports, AI render

SC-12 (done, development verified): eight new assistant tools built by a 20-agent workflow with adversarial verification (every major finding fixed), 153/153 tests, typecheck exit 0. Five real-provider journeys on the user's dev server passed every assertion: design edited by ID and renamed; Redburn page 2 calibrated, traced (5.000 m) and approved for a named reviewer with the assistant stamp; a pasted CSV imported as a provenance-marked price book; DXF/IFC exported with sha256 receipts; and "generate a real life view of this plan" produced a gemini-2.5-flash-image visualisation on the Render pane. Evidence: proof/growth/2026-09-09-assistant-unlock/README.md, verifier-fixes.md; report proof/growth/2026-09-09-15-assistant-unlock/index.html. Not done: Dans1 build/production/native runs. No commit, push or installation.


## 2026-09-09 - Release build 8e14ac427997 verified; assistant unlock in production and native; pointer moved

SC-13 (done): Dans1 build 8e14ac427997 passed all seven gates (358 focused tests); 40 production and Windows-native scenario runs (765 commands) verified the regressions, the wireframe and workbench journeys, and the five unlock journeys — design edits by ID, takeoff calibration/trace/approval for a named person, pasted price-book import, DXF/IFC exports with hash receipts and the AI real-life view (web; the native build refuses cleanly). Native graceful shutdown passed; LATEST-VERIFIED-BUILD.md now points at 8e14ac427997. Evidence: proof/growth/2026-09-09-az5-release/verification.md, qa/runs.md, report proof/growth/2026-09-09-16-az5-release/index.html.


## 2026-09-09 - Assistant surface: rail mode, canvas right-click AI menu, context guard with continue-in-new-chat, rich replies; sketch-to-design showcase

SC-14, SC-15, SC-16 (done, development verified): a bot button docks the Live assistant into the right-hand menu (persisted, tablet + desktop); right-click on any canvas offers AI actions and puts an exact entity/part reference into the chat (the assistant then edited that very wall by ID); a 300k-token context guard (plus the provider caps) stops the chat and carries the work into a new chat with a handover; replies with choices render pills, an inline answer box and suggestions. Three adversarial verifiers, every major fixed; 85/85 tests, typecheck exit 0; desktop and tablet Fast CDP journeys exit 0. SC-17 (done, development verified): from a client sketch the assistant designed "Riverside Lab & Workshop" — four levels, 66 walls, 31 doors, 60 windows, 33 room tags, 4 slabs, skillion roof — survived the context guard mid-session, rendered a real-life view and exported DXF/IFC with hash receipts. Evidence: proof/growth/2026-09-09-assistant-surface/README.md, verifier-fixes.md.

