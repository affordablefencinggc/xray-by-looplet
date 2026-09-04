# SC-07 transport bridge acceptance matrix

Status: **contract frozen; SC-07A–F and H proven; SC-07G in progress**
Scope: browser TypeScript ↔ Tauri command ↔ Rust host ↔ deterministic Python rules process
Canonical payloads: `xray.job-to-bom/v1` request and `xray.bom/v1` response, defined by `contracts/xray-job-bom-v1.schema.json` and mirrored by `src/studio/bomContract.ts`
Ruleset binding: `fencing-v1`

This document is the executable acceptance contract for the future SC-07 transport. A row may be marked complete only when its named automated test exists and its captured output passes. Source inspection, a successful happy path, or a UI screenshot cannot substitute for the failure-path test named in that row.

## Boundary and non-goals

- SC-07 transports one strictly validated `xray.job-to-bom/v1` request and returns one strictly validated `xray.bom/v1` response. It does not transport the legacy untyped document `takeoff`, Python `quote_lines`, or `fence_bom.py` envelopes.
- SC-07 tests use source-controlled JSON and fake child processes only. **No binary from `engine/bin`, installer, unsigned executable, or other unknown executable may be run for SC-07 acceptance.**
- The packaged-sidecar executable name, Tauri `externalBin` configuration, signature/checksum verification, clean-machine packaging proof, and the current `xray-engine` host/sidecar recursion/name collision belong to **SC-11**, not SC-07. SC-07 must nevertheless keep its process runner injectable so all transport behavior is provable without that binary.
- Marked-PDF generation, pricing, quote composition, Looplet handoff, and installer behavior are outside this matrix.
- Transport errors are not BOM-domain issues. `xray.bom/v1` remains the deterministic kernel response. Tauri/host failures require a separate strict, discriminated transport result whose successful branch contains the exact validated `xray.bom/v1` response.

## Required harness and fixtures

The Rust host must depend on an injectable process-runner seam. Tests provide a harmless fixture process selected by the test harness, never through production path discovery. A fixture receives a bounded request on stdin and is configured to produce one of these behaviors:

| Fixture | Deterministic behavior |
|---|---|
| `ok-response` | Reads the request, checks the supplied request and input digest, and writes the matching committed `xray.bom/v1` response. |
| `echo-binding` | Returns request ID, input digest, job revision, document hash, recipe-set revision/digest, and ruleset binding for equality assertions. |
| `unknown-request-field` | Observes a request containing one extra property; the engine-side validator must reject it before rules execute. |
| `unknown-response-field` | Emits an otherwise valid response with one extra property. |
| `wrong-schema` | Emits a valid-looking response with the wrong schema/version. |
| `wrong-request-id` | Emits a response correlated to another request. |
| `wrong-input-digest` | Emits a BOM bound to another canonical input digest. |
| `wrong-source-binding` | Emits a BOM with a changed job revision, document hash, recipe-set revision/digest, or ruleset version. |
| `malformed-json` | Emits truncated or syntactically invalid JSON. |
| `empty-output` | Exits successfully without a response. |
| `nonzero-exit` | Emits bounded diagnostic text and exits with a chosen non-zero code. |
| `stdout-at-limit` | Emits exactly the configured stdout limit. |
| `stdout-over-limit` | Attempts to emit more than the configured stdout limit. |
| `stderr-at-limit` | Emits exactly the configured stderr limit and then a valid response. |
| `stderr-over-limit` | Attempts to emit more than the configured stderr limit. |
| `stdin-slow-reader` | Reads stdin slowly so request-write cancellation and deadline handling are exercised. |
| `never-exits` | Waits until the host deadline or cancellation signal. |
| `child-tree` | Starts a harmless descendant that records its lifetime so process-tree termination can be asserted. |
| `temp-artifacts` | Creates every permitted scratch artifact and then selects success, failure, timeout, or cancellation. |
| `path-and-stack-error` | Emits an absolute path, traceback/backtrace text, control characters, and secrets-shaped text for sanitisation tests. |
| `multiple-json-files` | Creates the expected result file plus unrelated `.json` files in a scratch directory. |
| `missing-result-file` | Exits zero without creating the exact expected result file. |
| `symlink-result` | Replaces the expected result with a link/reparse-point target where the platform supports it. |

Fixture requests and expected kernel responses come from `engine/fixtures/bom-contract/`. Transport-only mutations must be made on isolated in-memory copies or dedicated transport fixtures; canonical golden files must never be rewritten by a test.

Before implementation, freeze and print these limits in a shared Rust configuration used by tests and production: maximum request bytes, stdout bytes, stderr bytes, response bytes, execution duration, and cancellation grace period. Tests must assert boundary-1, exact-boundary, and boundary+1 behavior. A limit existing only in documentation is not accepted.

