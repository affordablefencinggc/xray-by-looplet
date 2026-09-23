# SC-02 / production SC-12 — material mass and wrap

Daniel approved independent mass and airflow unknowns on 2026-09-23. Reviewed geometry/material operands calculate mass even when airflow/velocity is absent. Missing, edited or removed material operands remain withheld.

Executed DANS1 current web build `c56ad63e9ee7`, product source `281f2479`: [pressure/mass 144/144](../closeout-hvac-pressure-c56ad63e9ee7/browser-results.json), [material lifecycle 102/102](../closeout-hvac-material-c56ad63e9ee7/browser-results.json). Each launcher receipt records cleanup. Prior [development, tests and exact product diff](../../2026-09-23-fencing-v1/steps/SC-02-mass-rule.md) remain applicable; current full source 1,964/1,964, typecheck/lint exit 0. No product source changes in this campaign.

Inspected [mass 76.8 kg with absent airflow](../closeout-hvac-pressure-c56ad63e9ee7/captures/industry-mass-known-flow-unknown-desktop.png), [reviewed thickness/density](../closeout-hvac-material-c56ad63e9ee7/captures/material-reviewed-desktop.png), [removed material state](../closeout-hvac-material-c56ad63e9ee7/captures/material-removed-withheld.png). Executed predicates verify removal withholding; that last viewport shows the section preview and policy, not the off-screen mass cell. The report records the actual assertion separately.

Exact [scenario changes](../worksheet-proof.diff), [ledger changes](../ledger-hvac.diff), [evidence audit](../hvac-evidence-audit.json). SC-12 browser worksheet contract complete. Supplier inputs remain declarations; no normative gauge conversion, certified design, native installation or actual-device acceptance. Historical reload causation stays separately unconfirmed.
