# Industry draft backup and restore integration

Optional v2 industryDrafts snapshots now capture and validate the same-project library. Omitted older records stay omitted and produce no restore mutation. Explicit null restores an empty envelope with a fresh generation; nonnull snapshots preserve forms and revisions while replacing generation. Journal replay validates the generation and canonical allowed addresses. Restore compare/write takes the autosave key lock before comparing bytes. Root's expected-generation CAS rejects delayed pre-restore saves, including empty-slot and equal-revision cases.

DANS1 focused backup/restore tests: 50 passed. Full frozen source/package snapshot hashes verified before npm test: 201 script tests and 1176 TypeScript tests (89 suites) passed. tsc --noEmit exited 0. Full input manifest and regression stdout/stderr/result are adjacent. Initial focused run found one obsolete v1 fixture retaining newly added optional field; corrected fixture explicitly omits it.

No browser restore of user data performed. Backup/restore correctness has executable domain/storage-port proof; browser worksheet/persistence proof is in ../form-live. Root owns draftStorage generation schema and autosave host changes.
