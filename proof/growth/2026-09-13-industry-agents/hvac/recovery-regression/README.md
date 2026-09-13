# Recovery integration regression checkpoint

DANS1 concurrency-source full npm test passed at 2026-09-13T10:32:28Z: 201 script tests (1 suite) and 1,185 TypeScript tests (89 suites); zero failures. Full snapshot TypeScript exited 0. Root had staged/hash-verified recovery integration and QS nullable fix. Latest frozen native build worker was copied after roofing owner released it; no builds/browser/provider requests were run by this worker.

Initial npm.cmd lookup failed because the Codex runtime lacks npm.cmd. No product test ran in that attempt. The actual complete run used the existing build runtime's node_modules/npm/bin/npm-cli.js and exited 0. Logs and seven targeted source hash comparisons are attached; all compared local/remote hashes matched. Blank tsc.txt means no diagnostics; verdict.json records exit 0.

This checkpoint predates root's subsequent first-turn declaration focus change prompted by the QS live omission. It must not be cited as validation of that later change. New focused tests remain to run after source update.
