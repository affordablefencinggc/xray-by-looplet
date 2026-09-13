# Roofing actual assistant crosscheck — PASS with recovery caveat

DANS1 target 5109CD8477EBCCE9F4120D7C41B7DA12 / CDP9341. One new user request at 2026-09-13T10:35:17.220Z after root's declaration-focus update. Earlier failed attempts remain intact in history and their prior proof.

Actual model-origin calculate_draft_roof_area receipt c57e48df-46c8-4fab-9fb3-8a5bdcb4b992, call ce979425-c57f-4e4f-82d4-c9042ed6d485:0, used the exact supplied synthetic fixture: horizontal100m², pitch0°, opening5m² and original explicit references. Returned gross100/opening5/net95m², status draft-calculation, verifiedQuoteEligible false. The final answer at10:35:30.985Z matches the manual worksheet result and includes a Developer review accurately reporting one completed tool call.

Audit caveat: the first model response still falsely claimed execution. It was withheld, correction occurred, then the model issued one actual function call and produced the accepted final answer. Three provider responses are visible in the journal. The Developer review says “Friction: None”; that does not acknowledge this internal recovery, although the final user-visible answer and one-call count are correct. This is successful guarded recovery, not evidence that the model reliably calls tools on its initial response.

Packet c7f28f1a-f107-48f2-bd9d-a91fa4209a84 includes tool-intent and tool-result followed by review-required checkpoint; no project mutations. Reload eventually hydrated the original project and exact conversation entries. Initial persisted screenshot captured the opening-workspace loading state and is diagnostic only. form-model-recovery-settled.png is the visually inspected post-hydration Developer review. Checks: projectEqual=true, entriesEqual=true, busy=false, error=null, errors=[].

Proof: form-model-recovery-journal.json.result.json contains full audit; after and settled readbacks retain actual receipt/final/archive; receipt and settled PNGs capture readable output. Source hashes recorded in form-model-recovery-source-hashes.json. Browser left open with successful review, no additional requests.
