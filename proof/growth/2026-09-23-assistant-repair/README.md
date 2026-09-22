# Assistant and calibration repair - 23 September 2026

On Redburn sheet 12, choose **Use drawing scale 1:250**, then **Measure a run**. Click endpoints and select **Finish trace**. Source annotations offer **Draw on this sheet** after applying the scale.

Verified changes, each with tests, screenshots and exact diff:

- [Assistant docking, collapse and bottom alignment](steps/AR-01.md)
- [External MCP connection and configuration](steps/AR-02.md)
- [Adjustable plan/model divider](steps/AR-03.md)
- [Automatic current-view images and sheet identity](steps/AR-04.md)
- [Printed scale action and working measurement clicks](steps/AR-05.md)

94 focused tests passed; TypeScript passed; production build exit 0. Development interaction run 66/66; final production results linked in each step. Screen request run 17/17 includes an actual provider request with a drawing image and Page 12 identity. The model's first response guessed the page incorrectly; this prompted explicit page metadata. This proves image delivery, not universal visual-answer accuracy.

The source diff also includes two minimal TypeScript compatibility corrections in previously edited projectBackup and HVAC test files. Their behavior is covered by focused tests; screenshots demonstrate the surrounding working app, not type correctness. The cumulative diff retains existing edits in shared files and is not a claim to have authored every earlier change.

Verification used isolated local Windows browser contexts and the production web build. The user's saved project was not changed. No installed desktop release, deployment, native macOS/Linux, or complete application qualification is claimed. Owned test processes were stopped; cleanup receipts accompany each run. Existing user preview was preserved.
