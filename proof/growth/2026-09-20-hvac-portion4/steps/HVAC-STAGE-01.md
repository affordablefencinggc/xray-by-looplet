# HVAC-STAGE-01 - network and schedule foundation (WIP checkpoint)

Requirement: advance Portion 4 (SC-12/13/14), preserving draft provenance and automatically checkpointing before 100-150 pending files.

Frozen source: `hvac4-4edba61c6876`, SHA-256 `4edba61c687633e6bc73d062ca1f2dc36621ebfd7edd581555023b550be84375`, based on `ea35b253`. See [manifest](../source/freeze1.json) and [exact diff](../source/stage1.patch).

Executed on DANS1:
- [Machine gate](../machine1/results.json): 2,058/2,058 tests; typecheck exit 0; scoped lint zero errors, one unused section-preview import warning (follow-up required). This also registers the existing 14 material-basis checks in the normal gate.
- [Development interaction](../campaigns/hvac4-network-dev2/output/browser-results.json): 37/46 operations completed; beam/plenum/transition warnings, actual WebGL network, corrected network, export invalidation and three real downloads exercised. FAIL at reload hydration deadline; no uncaught browser errors recorded. This remains incomplete, consistent with the separately recorded SC-09 development reload failure.
- Initial [dev1 attempt](../campaigns/hvac4-network-dev1/output/browser-results.json) stopped at operation 7 because the test had not navigated to Estimate. Navigation corrected in dev2; failed evidence preserved.
- Both launchers recorded owned-process cleanup; no unrelated process cleanup is authorized.

Screenshots inspected:
- [Desktop clashes](../campaigns/hvac4-network-dev2/output/captures/network-clashes-desktop.png): actual 3D core/insulation, beam, red run and three text warnings.
- [Tablet corrected network](../campaigns/hvac4-network-dev2/output/captures/network-tablet.png): zero bounded issues, readable preview, no horizontal document overflow.
- [Prepared package](../campaigns/hvac4-network-dev2/output/captures/sealed-package-desktop.png).

Actual production browser-generated artifacts: [PDF](../exports-built1/hvac-commissioning-draft.pdf), [CSV](../exports-built1/hvac-commissioning-draft.csv), [sealed JSON](../exports-built1/hvac-commissioning-draft.json). Captured from the real Blob downloads without replacing product calculations. Machine checks load the PDF and reject tampered seals; PDF visual inspection is still pending. Development download telemetry was truncated, so returned bytes are from the bounded production capture.

Status: WIP, not completion of SC-12/13/14. Straight-section preview wiring, broader input interaction and final per-slice evidence remain. Production network qualification passed 136/136 operations, including reload and export bytes; see [receipt](../campaigns/hvac4-network-built1/output/browser-results.json). The required scripts/dans1-build-worker.ps1 completed its web-only build on DANS1 with High priority/all 16 processors under the safe owned-process wrapper: [build receipt](../build1/results.json), [worker completion](../build1/worker-completion.json). Pressure is an entered Pa/m allowance, not a solved pressure loss; beam checks use conservative envelopes. No pipe/fitting solver, native/deployment acceptance, certification or live Jev execution is claimed. Draft PDF replaces unsupported font characters with '?' while retaining original UTF-8 content in its attached JSON.

Checkpoint rule is persisted in AGENTS.project.md: count actual changed files, freeze at 100 with a 150 ceiling, explicitly commit/push stages and proceed automatically. This is the agent execution contract, not an unattended background daemon. This smaller checkpoint leaves room for the active build's returned evidence. User authorized ordinary feature-branch pushes on 2026-09-20.
