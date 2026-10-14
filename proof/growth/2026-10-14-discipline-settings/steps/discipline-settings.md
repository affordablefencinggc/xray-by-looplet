# Move discipline selection into Settings

## Requirement

Move the seven trade-discipline choices out of the full-width top row and into the existing right-side Settings rail to reclaim workspace height without removing or changing the selection behavior.

## Implementation

- Removed the dedicated full-width discipline row from `src/studio/Studio.tsx`.
- Added a Settings > Discipline section in `src/studio/SettingsRail.tsx`, keeping all seven choices, their existing `setDiscipline` action, the selected state, and the selected trade description.
- Added a compact two-column layout with 44 px minimum control height in `src/studio/workspacePanels.css`.
- Exact source patch: [`discipline-settings.diff`](discipline-settings.diff).

## Verification

- `npm run typecheck` — exit 0; output recorded in [`checks.log`](checks.log).
- `git diff --check` — exit 0; output recorded in [`checks.log`](checks.log).
- Local Fast CDP interactive run against the active development preview — PASS, 14/14 operations. It confirmed the old top row is absent, all seven controls appear in Settings, the existing Auto-detect choice is selected, selecting Electrical updates the active choice and trade description, the panel fits the desktop viewport, Auto-detect is restored in the isolated browser, and there are no browser errors.
- Screenshot: [`discipline-settings.png`](discipline-settings-cdp-r2/discipline-settings.png). The screenshot shows the Settings rail open beside the workspace with the full-width discipline row removed.
- Scenario: [`discipline-settings.scenario.json`](discipline-settings.scenario.json). The pass receipt is [`browser-results.json`](discipline-settings-cdp-r2/browser-results.json).
- The first runner attempt ended before UI assertions because the assertion opcode was missing its context argument. The runner cleaned up its isolated browser; the diagnostic receipt is [`browser-results.json`](discipline-settings-cdp/browser-results.json). The corrected run above passed.

## Limits

This change was checked in the local development preview on desktop Chrome. No production build, native package, or tablet-specific capture was run for this UI-only change.
