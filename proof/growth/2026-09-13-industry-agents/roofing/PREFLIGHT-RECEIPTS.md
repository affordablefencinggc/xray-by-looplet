# App-preflight receipt origin and parsing

Root delegated a follow-up in the same two receipt files. Exact `App preflight (not a model call)\n` result prefixes and `App preflight: Running …` progress prefixes are now recognised. The title explicitly says app preflight, not a model call. The body is parsed for the actual context summary; running status remains running. Failed results retain the actual error/refusal sentence without exposing structured JSON. Explicit executionOrigin metadata also preserves attribution when no text prefix exists. Ordinary model receipt behavior remains unchanged.

DANS1 final focused suite: 14 tests pass, zero fail (`toolReceipt-preflight-tests.txt`). Scoped TypeScript exits0 (`toolReceipt-preflight-typecheck.txt`). New cases cover completed context reads, running entries, structured refusals/array failures, origin metadata and unchanged model/lookalike prose. `git diff --check` passes. Full current scoped diff is `toolReceipt-preflight.patch`; prior11-test receipt proof is preserved separately.

Final pair transferred to DANS1 concurrency-source snapshot. No browser or provider calls made in this implementation slice. Source edits stopped before root's final freeze; visual confirmation remains pending that freeze.
