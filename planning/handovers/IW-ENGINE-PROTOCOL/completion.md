# IW-ENGINE-PROTOCOL implementation handover

Status: **awaiting-verification**. This source compatibility protocol is implemented and exercised. This is not overall SC08 completion, generic industry protocol support, native freezing proof or installed Tauri integration proof.

Thread reuse exception: parent explicitly reassigned the existing agent because fresh spawning was unavailable. This packet reread current source/instructions and began with its own `startup.md`. During this packet parent explicitly interrupted work to correct independently reported CORE-01/CORE-02 in the original construction slice. Those corrections have a separate `planning/handovers/IW-SC02/verification-corrections-attempt-02.md` and preserved attempt evidence; they are not part of the CLI patch.

## Changed surface

- `engine/python/xray/cli.py`: adds required exact compatibility command flags and dispatch; lazy-loads existing engine/markup imports only for `run`; suppresses private argument values in parser errors and disables ambiguous flag abbreviations.
- `engine/python/xray/bom_protocol.py`: new bounded stdin transport, digest-pinned frozen-schema validation, existing kernel invocation, strict response/binding validation, safe diagnostics and atomic exclusive result publication.
- `engine/python/xray/test_bom_protocol.py`: 19 protocol tests exercising actual subprocess entrypoints plus focused bounded-read inspection. Existing `job_bom` kernel, schema, requirements, Rust and TypeScript were not modified for this packet.
- `proof/audit/IW-ENGINE-PROTOCOL/capture.py`: repeatable source subprocess evidence capture; creates a fresh attempt directory and records exact raw stdout/stderr, actual result files, command exits/timing, hashes and dependency provenance.

No commits, staging, database changes, global dependency installs or unknown `engine/bin` execution. Shared ledgers remain parent-owned.

## Exact CLI contract

```text
python -m xray contract-status --json
python -m xray job-to-bom --request-stdin --result ABSOLUTE_PATH
```

The equivalent `python engine/python/xray_engine_entry.py ...` entrypoint is also tested. The host's frozen executable will use these same arguments directly after packaging.

Status exits 0 and emits exactly one JSON object and newline:

```json
{"requestSchema":"xray.job-to-bom/v1","responseSchema":"xray.bom/v1","ruleset":"fencing-v1"}
```

No extra capabilities are advertised. Status verifies that the existing `jsonschema` dependency and exact frozen schema asset can load; missing/corrupt schema or unavailable validation causes nonzero exit and a fixed stderr diagnostic, with no success JSON. PDF/CAD/OCR imports are not required for either compatibility command.

Job-to-BOM reads at most 1,048,577 bytes (1 MiB limit plus an oversize sentinel); it requires one UTF-8 JSON object and rejects duplicate keys, malformed/truncated/multiple JSON values, unpaired surrogates, nonfinite JSON constants, unsupported contract shapes and mismatched input digests. Input must pass the frozen request schema. The existing `build_bom` function remains the semantic validation and rules authority.

Successful transport writes a complete validated `xray.bom/v1` result and exits 0 with **empty stdout and stderr**. A well-formed, request-bound `ok:false` domain response is also a successfully completed transport and is written with exit 0 so the existing host can read its structured issues. Malformed input, invalid schema/digest, missing validation capability, corrupt/mismatched engine output, oversize output or write failure returns exit 2 with fixed input-independent stderr and no success message. An absent result can never produce exit 0.

Result output is limited to 4 MiB and checked against the exact success/error schema, request ID, input digest, job/revision, document hash, recipe-set identity/revision/digest and frozen ruleset/version. No kernel error strings, input fragments, private paths or dependency tracebacks are emitted to protocol stderr.

## Result path and publication

The destination must be an absent absolute path directly inside the host's current working directory. The existing Rust host already creates a private scratch directory, sets it as the child cwd and supplies this path. Relative paths, parent traversal, outside directories, missing parent directories, existing files/directories/hardlinks, symlink/reparse traversal, reserved Windows device names and alternate data streams are rejected. No parent directories are created by the protocol.

A unique staging file is created in the host working directory, written completely, flushed and fsynced. Single-component paths relative to the pinned process cwd are used for subsequent file operations, preventing an absolute ancestor path from redirecting publication. After rechecking the destination, `os.link` atomically publishes without replacing any existing path. Size/type/device/inode are verified against the staged file before success; the private staging name is then removed. Filesystems that cannot provide this hard-link primitive fail closed; there is no overwrite/partial-write fallback. Host cleanup owns abandoned scratch content after cancellation/crash.

The CLI bounds bytes; the existing host remains responsible for execution deadlines, cancellation and process-tree containment. The CLI does not install a second timeout process manager.

