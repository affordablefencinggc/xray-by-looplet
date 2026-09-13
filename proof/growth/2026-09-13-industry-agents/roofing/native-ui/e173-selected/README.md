# Mixed native application / selected-recipe engine test

App e173b12b942c SHA1c93cdfe96e270a66f25e1db226192b01a3bc44b42cdc3cb8122392a296892d4; engine selected-recipe revision SHAe4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d. This is explicitly a mixed-artifact diagnostic run, not final-package acceptance.

Native status passed. Existing failed receipt exposes Check again rather than Generate BOM. Two harness selector attempts failed before an engine call; corrected from actual DOM. Actual Check again successfully produced CURRENT equal-layout quantities:2endposts,2ordinaryposts,6railcuts,10lmrails,9sheets,0blockingissues. Original complete UI readback is native-industry-recheck-fixed2-result.json; extracted snapshot equal-success-receipt.json.

Full-layout UI selection correctly invalidated the equal result and reopened five active assumptions. Failed acceptance attempts exposed an actual product problem: retained snapshot state hides all Accept assumption controls. Regenerate preflight lists the five unresolved operands, but no way to accept them appears. No unused candidate assumptions accepted and no store injection used.

Visible layout has a second defect: BOM section clientHeight0/bounding height3px despite scrollHeight1549. Ancestor telemetry in native-industry-blocker-view-result.json and screenshots confirm quantity rows cannot be seen. Screenshot shows Current sidebar for equal and Stale for full; DOM text is not substituted for visual success. Tablet capture is diagnostic only, not acceptance.

Owned native app gracefully closed, profile preserved for fixed-package continuation. No full-layout successful generation, final reload/tablet acceptance, or complete fencing workflow claimed. Root has both defects for correction.
