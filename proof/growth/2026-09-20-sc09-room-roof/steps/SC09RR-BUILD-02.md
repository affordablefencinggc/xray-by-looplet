# SC09 room/roof — local built stylesheet contract (pre-check, not acceptance)

Status: **local plain-HTTP pre-check PASS**. This does **not** close the built-browser blocker and is not a DANS1 campaign receipt.

## Why this exists

[SC09RR-BUILD-01](SC09RR-BUILD-01.md) recorded the built1 `resource-http-error: Stylesheet HTTP 404` on `/assets/styles-BRNbTYdU.css` while the emitted asset was `styles-B9B94adg.css`. The candidate fix in `src/routes/__root.tsx` (captured as [root-css-manifest.patch](../source/root-css-manifest.patch)) had only ever been machine-gated; its browser campaign never ran — `campaigns/sc09rr-fc02f13bc904-room-roof-dev1/` holds two zero-byte logs and no `output/`. This step checks the exact failure condition locally before spending DANS1 campaign time.

## Executed

Working tree on `feat/closeout-sc09-remainder` (`DIRTY`, no commit), 2026-09-20 04:5x AEST.

- `VITE_XRAY_BUILD_ID=sc09rr-local-csscheck-1 npm run build` — **exit 0**, `✓ built in 1.53s`, `.vercel/output` regenerated, `[migrate] DATABASE_URL not set — skipping`. A first attempt through `node scripts/with-app-env.mjs vite build` failed with `'vite' is not recognized`: the wrapper spawns with `shell: true` and no `node_modules/.bin` on PATH. Not a code failure; recorded because the failed attempt is real.
- `node proof/growth/2026-09-20-sc09-room-roof/scripts/local-built-stylesheet-contract.mjs` — **exit 0**, [receipt](../scripts/local-built-stylesheet-contract.json): the SSR root (6,059 bytes) declares `/assets/index-4G6O5zZP.css` and `/assets/routes-3ed3_3c6.css`; both fetched **HTTP 200 `text/css`** (173,996 and 196,773 bytes) and both are **byte-identical** (SHA-256) to the emitted files under `.vercel/output/static/assets`.
- `grep -ro "styles-[A-Za-z0-9_-]*\.css" .vercel/output/` — **no matches**. The server-only `?url` stylesheet name is gone from the built output entirely; the global sheet is now emitted and referenced as `index-*.css` plus per-route `routes-*.css`, i.e. client-manifest names.
- Owned-process cleanup: the preview child was started and stopped by the check itself; port 8081 was confirmed free afterwards.

## Limits — read before citing this

- **No browser ran.** No Chrome, no raw-CDP batch, no screenshots. Nothing here is browser acceptance, and raw-CDP campaigns remain restricted to the `dans1` host by `Assert-Dans1` in `scripts/run-fast-cdp.ps1`.
- **No DANS1 receipt.** No frozen source, no transfer manifest, no resource policy, no build identity binding.
- The 135-op measured-binding journey (room/roof edit, stale withholding, rebind, reload) is untouched by this step. Dev4's 135/135 on `sc09rr-bf09e36e3100` remains the standing browser evidence.
- A build does not prove the campaign: op 6 of the production journey is the one that failed, and only the 138-op `production-css-check` journey exercises it end to end.
