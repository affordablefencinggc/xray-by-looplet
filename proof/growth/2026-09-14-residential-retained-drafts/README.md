# IND-01 retained apertures and saved stage drafts

Authorized continuation from be76fab on feat/architect-cad-engine. Parallel agents handled aperture rendering/review, draft domain/tests, and UI/browser proof; root integrated contracts and ran regression/build qualification on DANS1. No source-backed survey, construction approval or whole-industry completion is asserted.

## Individual step proof

- [SC-01 explicit retained-opening intent](steps/SC-01.md)
- [SC-02 aperture drawing and PDF](steps/SC-02.md)
- [SC-03 frozen saved drafts and persistence](steps/SC-03.md)
- [SC-04 mounted assistant operation and independent review](steps/SC-04.md)
- [SC-05 desktop/tablet built-output workflow](steps/SC-05.md)
- [SC-06 final regression and web/native package](steps/SC-06.md)

Every completed step has its own file and separately named screenshots. Screenshots prove visible state; numerical, persistence and build claims use executed receipts. [Exact source diff](source.diff) covers all28 product files including5 new modules/tests; [final source comparison](final-source-check.json) binds current files to868 web inputs. Native106 inputs are separately bound by the worker.

## Verification

DANS1 full regression:201 script +1,314 TypeScript tests pass. Two type declarations were corrected after initial typecheck findings; final typecheck and8focused canvas tests pass. No product logic test failed. [Initial and final logs](proof-retained-tests/result.json).

Dev100/100, production106/106 and mounted adapter20/20 browser operations pass, with cleanup after each campaign. Production serves actual5b80085aab3f output; generic runner limitation text is supplemented by task/build identity and is not an installation/release claim. Actual captured [frozen proposed PDF](proof-retained-drafts/sc02-frozen-proposed-draft.pdf) and its cover/drawing screenshots are preserved. Desktop1440x1000/tablet820x1180 layouts inspected.

Saved drafts preserve complete source/annotation snapshots and reviewed stage/selection; source hash is an integrity check, not authenticated approval. Five-record/size limits and failed saves report clearly. DXF into another project excludes original-project saved archives with a warning. Retain-void preserves wall cuts but removes fixture representations; PDF reference attachment and IFC void relations preserve that distinction.

## Remaining scope

Explicit physical infill, changed repaired geometry, phase work-category allocation/material procurement, coordinated construction issue sets, live provider/Developer explanations and full native/platform workflow acceptance remain open. This batch supplies frozen draft records, not issued drawings. No installation, deployment or merge performed.

Final build5b80085aab3f web/typecheck/native NSIS passes, native304.42seconds. Worker source recheck and final cleanup pass. See [native completion](build-5b80085aab3f/native-completion.json) and [cleanup](final-cleanup.json).
