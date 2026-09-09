# Independent pencil rhythms

Five distinct cycle lengths (0.86, 1.03, 0.73, 0.94 and 1.17 seconds), starting offsets up to 0.67 seconds, different orbital rates, wider angular variation, and per-transfer sideways feints replace the shared cadence. Each scribble remains 0.2 seconds at 1x. Upright tilt and fizzy departure/arrival bursts remain bounded. Timing and trails remain seek-deterministic; no new dependency.

[Watch the updated local canvas recording](pencil-independent.webm).

Local-first verification: eight focused tests and typecheck pass. The warmed Fast CDP batch in local-motion.json passed in approximately 3.15 seconds, including live motion sampling and desktop/tablet screenshots; screenshots inspected. A cold browser launch timed out before reaching the scenario and was closed before a warm retry. No overlapping retry counted as evidence. Scope is pencil choreography over the existing reveal, not new drawing geometry.

Build snapshot: 20dcf423e6ddcedd40ad2e52f3c13dbd89e0bd7965a89d7192776d7384fe5147. Build and packaged acceptance status follows below. The ring-overflow fix is inherited unchanged from the preceding verified slice.

## 2026-09-08 - Independent pencil timing accepted

Five distinct cycle lengths and wider offsets keep the pencils out of lockstep; different orbital rates and per-transfer sideways feints add irregular movement. Local-first Fast CDP desktop/tablet motion and Windows-native/production motion passed with inspected screenshots. Eight local focused tests and typecheck passed. Snapshot 20dcf423e6dd passed all seven sequential Dans1 High/16 gates (225 selected TypeScript and 14 Rust tests); artifact hashes and final source drift verified. User preview replaced on the same origin and Magic Pencil played in the existing Chrome tab. QA helpers/native test app closed; user preview and local development retained. No installation or publication. Evidence: proof/growth/2026-09-08-pencil-independent/README.md.
Native screenshots named tablet were captured at native window size without viewport emulation; tablet acceptance comes from the web batch. Native cleanup used the bounded close/termination rule (see cleanup.json); no native shutdown fix is claimed. Code: pencil.diff and pencil-tests.diff. Batch logs: local-motion.json.log, production-motion.json.log, native-motion.json.log. The user preview serves verified downloaded build artifacts locally; no remote tunnel is needed.
