# Assistant seam control fix — live UI proof

Root-approved minimal change in `src/studio/WorkspaceRails.tsx`: Drawings' synthetic right seam now exists only while assistantOpen, railMode or rightCollapsed. The measurement effect includes assistant-open/rail-mode dependencies. Real inspector measurement is unchanged. The closed bottom launcher no longer leaves a mid-canvas button with no visible rail.

DANS1 raw-CDP check on existing Edge9341 after source freeze passed:

1. Close assistant through its header on Drawings: zero orphan rail-assistant buttons; bottom launcher remains. `seam-closed-drawings.png`.
2. Click bottom launcher: assistant opens and button center aligns with panel left within3px. `seam-open-aligned.png`.
3. Click seam button: rail collapses and a small reopen button appears within60px of viewport right edge. `seam-collapsed-edge.png`.
4. Click edge button: assistant reopens, right-collapsed statefalse.
5. Open Takeoff and close assistant: actual measurement inspector remains visible and its seam control aligns within12px. `seam-takeoff-real-inspector.png`.
6. Return to Drawings and reopen existing assistant: saved roof result restored. `seam-restored-roof-receipt.png`.

Screenshots1,2,3,5 were visually inspected. No captured Runtime.exceptionThrown or Log.error events in any scenario. Original complete project and exact chat entries compare unchanged (`seam-checks.json`). No model request, source import, geometry or measurement action was performed. The initial frozen-source reload cleared a prior HMR hydration screen.

Evidence: `seam-*.json.result.json` contains actual action receipts and observed bounds; `seam-controls.patch` records the exact source diff. This is existing development preview proof; root owns the rebuilt production check. No new implementation-mirroring tests were added. Drag latency was not retested because pointer handling was unchanged.

Last activity09:55:28.111Z, existing EdgePID13316/port9341 retained with roof receipt open for user/root handoff. All foreground runners exited, sockets closed; root-owned tunnel untouched.
