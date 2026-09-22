# Redburn enclosure and viewer controls

Authorized by the user's 7 September reports: see-through wall gaps, white roof overlay, missing bottom buttons. Working in `feat/architect-cad-engine`; preserve existing changes and original source PDF. X-Ray only; builds on Dans1.

- [x] SC-01 Correct the carport enclosure and roof-intersecting door geometry. Source pages 4/5 inspected; aperture, panel rebate, roof and slab rays pass; production front/rear screenshots inspected. Proof: `proof/audit/IW-REDBURN-ENCLOSURE/`.
- [x] SC-02 Restore a visible, usable bottom model control bar. Zoom, front/rear, plan, roof, cutaway, explode, walking entry and expanded diagnostics exercised. Desktop/mobile screenshots inspected; 44px controls, no assistant overlap. Proof: `proof/audit/IW-REDBURN-ENCLOSURE/`.
- [x] SC-03 Focused tests (16), typecheck and production build on Dans1 pass; dev/production smoke clean with no baseline divergence. Evidence: `proof/audit/IW-REDBURN-ENCLOSURE/`.
- [x] SC-04 Native Windows package built on Dans1, retrieved hashes verified, installed and smoke-tested. Existing profile file hashes unchanged; normal app reopened and read-only checked with 198 parts and restored controls. Proof: native-completion.json, installed.log, install.json, installed-identity.json and inspected installed-front-detail.png. Proof: `proof/audit/IW-REDBURN-ENCLOSURE/`.

Proof requires a code diff plus executed checks and inspected screenshots. `implementation.diff` records the working-tree change (including earlier preserved navigation/gable edits). Native delivery completed; broader professional workflows remain tracked separately.
Document status: closed
