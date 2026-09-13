# QS unchanged-prompt reporting retest

Root reran the same concurrent read-only prompt at 2026-09-13T09:17:03.523Z after the reporting fixes. This agent only observed the existing DANS1 QS Edge target on port 9343; it sent no prompt or reload.

At **09:17:34.797Z**, the response had finished with no error. Fresh visible receipts now include **read_workflow_route** and **read_project_context**. The final answer and Developer review name exactly those two executed tools. Project ID, revision 1 and sample-only source are correctly reported. No other project ID appears. The project object exactly matches root's before snapshot. Screenshot `after.png` was visually inspected. **The core requested outcome and current-turn action-reporting check pass.**

Remaining answer-quality limitations: the response unnecessarily adds attachment/design/prior-calibration assertions outside the fresh context receipt, including “the prior turn's readback still applies.” These assertions are unnecessary to answer this prompt; retaining prior data does not automatically establish current calibration state. Developer review could identify that excess instead of saying no specific improvement. No verified takeoff, cost-plan or authority claim was produced by this retest.

`comparison.json` contains the structured verdict and screenshot hash; `fresh-turn.json` isolates this prompt, receipts and answer from history. `before.json` is root's pre-turn snapshot; `after.json` is the raw readback. Edge PID 7348 remains open and provider idle. Last target activity 09:17:34.797Z; raw-CDP socket closed after capture. Root retains browser/tunnel ownership.
