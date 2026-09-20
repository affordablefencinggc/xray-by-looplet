# HVAC-PIPE-STAGE-12 - WIP automatic checkpoint

Requirement: extend SC-13 network coordination to distinct pipe services without treating liquid flow as airflow. This is a WIP checkpoint, not completion of the pipe workflow or SC-13.

Frozen source hvac4-e671ee8bcecf based on 07fec3a9: [manifest](../source/pipe-freeze.json), [exact diff](../source/pipe-coordination.patch). Adds round outside-diameter clearance, separate inside diameter/pipe flow, pump/valve/terminal nodes, service-aware connectivity, explicit cross-service errors, separate pipe schedules and export data. Unknown pipe operands withhold velocity. Switching service clears flow operands. No pipe design limit or hydraulic loss is invented.

DANS1 [machine gate](../pipe-machine/results.json): 2083/2083 tests, TypeScript and scoped lint clean. [Required build](../pipe-build/results.json): PASS. [Development](../campaigns/hvac4-pipe-dev2/output/browser-results.json): 43/43 PASS. [Production](../campaigns/hvac4-pipe-built1/output/browser-results.json): 143/143 PASS including actual exports and reload. The first development scenario expected node-kind labels in the results table that displays equipment IDs; that incorrect assertion was removed, and its [failed receipt](../campaigns/hvac4-pipe-dev1/output/browser-results.json) is retained.

Inspected screenshots: [green pipe model, desktop](../campaigns/hvac4-pipe-dev2/output/captures/pipe-network-desktop.png), [pipe schedules](../campaigns/hvac4-pipe-dev2/output/captures/pipe-schedules-desktop.png), [unknown flow, tablet](../campaigns/hvac4-pipe-dev2/output/captures/pipe-unknown-tablet.png), [invalid inside diameter rejected](../campaigns/hvac4-pipe-dev2/output/captures/pipe-invalid-bore-tablet.png).

Open before completion: tablet schedule columns squeeze labels and need local scrolling/minimum widths; visually read back the actual pipe PDF; record final dashboard evidence. Explicit fittings and full-ledger/native/deployment acceptance remain open. All quantities are declared/sample drafts, ineligible for verified quotes. No live Jev execution.

Automatic freeze triggered at 102 pending files after production evidence. Scope frozen, this WIP proof added, explicit paths committed and pushed below 150. Continue immediately with tablet polish and remaining proof. No historical evidence is overwritten.
