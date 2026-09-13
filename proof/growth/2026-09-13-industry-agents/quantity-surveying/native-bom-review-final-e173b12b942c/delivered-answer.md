## Corrected consolidated review

On the synthetic 5 m QA run, recipe `recipe-colorbond-good-neighbour` lays the run out as equal bays of 1667, 1667 and 1666 mm; 2400 mm is the recipe's maximum bay width, not the realised spacing. Receipt 626fbc14-476c-4a92-8016-05c3b409e249 records 4 posts (2 end + 2 ordinary), 6 rail cuts, 10 lm of rail and 9 sheets â€” selected component quantities only, all numerically consistent with the three equal bays Ã— two rail rows and with ceil-per-bay sheet counts. No concrete or footing-volume line is emitted, and the configured component schedule for this recipe contains no such item; an absent footing line therefore does not establish a complete installed-material schedule, and no invented concrete volume is added. Locked synthetic QA calibration with matching receipt identity shows recorded internal consistency only, not independently verified real-world ground truth; no native screenshot pixels were inspected, no tools were executed, and no project changes were made.

## Developer review

- Outcome: Spacing wording corrected; 2400 mm is now correctly described as the maximum bay width, not the actual equal spacing, and the bay list 1667/1667/1666 mm is preserved.
- Friction: None.
- Improvement: None.
