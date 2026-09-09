# Ring recursion fix and pencil flutter — in progress

The user's preview on 8095 threw RangeError in polygon-clipping's recursive `isExteriorRing`, confirmed from browser logs. Reproduced locally with six saved wall coordinate pairs: overlapping reversed walls, a near-vertical return and a 16.569 mm closing segment. Saved drawing bytes were only read, not changed.

Clipping now canonicalizes operands to the editor's existing 0.001 mm precision. The exact reproduction no longer throws. Regression checks finite positive solids, union envelope volume within 0.0001 cubic metres, one enclosed room and unchanged input data. All 21 architect tests pass. [Geometry diff](geometry.diff).

Pencil transfers now have two bounded flutter bursts, around departure and arrival, with zero positional flutter during scribbling. Seven focused pencil/controller tests pass, including deterministic seek, continuity and upright tilt. Local typecheck passes.

Snapshot `925531795d827340d2a00d3fba3af294b06ce21384374ba5b3a703ae5fb58b52` passed all seven sequential Dans1 High/16 gates; see release-925531795d82/results.json. Browser acceptance, full artifact identity verification and user preview recovery remain OPEN. The original 8095 preview has not been upgraded. No installation or publication.

Local-first Fast CDP batches are prepared in local-regression.json and local-motion.json. A shell-started dev server briefly ran, then exited with its owning session. Automatic review rejected both direct npm startup and explicit attached-session startup because the workspace contract requires non-blocking startup.sh. User approval to override that conflict is pending. startup.sh contains a pending opt-in attached mode and Git Bash PATH correction. No rejected startup was executed.

The temporary remote preview is cleaned up; existing user app/data preserved. Resume with approval, local CDP regression and visual checks, then production/native acceptance. Do not mark the slice complete based only on unit tests or builds.

## Acceptance completed before independent-cadence follow-up

User approved attached startup. Local CDP regression resume and motion passed; production motion and Windows-native regression/motion passed. Original six-wall drawing reopened in the user's Chrome tab on the same 8095 origin, with build 925531795d82 and zero errors. No saved drawing edits. Eight-second-scale production capture: pencil-fizz.webm. All artifacts and build identity verified; final source drift empty. 224 selected TypeScript and 14 Rust tests passed. Native test app required identity-checked bounded termination after closing; no shutdown-fix claim. QA browsers closed; dev and user-facing repaired preview retained. Native screenshot named tablet is native-size evidence only, not tablet emulation. Initial selector/racing resume failures remain in their logs and are not counted as passes.

Subsequent user feedback requested more independent and erratic pencil movement. That follow-up lives in ../2026-09-08-pencil-independent/ and supersedes the choreography here. The geometry repair remains unchanged.
