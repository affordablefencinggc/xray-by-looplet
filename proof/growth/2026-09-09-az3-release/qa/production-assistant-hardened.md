# Production assistant checks (coordinator, 2026-09-09 01:30) — newest accepted scenarios

The assistant-layout stage scenarios (production-assistant.json, production-floor-pointer.json) fail deterministically on build 5dfc922f097f at their first placement assertion because the later assistant-hardening stage changed the default placement (bottom-right) and the storage key (xray:assistant-panel:v2). Those two scenarios are therefore stale for this build, not evidence of a regression; production-live-image.json passed (real provider reply "The test image is solid red.").

The assistant-hardening stage's accepted scenarios were re-run against the candidate preview http://127.0.0.1:8096/ (URL and screenshot folder changed only):

- production-hardened-layout.json → exit 0, 34 commands, 1.03 s, runner proof/growth/runner/2026-09-08T15-30-32-082Z-az3rel-prod-assistant2.json
- production-hardened-guards.json → exit 0, 28 commands, 0.69 s, runner proof/growth/runner/2026-09-08T15-30-33-235Z-az3rel-prod-assistant2.json

Session az3rel-prod-assistant2 closed. Screenshots under screenshots/growth/2026-09-09-az3-release/assistant-hardened-production-*.png (inspected by the coordinator, see walkthrough).
