# Local final-build qualification — in progress

User instructions on 24 September: "do it on this pc", "push all the changes in stages pelase", and "Keep missing measurements unknown". Local execution on DANIEL is explicitly authorized. The previous checkpoint is `e74e67d4` on `feat/closeout-sc09-remainder`, already pushed. This campaign retains the 20% aggregate CPU cap for local builds and records local evidence separately from DANS1 evidence.

The saved Boundaries plan remains read-only. Missing Colorbond heights and ground falls remain unknown; approximate map lengths remain unverified. No assumed 1.8 m Colorbond height, level ground, accepted BOM or real-job issued quote is authorized by the latest decision. Existing timber heights recorded in the saved plan retain their source status.

The user also authorized deletion of the two specified old DANS1 dependency caches (`44c9a5bdd386` and `e173b12b942c`). DANS1 SSH was unavailable at the start of this campaign; no cache deletion has occurred. This authorization does not identify any local cache for deletion.

[Local source and build qualification](steps/SC-00-local-build.md) passes: 1,964 tests, typecheck, web build and native NSIS package, with the 20% aggregate CPU cap verified before child launch. [Built discussion explanations](steps/SC-05-explanations-built.md) pass 35/35 with independent reply review. [Unknown-measurement decision](steps/SC-12-unknowns-ruling.md) passes development 20/20 and built 20/20; the compiler still withholds the real BOM/quote with 30 blockers. [Stage audit and artifact hashes](stage1-audit.json).

Remaining common-build worksheet campaigns and native runtime checks are in progress. No installation or deployment occurred. Each completed unit links an executed result, inspected screenshot and exact diff; original failures remain preserved. Continue automatically after each feature-branch checkpoint.

Checkpoint `78a75531` is pushed. Stage two proves [QS on the common local build](steps/SC-01-qs-final-build.md), including both tablet orientations, and [10/10 native workload closes](steps/SC-02-native-close.md), zero forced. [Audit](stage2-audit.json). The first tablet-readability attempt is retained; its corrected harness waits for the responsive rail control before clicking. Product source/build hashes remain unchanged. Remaining HVAC and fencing native feature journeys continue after this staged checkpoint.

Checkpoint 74aea9c1 is pushed. Stage three completes the [common-build worksheet and named industry-agent closeout](steps/SC-13-common-build.md): five HVAC journeys pass 904/904, zero captured browser errors, successful cleanup. Source/build identity checks and inspected desktop/tablet images are linked separately per step. Native fencing feature qualification and the explicitly incomplete real-job chain remain.
