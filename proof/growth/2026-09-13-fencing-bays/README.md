# Fencing bay division — SO-01 / IND-43

## Change

Fencing recipes can explicitly choose `equal` or `full-bays-terminal-cut`. New modular steel candidates use full bays and one terminal remainder; timber retains equal spacing. Each uninterrupted span stops at a corner or gate, so a gate is never bridged by a bay. Half-millimetre gate boundaries are preserved. The actual width is the smaller of the run's declared bay width and recipe post spacing; no manufacturer width or engineering approval is inferred.

The optional field extends the existing v1 recipe inputs. Missing fields retain frozen legacy calculations and responses byte-for-byte. Existing saved recipes are never silently migrated. Older strict-schema kernels reject the added field instead of quietly interpreting it as equal spacing. The v1 transport envelope and handshake remain unchanged; changed choices are bound by recipe revision, recipe-set revision and digest. A changed choice reopens prior recipe assumptions and adds a referenced layout decision. The Estimate screen requires a responsible estimator and preserves the previous choice if storage fails.

## Verification

- 92 Node tests pass: contract/compiler/rules/recipe persistence, BOM state/transport, 9 specific bay-layout cases and 11 industry-register tests.
- 19 Python kernel tests pass. The additional Node tests execute the real Python kernel and compare its complete JSON response against TypeScript.
- 5,000mm modular span -> 2,400 + 2,400 + 200mm. Exact 4,800mm -> two full bays. 100mm -> one partial bay. A 2,001mm gate retains half-millimetre residuals. Two legs around a corner retain one shared corner post.
- The extra cases exposed an existing difference in ordinary-post explanation text between kernels. Python now uses the general higher-role subtraction outside the frozen golden case; both return identical complete responses for the new examples. Old golden responses remain unchanged.
- Unknown rule values are rejected. A rule change leaves the previous object untouched, increments revisions, changes digest, clears approvals, rejects stale decisions and survives storage readback.
- Existing local Edge: separate `QA — fencing bay layout` project created through the app. A synthetic unmeasured, draft run was injected only into that QA project to expose the real Cost pane; no real source or calibration was asserted. Choice disabled without estimator; full -> equal -> full used real controls. Persisted recipe-set revision 3, all assumptions unresolved. Selected rule survived development reload. Original user project remains saved in the library.
- `edge-laptop-current.png` is the inspected 1440x900 screenshot, captured directly after the high-level screenshot helper returned a stale Drawings frame (`edge-laptop.png`, retained as diagnostic only). `edge-layout.png` is an earlier wide capture. The new panel fits its column. Document overflow was false at 1440 and 1024 widths. No tablet visual/touch acceptance is claimed. Browser error log returned []. First synthetic seeding attempt was rejected by schema for a null reviewer before the run was added; corrected to a valid draft.
- DANS1 build a21b5a8b5b1f: typecheck, worker focused tests and production web build exit 0; High priority / 16 workers. This build includes final runtime code; the later added corner test and assessment notes do not change application output. Final local typecheck also exits 0.
- Initial register validation failed because the PowerShell-to-Python pipe replaced the row separator with a question mark. Fixed the delimiter and reran: all 92 tests pass. Earlier output is retained separately.

## Scope still open

SO-01 remains **partial**, and fencing as an industry remains open. No installed desktop BOM generation or built-browser interaction was executed for this change. No post-position editor, choice of which terminal receives the cut, product-specific minimum cut width, stock nesting, slope solver or supplier/engineering acceptance is claimed. No quantities were entered into a quote or sent externally. Stay on fencing until the remaining gates are resolved.

## Files

`src/studio/bomContract.ts`, `contracts/xray-job-bom-v1.schema.json`, `src/studio/bomRules.ts`, `engine/python/xray/job_bom.py`, `src/studio/fencingRecipes.ts`, `src/studio/Studio.tsx`, `src/studio/fencingBayLayout.test.ts`, `planning/industry-specs/validate.test.mjs`, `PROFESSIONAL-A-Z-CHECKLIST.md`, `FENCING-IMPROVEMENTS-TODO.md`, completion/walkthrough notes and this proof directory.

## Process cleanup

No preview, browser helper or tunnel was launched. The foreground DANS1 build completed; no build helper remains active. The existing user-facing preview and normal Edge browser are retained. Temporary viewport override was removed. The separate synthetic QA project remains available for review.
