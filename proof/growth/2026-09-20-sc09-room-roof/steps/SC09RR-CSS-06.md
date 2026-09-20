# SC09RR-CSS-06 — production stylesheet repair

Bounded stylesheet repair: **verified**. SC-09 room/roof acceptance: **partial**.

## Requirement and exact change

The production SSR document must reference emitted CSS, return HTTP 200 text/css with a nonempty body, and apply the global theme before and after reload.

The existing root fix replaces `styles.css?url` plus a manually authored link with a side-effect CSS import, allowing Start's client manifest to supply stylesheet links. This turn qualified the existing change rather than claiming to have newly authored it.

- [Exact root code diff](../source/css-fix.patch).
- [Frozen source manifest](../source/css-fix-source-manifest.json): `fc02f13bc904a9d9d3291b7af822a44c282425d40f2b96615e3ce1438eb360e2`, base `6477356`. All 2,999 current file hashes matched before qualification. Source remains uncommitted.

## Executed checks

- [Existing DANS1 machine gate](../machine/css-fix/results.json): 2,032/2,032 tests, TypeScript exit 0, scoped lint exit 0 (16 warnings). Reused evidence on identical source, not a fresh test-suite execution this turn.
- [Fresh DANS1 build](../machine/css-build-1/results.json): PASS, source hashes checked before/after, High priority and 16 processors. Uses the frozen qualification helper's owned-process functions; no native build or deployment.
- [Fresh CSS-only production browser check](../campaigns/sc09rr-fc02f13bc904-css-only1/output/browser-results.json): **21/21 PASS**, zero browser errors, desktop/tablet render, raw SSR stylesheet HTTP/content checks, computed theme, tablet overflow check, normal reload before 3D usage.
- [Browser/preview cleanup](../campaigns/sc09rr-fc02f13bc904-css-only1/output/launcher-results.json): PASS; owned processes stopped.

The actual built links are `/assets/index-B9B94adg.css` (141,827 bytes) and `/assets/routes-3ed3_3c6.css` (196,773 bytes); both return 200 text/css. The theme exposes background `#ebe4d4` and ink `#1c1812`.

## Inspected screenshots

- [Desktop 1600×1000](../campaigns/sc09rr-fc02f13bc904-css-only1/output/captures/css-desktop-1600x1000.png).
- [Tablet 1024×768](../campaigns/sc09rr-fc02f13bc904-css-only1/output/captures/css-tablet-1024x768.png).
- [Tablet after reload](../campaigns/sc09rr-fc02f13bc904-css-only1/output/captures/css-reloaded-tablet-1024x768.png).

All three were visually inspected: application chrome and source page render with the applied theme. These images prove rendering, not measurement accuracy. The controlled SVG's long roof note is clipped within the source image; no claim of complete source-text legibility is made.

## Preserved failures and remaining work

- [Earlier development attempt](../campaigns/sc09rr-fc02f13bc904-room-roof-dev1/output/browser-results.json): FAIL 118/135, hydration readiness timeout after the edited/rebound workflow reload.
- [Fresh unchanged development replay](../campaigns/sc09rr-fc02f13bc904-room-roof-dev2/output/browser-results.json): same FAIL 118/135; failure screenshot itself timed out. Pre-reload captures remain. Do not label the failure transient.
- [Fresh complete production journey](../campaigns/sc09rr-fc02f13bc904-room-roof-built-css1/output/browser-results.json): FAIL 39/138, `THREE.WebGLRenderer: A WebGL context could not be created. Reason: Web page caused context loss and was blocked`. CSS checks passed before this failure. [Inspected pre-failure screenshot](../campaigns/sc09rr-fc02f13bc904-room-roof-built-css1/output/captures/production-classified-room-roof-desktop-1600x1000.png).

The CSS-only campaign is a separately named bounded check, not a replacement for either failed full journey. Resolve WebGL context loss and the post-edit reload failure before promoting SC-09. No native, deployment, live-device or professional quantity certification is claimed.

TypeSafe skill and live API documentation were consulted. No Jev inference was executed: no `TYPESAFE_API_KEY` was available in process/user/machine environment. Deterministic checks and source hashes are not represented as Jev judgments.