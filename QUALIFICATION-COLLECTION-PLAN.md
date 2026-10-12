# Next qualification gate: trusted preparation and collection

October 12, 2026. **Observer component independently tested; trusted preparation and collector OPEN.** This file
preserves concrete findings from independent design reviews `run_00033`,
`run_00037`, `run_00038`. DANS1 operation is authorized; no permission re-request
is needed. Stop before installation. Keep legacy producers/pin/receipts unchanged.

The separate declared-coverage consistency gate now has worker and independent
executed proof at `0c94244c` (19 coverage regressions plus 21 preflight). This checks
declared identities only, not trusted collection or full function/parameter coverage.
Its exact narrow `xray.collected-tests/v1` schema is unchanged. The additive
observer now emits a separate `xray.pytest-collection-observation/v1` envelope.
Clean worker `1a6dbfe4fa50` and independent `568657937b59` at `d553c480` each
passed 21 preflight + 25 observer regressions, zero skips. These are actual
pytest 9.1.1 runs on synthetic fixtures, including independent real JUnit mapping,
not collection of the engine source or an authenticated inventory approval.
See `collection-observer-executed.md` and `declared-coverage-executed.md` steps.
Step 1 has this tested component only; trusted preparation/approval integration
and step 3 remain unimplemented. All authentication/engine/app flags remain false.

### Tested observer component and next integration boundary

`scripts/collect_qualification_tests.py` requires externally pinned run/source/
snapshot identities, a verified extracted source tree, an absent sibling output,
and an expected relative pytest root. It rejects configuration/ancestor conftest
contamination, unexpected plugins (including transient registration), nondefault
effective settings, collection diagnostics/warnings, source mutation and invalid
identities. Active collection and post-cleanup plugin contexts are separate.
It preserves the producer's selection/default-option semantics, adds collect-only
and redirects diagnostic JUnit to sibling `collect-only.xml`, **but uses
`pytest.main(..., plugins=[observer])`, not the producer's `python -m pytest`
entrypoint**. Do not claim equivalent producer execution from this component.

Next: an independently pinned preparation launcher must extract the exact ZIP
into a fresh sibling, bind the fixed DANS1 Python/dependencies/observer/import
dependencies, provide queried containment and an external hard deadline, retain
logs and actual process exits, and approve the full source/parameter inventory
separately before producer execution. It must compare preparation and producer
ancestor/root/config contexts without changing preserved producer arguments.
The observer does not itself extract a ZIP, authenticate a channel/owner, enforce
an OS-level watchdog, or establish adversarial same-process isolation. Current
local development harness polling is not the required DANS1 hard watchdog.

## Why the offline gate is insufficient

The offline artifact gate is independently tested at `9cc49c9c`, but complete
self-consistency cannot prove execution. Legacy terminal records have no trusted
run/owner binding. A receipt hash is not authentication when its expected hash is
read from the same submitted bundle. Root phase 1 is still only provenance/tooling.

## Implement in order

1. **Trusted source preparation and test inventory.** Add a separately pinned
   pytest observer, not an edit to preserved producers. Run collect-only under the
   same fixed Python, pinned dependencies, sanitized environment and argument
   semantics, on a fresh sibling extraction of the exact source ZIP. Collect-only
   imports source and therefore needs containment/deadlines/ownership. Ordinary
   collect-only JUnit is not a reliable testcase list: observer records exact
   nodeids, source hashes, collection errors/skips/deselections, rootdir/inifile
   and exit status. Pin mapper code for pytest JUnit `(classname, name)` identities.
   Compare with independently reviewed source/parameter inventory before approving
   its digest; never derive expectations from the later execution JUnit.
   **Observe and pin pytest root/config discovery; do not equate cwd with rootdir.**
   Version 9.1.1's no-config fallback intersects invocation directory and argument
   ancestor, but ancestor configuration/setup files can change that result. Inspect
   both preparation and producer ancestor contexts, preserve exact nodeids, and
   bind observed relative root/config/effective settings. Do not add `--rootdir`
   or `-c` to the preserved producer to disguise a mismatch. The version-tagged
   primary source reviewed was `pytest-dev/pytest` tag `9.1.1`,
   `src/_pytest/config/findpaths.py` and `src/_pytest/junitxml.py`.
2. **Coverage validator and rejection tests.** Require exact identity multiset,
   no duplicate/missing/extra cases, zero collection errors/skips/deselections,
   actual zero failures/errors. Default `allowedSkips: []`, `maxSkipped: 0`.
   A permitted future skip stays a skip, never a pass. Pin any exception before
   execution; dependency import failures are not optional skips and do not authorize
   dependency installation/upgrades.
3. **Separate pinned DANS1 collector plus external watchdog.** Fresh producer root
   begins with exactly six transferred inputs plus transfer manifest, no outputs.
   Collector control/plan/logs live in a sibling directory, not producer output.
   Independently pin plan, collector, Python and legacy helper raw hashes before
   launch over the existing authenticated SSH channel. Check policy scopes;
   no persistent changes or managed-policy evasion. The approved process-only
   PowerShell Bypass applies only to independently hash-verified workers.
