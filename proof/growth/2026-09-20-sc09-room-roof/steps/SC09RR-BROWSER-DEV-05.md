# SC09RR browser development journey 05 — PASS; built preview blocked

Date: 2026-09-20  
Frozen source: `bf09e36e3100a5cfa9ef4565892edc8e28fdb791a3ec9341375af7fd91394e55`  
Host: DANS1  
Method: raw fast-CDP; actual public UI; no product store/module import

## Development result

`sc09rr-bf09e36e3100-room-roof-dev4` passed `135/135` operations with 16 screenshots, zero browser errors and exact owned browser/preview cleanup. Four observed pricing-status request cancellations were within the reviewed bound of eight; no asset failure or product search was exempted.

The journey proved, through public controls and native CDP pointer drags:

- a controlled SVG source with two closed polygons, an explicit 10.000 m calibration reference and a reviewed 30°/90° roof note;
- explicit room-area and roof-plane classification, with 12 m² projected room area and 13.856406460551018 m² initial true roof surface;
- explicit QS binding for both rows, full geometry/source SHA-256 provenance, verified/current status and permitted pricing;
- a genuine two-area 3D preview (`areaMeshCount=2`, one room and one roof), two triangles per area, zero invalid/unknown-slope areas, flat room height span 0 and positive declared-roof height spans;
- public `Edit highlighted source area` navigation and native plan-canvas vertex editing for the room, followed by room-only stale/withheld status while the roof remained current/permitted;
- explicit measured-quantity room rebind restoring both rows to verified/permitted;
- the same highlight/edit/stale/withheld/rebind sequence independently for the roof while the room remained current/permitted;
- normal reload persistence of both revision-2 geometries, both explicit bindings and reviewed roof slope provenance.

Representative receipt values include room revision 2/value `12.75`, roof revision 2/value `14.722431864335457`, source SHA-256 `c54539cb287c9bc5f39a9e9b604476fdcf4473797ac59613cf6253b554c8453d`, and final roof preview height span `1.889509990811348`.

## Development evidence

- Browser receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/browser-results.json), SHA-256 `2f85fd87c76a39d804a34911d01d97fe6210bbd9864aa7e47bf37262dbdeee4c`.
- Launcher/cleanup: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/launcher-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/launcher-results.json), SHA-256 `c9a675b94eb040ba7dedd6c76bf509b00a0513cce14680768094cc15dd5a9700`.
- Frozen manifest: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/sha256-manifest.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/sha256-manifest.json), SHA-256 `d5d46d5c9d8882c02d439d38f3131a9eb73c37f3577f34837351702dd306d933`.
- All 16 captures: [`../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/captures/`](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/captures/).
- Scenario: [`../scenarios/sc09-room-roof.dev.json`](../scenarios/sc09-room-roof.dev.json), SHA-256 `108ad757c85910ec6ec5cb0c27923393d9683b8cc7f9e87f056edf1b6b76ed70`.
- Scenario builder: [`../scripts/build-room-roof-scenarios.mjs`](../scripts/build-room-roof-scenarios.mjs), SHA-256 `cd714803e841259322bb79b95a00ec6ed7f6016da1539b4dda7c6897593925c0`.
- Earlier attempts and the readiness classification are preserved in [`SC09RR-BROWSER-DIAGNOSTIC-04.md`](./SC09RR-BROWSER-DIAGNOSTIC-04.md).

## Built-preview blocker — not complete

The same frozen source built successfully, but `sc09rr-bf09e36e3100-room-roof-built1` stopped at operation index 6 (`6/135` completed operations), before the room/roof interaction checks. The server-rendered root requested `/assets/styles-BRNbTYdU.css`; the generated static output contained `styles-B9B94adg.css`, so raw CDP correctly recorded HTTP 404, console error and failed stylesheet load. The failure screenshot shows rendered fixture content by capture time; this record does not claim that hydration never occurred.

Read-only inspection found that this is a current-build SSR/client divergence, not a missing copy or shared-worker cache mutation:

- the build-local, newly created Nitro SSR router compiled `src/styles.css?url` to `styles-BRNbTYdU.css`;
- the current client build emitted and referenced `styles-B9B94adg.css`;
- no `styles-BRNbTYdU.css` exists in the built output;
- generated `.nitro`, `.vite`, `.vite-temp` and `.cache` directories are local to this frozen source snapshot, while package dependency junctions point to the locked runtime only.

Evidence:

- Built failure receipt: [`../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/browser-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/browser-results.json), SHA-256 `58b901ae4d6c52a9fd3809aa13f00d3be70d8455503d84f166054275910948f4`.
- Built failure screenshot: [`../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/failure-op-6-default.png`](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/failure-op-6-default.png), SHA-256 `180e5a20ea8d564f2c1d23076016df1e1a5ff1df44a6ce221c067fa9c8890ca0`.
- Built launcher/cleanup: [`../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/launcher-results.json`](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/launcher-results.json), SHA-256 `cee8cbb25c7350ba9982fc294e73a0b15eea29fdd8f75c400ce9dbcc04bcb24e`.
- Build receipt: [`../machine/build-1/serial/web-build/receipt.json`](../machine/build-1/serial/web-build/receipt.json), SHA-256 `becf63ccd40c4780749bb0932a84f3e92afb985bf1e2539d5c99331dc9e6f53f`.

SC09RR browser proof is therefore **not complete**. Development behavior is proven; production-preview behavior remains blocked by the real generated asset mismatch. No generated output was patched, no speculative cleanup/rebuild loop was run, and no ledger/dashboard completion should be claimed from this record.
