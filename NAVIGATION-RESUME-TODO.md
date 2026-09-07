# Navigation resumption ledger

Approved: yes, 2026-09-08 — user: "proceed". Existing staged-push authorization continues.
Baseline: `93a94a85d9ae829425fc5bde00fbe8ee2d5d5702`, branch `feat/architect-cad-engine`.

Scope: standalone X-Ray; preserve working data, top settings and all five bottom model buttons. Parallel owners cover placement, input controller and release preparation; root integrates. Builds run on Dans1 at High priority with 16 workers. No local full builds, CRM edits, installation, merge or worktrees.

## SC-01 — Supported starting positions [done]

- [x] Infer floor support, body clearance and useful heading from actual source geometry.
- [x] Reject unsupported/obstructed manual placements and test both Redburn floors.
- [x] Inspect the resulting interior camera view in the real app.

Files: `src/studio/WalkStartDialog.tsx`, `src/studio/walkStartPlacement.ts`, focused tests.

## SC-02 — Reliable input and capture recovery [done]

- [x] Preserve usable drag-to-look navigation when pointer lock is refused.
- [x] Allow fresh-gesture capture; guard stop/dispose and pending-request races.
- [x] Prove W/A/S/D signs, Escape/re-entry and held-key cleanup with executed tests.

Files: `src/studio/FirstPersonNavigation.ts`, focused controller tests.

## SC-03 — Integrated viewer journeys [done]

- [x] Integrate clear capture-state instructions in source and architectural viewers.
- [x] Execute actual camera displacement and exit/re-entry journeys in persistent browser sessions.
- [x] Verify lower buttons and tablet/laptop visibility; inspect screenshots.
- [x] Run typecheck and focused regression tests.

Files: both viewer components, scenario JSON files, explicit test registration.

## SC-04 — Release evidence and staged push [blocked: publication approval]

- [x] Freeze source identity, build web/native on Dans1, verify artifact hashes.
- [x] Test production/native journeys and retain failures alongside final passing runs.
- [x] Save an image-embedded HTML report and PNG; append exact tests/diff/status to PROGRESS.md.
- [ ] Commit explicit verified paths and push the approved branch in stages.

Checklist mapping: R-02 (partial), R-01, U-02, U-05, U-06, U-09. Full R-02 remains open: wall collision is not implemented by this bounded repair. macOS/Linux native acceptance remains separately blocked by the current Windows-only CAD build.

### Executed development checkpoint

15 focused controller/placement tests pass; final typecheck passes. Ground and upper starts inspected: useful interiors at actual surface height + 1.65 m. Source viewer's 83-command journey passed capture denial, real drag yaw, fresh capture, Fly/Walk signed W/S/A/D displacement, invalid-start refusal and all five lower controls. Architect viewer independently passed 156 commands across captured/denied Fly and Walk, including Escape/re-entry. Tablet 26-command final run passed 1024×768 and 768×1024; inspected model controls and scroll-accessible start actions.

The first tablet audit exposed pre-existing 30px model-toolbar targets. Scoped sizing/wrapping and the start-action target are now corrected. Superseded candidate `527de32b75e2` passed 110 tests and builds but is not accepted. Final candidate `049d8ae830ee` is building on Dans1. Source snapshot: `proof/growth/2026-09-08-07-navigation-source/`; scoped SHA-256 `aafd47c003bfc39b73a1fbf4d89713182d9d6f31a4b2fdb50a950640fedfb93e`. Final source has 516 web and 101 native files. Production/native acceptance and illustrated release evidence remain pending.

Failed scenarios remain in immutable runner records. One initial screenshot directory was missing; development package-script changes caused a reload between batches; scroll and arrival telemetry required reactive readiness waits. The static source-walk screenshot names were accidentally reused once; unique final ground/upper evidence is used for acceptance instead. No completion claim relies on the overwritten images.


Final acceptance: candidate aa8d81a110ac, 110 tests and both builds pass; browser144+25+23commands and Windows168commands pass. Eight embedded images and PNG inspected. Full evidence/source identities are in proof/growth/PROGRESS.md. Only staged publication remains for SC-04.

### Stage 07 publication held after automatic approval review

Navigation source commit `6b55950` is local. Build, 110 tests, final browser/Windows journeys and inspected HTML/PNG evidence passed. Automatic approval review rejected uploading the source to `https://github.com/affordablefencinggc/xray-by-looplet.git`, branch `feat/architect-cad-engine`, because it requires trusted user approval naming this payload and destination. Read-only remote verification still shows `93a94a8`; no Stage 07 upload occurred. Curated evidence is being archived as a separate local commit. Explicit approval for both local commits is the only remaining publication step. This note supersedes earlier wording that publication was underway. Exact rejection and file manifest: `proof/growth/2026-09-08-navigation-release/publication-blocked.md` and `proof/growth/staged-push/navigation-evidence-manifest.json`. No installation, merge or CRM changes.