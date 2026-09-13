# Industry worksheet checkpoint — 2026-09-13

Estimate now contains a compact, collapsed Industry worksheets section for roofing areas, HVAC straight-duct material and quantity classification. Inputs start empty; each panel invokes the same domain helper as its assistant tool. They remain manual drafts, not verified takeoff, engineering approval or issued quotes.

Inputs save by project and industry using a per-library Web Lock and per-form revision comparison. Edits invalidate results. Failed saves retain visible inputs and offer a download. Backup v2 captures drafts; older packages that omit drafts preserve current data. Restore uses a new generation, including an empty tombstone for an explicitly empty backup, so delayed edits cannot overwrite restored data even when revisions coincide.

## Executed proof

- DANS1 full regression: 1,176 TypeScript tests in 89 suites, plus the script test chain; TypeScript passes. See quantity-surveying/backup-restore. Focused backup/restore campaign: 50 tests.
- Production build 916199981aa8 passes all worker stages. All 830 staged web inputs match the reviewed tree. See form-production-916199981aa8/source-readback.json.
- Production raw CDP: 34 operations across workflow navigation and all three worksheet panels, desktop 1280×900 and tablet 1024×768. No runtime/console errors or horizontal overflow; root inspected screenshots.
- Separate disposable production context: 55 operations including actual Project library create/open UI. Project A's roof input remained intact after creating and editing project B. No direct project-store or localStorage mutation used by the test.
- Roofing manual UI: 100 gross − 5 openings at zero pitch = 95 m² net. Empty input refusal, edit invalidation, recalculation, worksheet switch, reload and tablet result passed.
- HVAC manual UI: 10 m × perimeter 1.6 m = 16 m², explicitly supplied 4 kg/m² = 64 kg. Doubling length invalidated old output and yielded 32 m² / 128 kg. Reload and switch retained inputs; tablet visually inspected.
- QS manual UI: exact 0.3 total / 0.1 assigned / 0.2 unassigned; assigning the second row clears the old result and yields 0.3 / 0.3 / 0. Reload retains draft and results.

## Assistant crosscheck limits — unresolved

HVAC independently executed its actual tool with the observed operands/references. Result, final answer and Developer review agree; exact chat reload and unchanged project are recorded in hvac/form-browser.

Roofing's two fresh comparison attempts made no tool calls. The execution-claim guard withheld unsupported claims. These are failures, not accepted fresh assistant execution; earlier successful receipts are historical. See roofing/FORM-BROWSER-QA.md and failed journals.

QS made six failed calls after replacing supplied null parent/source values with empty strings/objects and invented source placeholders. Its final explanation incorrectly blamed the tool contract. Manual arithmetic and persistence pass, but this assistant crosscheck fails. See quantity-surveying/form-live/failed-turn.json. Investigation continues before the next industry.

## Cleanup and scope

Both disposable production browser contexts were disposed. The owned production preview (PID 4036, creation/command recorded in the build proof) was verified and stopped. The three user-facing DANS1 Edge QA windows and active preview connection remain available with the working examples. No native package or whole-industry readiness is accepted by this checkpoint. No source geometry, calibration, authoritative references or prices were invented by the forms.
