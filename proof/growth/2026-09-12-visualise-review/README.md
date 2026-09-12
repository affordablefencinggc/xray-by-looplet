# Gemini review and Visualise changes — 2026-09-12

Status: implemented and development-browser verified after Daniel explicitly approved the existing local preview. Branch `feat/architect-cad-engine`; starting commit `d128382`. No commit, push, installed-app update or release was requested or performed.

## Review findings and changes

- D-15: legacy issues without geometry snapshots previously became empty models, fabricating additions and quantity increases. Comparison now refuses explicitly and the UI displays the reason.
- D-15: moved openings, equal-area slab/roof changes, roof pitches, material specifications and associated level changes could go undetected. Remaining element fields and level changes are now compared, excluding bookkeeping revision increments.
- D-15: active sheet layout hashes were blank, hiding viewport/north-angle changes. Active layouts now use the same hash function and authored sheet IDs as issue records. Replacement sheets with reused numbers remain additions/removals; renumbering is detected.
- D-15: added/removed slabs and roofs were omitted from detail cards; they now render. Zero-baseline percentages are undefined rather than a fabricated 100%. Summary change detection includes quantity rows beyond net area.
- U-03: Settings explicitly hid the shared right resize/collapse controls, while their position continued to follow the underlying inspector. The visible Settings drawer now supplies the seam measurement and retains shared controls. Width commands and saved width updates are synchronized.
- U-03: the assistant opened underneath Settings. Entering assistant mode closes Settings; opening Settings closes the assistant and expands the right menu. The appearance popup is hidden while Settings covers it.
- U-03: Visual settings gains a left-edge pointer/keyboard resizer and saves its width on this device.
- Walkthrough: source and architect pickers now use a wider two-column dialog with a scrollable floor rail. First click places the origin, pointer movement changes the heading, and second click enters. Keyboard placement/aiming, repositioning, a pulsing marker and reduced-motion support are included. The source picker revalidates the origin before entry and preserves the user's chosen heading instead of replacing it with the recommended heading.
- NCC: added directly below Projects in the assistant menu. New local library supports supplied edition labels, PDF text indexing, keyword/section matching, selected excerpts, original PDF page links and adding references to an existing draft without sending it. Empty libraries produce no fabricated references. Real NCC content qualification awaits Daniel's files.

## Executed evidence

- Daniel explicitly approved local testing: "Use the existing local preview". The personal Fast CDP host restriction was overridden for this task. The existing preview PID 57888 was retained.
- `local-ui/`: 78/78 raw CDP operations passed on the local Windows Chrome browser against the existing development preview. Desktop 1440x1000 and tablet 1024x768 screenshots were inspected. Settings resize/seam, assistant visibility, saved appearance width, floor selection, pointer heading and entered camera yaw passed. Runtime error/unhandled-rejection collection remained empty.
- NCC browser proof imported an explicitly synthetic one-page PDF in a disposable browser context, searched its extracted text, selected D2D3/page 1, recovered an original-page blob link and appended source excerpts to the existing question. No AI message was sent; no synthetic content was added to the user's browser profile. `local-ui/ncc-selected.png` shows the selected excerpt.
- `local-delta/`: 13/13 component-fixture operations passed. Screenshots show removed slab/added roof/moved opening details and an explicit visible error for a snapshot-less legacy issue. The panel now stays open when comparison fails.
- `local-architect-walk/`: 15/15 component-fixture operations passed. Selecting the upper floor, aiming right and entering returned elevation 3.3 m and yaw -pi/2.
- The first screenshot inspection found floor buttons shrinking below their label height; `flex-shrink: 0` fixes this and an executed bounds assertion verifies labels fit. The source walkthrough no longer displays a stale clear-ahead distance after aiming.
- 119 focused tests passed on DANS1 in the earlier staged review run; see `tests.log`. The final source passed the official DANS1 worker's typecheck, focused regression tests and production web build: `build/completion.json`, run `f9fe019e7008`, 734 web and 101 native source files verified. Web-only run; no native package built. High priority and 16 workers are recorded.
- Final source identity is recorded in `final-source-manifest.json`; `changes.patch` captures tracked and new source changes. Earlier manifests/logs remain historical evidence.
- Prior DANS1 browser failures and intermittent local navigation failures are retained as infrastructure evidence. The sandbox checks were not weakened. Task-owned browser sessions were closed and cleanup recorded after every campaign.

## Outstanding boundaries

- Production compilation passed. Production-server browser qualification is recorded separately below; development evidence is not a claim of native-package or deployed-platform acceptance.
- NCC searches currently use extracted PDF text and keywords, not semantic retrieval or OCR. Edition labels are supplied by the user, not validated jurisdictional applicability. Tests use synthetic text, not legal content. No substantive NCC answer, legal conclusion or exhaustive provision coverage is claimed.
- D-15 still does not compare drafting annotations or perform visual overlays/slip-sheeting. Gemini's earlier README overstated annotation support and legacy fallback behavior; this audit supersedes those claims.
- Additional D-09 defects found but not addressed in this bounded pass: history viewports still draw from the live model (`viewportBox(p, v)`), and supersession marks all sheets in a prior current issue superseded even if only some were reissued. These need their own correction and regression proof. Existing historical evidence is retained.
- No source-backed takeoff, calibrated measurement, verified material price or construction-ready claim is made by these changes.

## Final production verification and cleanup

`production-ui/` passed 78/78 raw-CDP operations against the actual compiled Vercel output on DANS1, viewed by local Chrome through a loopback-only SSH tunnel. Desktop and tablet screenshots were inspected and match the development behavior. `production-binding.json` binds the run to source archive `f9fe019e7008b26d07c97db403e3b6d491745315b237a8df0966fce0e851c80a`; all 734 source files were rechecked against the working tree after the campaign. The runner's generic development-only limitation string is not the campaign identity; this separate binding records the actual built-output server. Native packages, external model replies and deployed hosting were not tested.

The final worker ran 86 regression tests, typecheck and web build successfully. Earlier 119 focused feature tests remain separately recorded, not added together as unique test coverage.

Three production launch attempts timed out because the remote preview did not survive closure of its initiating SSH session. Keeping the launch session attached fixed this; no source/build change was required. Failed launch records are retained separately.

The production preview, SSH tunnel and all task-owned test browsers were identity-checked and stopped. Local ports 8187/9337 no longer listen; the original development preview remains on 8091 with PID 57888. See `build/review-preview-cleanup.txt`, `production-ui/tunnel-cleanup.txt` and browser cleanup receipts. No commit, push, release or user-profile test data modification occurred.
