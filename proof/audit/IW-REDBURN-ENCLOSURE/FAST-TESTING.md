# Exact fast browser-testing scripts used in this session

Runner: `proof/audit/IW-DWG/browser-batch.mjs`.
Test steps: `native.json`, `native-controls-final.json`, `native-archive-final.json`, `production.json`, `production-final.json` in this directory.

Run from the X-Ray repository root. The runner uses the installed agent-browser CLI at `.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js`; change that one `cli` path if using another installation. It requires Node and a running app/browser. Native testing requires a WebView2 debug endpoint; this session used port 9250 with a separate QA profile. Do not reuse a customer's live profile for mutation tests.

```powershell
New-Item -ItemType Directory -Force screenshots/redburn-enclosure
node proof/audit/IW-REDBURN-ENCLOSURE/launch-native.mjs
node proof/audit/IW-DWG/browser-batch.mjs xray-enclosure-native proof/audit/IW-REDBURN-ENCLOSURE/native.json --cdp 9250
```

For the running web app:

```powershell
node proof/audit/IW-DWG/browser-batch.mjs xray-catalogue proof/audit/IW-REDBURN-ENCLOSURE/production.json
```

These are the actual project scenarios, not generic drop-in tests. The production scenario opens the private Dans1 preview at `http://127.0.0.1:8083/`. `native.json` starts from a fresh QA profile and saves one backup. The final/resume scenarios require the preceding scenario's state. Change names, URLs, expected counts and screenshot locations for another application.

Why the interaction checks are fast:

1. Reuse one connected browser session.
2. Send all actions as a JSON batch instead of launching a browser for every click.
3. Wait on actual readiness conditions, including enabled buttons and completed storage updates, instead of sleeping for arbitrary durations.
4. Throw on failed assertions; `--bail` stops the batch immediately.
5. Save screenshots at meaningful checkpoints and inspect them before marking an item complete.

Example action sequence:

```json
[
  ["find", "role", "button", "click", "--name", "Front", "--exact"],
  ["find", "role", "button", "click", "--name", "Zoom in model", "--exact"],
  ["wait", "--fn", "Number(document.querySelector('.building-canvas canvas')?.dataset.meshCount) === 198"],
  ["screenshot", "screenshots/redburn-enclosure/front.png"],
  ["errors"]
]
```

Builds, initial asset loading and first automation connection take longer. A fast click sequence is not a substitute for full workflow coverage, performance tests or visual inspection. One early native archive attempt clicked before its asynchronous counter update; the scenario now explicitly waits for the enabled updated button. Final passing evidence is in `native-controls-final.log` and `native-archive-final.log`.
