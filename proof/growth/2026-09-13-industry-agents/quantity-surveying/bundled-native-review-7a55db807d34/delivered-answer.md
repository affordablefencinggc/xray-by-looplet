## Corrected consolidated review

This is the new bundled-native receipt request `2d87d4bc-5fb4-4766-b9ee-698be72b34b9`, bound to a synthetic 5 m QA run with no gates; the recipe's maximum bay width is 2400 mm, but the realised bays here are 2400, 2400 and 200 mm (terminal-cut), so two full bays sit at the maximum and the third is a residual cut. The supplied quantities reconcile arithmetically: 2 end + 2 ordinary posts = 4 sites across 3 bays; 3 bays Ã— 2 rail rows = 6 cuts and 5 lm Ã— 2 rows = 10 lm rail, matching `CB-RAIL-CUT` and `CB-RAIL-LM`; and `ceil(2400/762) + ceil(2400/762) + ceil(200/762) = 4 + 4 + 1 = 9 sheets` matches `CB-SHEET`. The receipt's scope is selected recipe components only: no concrete or footing-volume line is emitted, and that absence does not establish a complete installed-material schedule or footing adequacy. Synthetic QA calibration with matching receipt identity shows recorded internal consistency only â€” not independently verified real-world ground truth â€” and no native pixels were inspected, no tools were executed, and no project changes were made.

## Developer review

- Outcome: Distinguishes the 2400 mm maximum from the 2400/2400/200 mm realised bays and shows each line reconciles arithmetically with the terminal-cut layout.
- Friction: None.
- Improvement: None.
