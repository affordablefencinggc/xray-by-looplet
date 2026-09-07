# Redburn roof facade repair

2026-09-07, `feat/architect-cad-engine`, baseline `3e422f0` plus preserved prior working changes.

- [x] Trace the user's screenshot flaw to gable face panels on an uninterrupted hip-roof surface.
- [x] Add actual gable slopes and shared edges, cut host-roof footprints, and clip ribs at valleys. Source presentation now contains 192 objects and 15 roof faces; original PDF/source binding retained.
- [x] Execute roof regression: downward probes hit one intended surface and facade vertices join roof vertices. Included in the passing 684-test JS/TS run.
- [x] Inspect real development and packaged-native screenshots, including both gables. [Native view](../../../screenshots/redburn-roof/native-detail.png).
- [ ] Verify the installed update after the existing app closes. Installation has not started; user decision on force-closing is pending.

[Exact generator/test diff](implementation.diff), [native action log](native.log), [combined verification record](../IW-DWG/completion.md). `before-roof.json` records the old roof geometry. The model remains inferred presentation, not engineering/fabrication certification.
