# Hermetic raw status-handshake proof — October 12, 2026

## Requirement

Restore actual `engine_status_with` acceptance coverage after removing OS-shell fixtures. Do not relax the production JSON parser, process containment, configured-runner selection or Python-fallback prohibition.

## Exact source diff

- `engine/host/Cargo.toml`: test-only `transport_status_handshake` integration target, `harness = false`.
- `engine/host/tests/status_handshake.rs`: own `main` dispatches the child fixture before any test-runner text. Its only child program is `std::env::current_exe().unwrap()`. It writes/flushes raw JSON and returns a controlled exit code. No OS shell, installed engine, repository binary, Python or new dependency is used.
- The integration runner reports four independently named checks and exits nonzero on any panic. It honors the existing transport filter, exact/list/ignored selections used by this campaign.
- `scripts/verify-sc07-transport-proof.mjs`: includes/hashes the new source, audits its spawn target, inventories its BR-021 tests and requires all four actual passing test lines in the host log. Older logs without them now fail verification.
- `scripts/sc07-cargo-result.mjs` and its test file: reusable pure log validation, explicitly tested for stale/empty/zero-test results, substring-only markers and earlier-failure/final-success masking. CI executes these tests before capturing proof.
- `engine/host/src/lib.rs`: comment clarifies split bounded-read coverage versus new raw end-to-end proof. Production code unchanged.

## Executed checks

- `cargo fmt --manifest-path engine/host/Cargo.toml -- --check`: exit 0.
- Capped local Windows `cargo test --manifest-path engine/host/Cargo.toml transport -- --nocapture`: host library 37 passed/0 failed/1 ignored; new integration 4 passed/0 failed.
- Capped local `cargo clippy --manifest-path engine/host/Cargo.toml --all-targets -- -D warnings`: exit 0.
- Source/spawn audit: exit 0, no source problems, includes the new current-executable target. Source-only requirements remain 35 partial, not executed acceptance.
- Verifier syntax and diff-whitespace checks: exit 0.

## Proven properties

1. Valid JSON arriving after 2200 ms reports `available: true` through the production default-timeout status function; reverting it to the former two-second budget fails the test.
2. Identical compatible JSON with exit code 7 reports unavailable, independently checking the exit-status boundary rather than relying on harness noise.
3. Each missing, wrong or mistyped request schema, response schema and ruleset is rejected.
4. Empty/truncated JSON, leading/trailing runner text, multiple JSON documents and output overflow are rejected.

## Visual evidence and limits

Nonvisual step; no screenshot taken or altered. The compiled child is a harmless test fixture, not the real frozen calculation engine. Remote Linux/Windows execution still requires a new CI result for the changed commit. Existing private-short-deadline and descendant termination tests remain separate coverage; no timing guarantee for every machine is asserted.