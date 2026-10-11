# Frozen Windows engine qualification — WIP

This is **engine-only build/qualification tooling**, not an application installer,
native UI acceptance, or a replacement for the maintained DANS1 app build worker.
It never stages `engine/bin/xray-engine.exe` or updates the bundled-engine pin.
The original source engine, contract, host transport and historical package remain
unchanged. Python here is a build/test tool, never a product runtime fallback.

## Current execution boundary

The October 12, 2026 local continuation prepared source/fixture inputs from
`5a6378320ce16b9ad801db094aea31d216e52a42`. Nine local helper tests, six fresh
TypeScript reference cases and their snapshot source bindings passed. **The DANS1
qualification worker did not execute:** PowerShell denied the script under the
effective `Restricted` policy. No new executable exists and nothing is qualified.
Do not change or bypass that policy as part of an unattended retry. Resolve an
authorized host execution method first. Preserve the blocked attempt.

See the separate campaign step proof for input hashes, logs and limitations.

## Components

- `qualify_frozen_engine.py snapshot`: selects regular Git source blobs, excludes
  Python caches, and creates a new uncompressed ZIP and content manifest. It
  includes current Python sources, fixtures, Caroline test assets, canonical
  schema, TypeScript kernels, package metadata and lockfile. It rejects dirty
  selected tracked source. It deliberately does not package an application.
- `frozen-engine-cases.mjs`: computes four frozen-fixture responses and two layout
  responses using the current TypeScript kernel. It hashes its source inputs,
  installed Zod files and Node executable, and refuses to overwrite output.
- `run-frozen-engine-qualification.ps1`: DANS1-only owner, input hash checks,
  sanitized environment, process ownership records and a 1,500-second deadline.
  It is deliberately not invoked with an execution-policy override.
- `qualify_frozen_engine.py qualify`: joins a verified High-priority, all-CPU,
  kill-on-close Windows Job before creating children; verifies/extracts the
  snapshot; inventories the existing toolchain; runs `pip check` and all current
  Python engine source tests; builds with PyInstaller; then tests only the
  declared frozen BOM cases and eight rejection/no-overwrite cases. Each child
  has a deadline and polled output-size bounds. Frozen execution has no Python
  directories on PATH, no engine override and an unrelated working directory.
- `test_qualify_frozen_engine.py`: nine standard-library unit tests covering
  snapshot names, manifest identities, file types, no overwrite, source drift,
  strict JSON, case-source bindings, and child exit/deadline/log-limit handling.

## Preparing a new run

Use a new 12-character lowercase hexadecimal run ID and a new local evidence
directory. Preserve all old run directories. Confirm recovery-branch source and
the untouched `main` worktree before starting. Local background validation must
inherit the already verified aggregate CPU cap of at most 20%; low priority or
thread limits alone are not sufficient.

1. Run the helper unit tests, Node syntax check and PowerShell parser check.
2. Generate the source snapshot with the Python helper's `snapshot` command.
3. Generate `cases.json` using Node's TypeScript stripping support and the case
   generator. Run `verify_cases` against `snapshot.json` before transfer: the
   TypeScript source/fixture hashes must match the exact Git snapshot bytes.
4. Copy the exact Python helper, its test file and PowerShell worker to that new
   evidence directory. Record all six input filenames, SHA-256 hashes and sizes
   in `transfer.json`; record the transfer manifest's SHA-256 independently.
5. Transfer only those six files plus `transfer.json` into the new directory
   beneath `C:\Users\danie\XRayBuilds\engine-qualification`. Verify the worker's
   hash independently before executing it through the authorized host mechanism.
6. Keep the SSH session attached for the entire bounded worker. A detached child
   whose launcher returned is not evidence that the worker is running. Record
   local SSH and remote owner identities, inspect progress at least every ten
   minutes, and stop only verified task-owned processes when no longer needed.

The worker intentionally uses the existing build-only virtual environment at
`C:\Users\danie\XRayBuilds\industry-visible-20260913\native-engine-20260913-1037\venv`.
It does not install/upgrade dependencies. Direct requirements and PyInstaller
versions must match; the full observed installed distribution inventory is
compared before/after. If this environment is unavailable or incompatible, stop
and establish new build-tool provenance rather than silently choosing Python
from PATH or changing old build records.

## Required terminal acceptance

Never accept `qualification.json` alone. Require all of:

1. The PowerShell owner's terminal `exit.json` has `exitCode: 0` and
   `workerExited: true`, after the transferred-input recheck.
2. The helper's qualification verdict, source and toolchain inventories, source
   tests/JUnit report, build command/logs/spec/TOC/warnings, executable digest,
   six fixture/parity results and eight rejection checks are inspected together.
3. The status result satisfies the exact contract triple within the host's
   ten-second / 4,096-byte bounds. Source-test skips remain explicit.
4. Process cleanup is verified by ownership, creation time and executable/command;
   no unrelated processes are stopped and no test helper remains running.

Even a passing future run means only the recorded Windows frozen-engine tests
passed. It does not establish native host invocation, WebView rendering,
application installation, persisted UI behavior, Linux/macOS support, signing or
release readiness. A subsequent source/hash-gated staging decision and native
application QA remain separate. Do not change the staging pin merely because a
build succeeds.

## Hardening and provenance limits

- The Windows Job, PyInstaller invocation and complete qualification path have
  only been statically reviewed at this checkpoint; they did not execute on
  DANS1. The nine local tests do not validate Windows Job behavior.
- Inputs are controlled, hash-bound campaign data, not a general hostile-archive
  service. Path checks do not eliminate concurrent filesystem replacement races.
  Output bounds are polled, not strict filesystem quotas, and may overshoot
  briefly. Descendant containment is for the whole worker, not each individual
  invocation. Do not substitute an untrusted executable or arbitrary requests.
- Installed dependency/executable inventories are observed provenance, not
  independent wheel, base-standard-library or reproducible-build attestation.
  Zod's registry integrity is recorded but the installed tree is not independently
  revalidated against a freshly downloaded registry archive.
- The reference cases run on the local host. Future comparison is full parsed
  JSON equality, not a claim of identical output wire bytes or DANS1 TypeScript
  execution. Generated per-case hashes are supporting metadata; the whole
  `cases.json` digest is the transferred integrity boundary.
- Full Python source tests do not qualify all PDF/CAD commands in the frozen
  executable. The frozen scope is six BOM fixtures and eight specified negative
  cases, not exhaustive malformed-input or whole-product acceptance.