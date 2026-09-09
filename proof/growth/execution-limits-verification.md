# Live assistant execution limits - 9 September 2026

Removed the web process's 100-request/day counter. The single active request guard remains. Added persisted Assistant settings for model rounds (default 64; range 1-512), tool calls (256; 1-4096), output tokens (32768; 1024-65536), request timeout (300 seconds; 10-600), and estimated working context (600000; 16000-900000). Settings are snapshotted for each user message and carried into every model turn. Web transport uses selected output and timeout values; native source has matching validation/defaults. No claim of native execution or packaging is made.

Removed the 38-entry runtime stop; request envelope permits 2048 entries, while byte and estimated token guards remain. Full current-task exchanges stay paired and are archived before reductions of prior conversational context. Thought signatures now count toward the estimate. No evidence was discarded and no mutation retry was introduced. Atomic drawing/edit batches increased from 25 to 200 operations, with provider declarations and operating brief updated.

## Verification

- Full npm test: **974 pass, 89 suites, zero failures** (execution-limits-full-tests.txt). New execution tests added to the permanent npm test script.
- Assistant/server focused set: **324 pass**, including 120 sequential simulated provider requests with no daily cap and selected output budget forwarded, a 120-tool simulated conversation preserving every receipt/signature, and 200 actual drawing operations prepared and validated atomically. These stress tests use injected provider replies, not 120 paid Gemini calls.
- Typecheck: exit 0. Scoped lint: exit 0, no errors or warnings. Generated context freshness/parity check: pass.
- Real Gemini: UI send -> two actual provider turns -> project-context tool -> successful report of the isolated New project workspace and its missing source drawing. Both requests carried saved settings 128 rounds / 512 tools / 32768 output tokens / 300 seconds / 600000 context. See runner/2026-09-09T12-36-17-184Z-execution-limits.json and screenshots/execution-limits-gemini.png.
- UI preferences persisted through reload; invalid out-of-range input refused without corrupting stored settings; Restore defaults worked. Desktop 1440x900 and tablet 1024x768 screenshots inspected; lower settings remain reachable by scrolling. Browser errors empty. Final UI proof: runner/2026-09-09T12-37-23-791Z-execution-limits.json.
- Early browser helpers failed on a non-boolean wait expression, a hydration race and an overly specific textarea selector. Corrected helpers then passed; original logs retained.
- Test browser execution-limits closed. See execution-limits-process.json and execution-limits-cleanup.json. User browsers and dev server retained.

## Remaining limits

Uploads retain 500 MiB per original and 20 files/message (previous large-files verification, not re-exercised at 500 MiB this turn). Device/browser quota is finite. Originals are retrieved by page or text section; image previews remain bounded. Working requests remain 10 MiB, transport 12 MiB and responses 2 MiB. Provider quotas and model-specific limits still apply. IFC/DXF raw-text reading does not provide automatic BIM import/clash validation; DWG/RVT attachments remain unsupported. Calibration and human issue authority remain necessary for verified engineering outputs. Attachment originals are not yet included in existing full-project backup bundles; individual original downloads remain available. No production build, native build, deployment or installation was performed in this turn.

Code diff against task-start snapshots: execution-limits.diff. Existing test boundary fixtures were also updated for selected budgets and the 200-operation ceiling; generated manual rebuilt from its Markdown sources.
