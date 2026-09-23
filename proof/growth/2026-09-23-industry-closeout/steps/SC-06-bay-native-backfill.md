# Fencing SC-01 — full/equal bay package acceptance backfill

Requirement: reviewed full bays plus terminal cut and legacy equal bays, with native generation, saved selection and reload proof. This record reconciles acceptance already recorded on 13 September. It does not claim a new native package or installer registration.

Exact implementation commits: `d6c39da3` (reviewed modular bay division in both kernels) and `892bb37a` (selected recipe validation and readable native results). [Scoped original code diff](../historical-bays.diff). Current equivalent kernels pass [nine layout parity cases](../bay-layout-parity.log), including exact division, residuals, gate and corner cases.

Original native DANS1 d334 [full receipt](../../2026-09-13-industry-agents/roofing/native-ui/d334/full-receipt.json) and [equal receipt](../../2026-09-13-industry-agents/roofing/native-ui/d334/equal-receipt.json) were generated through actual controls. Root inspected [full result](../../2026-09-13-industry-agents/roofing/native-ui/d334/full-native-result.png) and [equal result](../../2026-09-13-industry-agents/roofing/native-ui/d334/equal-final-result.png). Both synthetic 5 m cases produce 2 end posts, 2 ordinary posts, 6 rail cuts, 10 lm rails and 9 sheets; recipe digests and calculation evidence distinguish the layouts.

The subsequent 0cbb package fixes table headers and proves actual [desktop reload](../../2026-09-13-industry-agents/roofing/native-ui/0cbb/equal-reload-desktop-confirmed.png) and [tablet reload](../../2026-09-13-industry-agents/roofing/native-ui/0cbb/equal-reload-tablet-confirmed.png), both inspected. These use the documented qualified engine override.

Default bundled-engine acceptance is separately proved by installer-extracted build `7a55db807d34`: [package record](../../2026-09-13-industry-agents/roofing/native-ui/7a55-package/README.md), [actual full receipt](../../2026-09-13-industry-agents/roofing/native-ui/7a55-bundled/full-receipt.json), [inspected native screenshot](../../2026-09-13-industry-agents/roofing/native-ui/7a55-bundled/full-native-result.png). No override or Python PATH; unrelated working directory. Missing/tampered resources fail closed. The installer was extracted, not installed.

The checklist correction is in [ledger diff](../discussion-ledger.diff). SC-00's separate historical claim that 288 files were retained remains unproved. Stock nesting, slopes, current native build and real-job acceptance remain open.
