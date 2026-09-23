# SC-02: ten consecutive native workload closes

Status: bounded native graceful-close gate PASS; historical hang cause OPEN.

DANS1 interactive desktop; isolated profiles; packaged executable SHA-256 5e881bd6756fcc7199f9298557b20da637cb29bab0d84db7cd5ee28797161d9b (8a6226fc93a6 build). No install or native source changes.

Each of ten fresh processes completed 140 UI operations: real Redburn drawing/calibration, fence and double gate, approvals/current BOM, reviewed rate import/mapping, draft PDF download and Email with Gmail. Nothing sent. Each then accepted CloseMainWindow and exited in 52.7583-85.9238 ms, below 5 seconds. Forced closes: zero in this final gate. All task-owned app identities are absent after cleanup.

[Ten process identities, request and exit times](../native/close-results.json), [all workload receipts](../native/all-workloads.json), [first inspected screenshot](../native/ready-1.png), [tenth inspected screenshot](../native/ready-10.png), [exact harness diff](../changes.diff), [cleanup](../cleanup-summary.json). Each run has its separately named ready-1.png through ready-10.png. Screenshots show the quote workload before close; process logs prove exit.

Earlier harness attempts are retained in attempt1-close-results.json and attempt2-close-results.json. First attempt reused a CDP endpoint and did not retry destroyed startup contexts; its incomplete workloads and forced cleanup are not included in the final 10/10. The corrected probe uses distinct verified loopback endpoints, retries only navigation-context destruction within the original deadline, then disconnects CDP before CloseMainWindow.

Limits: this is a bounded workload, not hours-long attached-CDP use. Native Share PDF is absent by prior design; Gmail handover was exercised. External browser tabs were not inspected, sent or broadly terminated. The historical Rust/window-close cause was not reproduced or fixed.
