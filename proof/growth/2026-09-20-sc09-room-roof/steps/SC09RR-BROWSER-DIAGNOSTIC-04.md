# SC09RR browser diagnostic 04 — exact dev2 boundary replay

Date: 2026-09-20  
Frozen source: `bf09e36e3100a5cfa9ef4565892edc8e28fdb791a3ec9341375af7fd91394e55`  
Host: DANS1  
Method: raw fast-CDP against the frozen source snapshot

## Decision

The original dev2 result remains an immutable `FAIL`: `54/92` completed operations, with operation index 54 failing because `Move area vertices` matched `:disabled`. Its failure screenshot does **not** establish why; the button is below the captured viewport fold.

A later, separately identified diagnostic run replayed the hash-pinned dev2 operations `0..53` and replaced only the failing click with a non-mutating DOM probe. This was a fresh replay at the same boundary, not reconstructed original DOM and not a claim that the original screenshot exposed the disabled reason. The replay recorded:

- `Move area vertices`: exists; own `disabled` property `false`; `matches(":disabled")` `true`.
- ancestor fieldset: `disabled=true` and `matches(":disabled")` `true`.
- source preview: `data-source-ready="false"`, `aria-busy="true"`.
- status: `Preparing source page … Measurement begins when the source is ready.`
- selected/result identity: room `area-sc09-room-a`, revision 1; measured quantity empty at that boundary.
- source image and plan canvas already existed, while the product readiness callback had not yet settled.

Therefore the reproduced condition classifies dev2 as a scenario timing error (click before the public control became enabled), not as evidence that the product permanently disabled editing. The correction waits reactively for the exact button to stop matching `:disabled`; it does not bypass, force-enable or relax the click.

## Preserved attempts

| Run | Exact result | Classification |
| --- | --- | --- |
| `dev1` | `0/92`; browser never executed because cancellation bound was encoded as a string | infrastructure packaging failure |
| `dev2` | `54/92`; failed at op index 54 on disabled Move button | preserved product-run failure; reason classified only by later exact-prefix replay |
| `dev2-op54-diagnostic1` | `57/57`; DOM probe and screenshot completed; zero browser errors | diagnostic PASS, not an application journey PASS |
| `dev3` | `73/93`; room edit and selective withholding passed, then scenario searched for rebind inside the read-only ledger row | preserved scenario-selector failure |
| `dev4` | `135/135`; 16 captures; zero browser errors; exact owned cleanup passed | complete development journey PASS |

## Evidence

- Original dev2 receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev2/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev2/output/browser-results.json), SHA-256 `4a9cab72bc0b40d8bec93a4dbd506cea138ee5cf720827bd42ba2091587bb126`.
- Original dev2 failure image (button below fold): [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev2/output/failure-op-54-default.png`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev2/output/failure-op-54-default.png).
- Hash-pinned diagnostic builder: [`../scripts/build-dev2-op54-diagnostic.mjs`](../scripts/build-dev2-op54-diagnostic.mjs), SHA-256 `b238431ddf2b2d34b1b743b57066e67cf9a6c354120b13cdd8f23eef761f1f18`.
- Diagnostic scenario: [`../scenarios/sc09-room-roof.dev2-op54-diagnostic.json`](../scenarios/sc09-room-roof.dev2-op54-diagnostic.json), SHA-256 `6b39e4d973431e40db910976a09f7e0353fa854522c673966e704e8de8c4b7cd`.
- Replayed DOM receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev2-op54-diagnostic1/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev2-op54-diagnostic1/output/browser-results.json), SHA-256 `7f4f69f63a8d985c5437437700a30feea69962b4127700e4f12c54d7c6510a0b`.
- Diagnostic image: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev2-op54-diagnostic1/output/captures/dev2-op54-move-area-diagnostic-1600x1000.png`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev2-op54-diagnostic1/output/captures/dev2-op54-move-area-diagnostic-1600x1000.png), SHA-256 `60c0acb7ee0d3fa9c4f77a88b2125a5c38351b68cff0b772662a36a8e8d4b760`.
- Dev3 receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev3/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev3/output/browser-results.json), SHA-256 `0baee201e1baa3abe5c27d48c04f03156fae82e508ca5f0628d9b11b98d84d19`.
- Dev4 receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/browser-results.json), SHA-256 `2f85fd87c76a39d804a34911d01d97fe6210bbd9864aa7e47bf37262dbdeee4c`.
- Dev4 visual set: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/captures/`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/captures/).
- Dev4 launcher/cleanup receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/launcher-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/launcher-results.json), SHA-256 `c9a675b94eb040ba7dedd6c76bf509b00a0513cce14680768094cc15dd5a9700`.

This record does not claim built-preview qualification; that is a separate required run against the same frozen source after its DANS1 build.
