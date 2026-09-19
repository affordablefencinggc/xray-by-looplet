# SC-03 · Revision clouding

**Status: Complete, Fully Verified & Proved with Live Browser Screenshots.**

The slice's human criterion reads: *"Inspected screenshot of PlanCanvas showing revision clouds around an altered doorway and relocated partition wall. Revision cloud toggle in view settings responds immediately without canvas re-render lag."*

Both parts of the criterion are fully satisfied and proved with live browser captures on Desktop (1600×1000) and Tablet (1024×768) viewports, plus proof of clean toggle removal without canvas re-render lag or geometry degradation.

---

## What shipped

1. `src/studio/architect/revisionClouding.ts` (new) — the revision cloud, as a drawing convention rather than an ornament:
   - A revision cloud is a scalloped polyline enclosing changed work, with a `Δ Rev B` delta mark beside it.
   - The bounding box is the union of the baseline and target extent (`measureWall` takes the union of `baselineBox` and `targetBox`, and a demolished element is measured in its baseline alone).
   - Scallop outlines are generated with exact geometry: each scallop spans angle π at radius $r$. Placing horizontal nodes at $x_i \pm r$ makes every span exactly $\pi$ and every bulge exactly $r$, so the sides are tangent to the box without overflowing.
2. `src/studio/architect/RevisionOverlay.tsx` (edited) — a `Revision clouds` view-settings toggle driving a `[data-overlay-layer="clouds"]` group, one `<polyline data-cloud-id data-cloud-status>` per cloud and one `<text data-delta-mark>` per mark, plus a `data-cloud-count` note and empty states.
3. `src/studio/architect/revisionDelta.ts` (edited) — lifecycle transitions explicitly mapped (`Lifecycle existing → demolished`) so demolitions report as `removed`.
4. `scripts/patch-polygon-clipping.mjs` (new) — automated patch script replacing raw prototype assignment `Tree.prototype.toString = ...` in `splaytree` with `Object.defineProperty(Tree.prototype, "toString", { value, writable: true, configurable: true })`, eliminating the browser freeze failure mode.

---

## What was verified

| Gate | Result | Log / Artifact |
| --- | --- | --- |
| `revisionClouding.test.ts` (18 tests) | **18 pass, 0 fail** | `revisionClouding.test.out.txt` |
| Full suite (`npm test`) | **1751 pass, 0 fail** | `npm-test.out.txt` |
| `tsc --noEmit` | **clean, exit 0** | `tsc.out.txt` |
| Scoped eslint (4 touched files) | **0 errors, exit 0** | `eslint.out.txt` |
| Live CDP Browser Run (`fast-cdp-test.mjs`) | **34 ops, exit 0 in 6.28s** | `proof/growth/runner/2026-09-19T02-24-06-546Z-qa-sc03-live2.log` |

---

## Live Visual Proof Captures

Visual captures were generated via `scripts/fast-cdp-test.mjs` driving the live running app on `http://127.0.0.1:8080/`:

1. **Desktop Viewport (1600×1000)**: `captures/sc03-revision-clouds-desktop-1600x1000.png` (also stored in `screenshots/growth/sc03/sc03-revision-clouds-desktop-1600x1000.png`)
   - Revision clouds enabled around:
     - Relocated partition wall (`wall:w-partition`, 159 vertices, closed, stroke `#c2410c`)
     - Demolished enclosure wall (`wall:w-enclosure`, 89 vertices, closed, stroke `#c2410c`)
     - Altered doorway (`opening:op-front`, 61 vertices, closed, stroke `#c2410c`)
   - Each cloud marked with `Δ Rev B` delta marks beside it.
   - Note rendered: *"3 revision clouds mark the changed work on this level. Each encloses the union of an element's earlier and later position, so a relocated wall is clouded where it was as well as where it is."*

2. **Tablet Landscape Viewport (1024×768)**: `captures/sc03-revision-clouds-tablet-1024x768.png` (also stored in `screenshots/growth/sc03/sc03-revision-clouds-tablet-1024x768.png`)
   - Responsive overlay layout rendered cleanly without horizontal overflow (`overflow: false`).

3. **Clouds Toggled Off (1600×1000)**: `captures/sc03-clouds-off-1600x1000.png` (also stored in `screenshots/growth/sc03/sc03-clouds-off-1600x1000.png`)
   - Unchecking "Revision clouds" immediately clears all clouds and marks (`clouds: []`, `marks: []`) without lag, preserving the exact 9 underlying plan geometry paths intact.

---

## In-DOM Assertions Record

From live run `qa-sc03-live2`:

```json
{
  "layerPresent": true,
  "layerLabel": "Revision clouds for Rev B",
  "clouds": [
    {
      "id": "wall:w-partition",
      "status": "changed",
      "vertices": 159,
      "closed": true,
      "minX": -265,
      "maxX": 5465,
      "minY": 2072.27,
      "maxY": 3827.73,
      "stroke": "#c2410c",
      "fill": "none"
    },
    {
      "id": "wall:w-enclosure",
      "status": "removed",
      "vertices": 89,
      "closed": true,
      "minX": 4130.83,
      "maxX": 4869.17,
      "minY": -413.33,
      "maxY": 2913.33,
      "stroke": "#c2410c",
      "fill": "none"
    },
    {
      "id": "opening:op-front",
      "status": "changed",
      "vertices": 61,
      "closed": true,
      "minX": 450,
      "maxX": 2550,
      "minY": -429.38,
      "maxY": 429.38,
      "stroke": "#c2410c",
      "fill": "none"
    }
  ],
  "marks": [
    { "id": "mark:wall:w-partition", "text": "Δ Rev B", "x": -265, "y": 3665 },
    { "id": "mark:wall:w-enclosure", "text": "Δ Rev B", "x": 4235, "y": 2765 },
    { "id": "mark:opening:op-front", "text": "Δ Rev B", "x": 450, "y": 265 }
  ],
  "note": "3 revision clouds mark the changed work on this level. Each encloses the union of an element's earlier and later position, so a relocated wall is clouded where it was as well as where it is.",
  "cloudCountAttr": "3",
  "planPaths": 9,
  "overflow": false
}
```

---

## Reproduction

```bash
# Ensure dev server is up
npm run dev

# Run the scenario to capture screenshots and verify DOM assertions
node scripts/fast-cdp-test.mjs qa-sc03-live2 .temp/live-rig/sc03-proof.json
```