## Frozen schema packaging requirement: IW-PACKAGE-SCHEMA

This is a **local packaging follow-up**, not an external-service blocker. The source form reads only the repository-owned `contracts/xray-job-bom-v1.schema.json`. Frozen form reads only `sys._MEIPASS/contracts/xray-job-bom-v1.schema.json`; it does not fall back to cwd, environment, PATH or user files.

The packaging owner must bundle the exact existing asset, retaining its bytes and SHA-256:

```text
contracts/xray-job-bom-v1.schema.json
d394988e89d69e342d53559538367ac21b31e4402d7720b7294e237c4f5722b7
```

Include the declared `jsonschema==4.26.0` package and its required runtime dependencies/resources in the frozen executable. Schema changes must be a separately versioned contract decision, not silently accepted by changing this digest. Current source status can work; a frozen bundle missing the asset intentionally cannot claim availability.

## Verification and artifact locations

Final captured attempt: `proof/audit/IW-ENGINE-PROTOCOL/attempt-03/`. Its `summary.json` records exact commands, exits, durations, source/schema hashes, Python identity and wheel provenance. Raw `tests.stdout.log` and `tests.stderr.log` preserve actual subprocess output without PowerShell's NativeCommandError formatting. Original attempts remain available.

Combined suite: **43 tests, 42 passed, 1 skipped, 0 failed** (19 new protocol cases plus 24 existing kernel/contract cases). The skipped case requires creating symlinks, denied in this Windows session; symlink/junction behavioral proof must be rerun where creation is available. Existing-target hardlink rejection, out-of-directory/stream paths, fsync/link write failures, complete staging before publication and simultaneous writers were executed successfully.

Executed coverage includes both entrypoints, exact machine status/stdout hygiene, all four golden responses (Colorbond, timber paling, chain wire, concrete allowance), valid domain-error transport, malformed/oversize/exact-limit/truncated/duplicate-key/unknown-command inputs, schema and digest mismatch, forged result fields/source bindings, absent-result failure, missing/corrupt schema asset, output limits and existing `run` help/missing-input behavior. Successful PDF takeoff under `run` was not rerun; its calculation/output body is unchanged, with only import timing adjusted. PDF/CAD native libraries and native packaging remain separate checks.

Actual final status and four golden subprocess outputs are retained as `status.stdout.log`, `*.stdout.log`, `*.stderr.log` and `*.result.json`. They contain the exact produced engine results rather than copied expected fixtures. `code.patch` records the tracked CLI diff plus both new source files. `diff-check.log` records whitespace verification.

Commands for independent verification (PowerShell; trusted runtime used here):

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) 'engine/python') + ';' + (Join-Path (Get-Location) 'proof/audit/IW-ENGINE-PROTOCOL/python-deps')
$env:PYTHONDONTWRITEBYTECODE = '1'
& 'C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -B -m unittest -v xray.test_bom_protocol xray.test_job_bom xray.test_job_bom_contract_boundary
```

The isolated dependency directory is ignored by a scoped `.gitignore`; do not commit it. Parent approved installing the **already-declared** pinned validator there. Sandboxed network attempts stalled and were terminated; standard reviewed escalation completed the isolated install from cached/PyPI wheels. Directory inheritance was reset only for this dependency directory because elevated installation initially made it unreadable to the sandbox. No machine-wide execution policy or package requirements changed.

`dependency-report.json` and final summary preserve package download URLs, hashes and exact versions: jsonschema 4.26.0, attrs 26.1.0, jsonschema-specifications 2025.9.1, referencing 0.37.0, rpds-py 2026.6.3 and typing-extensions 4.16.0. Runtime: trusted Codex Python 3.12.14. No secret environment values were captured.

## Next owners

1. Independent verifier: review final patch/hashes, rerun protocol and existing kernel tests, inspect actual responses/stdout/status, and rerun symlink/reparse cases in a suitable native environment. Leave status awaiting-verification until that review is recorded.
2. IW-PACKAGE-SCHEMA: add the exact schema asset to the source-built frozen bundle and prove hash/dependency inclusion; do not use unproven `engine/bin` artifacts or a placeholder executable.
3. Native runtime owner: build a fresh executable, configure the existing absolute `XRAY_ENGINE_PATH` boundary, and execute status plus a bound golden calculation through the real Rust/Tauri host with cancellation/timeout/cleanup proof. This packet did not modify those boundaries.
4. Preserve industry-neutral direction: this command is only a compatibility module for the frozen fencing request. Generic count/length/area/volume integration needs its own versioned capabilities and must not relabel this status as generic support.
