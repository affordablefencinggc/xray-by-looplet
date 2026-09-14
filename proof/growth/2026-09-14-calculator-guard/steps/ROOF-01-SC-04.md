# ROOF-01-SC-04 ? boundary extent and precision

Status: COMPLETE for receipt correction; ROOF-01 live explanation remains OPEN.

Requirement: the next representable run requires **at least** the next course count, not exactly that count for every longer run. Input resolution must not imply PDF precision or source measurement accuracy.

Changed `sheetCoverage.ts`: corrected the unbounded "or more" statement and added `boundaryPrecision`. Arithmetic and accepted inputs remain unchanged. Regression checks confirm 9.8 m = 2 courses, 9.800000001 m = 3, 14.6 m = 3, 14.600000001 m = 4 and 100 m = 21 for 5 m sheets with 0.2 m end laps.

The browser runs the actual project-bound roofing calculator. A controlled provider response displays its returned boundary/precision/lap fields without paraphrasing. [Saved development audit](../live-dev-2026-09-14T12-46-34-441Z/roof-boundary-archive.json).

Visible evidence: [desktop boundary and precision](../live-production-2026-09-14T12-48-31-113Z/roof-boundary-desktop.png), [tablet precision after reload](../live-production-2026-09-14T12-48-31-113Z/roof-boundary-tablet-reloaded.png). The tablet screenshot shows the scrolled precision/lap section; the desktop shows the boundary sentence.

Validation: DANS1 only. [66 focused tests](../focused-tests.log) pass; [TypeScript verification](../verification.json) passes. [Full web build 09c014abc003](../build-proof/results.json) passes, including its 87 existing focused checks. [Build identity](../build-proof/completion.json) records source SHA-256 b9d170acab1c98c2431d9f12b765b9f03f99ad182197840c3e46947ad94a3e8d (871 web files, three fixture PDFs). [Exact source manifest](../build-input/source-manifest.json).

[Development browser result](../live-dev-2026-09-14T12-46-34-441Z/result.json) and [production browser result](../live-production-2026-09-14T12-48-31-113Z/result.json): PASS, clean observed console/network, isolated contexts disposed. Desktop 1600x1000 and tablet viewport 1024x768. Screenshots visually inspected. Controlled provider responses reproduce the regression through the real app tool pipeline, chat and persistence; these are **not live MiniMax acceptance**. No physical tablet, native package, macOS/Linux, installation or deployment qualification is claimed.

Exact product changes: [code.diff](../code.diff), based on commit 6bccb449028286ab3b6461a052b4ba3fe81d55de. Test servers stopped with identity checks: [dev](../cleanup/dev-cleanup.json), [production](../cleanup/preview-cleanup.json). The original user-facing local preview was preserved.

Limits: does not establish that MiniMax will explain these fields accurately. The prior live run's "halves" lap error remains unresolved. No cutting schedule, per-sheet waste, supplier suitability or verified-quote eligibility is established.
