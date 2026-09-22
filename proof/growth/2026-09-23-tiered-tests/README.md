# Tiered product tests, simple → complex — 23 September 2026

Build under test: local desktop candidate 7de46b74… (current source + recovery-journal fix), isolated profile `.temp/tiered-tests-native`, CDP 9292, driven through the real UI by Fast CDP scenarios (`scenarios/`, runner logs in `proof/growth/runner/*-tier.*`). Source: Redburn BR250157 sample PDF, SHA-256 b57956f7…. Competitor reference: `artifacts/research/construction-platforms-2026-09-05/Research and implementation direction.md`.

| # | Test | Competitor reference | Result | Evidence |
|---|---|---|---|---|
| T1 | Open 13-sheet PDF, navigate | Bluebeam | PASS. Gap: sheets named "Sheet 1…13" in Drawings/Takeoff although Visualise shows real titles | shots/t1-after-open.png |
| T2 | Scale | Bluebeam, PlanSwift | PASS: 1:250 printed scale auto-detected on sheet 12, locked, 0.088194 m/unit | shots/t2-calibrated.png |
| T3 | Length accuracy | Bluebeam | PASS: scale bar 0–12.5 m measured 12.5026 m (0.02 %) | shots/t3-scalebar-run.png |
| T4 | Area | Bluebeam, Togal | PASS: 153.61 m², independently recomputed from stored points | shots/t4-area.png |
| T5 | Fence run + spec | Groundplan-style trade takeoff | PASS: 26.88 m timber paling 1.8 m, bay 2.4, soil, level | shots/t5-fence-spec.png |
| T6 | Gate on run | — | PASS: 2.0 m double gate; net 24.88 m | shots/t6-gate-spec.png |
| T7 | Material counts (BOM) | Togal, Forma Takeoff | **FAIL on desktop**: "local calculation engine is unavailable" — local builds lack the Dans1-qualified engine (XRAY_BUNDLED_ENGINE_SHA256). Also: one general run silently hides the whole fence BOM panel. Reference counts computed with the app's own compiler + TS rules (`reference-bom.mts`): 281 palings, 13 posts, 22 rail cuts, 2 gate leaves | shots/t7-bom-generated.png, reference-bom-rev1.json |
| T8 | Review gate | Procore/Aconex | PASS: approvals required, attributed, invalidated by geometry change | shots/t8-approved.png |
| T9 | Real rates → priced worksheet | RIB CostX, Buildxact | PASS: 8 confirmed AFGC sell prices from Looplet CRM imported with source/hash; 7 lines AUD 3,042.90 ex GST (arithmetic checked). Gap: quantities typed by hand from the BOM | AFGC-LOOPLET-CRM-RATES.csv, shots/t9-priced-worksheet.png |
| T10 | Revision | RIB CostX | PASS with gap: run 26.88→34.50 m, approvals reset, gate kept its position; reference BOM 368 palings/16 posts/28 rails; revised worksheet AUD 3,469.80 (+426.90) — worksheet does not update itself; lines removed and re-added by hand | reference-bom-rev2.json, shots/t10-revised-worksheet.png |
| T11 | Exports | all | PASS: worksheet CSV and evidence manifest completed to Downloads (unlike the Edge .crdownload stall) | exported-*.{csv,json} |
| T12 | 3D reconstruction | Revit/Forma | PASS as presentation: 198 source-linked parts; the traced fence is not in 3D | shots/t12-3d.png |
| T13 | Assistant | Bluebeam Max | Gemini: "Assistant failed." — real cause HTTP 429 quota, hidden because native string errors were discarded (fixed). MiniMax added to desktop and passed (see ../2026-09-23-minimax-desktop) | shots/t13-*.png |

Not a quote: gate priced as 2 × 1800 timber pedestrian gate ($750) because the price list has no timber double gate; no concrete bags, waste, delivery or margin. QA approvals were recorded as "QA test estimator (Claude)" on an isolated profile.

Small bugs seen: "Priced worksheet (n)" tab counter lagged one line; Approve could be pressed twice on an approved run (two audit entries); the run-delete "×" has no accessible name and no confirmation.
