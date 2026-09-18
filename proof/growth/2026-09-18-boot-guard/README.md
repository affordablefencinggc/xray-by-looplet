# Boot guard · a frozen global must not white-screen the app

**Status: code complete, unit-verified, and verified against the served document. The
in-browser render is not claimed — the CDP automation is degraded on this machine.**

## The defect this closes

A third-party dependency, `polygon-clipping@0.15.7`, bundles `splaytree`, whose

```js
Tree.prototype.toString = function …   // a plain assignment, at module-evaluation time
```

throws when `Object.prototype.toString` is read-only. That throw happens while the
route module is being *evaluated*, before any React or TanStack Router boundary
exists — so no render boundary can catch it. The app replaced its entire UI with an
error card, or with nothing at all:

```
Something went wrong
Cannot assign to read only property 'toString' of object '#<Tree>'
```

The global could not be repaired. Measured in the app's own page and on
`about:blank`, independently:

```
objToString:   {writable: false, configurable: false}   ← non-configurable
objProtoFrozen: true, objProtoExtensible: false
redefine:      "Cannot redefine property: toString"
fnToString:    {writable: true,  configurable: true}    ← only Object.prototype is frozen
```

`configurable: false` means `Object.defineProperty` cannot restore it and Node cannot
either. So the honest fix is not to repair the global — it is to **fail legibly**,
before the dependency is reached, in a place where a boundary is still available.

## What shipped

`src/lib/boot-guard.ts` (new) — the guard, exported both as a callable function and as
`BOOT_GUARD_SOURCE`, the source text the document inlines.

`src/routes/__root.tsx` (edited) — one line, immediately before `<Scripts />`, which is
the last thing the server document emits:

```tsx
<script dangerouslySetInnerHTML={{ __html: BOOT_GUARD_SOURCE }} />
```

That position is load-bearing and is proven, not assumed: a **classic inline script
runs at parse time**, while a `type="module"` script is **deferred until after
parsing**. So the guard executes ahead of every dependency in the bundle regardless of
byte offset. `script-order.out.txt` records the classification:

```
guardFound: true, guardIsClassic: true, guardOffset: 241
moduleOffsets: [3583]
guardExecutesBeforeModules: true
```

`src/lib/boot-guard.test.ts` (new, 7 tests) — the guard's three outcomes asserted
separately, so the check can fail. A check that only ever reports success is not a
check.

## The two bugs found while writing this

Both were found by *running* the guard, not by reading it. Each produced a guard that
looked correct and did nothing — the exact failure mode this whole change is about.

**1. `#root` does not exist in the document the server sends.** The guard opened with
`if (!root) return;`. The TanStack Start document mounts into its own container; `#root`
belongs to the SPA entry (`index.html`) and is absent from the served HTML —
`documentHasRoot: false`. The guard silently bailed on its first line. Fixed by
resolving the host *at failure time* rather than at the top.

**2. The server's startup skeleton made the guard decline to paint.** The guard skipped
any host with `childElementCount > 0`, to avoid clobbering a rendered app. But the guard
runs *before* the module, so the only thing it can ever find there is the server's own
placeholder — `<main class="workspace-startup">Opening your workspace</main>`. The check
guaranteed it never fired. Fixed by removing the host's children and painting in their
place. The unit test's name records the reasoning: *"the server's startup skeleton is
replaced, not left above the panel."*

## What was verified

| Gate | Result | Log |
| --- | --- | --- |
| `boot-guard.test.ts` (7 tests) | 7 pass, 0 fail | `boot-guard.test.out.txt` |
| Full suite (`npm test`) | **1751 pass, 0 fail** — 203 script + 1548 src | `npm-test.out.txt` |
| `tsc --noEmit` | clean, exit 0 | `tsc.out.txt` |
| Scoped eslint (3 touched files) | 0 errors, exit 0 | `eslint.out.txt` |
| Guard vs. the **served** document | healthy → silent; frozen → named panel | `served-document-check.out.txt` |
| Classic-before-module ordering | guard is a classic script, the entry is a module | `script-order.out.txt` |

`guard-vs-served.mjs` is the strongest of these: it fetches the exact bytes the dev
server sends, extracts the exact guard the server inlined, parses the real HTML, and
evaluates the guard with `Object.prototype` frozen. Nothing is hand-rebuilt.

```
{"guardInlinedInServedDocument": true, "guardSourceBytes": 2482, "documentHasRoot": false}

healthy globals      → marked: null                                   (silent, correct)
frozen Object.proto  → marked: "body", marker: "globals"
                        panelText: "X-Ray could not start This browser has made
                        Object.prototype.toString read-only, so a drawing dependency
                        cannot load. It is not configurable, so it cannot be repaired
                        in place. Reload in a browser where Object.prototype.toString
                        is writable."
```

## What is NOT claimed

- **No screenshot in a real browser.** The CDP automation degraded during this work and
  never recovered: every scenario, including `about:blank` with a one-line `eval`, timed
  out on `open`. That is the same failure the SC-03 captures hit, and it is why the
  served-document check above exists as a substitute. It exercises the real guard
  against the real document; it does **not** show a browser painting the result.
- The guard repairs nothing when the global is non-configurable — it cannot, and the
  panel says so instead of implying otherwise. Where the property *is* configurable it
  does repair in place and the app boots normally; that branch is unit-tested.
- `index.html` (the SPA entry) is untouched. It is not the document the dev server
  serves, and it does not import `polygon-clipping` on the boot path.

## Reproduce

```
node proof/growth/2026-09-18-boot-guard/guard-vs-served.mjs      # guard vs. the running server's own bytes
node proof/growth/2026-09-18-boot-guard/check-script-order.mjs   # classic-before-module ordering
node --experimental-strip-types --test src/lib/boot-guard.test.ts
npm test
```

`guard-vs-served.mjs` needs the dev server on port 8085; `check-script-order.mjs` needs
it too. The dev server is `.temp/live-rig/server-8085.ps1` (start, or `-Stop`).

The guard reads the browser's real condition directly:

```
node scripts/fast-cdp-test.mjs qa-freeze .temp/live-rig/sc03-freeze3.json --cdp 9222
```

That command is what produced the `configurable: false` measurement. It requires a
working CDP browser, which this machine did not have at the time of writing.

## Process cleanup

Seven task-owned browser sessions were verified (session `.pid` file → live PID →
creation time → `agent-browser` executable path) and terminated after graceful close was
attempted and exhausted. The dev server on port 8085 was retained — it is the
user-facing preview and still serving. Full record: `cleanup.log`.
