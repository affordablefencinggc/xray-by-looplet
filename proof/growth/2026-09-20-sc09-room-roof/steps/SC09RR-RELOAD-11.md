# SC09RR-RELOAD-11 — development reload timeout: mechanism narrowed, not yet decided

Analysis of retained campaign evidence only. **No browser ran and no new campaign was launched**, so nothing here changes a campaign verdict. It narrows the open development-reload failure from "causation not established" to two mechanisms and names the single measurement that separates them.

## The failing operation

In [dev1](../campaigns/sc09rr-1388723caf33-room-roof-dev1/output/browser-results.json) the failure is op **118**, a `wait` on `document.querySelector("[data-hydration-status]")?.getAttribute("data-hydration-status") === "ready"`, recorded with the whole 60,000 ms deadline. Its predecessor, op **117**, is `open` on the app root — a re-navigation. The runner rewrites `open` to `Page.navigate` (`scripts/fast-cdp.mjs:485-488`, `514-515`, `525-533`), and a `wait` with no third argument takes the command-level default of 60,000 ms (`scripts/fast-cdp.mjs:369`).

The four failing runs fail identically, and the failure screenshot also times out (`scripts/fast-cdp.mjs:643-644`), so **no post-timeout DOM was captured in any of them** — the attribute's value at the deadline is unknown.

## What the passing runs rule out

- **The startup crash is not causal.** `Network service crashed or was terminated, restarting service` and `GPU process exited unexpectedly: exit_code=34` appear in this run's `chrome.stderr.log` at campaign start (08:53:03Z) but also in the **passing** runs ([built1](../campaigns/sc09rr-1388723caf33-room-roof-built1/output/chrome.stderr.log), dev4). The timeout came ~115 s later.
- **The predicate and token are correct in development.** The attribute is rendered at `src/studio/Studio.tsx:214` and set to `"ready"` at `src/studio/store.ts:2448`; dev4 passed the same 135-op scenario (scenario SHA `108ad757c859…`) in 19 s with this same wait taking 420 ms. Elsewhere the store sets `"idle"` (`store.ts:829`), `"loading"` (`store.ts:2278`), and `"error"` (`store.ts:2459`).
- **React StrictMode double-mounting is not the mechanism.** `hydratePersistence` returns early on `persistenceHydrated` and shares `hydrationFlight` (`store.ts:2278-2279`), so a dev-only second mount does not restart hydration.
- **It is a stall at the reload, not general slowness.** Ops 0-117 completed in 24.4 s against dev4's 19.0 s for the same span.

The production scenario differs from the development one by exactly three production-only asset-check ops (indices 6-8, `scenarios/sc09-room-roof.production.json`), so built1's op 120/121 corresponds to dev's 117/118 and uses the identical predicate — production does not add a settling wait. **The difference is not the scenario; it is what the reloaded document does.**

## The two surviving mechanisms

- **(A)** The reloaded development document's unbundled module graph never finished loading, so the client never hydrated and the attribute kept its server-rendered value.
- **(B)** It hydrated into a non-`"ready"` state — `"error"` via the catch at `store.ts:2452-2460`, or hydration blocked — rather than staying pre-hydration.

The retained evidence does not separate these, because the distinguishing artifact was never captured.

## The deciding measurement

At the op-118 deadline, in the reloaded document, record:

1. `document.querySelector("[data-hydration-status]")?.getAttribute("data-hydration-status")`
2. `document.readyState`
3. the count of pending/incomplete module requests (and any that returned non-200)

`"idle"`/`"loading"` with pending module requests points to **(A)** and makes this a dev-server/network-shape problem; `"error"` points to **(B)** and makes it a persistence problem in the reloaded document. A failure screenshot that succeeds would also settle it, which is why the current `captureScreenshot` deadline inherits the exhausted budget and must be raised for diagnostic runs.

## Limits

No campaign was executed; raw-CDP campaigns remain restricted to the `dans1` host by `Assert-Dans1` in `scripts/run-fast-cdp.ps1`. SC-09 remains `[[partial]]`. Nothing here is browser acceptance, and no product change is claimed or made.
