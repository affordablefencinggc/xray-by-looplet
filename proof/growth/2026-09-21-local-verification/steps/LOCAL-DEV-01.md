# LOCAL-DEV-01 — local startup and HVAC reload verification

Host: Daniel. Branch: feat/closeout-sc09-remainder. Base: 3f4df26c1721ffe1498b154349af78bfaa7fcab5. User explicitly authorized local execution. This is development-browser evidence, not production build, deployment, native-package or DANS1 acceptance.

Requirement: launch locally with isolated browser storage, retain strict host checks and cleanup, and verify the existing HVAC editing/export/reload scenario.

Changes: Tailwind scans application source instead of the repository's proof and snapshot trees. Retain the development-only TanStack synthetic-stylesheet workaround. Local execution requires the explicit switch and binds evidence to Daniel. Readiness checks retry only bounded navigation-context loss within the original deadline.

- [Exact source diff](../source/local-stage.patch).
- [Executed 75/75 browser operations](../reload-dev3/browser-results.json), no unexpected browser errors. [Verified process cleanup](../reload-dev3/launcher-results.json).
- [Desktop screenshot](../reload-dev3/captures/fittings-duct-desktop.png) and [tablet after reload](../reload-dev3/captures/fittings-reloaded-tablet.png), visually inspected. They show the rendered source-linked sample fittings, persisted network and declared limitations. They do not establish fabrication accuracy.
- [Comparison without the synthetic-stylesheet workaround](../reload-dev4/browser-results.json): 66/75, fails readiness after reload. Startup without the Tailwind source restriction failed in [dev2](../reload-dev2/launcher-results.json), with a stylesheet transform timeout in its stderr log. Preserve both failures. These observations support the combined configuration, not a universal upstream root-cause claim.
- Full registered local regression batches: [203](../machine/suite-3.log), [867](../machine/suite-4.log), [1036](../machine/suite-5.log), all passing: 2,106 total. Both guard commands passed; [execution receipts](../machine/suite-results.json). Full suite ran before the navigation helper change; its separate [six runner tests](../machine/cdp-tests.log) passed afterward.
- TypeScript exit 0: [log](../machine/typecheck-final.log). Scoped product lint exit 0: [log](../machine/lint-final.log). Final runner lint exit 0: [log](../machine/runner-lint.log). Empty logs mean the successful commands emitted no diagnostics; statuses are recorded in [gate receipts](../machine/gates.json).

Limits: full SC-09 journey, production build/render and device qualification remain open. Startup readiness probes produced aborted-request server diagnostics; browser acceptance reports no unexpected errors. Earlier proof remains unchanged. No user browser data was used or removed.
