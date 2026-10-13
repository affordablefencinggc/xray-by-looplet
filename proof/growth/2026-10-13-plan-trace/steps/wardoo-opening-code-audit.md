# Wardoo sheet 6 annotated-opening reconciliation

## Requirement and scope

Continue the opening audit from the Cline plan-trace handoff: compare the latest
sheet-6 scene against the widths printed beside the opening symbols, and keep
ambiguous geometry labelled as inferred. This is a read-only audit; it changes
neither the tracer nor the scene.

Source PDF SHA-256: `79126aaa2a59dfb835d840e9cbfb97225b2d905046ed6505db27aaabc191f59a`.
Scene: [`wardoo-sheet6.scene.json`](wardoo-window-rules-r3/wardoo-sheet6.scene.json),
SHA-256 `bebdac1a76f87630583d589b20e5752df1324179194d2ea54c28e56ee5fd52e2`.

## Width-code comparison

I compared the nine printed `-<width>W` annotation locations with the centers of
the current scene's opening source traces. Every printed width has a nearest
scene gap of the same measured width:

| Drawing annotation | Scene gap | Offset from annotation to gap center |
| --- | --- | ---: |
| 1510W (three instances) | 1510 mm (three openings) | 15.2–18.2 pt |
| 610W | 610 mm | 15.5 pt |
| 600W (two instances) | 600 mm (two openings) | 15.2–17.3 pt |
| 2400W | 2400 mm | 19.3 pt |
| 850W (two instances) | 850 mm (two openings) | 20.0 pt each |

Those nine size matches are an improvement in source-width coverage. They do not
establish door/window type, head/sill height, wall assembly, or quantity accuracy.
The three rule-confirmed gaps (600, 600, 610 mm) retain inferred assembly and
vertical geometry.

## Ambiguous candidates that remain

The latest scene has 13 opening candidates. Four do not correspond one-to-one
with the nine explicit width annotations:

- `opening-10`, 830 mm, lies on a neighboring parallel lane beside the
  rule-confirmed 600 mm `opening-9`. Their along-wall centers are effectively
  identical; the 830 mm interval extends about 115 mm past each end of the
  600 mm interval, and the lanes are about 148 mm apart. The adjacent source
  crop labels this symbol `900H -600W ASW`. This strongly suggests the 830 mm
  candidate is a second face/layer of that same window, but the extractor does
  not bind text or wall-layer identity to a candidate. It is not safe to delete
  it automatically yet.
- `opening-3`, 1478 mm, and `opening-4`, 916 mm, have no nearby printed width
  annotation that validates their size. They remain unclassified gaps.
- `opening-5`, 870 mm, is near the drawing's `870 @ 2040` notation. The scene
  does not classify it as a door or establish that the notation belongs to it.

The retained visual references under
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\opening-audit-20261013-5d9ac0e1c287`
are `window-code-1-600W.png`, `window-code-2-600W.png`, and
`window-code-3-610W.png`. I inspected these existing crops and the full-sheet
overlay in this audit; no new screenshot was captured.

## Executed checks and limits

- Recomputed nearest annotation-to-opening centers from the committed scene
  traces and retained annotation coordinates; all nine explicit widths match.
- Inspected the retained full-sheet and bathroom/window crops against the
  candidate locations.
- No code or scene was changed and no tests were run for this read-only audit.

The next geometry step needs a source-bound relationship between annotation text,
window rules, and adjacent wall faces before it can suppress the 830 mm candidate
or promote a 1478/916 mm gap. T-01's deliberate UI rotation-and-reload journey
also remains open; this audit does not change its checklist status.
