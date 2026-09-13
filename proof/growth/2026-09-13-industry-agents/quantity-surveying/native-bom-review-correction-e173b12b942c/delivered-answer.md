## Corrected consolidated review

Synthetic QA fixture bound to run `run-d511a32c-265e-4360-bde7-bbc49e3ea0cf`, recipeSet `xray-fencing-candidates-v1` r11, document sha256 `bb6c4525â€¦d40131` (`fencing-5m.svg`). Calibration is a locked synthetic QA two-point, not an independently verified real-world ground truth; the receipt shows recorded internal consistency only.

Quantity reconciliation against `recipe-colorbond-good-neighbour` r11:

- End posts: 2 ea (`bom-cb-end-post`) âœ… matches 4 sites on a straight 5 m run at 2400 mm equal spacing.
- Ordinary posts: 2 ea (`bom-cb-ordinary-post`) âœ… matches.
- Rail cuts: 6 (`bom-cb-rail-cut`) âœ… matches 3 bays Ã— 2 rows.
- Rail length: 10 lm (`bom-cb-rail-lm`) âœ… matches 5 m Ã— 2 rows.
- Sheets: 9 ea (`bom-cb-sheet`) âœ… consistent with ceil(1667/762)+ceil(1667/762)+ceil(1666/762) across the three equal bays.
- Gates: none â€” job has `gates: []`; no gate boundary posts, hinges, latches, drop bolts or gate-opening line emitted.

Concrete / footing volume: not emitted. The recipe's role-keyed footing schedule (ordinary/end Ã˜250 d600; corner/junction/gate Ã˜300 d800) is present, but the component schedule for this recipe includes only post, rail and gate-base items â€” there is no concrete or footing-volume component configured. The receipt's absence of a footing line is therefore a configured-scope outcome, not evidence that an installed-material schedule is complete, and it is not resolved by `supportsSleepers: false` or `supportedRetainingTypes: ["none"]`. No invented concrete volume or footing requirement is added here; whether footings belong on an installed schedule is an engineering/specification decision, not a BOM completeness check.

Limitations:

- BOM totals are draft/synthetic; no prices, compliance, reinforcement or installed quantities are claimed.
- No native screenshot pixels are attached; bay lengths are recipe-derived, not pixel-measured.
- Document identity and recipeSet digest match the receipt; calibration lock is internal QA consistency, not external ground truth.

## Developer review

- Outcome: Correctly states calibration is internal QA consistency, not real-world ground truth, and clearly distinguishes a configured component schedule from a complete installed-material schedule without inventing a footing volume.
- Friction: None.
- Improvement: None.