## Acceptance matrix

Legend: `R` = Rust host unit/integration test, `T` = Tauri command test, `TS` = TypeScript test, `B` = browser behavior test. Proposed test names are stable acceptance identifiers; implementations may group them into files but must print the identifier on failure.

| ID | Requirement | Automated proof | Pass condition |
|---|---|---|---|
| BR-001 | The request boundary accepts only `xray.job-to-bom/v1`. | `TS contract_request_version_is_exact`; `R request_version_is_exact`; Python contract fixture validation. | Missing, legacy, future, or misspelled schema values fail before rule execution with a typed contract error. |
| BR-002 | Every request object rejects unknown fields at every language boundary. | `TS request_rejects_unknown_fields`; `R request_rejects_unknown_fields`; Python schema test using `unknown-request-field`. | The same injected property is rejected by TypeScript, Rust, and Python; it is never silently dropped. |
| BR-003 | Every `xray.bom/v1` success/error object rejects unknown fields. | `TS response_rejects_unknown_fields`; `R response_rejects_unknown_fields`; Python output validation using `unknown-response-field`. | No layer accepts or persists the mutated response. |
| BR-004 | The canonical request digest is verified before invocation. | `TS changed_payload_with_old_digest_is_rejected`; `R input_digest_verified_before_spawn`. | A one-byte semantic mutation with the old digest produces no child-process start. |
| BR-005 | Response correlation is exact. | `R response_request_id_must_match`; `T response_request_id_must_match`; `TS response_request_id_must_match`. | `wrong-request-id` is a typed failure and cannot update runtime or durable BOM state. |
| BR-006 | Result input binding is exact. | `R response_input_digest_must_match`; `TS stale_input_digest_is_rejected`. | `wrong-input-digest` is rejected even when its BOM body is otherwise valid. |
| BR-007 | Source bindings survive every hop unchanged. | `R source_bindings_round_trip`; `T source_bindings_round_trip`; `TS source_bindings_round_trip` using `echo-binding`. | Job ID/revision, document SHA-256, recipe-set ID/revision/digest, and `fencing-v1` ruleset identity exactly match the request. |
| BR-008 | Stdin is bounded. | `R request_at_limit_is_written`; `R request_over_limit_never_spawns`; `R slow_stdin_honours_deadline_and_cancel`. | Exact-limit input works; oversized input fails before spawn; a blocked write cannot outlive cancellation/deadline. |
| BR-009 | Stdout and final response are independently bounded. | `R stdout_boundary`; `R stdout_overflow_kills_tree`; `R response_size_boundary`. | Boundary output works; excess output terminates the tree, returns a typed size error, and is never parsed or retained. |
| BR-010 | Stderr is bounded and never used as a response channel. | `R stderr_boundary`; `R stderr_overflow_is_bounded`. | Valid stdout remains parseable at the stderr boundary; excess diagnostic output is truncated internally and produces a typed failure without memory growth. |
| BR-011 | Engine execution has an enforced deadline. | `R timeout_terminates_process_tree`; `T timeout_is_typed`. | `never-exits` ends within deadline plus grace, all descendants are gone, and the result is `timeout`, never an empty BOM. |
| BR-012 | User cancellation is distinct from timeout. | `R cancellation_terminates_process_tree`; `T cancellation_is_typed`; `B cancel_leaves_current_bom_untouched`. | Cancellation ends the complete tree promptly, returns `cancelled`, and changes no BOM/revision. |
| BR-013 | Process-tree termination is proven, not inferred from parent exit. | `R timeout_kills_descendants`; `R cancellation_kills_descendants`. | The `child-tree` descendant lifetime record proves no descendant survives either path. |
| BR-014 | The Tauri command is asynchronous from the webview's perspective. | `T command_runs_on_blocking_worker`; `B engine_run_does_not_block_heartbeat`. | A UI heartbeat/input counter advances while `never-exits` is pending; the command supports cancellation and the window remains responsive. |
| BR-015 | All process failures use a closed typed error vocabulary. | Table-driven `R every_process_failure_maps_to_typed_error`; `T typed_error_survives_ipc`; `TS typed_error_parser_is_exhaustive`. | Spawn, write, timeout, cancellation, non-zero exit, size, missing output, malformed JSON, contract, and binding failures each remain distinguishable; no plain string-only error crosses IPC. |
| BR-016 | Successful exit is not sufficient. | `R zero_exit_empty_output_fails`; `R zero_exit_malformed_output_fails`; `R zero_exit_wrong_schema_fails`. | Every fixture fails closed and cannot be interpreted as zero lines or `takeoff: null`. |
| BR-017 | Exact result identity is required. | `R parses_only_expected_result_identity`; `R missing_expected_result_fails`; `R result_link_is_rejected`. | The host derives an exact result identity from the request, opens only that regular file with no link traversal, and ignores/rejects unrelated JSON; it never uses `read_dir().find(...)`. |
| BR-018 | Scratch storage is private and collision-resistant. | `R scratch_permissions_and_identity`; platform-gated Windows ACL assertion. | Each invocation owns a unique directory inaccessible beyond the required user/process scope; request IDs cannot inject path components. |
| BR-019 | Scratch cleanup runs on every terminal path. | Table-driven `R scratch_removed_after_success_spawn_error_write_error_nonzero_timeout_cancel_size_parse_contract_binding`; `T app_shutdown_cleans_active_invocations`. | The fixture root is empty after every case and after simulated host shutdown. Cleanup failure is recorded internally without replacing the primary typed error. |
| BR-020 | UI-facing errors contain no raw paths, stacks, control characters, or unbounded child output. | `R diagnostics_are_sanitised_and_bounded`; `T sanitised_error_crosses_ipc`; `TS error_ui_does_not_render_sensitive_detail`. | `path-and-stack-error` yields a short safe message, stable code/stage/retryability, and optional opaque diagnostic ID; forbidden source strings do not cross IPC. |
| BR-021 | Runtime availability is tested, not guessed from files. | `R status_checks_actual_launchable_config`; `T unavailable_status_is_truthful`; `TS unavailable_disables_run`. | Missing/unlaunchable configured runner reports unavailable. Python source on disk alone is insufficient. Status exposes compatible contract/ruleset versions, not an arbitrary executable path. |
| BR-022 | Source content is validated before any engine process starts. | `R bad_magic_never_spawns`; `T bad_magic_never_spawns`; existing TS document fixtures reused. | Renamed, empty, oversized, unsupported, and malformed plan bytes are rejected before invocation; extension alone is insufficient. |
| BR-023 | Document bytes and engine request stay cryptographically bound. | `R source_hash_is_recomputed_before_spawn`; `T changed_file_after_pick_is_rejected`; `TS result_document_hash_must_match_active_original`. | A time-of-check/time-of-use mutation or mismatched SHA fails before BOM commit. |
| BR-024 | Tauri import does not hide engine failures. | `T import_and_bom_are_separate_commands`; `TS null_is_not_an_engine_result`. | Plan import returns validated plan data only. BOM invocation returns typed success/failure; `.ok()`-style failure collapse is forbidden. |
| BR-025 | Electron host reporting is truthful. | `TS electron_uses_supported_bridge_or_reports_unavailable`; `TS host_detection_never_claims_unused_path`. | If an Electron bridge is supported, its exact method is invoked and contract-tested. Otherwise detection returns unsupported/web behavior and never advertises a dormant `runTakeoff` path. |
| BR-026 | Web-only runtime behavior is truthful. | `TS web_engine_is_explicitly_unavailable`; `B web_cost_never_claims_generation`. | No local engine command is attempted in the web host; UI remains unpriced/blocked without a fabricated success. |
| BR-027 | A validated response is persisted atomically. | `TS successful_bom_commit_is_atomic`; `TS reload_restores_validated_bom_and_binding`. | BOM snapshot, request/input digest, source bindings, recipe/ruleset versions, and revision event survive reload together or not at all. |
| BR-028 | Stale results never replace the current BOM. | `TS changed_job_revision_rejects_result`; `TS changed_document_rejects_result`; `TS changed_recipe_or_ruleset_rejects_result`. | Mutating any bound source while a request is pending leaves the new job untouched; the old response is retained only as explicitly stale diagnostic history if that feature is implemented. |
| BR-029 | Failures never erase the last valid BOM. | `TS timeout_cancel_parse_and_contract_errors_preserve_previous_bom`. | Every transport/error fixture preserves the prior validated BOM and records no false completion revision. |
| BR-030 | Retry identity is deterministic. | `TS identical_retry_keeps_input_digest`; `R retry_keeps_source_bindings`. | A new request ID with unchanged canonical input produces the same input digest and byte-equivalent BOM body. |
| BR-031 | Concurrent completion order cannot corrupt state. | `TS newest_source_binding_wins_not_last_callback`; `T concurrent_invocations_are_isolated`. | Two requests may finish out of order; only the response matching the current immutable binding is committable, and scratch/result identities never collide. |
| BR-032 | Kernel-domain errors remain distinct from transport errors. | `R valid_xray_bom_error_round_trips`; `T transport_error_does_not_masquerade_as_bom_issue`; `TS domain_and_transport_errors_render_distinctly`. | A valid `ok:false` `xray.bom/v1` response preserves its `BomIssue[]`; host failures use the outer transport error branch. |
| BR-033 | No pricing, quote, receipt, or handoff data crosses SC-07. | `TS transport_payload_rejects_forbidden_commercial_fields`; `R forbidden_fields_rejected`; Python schema test. | Injecting rate, amount, tax, margin, quote status, Looplet receipt, or target fields fails strict validation. |
| BR-034 | No absolute input/output path is part of the public job-to-BOM contract. | `TS contract_contains_no_path_fields`; `R child_arguments_expose_only_owned_transport_handles`. | The webview sends canonical data, not arbitrary filesystem paths; any host-private scratch path remains inside the host and diagnostics. |
| BR-035 | Fake-process tests are hermetic. | `R transport_tests_never_resolve_production_sidecar`; CI process-spawn audit. | Tests inject only the compiled harmless fixture created by the test target; `XRAY_ENGINE_PATH`, `engine/bin`, installers, PATH-based `python`, and packaged sidecars are never resolved or executed. |

