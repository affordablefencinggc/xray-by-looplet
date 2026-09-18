# SC-03 · Revision clouding

**Status: code complete and unit-verified. The live visual proof is BLOCKED by a browser
environment condition outside this repository. No screenshot of the feature is claimed here.**

The slice's human criterion reads: *"Inspected screenshot of PlanCanvas showing revision clouds
around an altered doorway and relocated partition wall. Revision cloud toggle in view settings
responds immediately without canvas re-render lag."* Half of that criterion — the inspected
screenshot — could not be produced on this machine. What follows says exactly what was built,
what was verified, what was not, and why.

## What shipped

`src/studio/architect/revisionClouding.ts` (new) — the revision cloud, as a drawing convention
rather than an ornament.

A revision cloud is a scalloped polyline enclosing changed work, with a `Δ Rev B` delta mark
beside it. The load-bearing decision is what the cloud *encloses*: **the box must be the union
of the baseline and target extent.** A cloud drawn only on the later revision cannot enclose a
demolished wall — that wall is not in the later drawing at all. `measureWall` therefore takes
the union of `baselineBox` and `targetBox`, and a demolished element is measured in its baseline
alone.

The scallop outline is generated from the box, and the geometry is exact rather than
approximate. Each scallop spans angle π at radius r. Placing horizontal nodes at `x_i ± r` (not
at the box edges) makes every span exactly π and every bulge exactly r, so the left and right
sides come out *tangent* to the box — never bulging past it. Travelling right-to-left along the
bottom edge, a bulge toward −y is `0 → -π`, not `0 → π`. The test asserts the tangent invariant
directly (`assert.equal(reached.max[0], box.max[0])`), which is the assertion that fails if the
winding or the node spacing is wrong.

`src/studio/architect/RevisionOverlay.tsx` (edited) — a `Revision clouds` view-settings toggle
driving a `[data-overlay-layer="clouds"]` group, one `<polyline data-cloud-id data-cloud-status>`
per cloud and one `<text data-delta-mark>` per mark, plus a `data-cloud-count` note and a
`role="status"` empty state.

`src/studio/architect/revisionDelta.ts` (edited) — a second defect found and repaired while
wiring this up. Lifecycle demolitions were being reported as `changed` with the reason
`"Element geometry, placement, or specification modified"`. A demolition is the one change whose
earlier position the later drawing no longer holds, so the transition is now named
(`Lifecycle existing → demolished`) and the register reports it as `removed`.

## What was verified

| Gate | Result | Log |
| --- | --- | --- |
| `revisionClouding.test.ts` (18 tests) | 18 pass, 0 fail | `revisionClouding.test.out.txt` |
| Full suite (`npm test`) | **1751 pass, 0 fail** — 203 script + 1548 src | `npm-test.out.txt` |
| `tsc --noEmit` | clean, exit 0 | `tsc.out.txt` |
| Scoped eslint (4 touched files) | 0 errors, exit 0 | `eslint.out.txt` |

The seed `seed-project.mjs` builds `job-sc03-proof` from a real issued Rev A, and produces the
three clouds the criterion asks for:

```
delta: +0 / -0 / 3
register: 3 entries; unmeasured 0
  changed  Wall           Partition          box 5430×1130mm
  removed  Wall           Enclosure wall     box 230×2730mm
  changed  Door / window  door D01           box 1800×230mm
```

The relocated partition and the widened doorway are the two the criterion names; the third is
the demolished enclosure wall, which is the case a naive cloud gets wrong.

## Why the live proof is missing

The app white-screens under the owned automation browser:

```
Something went wrong
Cannot assign to read only property 'toString' of object '#<Tree>'
```

The trace is `node_modules/.vite/deps/polygon-clipping.js`, in the splaytree bundled inside
`polygon-clipping@0.15.7`, whose `Tree.prototype.toString = function ...` is a plain assignment.
That assignment throws because `Object.prototype.toString` is **non-writable in this browser**.

This was traced to the environment, not the repository, by three measurements:

1. **The freeze exists before any app code runs.** On `about:blank`, with nothing loaded:
   `{"where":"about:blank","writable":false,"frozen":true,"extensible":false}` — logged in
   `captures/freeze-blank-and-app.log`.
2. **Only `Object.prototype` is frozen, not `Function.prototype` or `Array.prototype.**
   Same run: `funcProtoWritable: true`, `arrayFrozen: false`. That is not the signature of a
   library's defensive freeze; it is a modified built-in global.
3. **The exact built bundle runs cleanly outside the browser.** `node_modules/.vite` was deleted
   and rebuilt, and the regenerated dep was executed in-process against the runtime helper and
   the app's real wall inputs — union, difference, a degenerate ring and the wall-difference
   case all returned correct results. The bundle is not broken; the browser's globals are.

The app itself was rendering correctly under the same automation earlier in this campaign — at
`captures/last-render-before-freeze.log` the page reached the Architectural workspace with all
41 controls present. The freeze appeared afterwards and survived a browser restart and a Vite
dependency-cache rebuild.

**The real defect this exposes, and the reason it is worth recording rather than skipping:** the
application has no defence against a frozen global. A third-party dependency's property
assignment escapes all the way to a route-level error boundary and replaces the entire UI with
an error card. Whether or not that third-party assignment is something a given environment
tolerates, a white screen is the wrong response. That is a genuine robustness gap in this
repository, and it is now recorded as such rather than papered over.

## What is NOT claimed

- No screenshot of revision clouds on a canvas. `captures/` holds only diagnostics: the freeze
  evidence, the error-boundary render, the last good render before the freeze, and the owned
  browser's graceful close.
- The criterion's second sentence — the toggle responding without canvas re-render lag — was not
  measured, because the canvas never rendered in this environment.
- `build-scenario.mjs` is the scenario that *would* take the three captures (desktop 1600×1000,
  tablet 1024×768, and clouds-off). It is committed so the proof can be re-run on a sound
  browser, and it has never produced a frame.

Reproduce the block:

```
node scripts/fast-cdp-test.mjs qa-sc03-freeze .temp/live-rig/sc03-freeze3.json --cdp 9222
```

## Reproduce the verifiable half

```
node .temp/live-rig/sc03-seed-project.mjs          # builds the fixture, prints the register
node --experimental-strip-types --test src/studio/architect/revisionClouding.test.ts
npm test
```
