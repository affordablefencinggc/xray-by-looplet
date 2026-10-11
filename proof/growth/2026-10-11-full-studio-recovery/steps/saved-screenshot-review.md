# Saved screenshot review — October 12, 2026

## Requirement and scope

Inspect the saved recovered studio evidence without conflating a review with a new browser/native run. This is an AI visual review, not human signoff. Images were opened successfully in the current session; the earlier session's inability to inspect images is no longer the applicable technical limitation.

## Reviewed states

| Capture | SHA-256 | Observation |
| --- | --- | --- |
| `built-cdp-full3/full-03-model.png` | `03a2cf14a818cdfdb165d931288c5f738a056a4bb2460f3c233d156e508fcf0f` | Desktop studio shows the model/sheet sidebar, source-linked Redburn geometry, evidence sheet and controls; no blank root in this capture. |
| `built-cdp-full3/full-06-render.png` | `c231ac8442a7d35a48b10a648362fe472ccbe15f6e90544535a0ec11f8eb48b7` | Render workspace and site-import panel visible. Page truthfully says it does not generate images; unavailable image renderer is not a completed render operation. |
| `dev-cdp-tablet2/tablet-model-1180x820.png` | `ae26940225cdbcc709c6b26a735e4154f4ce4b0a5436249ee701bccd023ca559` | Landscape tablet preserves three panes and source evidence. Small toolbar controls crowd the model; design/accessibility work remains. |
| `dev-cdp-tablet2/tablet-model-820x1180.png` | `93c0a4b1b48905ed2c727f17a364e5cde8ec83ea36d31b71ed3eee54c143800d` | Portrait tablet presents the large model canvas. The bottom assistant bar partly obscures navigation/diagnostics in the captured viewport; separately track this layout issue. |

## Capture identity and checks

- Built run ID: `adbde37c-9dee-4e2a-8310-932e22f09a19`, started `2026-10-11T08:35:41.660Z`, host Daniels, Chrome `154.0.8037.98`.
- Tablet run ID: `d1811f87-8191-4bb0-8784-e274e1db5ba6`, started `2026-10-11T11:21:13.412Z`, same host/browser.
- Recomputed the four image hashes; no screenshots edited or retaken.
- These run bindings identify scenario/tool hashes, not a fresh source commit acceptance. Use the original scenario/results/manifests for execution claims.

## Remaining limits

No current UI/source changes or new browser run in this review. Does not establish all screenshots, dynamic behavior, installed native display, human approval or deployment correctness. Compact controls and the portrait bottom-bar obstruction are open, not silently accepted.