## Typed transport result

The transport layer needs a strict envelope separate from `BomBuildResponse`. Its exact Rust/TypeScript definition is an implementation task, but acceptance requires this semantic shape:

```text
success: { ok: true, requestId, response: <validated xray.bom/v1> }
failure: { ok: false, requestId|null, error: { code, stage, retryable, safeMessage, diagnosticId|null } }
```

The closed transport `code` set must cover at least: `invalid-request`, `unsupported-contract`, `engine-unavailable`, `spawn-failed`, `request-write-failed`, `timeout`, `cancelled`, `nonzero-exit`, `stdout-limit`, `stderr-limit`, `response-limit`, `missing-result`, `unsafe-result`, `malformed-result`, `response-contract`, `request-id-mismatch`, `input-digest-mismatch`, and `source-binding-mismatch`.

The closed `stage` set must cover at least: `preflight`, `encode`, `spawn`, `write`, `execute`, `read`, `parse`, `validate`, `bind`, and `cleanup`. Raw stderr may be retained only in a bounded host-private diagnostic sink addressed by opaque `diagnosticId`; it is never included in `safeMessage` or the browser-persisted job.

## Execution gates

Run these gates only after the matching implementation files exist. The exact Cargo test filters may be refined by the owning Rust lane, but the acceptance IDs above must remain traceable in test names/output.

