# Project material takeoff workflow - 2026-09-06

Authorized: "proceed with everything required to achieve this", following clarification that bolts were only an example and every supplied material is in scope. Continued branch feat/model-wireframe-navigation, baseline 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared changes, existing index and the prior restore snapshot were retained. No staging, commits, worktrees, merge or push.

## Delivered workflow

- General material inventory across structural, architectural, mechanical, electrical, plumbing, fire protection, civil and landscape disciplines. Physical scope keys reject duplicate records; quantities use their actual each/length/area/volume/mass units. Dimensions, method, specification, location, unresolved detail, source hashes/pages and review revisions remain attached to every line.
- Ten matching original public documents, 1,260 pages total (136 drawings plus 1,124 specifications), available in the source library. Imported source bytes and page counts are verified. Every registered source page gets an independent coverage record.
- PDF text discovery and local image OCR produce candidates, never physical counts. Candidate creation starts with unknown quantity; evidence can be linked without duplicate inflation, or excluded with a reason. Sheet/discipline review remains explicit. Local OCR confidence is displayed. Raster PDF decoder assets fix previously blank scanned schedule content.
- Material volume, specified weight and whole-package storage volume are separate. Unknown values remain null. CSV includes dimensions, source identity, calculation, unresolved detail and review state; JSON retains the complete register, coverage and totals.
- Transactional IndexedDB persistence compares the previous snapshot before writing. Unreadable or concurrent state blocks ordinary writes. Explicit backup restoration validates the project/schema and requires a reviewed replacement, archiving the previous raw snapshot in the same atomic transaction. Failed quota/recovery writes preserve both bytes and the recovery block.
- Prepared source inventory: 79 pending-review lines, covering 37 swinging door leaves, five overhead door assemblies, 35 frames, eight selected roof beams, sixteen shear plates, thirty-two bolts and one RTU-1 rooftop unit. Re-import preserves existing physical entries and user edits. The one specified weight is 997.903214 kg; material/packed-volume totals are unknown. [Independent source audit](source-audit.md).
- Source evidence opens in a hash-bound modal and can load its original bundled revision automatically. Switching documents cannot display the previous evidence page against a different source. Generated build directories no longer trigger development reloads.

## Verification

Typecheck and 633 automated tests passed (198 script tests, 435 TypeScript tests). The new 21 tests include real PDF extraction, physical deduplication, source/quantity validation, revision/review invalidation, evidence rescans, prepared schedule counts, idempotent import and complete CSV fields. [Typecheck](typecheck.log), [tests](tests.log).

Web production and NSIS desktop builds passed. [Web build](build.log), [exit](build-exit.txt), [desktop build](desktop-build.log), [exit](desktop-build-exit.txt). PowerShell captured native deprecation warnings as NativeCommandError records; explicit process exit records are zero.

Thirteen focused scenarios were run against development, production, packaged native and installed native apps. Coverage includes source import, all-page text scanning, local OCR on a real raster sheet, actual JSON/CSV downloads and readback, reload persistence, stale approval reset, atomic archive/restore, malformed newer-version protection, injected quota rejection, source schedule preview, candidate dispositions, scope controls and a source-only 79-line export. Desktop/mobile smoke checks show visible content, no page/console errors, no horizontal overflow and no production baseline divergence. The utility retains the platform share-card placeholder note. [QA script](qa.mjs), [dev report](../../../screenshots/project-materials/dev/report.json), [built report](../../../screenshots/project-materials/built/report.json), [native report](native-qa.json), [installed report](installed-qa.json).

Inspected actual desktop, mobile, raster schedule and native screenshots. [Installed inventory](../../../screenshots/project-materials/installed/11-source-inventory.png), [mobile](../../../screenshots/project-materials/dev/07-mobile.png), [source schedule](../../../screenshots/project-materials/dev/09-mechanical-schedule.png). The explicit QA dimensional fixture was removed before source-only exports and screenshots. [Source-only CSV](../../../screenshots/project-materials/installed/source-only-materials.csv), [JSON report](../../../screenshots/project-materials/installed/source-only-materials.json).

Browser automation used Playwright/Edge and the native WebView debugging connection in isolated profiles. This is not a claim of working MCP transport or Android/ADB verification.

## Installation and recovery

Verified build SHA-256: 227b6096276631d7823935df36f82b294280f3219948a14da494515ad2102dc5.

Verified installed SHA-256: 3e0399a63cbe7c5836f84ee2967bedfab0eaccb70f165e09fd15d9868e5b6a0b. Full binary comparison matches after the single documented Tauri NSIS marker substitution. The old executable was backed up and the user's existing profile retained. [Installation](install.json), [binary identity](bundle-identity.json), [normal launch](installed.json), [service cleanup](services-stopped.json).

[Exact task-only code diff](code.diff) compares touched files against before-task copies; [code and runtime/source asset hashes](changed-files.json) distinguish this work from pre-existing changes.

## Still open: whole-building completeness

This release completes the general workflow and bounded multi-material trial, not the requested ultimate whole-building takeoff. The supplied 1,260 pages still require full physical reconciliation. Hardware group contents, services distribution, finishes, concrete/reinforcement, civil/landscape and remaining assemblies are not all quantified. Missing sprinkler/shop/fabrication details and supplier packaging/weight information prevent a defensible last-item completeness claim. All prepared materials remain pending review and every registered sheet remains unapproved until checked. The low-rise Thornton trial does not establish high-rise extraction completeness. [Live remaining work](../../../PROJECT-MATERIALS-TODO.md).
