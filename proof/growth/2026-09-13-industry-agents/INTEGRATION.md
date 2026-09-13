# Draft industry assistant integration

Accepted synthetic workflows: roofing95m² net (100gross-5opening), straight duct16m²/64kg, quantity classification0.3total/0.1classified/0.2unclassified. Actual tools ran; final answers and Developer reviews were compared with their receipts. All three final projects were unchanged and chats survived reload. Draft-only outputs never become verified measurements or quote quantities.

Evidence:
- roofing/FINAL-ROOFING-QA.md and SEAM-UI-QA.md
- hvac/duct-history-retest/ and history-candidate-fix/
- quantity-surveying/final-live/ and after-history-regression/
- integration-build-2b490c637162/ production desktop/tablet proof and build receipts

Shared fixes include current-turn read prerequisites, explicit app-preflight provenance, strict chat-origin persistence, named-tool claim checks, withheld-candidate history filtering, original-objective preservation, automatic completion routing for successful pure calculations, and readable numeric receipts. The claim matcher is deliberately limited to explicit named-tool requests and recognizable English assertions; it is not a general fact checker.

Final full npm test on DANS1:201script+1,151TypeScript tests. Final typecheck passes. All623non-test build inputs match build2b490c637162; only a subsequently corrected test differs. Production19operations pass; both desktop/tablet screenshots inspected. Temporary production servers and disposable browser contexts stopped; three user-facing Edge profiles and their preview tunnel remain.

Failed attempts are preserved, including fabricated claims withheld before display, a fabricated QS answer caught by review, schema persistence failure, and HMR interruptions. Original roofing visible-qa.mjs is preserved; the later extended runner used remotely under that name is archived as visible-qa-v2.mjs.

No real-source roof takeoff, HVAC sizing, issued cost plan, native package or complete-industry readiness is claimed.

