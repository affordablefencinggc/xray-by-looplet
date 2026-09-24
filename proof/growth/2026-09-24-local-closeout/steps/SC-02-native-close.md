# SC-02 — current local native build closes ten times

Actual local Windows executable SHA-256 `660e1bfa77d02b0eece9ee47c07286104e2265127ca2583443b95ae00f01fe71`, from the fresh capped build. Default bundled engine `e4693d8f…`; no engine-path override. Each process uses a new private WebView profile, preserving the installed app and user data.

[Ten consecutive process receipts](../native-close01/close-results.json): **10 requested closes, 10 clean exits, 0 forced stops**, 70.9546–113.4788 ms, all below five seconds. All ten execute drawing/calibration, fence/gate specification, approvals, the actual native BOM, imported price mappings and the draft-PDF action. The first additionally invokes Gmail composition; nothing is sent. The remaining nine avoid opening redundant external compose tabs. **1,373 UI operations**, zero captured native browser errors. [Audit and artifact hashes](../stage2-audit.json), [identity-based cleanup](../native-cleanup.json).

Root inspected [first workload](../native-close01/ready-1.png) and [tenth workload](../native-close01/ready-10.png); every run has a separately named screenshot and operation receipt. Screenshots show the completed workload before close; process timing records prove exit. [Exact local harness and ledger diff](../stage2-changes.diff).

CDP disconnects before the close request. This is a bounded workload gate, not an hours-long attached-CDP soak. The historical ignored-close cause was not reproduced; no speculative Rust fix is claimed. The new executable ran directly from build output; the NSIS package was built but not installed. This does not establish all native stock/quote-issue workflows or a real customer quotation.
