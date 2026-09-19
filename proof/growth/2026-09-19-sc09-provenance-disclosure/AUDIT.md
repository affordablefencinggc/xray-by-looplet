# SC09 cycle-9 tablet follow-up — source freeze, proof pending

2026-09-19. Scope: `QSItemBindingLedger.tsx` and its scoped selectors in `src/styles.css`. No Workbench/Host, diagnostics component/styles, arithmetic, binding evaluation, pricing, source or persistence changes.

## What the existing screenshots show

Inspected the original visual3 captures in `proof/growth/2026-09-19-sc09-entity-highlight/campaigns/sc09-4c87a0de13b6-visual3/output/proof/growth/2026-09-19-dashboard-refresh/qs-visual-captures/`:

- `qs-evidence-card-qs-wall-a-tablet-1024x768.png`
- `sc09-only-edited-run-stale-tablet-1024x768.png`
- `qs-evidence-card-qs-wall-b-tablet-1024x768.png`

The geometry hash ending in an ellipsis is **intentional abbreviation**, not evidence of CSS clipping: `qsItemBinding.ts:278` explicitly uses `entityGeometrySha256.slice(0, 12)` plus an ellipsis. Text wraps inside the card. However, the full value was only exposed through a `title` attribute, which does not provide a reliable touch-accessible inspection route. That is the bounded usability defect addressed here.

The Diagnostics footer is fully visible in the inspected frames and is **collapsed**. `WorkspaceDiagnostics.tsx` only mounts its tab list/build label/content when expanded. The footer's missing content therefore does not establish clipping. The screenshots do not prove expanded diagnostics containment either; that remains an explicit additional browser check. No diagnostics styles were changed on speculation.

## Minimal source change

Every bound item now has a native, keyboard/touch-accessible **View full binding provenance** disclosure. It exposes the complete recorded geometry SHA-256, recorded source SHA-256 and calibration, with explicit "at binding" labels and a reminder that current status governs pricing. Unknown source/calibration values stay explicit. The existing abbreviated overview and hover title remain supplemental.

Scoped CSS keeps the summary at least 44px tall, adds a visible focus indicator, and wraps/selects full hashes without expanding the evidence card. No status or verification claim was added.

## Pending executed proof

[`provenance-fragment.mjs`](provenance-fragment.mjs) is an **unexecuted** fast-CDP augmentation for root's final DANS1 SC09 campaign. Append it after the existing two-row fixture is bound. It:

1. Opens the disclosure through its actual summary control at 1024x768.
2. Requires complete 64-character geometry/source hashes, checks them against existing recorded identity and the fixture's exact source digest, and checks text/ancestor containment and 44px control size.
3. Captures an expanded provenance screenshot.
4. Separately checks collapsed diagnostics, expands it through the real toggle, checks header/control containment and content scrolling, captures the expanded state, then restores its previous open/closed state.

No product test or browser was executed locally. The existing screenshots are pre-change observations, not proof of this new disclosure. Root must execute the fragment, inspect fresh screenshots, run regression/typecheck/build as applicable, and attach the exact diff before any SC09 visual gate can close.