```powershell
node --experimental-strip-types --test src/studio/bomContract.test.ts
node --experimental-strip-types --test src/studio/bomTransport.test.ts
npm.cmd run typecheck
& 'C:\Users\danie\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe' test --manifest-path engine/host/Cargo.toml transport
& 'C:\Users\danie\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe' test --manifest-path src-tauri/Cargo.toml transport
```

Python kernel and cross-language parity gates:

```text
python -m pytest engine/python/xray/test_job_bom.py engine/python/xray/test_orders.py -q -p no:cacheprovider
XRAY_PYTHON=python npm run test:bom-parity
```

The latest local convergence proof is `proof/SC-07/convergence.json`; it records byte-identical TypeScript, Python and expected outputs for every frozen response. The local Windows transport manifest is `proof/SC-07/transport.json`: 63 focused TypeScript tests, 60 Python tests with 174 subtests, 34 Rust-host tests plus one intentionally ignored fixture, two focused Windows filesystem-security tests, 24 Tauri tests, and passing development/production browser audits. It classifies BR-001…BR-035 as 34 verified, 1 partial and 0 open. Only BR-013 remains partial: Windows Job Object descendant termination is executed, but the matching Unix process-group test still requires a current Ubuntu artifact. This is executed local evidence, not a remote CI or packaged-sidecar claim.

`proof/SC-07/bom-flow-audit-dev.json` and `proof/SC-07/bom-flow-audit-built.json` pass desktop and mobile generation, cancellation preservation, successful atomic commit, recipe/job staleness and reload persistence with no console errors or overflow. The built audit records an append-only 111-byte observability assignment to the served route chunk, zero statement replacements and its original SHA-256; it therefore proves production-bundle logic under a deterministic fake Tauri invoke, not byte-identical serving or native-engine execution.

## Completion evidence checklist

- [ ] Every BR-001…BR-035 row has a named passing test and captured output.
- [ ] Shared canonical contract fixtures pass unchanged in TypeScript, Rust, and Python.
- [ ] Limit values and boundary tests are recorded in the SC-07 proof output.
- [ ] Process-tree death and scratch cleanup are directly asserted for timeout and cancellation.
- [ ] No SC-07 test executed `engine/bin`, an installer, an unknown executable, or a production packaged sidecar.
- [ ] Browser proof shows nonblocking execution, cancellation, typed failure, stale rejection, atomic commit, and reload.
- [ ] Packaging/name-recursion work remains open under SC-11 until clean-machine packaged proof exists.

Until every checked item has machine evidence, the Rust/Tauri/TypeScript transport remains **unproven** and SC-07 must not be marked complete.