4. **Collected-envelope verification.** Bind raw terminal/worker records, all
   source/build/runtime artifacts, prep approval/test inventory, queried resources,
   retained process identities/exits and owned cleanup. Local copy must match
   remote inventory and the receipt digest observed through the trusted completed
   launcher. Separate independent inspection is still needed before engine review.

## Current-source test inventory findings (static, NOT executed)

18 test modules, 180 test definitions, four `test_orders.py` parameter expansions
add 17 items: approximately **197 expected collected items**. This is not a trusted
collected count. Pin exact nodeids and parameter identities through step 1.

Only identified runtime skip site: `engine/python/xray/test_bom_protocol.py`,
`BomProtocolTests::test_symlink_output_and_symlink_directory_are_rejected_when_supported`.
Its broad `OSError` catch means a skip does not by itself establish missing privilege.
Default policy rejects it. Offline-validator junction tests are not compensation
for missing product-engine symlink coverage. Any later waiver needs exact reason,
same-context capability evidence and explicit risk review, not broad host approval.

Missing pikepdf/pdfium/ezdxf/jsonschema causes genuine import/collection failures.
Existing six dependency pins remain authoritative; no upgrades. Snapshot must
include the full selected source/fixtures/models/schema, not only tests. Protocol
tests can leave empty `source/proof/audit/...` directories after cleaning temporary
files; exact selected file inventory is distinct from “no additional directories”.

## Minimal prelaunch and completion contracts

Externally pinned `qualification-plan.json`:

- Schema/run ID/source commit; exact snapshot/ZIP/cases/transfer/source-preparation
  receipt hashes; helper/collector/observer/JUnit-mapper hashes.
- Expected DANS1 host, absolute Python path/hash, existing dependency pins, fixed
  separate producer/preparation/collection roots and sanitized-environment policy.
- Exact collect argv/cwd, bounded logs/time, expected rootdir, absent inifile;
  static reviewed test-policy hash; zero-skips/deselections/default policy.
- Installation/staging/promotion false.

Separate prelaunch approval **after preparation, before owner launch** pins the
derived collected-test inventory and preparation receipt, plan, skip policy,
reviewer/time and reviewed source/test identity. This avoids circular expectations.

Collection receipt binds plan + approval + collected inventory, file/directory
inventories and raw owner/worker/exit/qualification/JUnit/log/executable hashes.
It records queried resource limits and observations, actual retained-handle exits,
monotonic elapsed time and cleanup. Reject links/reparse points/ADS/hardlinks in
the trusted collector; bound all files/nodes/total bytes and rehash after quiescence.
The existing offline file inventory is not sufficient for this stronger contract.

Final collector job `ActiveProcesses == 1` means **collector only**, not empty job.
External bootstrap observes the collector's actual exit 0 and relays the digest;
do not put its own future exit or the collection's own hash inside that receipt.
Authenticated-channel observations must supply external pins, not self-reported
booleans. Only then consider `eligibleForEngineReview`; not automatic qualification.

## Execution/resource details to test before real qualification

- Verify q helper bytes before loading; execute the same verified bytes, avoiding
  loader rereads/bytecode substitution. Fixed Python with `-I -S -B`; trust in host
  account/runtime/ACL remains explicit (Python exe hash does not attest all DLLs).
- Reuse reviewed `q.windows_job()` only after verification. Query exact flags
  `0x2030`, High priority `0x80`, affinity `0xFFFF`, 16 active processors/one group,
  membership and noninheritable handle. No breakaway. Reject unexplained restrictive
  ancestor jobs. Eligibility on all CPUs is not guaranteed CPU allocation.
- Launch legacy owner suspended with retained native handles when claiming
  pre-execution resource verification, query before resume. Ordinary post-launch
  queries must not be called whole-lifecycle proof.
- Retain owner handle and independently observe live worker identity. A missed
  short-lived worker cannot become authenticated from its JSON alone. Compare
  worker 100ns timestamps exactly; normalize CIM owner microsecond precision only
  as documented, preserving both raw and native identities.
- Legacy owner deadline stays 1500 seconds. Proposed whole collector envelope
  1600 seconds includes collection. External attached watchdog retains collector
  process handle and enforces wall time even during blocking hashing/import/I/O;
  internal polling alone is not a hard watchdog. Timeout/missing receipt fails.
- Before success: actual owner exit 0, legacy exit 0/workerExited, no worker-error,
  input hashes unchanged, every retained handle exited, job collector-only, output
  quiescent, repeated inventories equal. Bootstrap/SSH also exits 0, local owned
  launchers gone. No cross-host timestamp ordering (known clock skew).

Implement and independently test these behaviors with controlled owned fixtures
before running a fresh immutable-ID DANS1 engine qualification. None of this plan
authorizes staging-pin promotion, native installation, push or merge.