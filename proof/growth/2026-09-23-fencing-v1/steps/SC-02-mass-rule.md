# SC-02 — approved HVAC material-mass rule

Requirement: Daniel answered “Adopt the recommended mass rule.” Reviewed geometry/material operands can yield mass; missing airflow and velocity stay independently unknown. No normative gauge table or engineering approval is inferred.

Exact changes: [HVAC diff](../hvac-source.diff), [source hashes](../source-hashes-03.json). The UI and calculated objects carry the policy and estimate label. Regression M15 exercises mass 64 kg with unknown airflow/velocity, known velocity without changing mass, and missing material mass with flow available.

Executed evidence: [1,958 passing source tests](../source-tests-03.log), [typecheck exit 0](../checks-03.json), [144/144 development operations](../v1-hvac-pressure-dev02/browser-results.json). The browser first calculates 64 kg, invalidates edited material provenance, then reviews 0.6 mm thickness and calculates 76.8 kg while network airflow stays unknown. Straight wrap remains 18.5 m².

Inspected screenshots: [mass with absent flow](../v1-hvac-pressure-dev02/captures/industry-mass-known-flow-unknown-desktop.png), [unknown pressure inputs](../v1-hvac-pressure-dev02/captures/industry-pressure-missing-inputs.png), [material review on tablet](../v1-hvac-pressure-dev02/captures/industry-material-reviewed-tablet.png). These show the visible implementation of the ledger's amended rule, not independent validation of the supplied engineering values.

Status: source/development verified; formal SC-12 closeout and the single final build remain open. Historical development-reload cause is separately unconfirmed.
