# Native DWG continuation

Authorized 2026-09-07: user said "if thats what was next" in response to continuing native DWG support.
Baseline: feat/architect-cad-engine at 3e422f0084de607a775c2ede8dfecdf0b032c75e, with prior architectural/navigation/voice work uncommitted. Preserve that work and user data.

- [x] SC-05a ACadSharp 3.7.1 evaluation: 431 entities across two levels, units, layers, text and curve geometry survived DWG and independent LibreDWG 0.14 readback within 0.0000001 mm. Parametric DXF comment metadata does not survive; DWG scope is drawing geometry. See converter-proof.json. Proof: `proof/audit/IW-DWG/`.
- [x] SC-05b Selected MIT-licensed ACadSharp for local Windows desktop conversion after user delegated platform choice ("you pick"). No subscription. Web remains DXF; translator and Microsoft license notices bundled. Corrected missing DXF layer declarations exposed by strict-reader baseline failure. Proof: `proof/audit/IW-DWG/`.
- [x] SC-05c Implement the selected translator with bounded input/output, cancellation, diagnostics and import review. Native import/cancel/undo/redo verified; fixed stale selected-level crash exposed by the import undo test. Actual UI download independently decoded and geometrically compared to the authored 412-entity fixture. Code diff, native-final.log, native-ui-independent.json and inspected screenshots in proof/audit/IW-DWG/ and screenshots/dwg/. No assemblies inferred from external vectors.
- [ ] SC-05d Verify native DWG with an independent reader, desktop/web workflows, builds and regression checks before marking SC-05 complete. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 06]

Proof: proof/audit/IW-DWG/. Evaluation binaries stay in its ignored runtime directory. No application dependency, SDK subscription or public deployment is authorized by the research alone.

Current delivery: web and Windows builds pass; 684 JS/TS tests and 29 Rust tests pass; native and dev/production checks pass. Final installer built. Normal close request to existing installed process 50592 did not close its window; installer was not started. User decision about force-closing is pending. Existing saved profile retained. SC-05d remains open until installed verification is complete.
Document status: open (1)
