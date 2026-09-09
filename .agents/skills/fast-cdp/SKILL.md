---
name: fast-cdp
description: "The Fast CDP Skill: Ultra-fast, deterministic browser and desktop E2E testing using declarative JSON opcode streaming over hot Chrome DevTools Protocol (CDP) WebSocket sessions. Eliminates cold-start delays, framework bloat, and flaky sleep() timers by coupling direct STDIN batching with in-DOM reactive telemetry and native V8 layout closures. Trigger with /fast-cdp, /fast-test, or when writing and executing automated UI/WebGL/desktop tests."
trigger: /fast-cdp
version: 1.0.0
---

# Fast CDP Skill (Declarative Opcode Streaming)

A high-speed, zero-flakiness testing architecture for AI agents and developers. It replaces traditional, heavyweight, slow E2E test suites (Selenium, Cypress, standard Playwright runners) with **hot-socket CDP batch execution** and **in-DOM reactive telemetry**.

---

## The 5 Core Principles

1. **Hot-Socket Attach (Zero Cold Starts):**
   - Never launch a fresh browser instance per test.
   - Connect directly to an already running app/browser via its remote debugging port (e.g. `--cdp 9250` or `--remote-debugging-port 9222`).
   - Attachment takes $< 15\text{ms}$.

2. **JSON Opcode Batch Streaming over STDIN:**
   - Never execute actions via sequential async IPC roundtrips or multi-turn agent tool calls.
   - Package all actions into a single declarative JSON array and stream it over STDIN into `agent-browser batch --bail`.
   - 40+ atomic steps execute in $\approx 1\text{–}2\text{ seconds}$.

3. **Reactive In-DOM Telemetry (Zero `sleep`):**
   - Never use arbitrary timeouts (`sleep(1000)` or waiting for noisy `networkidle`).
   - Applications expose internal state on DOM data-attributes:
     - React / Framework readiness: `[data-hydration-status="ready"]`
     - 3D WebGL / Canvas scene mount: `canvas[data-mesh-count="198"]`
     - Animation / Camera: `canvas[data-camera-zoom="1.4"]`
     - Navigation modes: `canvas[data-navigation="fly"]`
   - Use `["wait", "--fn", "<predicate>"]` to advance the exact millisecond the condition becomes true.

4. **In-Engine Geometric & Layout Closures:**
   - Do not query 30 bounding boxes across the bridge one-by-one.
   - Inject a single JavaScript `eval` closure that validates layout, touch targets ($\ge 44\text{px}$), viewport overflow, and occlusions inside the browser's native V8 engine in $0.2\text{ms}$:
     ```javascript
     var dock = document.querySelector('.control-dock').getBoundingClientRect();
     for (const b of dock.querySelectorAll('button')) {
       var r = b.getBoundingClientRect();
       if (r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
         throw Error('Control clipped: ' + b.textContent);
       }
     }
     ```

5. **Fail-Fast Bail & Visual Artifact Proof:**
   - Always run with `--bail` so execution stops on the first broken invariant.
   - Capture clean framebuffer screenshots at key milestones (`["screenshot", "path/to/proof.png"]`) to provide undeniable proof of visual rendering and correctness.

---

## Universal Test Runner (`browser-batch.mjs`)

Save this standalone runner in your repository:

```javascript
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [, , session, file, ...extra] = process.argv;
if (!session || !file) {
  console.error('Usage: node browser-batch.mjs <session-name> <scenario.json> [--cdp <port>]');
  process.exit(1);
}

const commands = JSON.parse(readFileSync(file, 'utf8'));
// Resolves local or global agent-browser CLI
const cli = process.env.AGENT_BROWSER_CLI || 'agent-browser';

const result = spawnSync(cli, ['--session', session, ...extra, 'batch', '--bail'], {
  input: JSON.stringify(commands),
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 2e6,
  timeout: 180000,
  shell: process.platform === 'win32'
});

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
```

---

## Opcode Specification Cheat Sheet

A scenario is a JSON array of opcode tuples:

| Opcode | Arguments | Description | Example |
| :--- | :--- | :--- | :--- |
| `tab` | `[id]` | Switch to or target a specific tab | `["tab", "t1"]` |
| `find` | `role, <role>, click, --name, <name>, --exact` | Accessible semantic click | `["find", "role", "button", "click", "--name", "Save", "--exact"]` |
| `fill` | `<selector>, <value>` | Fill text into an input | `["fill", "#project-name", "Tower Phase 2"]` |
| `press` | `<key>` | Send a keyboard key event | `["press", "Escape"]` |
| `wait` | `--fn, <js_predicate>` | Wait for in-DOM condition | `["wait", "--fn", "document.querySelectorAll('.item').length === 3"]` |
| `eval` | `<js_code>` | Run JS closure in browser; throws on failure | `["eval", "if (!window.__APP__) throw Error('App not ready')"]` |
| `set` | `viewport, <w>, <h>` | Resize viewport (mobile/desktop audit) | `["set", "viewport", "390", "844"]` |
| `screenshot` | `<output_path>` | Direct GPU framebuffer snapshot | `["screenshot", "screenshots/audit/pass-1.png"]` |
| `reload` | *(none)* | Refresh page / verify state persistence | `["reload"]` |
| `errors` | *(none)* | Assert zero uncaught browser runtime errors | `["errors"]` |
| `console` | *(none)* | Output browser console logs | `["console"]` |

---

## Complete Scenario Example (`scenario.json`)

```json
[
  ["tab", "t1"],
  ["wait", "--fn", "!!document.querySelector('[data-hydration-status=ready]')"],
  ["find", "role", "button", "click", "--name", "3D Model", "--exact"],
  ["wait", "--fn", "Number(document.querySelector('.canvas-container canvas')?.dataset.meshCount) > 0"],
  ["find", "role", "button", "click", "--name", "Front Elevation", "--exact"],
  ["screenshot", "screenshots/front-elevation.png"],
  ["set", "viewport", "390", "844"],
  ["eval", "for(const btn of document.querySelectorAll('button')) if(btn.getBoundingClientRect().height < 44) throw Error('Touch target < 44px'); 'Mobile touch targets verified'"],
  ["screenshot", "screenshots/mobile-responsive.png"],
  ["set", "viewport", "1600", "1000"],
  ["errors"]
]
```

---

## How to Execute

### 1. For a Live Web App (Vite / Next / Dev Server):
```bash
node browser-batch.mjs web-audit proof/scenarios/web-flow.json
```

### 2. For a Running Desktop App (Tauri / Electron with CDP enabled):
```bash
node browser-batch.mjs desktop-audit proof/scenarios/desktop-flow.json --cdp 9250
```

---

## Portability Guide (Using this across Claude, Codex, Gemini, Grok)

When bootstrapping this skill into any new repository or model:
1. Copy `browser-batch.mjs` into your scripts or tools directory.
2. Ensure `agent-browser` is accessible in the environment (`npm i -g agent-browser` or via local node_modules).
3. Ensure the web application emits data attributes (`data-hydration-status`, `data-mesh-count`, etc.) for key asynchronous states.
4. Pass scenario files to the runner via STDIN streaming to achieve instant, deterministic verification.
