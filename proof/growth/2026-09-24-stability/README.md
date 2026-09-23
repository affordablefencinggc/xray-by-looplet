# V1 stability qualification - current gates green, historical causes unresolved

Captured 2026-09-23 on DANS1 for the 25-30 Sep handover. Hygiene checkpoint: fee8dbfd. Product source remains unchanged: [identity](source-identity.json).

- [SC-01: dev 135/135, production 138/138, measured startup order](steps/SC-01-reload-measurement.md)
- [SC-02: 10/10 full-workload native graceful closes, 0 forced](steps/SC-02-native-close-gate.md)
- [SC-03: current HVAC 46/46 dev and built; full fitting journey 75/75](steps/SC-03-hvac-regression.md)
- [SC-04: current built smoke and unresolved historical 404](steps/SC-04-production-smoke.md)

[Exact diff](changes.diff), [gate verifier](verification.json), [cleanup](cleanup-summary.json). Each step links its executed results and inspected screenshot.

Changes are test tooling, the versioned HVAC fixture, and evidence/ledger corrections. No Rust or persistence fix is claimed because the current app failures were not reproduced. Thus 01-stability as a root-cause/fix task remains incomplete, despite the requested current regression and ten-close gates passing. No unconditional process exit, disabled recovery, weakened validation, installer promotion or deployment.
