# DWG, roof repair and professional coverage — verification record

Date: 2026-09-07. Branch: `feat/architect-cad-engine`. Baseline: `3e422f0084de607a775c2ede8dfecdf0b032c75e`. Working changes are uncommitted and include preserved earlier architectural/navigation/voice work. No staging, commit, merge, push or new worktree.

## Delivered and verified scope

- [x] Researched A–Z register: **364 explicit acceptance requirements, 26 categories, 68 industry/professional profiles, eight working-day stages, 33 primary references**. This is completion of the register, not completion of its product requirements. [Catalogue](../../../PROFESSIONAL-A-Z-CHECKLIST.md), [source validation](../../../planning/professional-coverage/validation.json).
- [x] Searchable HTML report, industry/category intersection filters, reset, profile scenarios, CSV/JSON and embedded Proof access. Actual UI CSV download matches the 68,381-byte source and SHA-256 `cc890be5792e77921aea22c111597d89fcf8434ff61eeee74be1aaa5a805ee76`. [Interaction log](catalogue-qa.log), [download receipt and hash](catalogue-download-events.json), [layout assertions](catalogue-layout.log).
- [x] Local Windows DWG conversion through ACadSharp 3.7.1, with MIT notices and pinned dependency hashes. Bounded 12 MB request/output, 100,000-entity helper limit, one active request, timeout and cancellation; no remote drawing upload. Web retains DXF.
- [x] Independent conversion fixture: **431 entities across two levels**, millimetres and layers preserved at a comparison tolerance of `1e-7 mm`. LibreDWG 0.14 independently reads generated DWG; it is QA-only and is not bundled. [Converter result](converter-proof.json), [independent DXF readback](independent.dxf).
- [x] Actual native UI export: **412 entities**, independent geometric equality against the unmodified demonstration after import/undo/redo/undo. [Download events](native-download-events.json), [independent geometry result](native-ui-independent.json), [binary output](native-ui-export.dwg).
- [x] Native import review and cancellation preserve the authored design. Confirmed reference import contains **474 lines, 9 circles and 3 arcs**, zero inferred walls. Undo restores authored walls and valid level selection; redo restores references. [Native sequence](native-final.log).
- [x] Fixed the real undo crash found during smoke testing: importing replaces level IDs; history restoration now selects a valid level in the restored design. Dev and production web reproduce and pass import/undo/redo with DXF. [Development](dev-regression.log), [production](web-regression.log).
- [x] Redburn gables now have intersecting roof slopes, valley/ridge/barge details and host-roof cutouts; ribs are clipped at the valleys. Development and native views inspected; geometry test samples prove a single roof surface with shared facade/roof vertices. [Roof-specific diff](../IW-REDBURN-ROOF/implementation.diff), [native actions](../IW-REDBURN-ROOF/native.log).
- [x] Typecheck; **684 JS/TS tests (198 + 486)**; **29 Rust tests**; production web build; Windows NSIS package. Test logs: [JS/TS](tests.log), [Rust](rust-tests.log), [typecheck](typecheck-final.log), [web build](web-build-final.log), [Windows build](native-build-final.log).
- [x] Final development and production smoke: both desktop and mobile render with HTTP 200, no console/page errors, no horizontal overflow; production does not diverge. [App verdict](../../../screenshots/dwg/web-smoke-final.json), [catalogue verdict](../../../screenshots/professional-coverage/web.json). The generic smoke script exits 1 for its optional custom-share-card note; this CAD/admin tracker retains the platform placeholder as permitted for utilities. No rendering/test failure is suppressed.
- [ ] Install current update and repeat installed acceptance. **Not installed yet.** Existing installed app PID 50592 did not close normally; `install.ps1` aborted before launching the installer. User choice on force-closing is pending. Existing saved profile remains untouched. [Installation attempt](install.log).

## Inspected screenshots

![Catalogue desktop](../../../screenshots/professional-coverage/dev.png)
![Catalogue mobile](../../../screenshots/professional-coverage/dev-mobile.png)
![Search results](../../../screenshots/professional-coverage/search.png)
![Embedded report fitted to the workspace](../../../screenshots/professional-coverage/in-app.png)
![Native import review](../../../screenshots/dwg/native-import-review.png)
![Authored design restored after undo](../../../screenshots/dwg/native-undo-restored.png)
![Repaired Redburn roof](../../../screenshots/redburn-roof/native-detail.png)

Visual review: report text remains legible, filters are labelled and unchecked states are explicit; the embedded report fits a 536 px frame in a 566 px centre pane. CAD confirmation has readable paragraph spacing and diagnostics are expandable. Both Redburn gables join the surrounding roof; no floating triangular face or duplicate host surface remains in the tested geometry.

## Evidence and limits

[Implementation diff](implementation.diff) and [source/screenshot/log hash manifest](proof-manifest.json). Final built executable identity: see [native launch](native-launch.json); expected SHA-256 `0e2fd132f4470801c8bcc2facbec931af66ef7133fbd375023388d436094393a` at this verification. Installer: `src-tauri/target/release/bundle/nsis/X-Ray by Looplet_0.1.0_x64-setup.exe`.

DWG imports supported 2D reference geometry; text/blocks/unsupported entities are reported and parametric X-Ray comment metadata does not survive DWG. Export uses the 2013 format. The selected library supports R14–2018-format reading, but the local geometry fixture is not certification of every possible vendor file or object type. Keep the DXF or design backup for editable X-Ray assemblies.

The Redburn reconstruction remains inferred presentation geometry bound to the original 13-page PDF SHA-256 `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`; it is not a certified engineering model or fabrication quantity source.

The A–Z register keeps every expanded requirement open until its full acceptance has current evidence. Initial code findings distinguish partial existing persistence/manual rates from missing whole-project archive, full sheet lifecycle, price-book imports, Firecrawl and authenticated staff delivery. Follow `DAY-TO-DAY-TODO.md`; no all-industry readiness claim.

Prior failed test attempts are retained for diagnosis. Agent-browser's Windows download helper cancelled transfers; a direct CDP download-destination setup plus the same real agent-browser button click produced actual completed file receipts. A relative upload path produced an empty fixture until changed to an absolute path. Temporary native browser caches caused a Vite Windows watcher EBUSY failure; `.temp` is now excluded. Final proof above supersedes those attempts without erasing them.
