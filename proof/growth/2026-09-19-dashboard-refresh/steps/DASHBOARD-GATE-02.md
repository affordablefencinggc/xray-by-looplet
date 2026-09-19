# DASHBOARD-GATE-02 — refresh the executed machine gate

2026-09-19. Static dashboard update only; no slice or A-Z row promoted.

The ledger now records the separately frozen `9abf4c807030` source: 1951 full tests (203 + 796 + 952), typecheck exit 0 and scoped lint 0 errors / 9 warnings. It explicitly retains the SC10 contrast failure and open production gates. The catalogue remains 6 verified / 108 partial / 19 blocked / 241 gaps / 1 failed.

- DANS1 [campaign receipt](../campaigns/dash-a4afc743c815/output/results.json): generation, repeated byte-identical generation and validation passed.
- [433/433 validator checks](../campaigns/dash-a4afc743c815/output/validate.stdout.log); [105/105 browser operations](../campaigns/dash-a4afc743c815/output/browser/browser-results.json), zero browser errors.
- Inspected [desktop summary](../campaigns/dash-a4afc743c815/output/browser/captures/dashboard-summary-desktop-1600x1000.png), [tablet summary](../campaigns/dash-a4afc743c815/output/browser/captures/dashboard-summary-tablet-1024x768.png), [tablet SC09 disclosure](../campaigns/dash-a4afc743c815/output/browser/captures/dashboard-expanded-evidence-tablet-1024x768.png) and [tablet catalogue](../campaigns/dash-a4afc743c815/output/browser/captures/dashboard-az-filter-tablet-1024x768.png): text/status counts readable, no layout regression in those views.
- [Exact ledger/HTML diff](../machine-gate-1951.diff).
- Returned HTML SHA-256 `af52f076d7c7227b50b0819bb666cfd138ecf84a7257af432227e5639498817c`; root artifact copied from tested output and hash matched.
- Owned browser/server cleanup passed, retrieval hashes verified. No product build, deployment, native or physical tablet acceptance is implied by this static-document run.

Later SC09 84-operation disclosure proof is recorded independently in [RESULTS.md](../../2026-09-19-sc09-provenance-disclosure/RESULTS.md); it arrived after this dashboard input snapshot and will enter the next evidence roll-up.
