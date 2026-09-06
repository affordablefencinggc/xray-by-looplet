# General construction runs — phase 2 completion

2026-09-06. User authorized “proceed” and “continue”. Adopted branch `feat/model-wireframe-navigation`, baseline `3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe`. Shared pre-existing changes preserved. No staging, commit, publication or additional worktree.

## Behavior shipped

- New source projects default to a general run specification. Existing fencing jobs retain their workflow. Switching types retains both sets of entered fields.
- General runs accept an assembly, trade/work package, source reference and length / strip-area / rectangular-volume basis. Readiness uses those fields without requiring fence posts, bays, ground or sleepers.
- Quantities are recomputed from traced geometry and a locked calibration tied to the active source drawing. Missing originals, missing dimensions or unverified/foreign scale withhold the quantity. Output includes the formula and review state. Small positive volumes are not rounded to zero.
- Existing persistence saves the new fields. Edits increment revisions, invalidate approval and reject stale revisions through the established command path.
- Cost shows general measured quantities and scope. The fence compiler rejects any job containing an active general run, even when retained fence attributes match a valid recipe. Fence recipes are not initialized for that view.
- Fixed a stacked mobile layout that reduced the inspector to a 9 px scroll area. Browser proof now checks that the quantity is actually visible and unobscured.

## Executed proof

- `npm run typecheck`: exit 0, [log](typecheck.txt).
- `npm test`: exit 0, **574 tests** (198 script + 376 TypeScript), [log](test.txt).
- `npm run build`: exit 0, [log](build.txt), [exit record](build-exit.json).
- **Eight UI scenarios pass in both dev and final built output**, using file chooser import of an explicitly labelled synthetic SVG, manual calibration and traced run, all three bases, type switching, approval, revision invalidation, reload, mobile editing and the existing scale-change guard. [Replay](browser-proof.mjs), [dev report](../../../screenshots/general-runs/dev/report.json), [built report](../../../screenshots/general-runs/built/report.json).
- Desktop and mobile screenshots visually inspected: [editor](../../../screenshots/general-runs/built/01-volume-editor.png), [cost quantities](../../../screenshots/general-runs/built/02-cost-quantities.png), [mobile editor](../../../screenshots/general-runs/built/03-mobile-editor.png), [mobile cost](../../../screenshots/general-runs/built/04-mobile-cost.png).
- Generic smoke renders real content at desktop/mobile with no console errors, page errors or horizontal overflow. [Dev](../../../screenshots/general-runs/smoke-dev.json), [built](../../../screenshots/general-runs/smoke-built.json). The generic baseline still reports the previously documented dev annotation canvas/text difference; its canvas heuristic flags game branding in dev. This construction utility has no custom game card. Generic baseline equality is not claimed; feature behavior and actual screenshots were verified in both builds.
- Temporary dev/preview processes stopped; [listener check](services-stopped.txt). Windows npm-script fallback used because `sh` is unavailable, as in earlier slices. Playwright/Edge fallback used because agent-browser is unavailable.

## Exact changes and remaining scope

[Implementation delta](implementation.patch) compares this slice against saved pre-turn files, excluding earlier shared changes. [Source hashes](source-hashes.json) identify the 11 final product/test files.

This completes the run-specification phase, not the whole decoupling roadmap. Existing v2 job persistence remains in place; standalone polygon/count readiness, ConstructionJob repository migration and generic assembly BOM packs remain next. General quantities are gross geometry: no opening/overlap/waste deductions, packed stock volume, inferred density or mass. The QA 4 m³ example is demonstration data, not an Altitude quantity or a real supplier schedule.
