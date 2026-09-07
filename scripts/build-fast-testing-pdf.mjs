import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const imgPath = 'C:/Users/danie/.gemini/antigravity-ide/brain/cba3f24c-7348-4916-bac8-c5d12d27a34e/fast_testing_infographic_1788783641170.jpg';
let imgBase64 = '';
if (fs.existsSync(imgPath)) {
  imgBase64 = 'data:image/jpeg;base64,' + fs.readFileSync(imgPath).toString('base64');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fast CDP Testing Architecture & Reference Guide</title>
<style>
  @page {
    size: A4;
    margin: 12mm 12mm 12mm 12mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.45;
    font-size: 10.5pt;
    margin: 0;
    padding: 0;
  }
  h1 { font-size: 19pt; color: #0f172a; margin-top: 0; margin-bottom: 6px; border-bottom: 2px solid #38bdf8; padding-bottom: 6px; }
  h2 { font-size: 13pt; color: #0284c7; margin-top: 14px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 10.5pt; color: #334155; margin-top: 10px; margin-bottom: 4px; }
  p { margin: 4px 0 8px 0; }
  .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 8.5pt; margin-right: 6px; }
  .infographic { width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); margin: 8px 0 14px 0; display: block; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 600; }
  tr:nth-child(even) { background: #f8fafc; }
  pre { background: #0f172a; color: #f8fafc; padding: 8px 10px; border-radius: 6px; font-size: 8pt; font-family: 'Consolas', 'Courier New', monospace; overflow: hidden; white-space: pre-wrap; margin: 5px 0; }
  code { font-family: 'Consolas', 'Courier New', monospace; font-size: 8.5pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0284c7; }
  pre code { background: none; color: inherit; padding: 0; }
  .page-break { page-break-before: always; }
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; background: #f8fafc; font-size: 9pt; }
  .card strong { color: #0f172a; display: block; margin-bottom: 2px; }
</style>
</head>
<body>

  <h1>⚡ Fast CDP Testing Architecture & Reference Guide</h1>
  <p>
    <span class="badge">Sub-2s Execution</span>
    <span class="badge">Zero Sleep Hacks</span>
    <span class="badge">Hot-Socket CDP</span>
    <span class="badge">In-DOM Telemetry</span>
    <span class="badge">Declarative JSON Opcodes</span>
  </p>

  <img class="infographic" src="${imgBase64}" alt="Fast CDP Architecture Infographic" />

  <h2>1. Core Architectural Pillars</h2>
  <div class="card-grid">
    <div class="card">
      <strong>1. Hot-Socket Connection (Port 9250 / 9222)</strong>
      Attaches directly to an already-running desktop app or browser via WebSocket. Zero browser cold-starts (&lt; 15ms attach vs 10s fresh launch).
    </div>
    <div class="card">
      <strong>2. JSON Opcode Stream over STDIN</strong>
      All steps are passed as a single JSON array to <code>agent-browser batch --bail</code>. 40+ atomic steps run in a tight synchronous in-memory loop.
    </div>
    <div class="card">
      <strong>3. Reactive In-DOM Telemetry</strong>
      Zero <code>sleep()</code> slop. Asserts DOM dataset contracts (<code>data-mesh-count="198"</code>, <code>data-hydration-status="ready"</code>) instantly on change.
    </div>
    <div class="card">
      <strong>4. In-Engine Layout Closures</strong>
      A single in-browser JavaScript evaluation checks 50+ elements for touch target sizing (&ge; 44px), clipping, and viewport overflow in 0.2ms.
    </div>
  </div>

  <div class="page-break"></div>

  <h2>2. Performance Benchmark Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Attribute</th>
        <th>Traditional E2E (Selenium / Cypress / Playwright Runner)</th>
        <th>Fast CDP Batch Testing</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Startup Overhead</strong></td>
        <td>5–15 seconds (cold browser boot &amp; runner initialization)</td>
        <td>&lt; 15 milliseconds (hot-attached CDP WebSocket)</td>
      </tr>
      <tr>
        <td><strong>Full Suite Speed</strong></td>
        <td>30–60 seconds per scenario</td>
        <td>1–2 seconds per scenario</td>
      </tr>
      <tr>
        <td><strong>Timing Strategy</strong></td>
        <td>Arbitrary <code>sleep()</code> hacks or hanging <code>networkidle</code></td>
        <td>Microtask reactive DOM predicates (<code>wait --fn</code>)</td>
      </tr>
      <tr>
        <td><strong>3D / Canvas Validation</strong></td>
        <td>Slow, brittle visual diffing or un-tested black box</td>
        <td>Instant DOM dataset attribute telemetry</td>
      </tr>
      <tr>
        <td><strong>Layout &amp; Bounds Checking</strong></td>
        <td>Dozens of round-trip IPC bridge queries</td>
        <td>1 native V8 geometric closure (0.2ms)</td>
      </tr>
      <tr>
        <td><strong>Failure Handling</strong></td>
        <td>Cascading timeout retries (minutes of waiting)</td>
        <td>Instant <code>--bail</code> termination on first broken invariant</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Declarative Opcode Specification</h2>
  <table>
    <thead>
      <tr>
        <th>Opcode</th>
        <th>Syntax</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>tab</code></td>
        <td><code>["tab", "t1"]</code></td>
        <td>Target specific browser/webview tab.</td>
      </tr>
      <tr>
        <td><code>find</code></td>
        <td><code>["find", "role", "button", "click", "--name", "Save", "--exact"]</code></td>
        <td>Accessible semantic element click.</td>
      </tr>
      <tr>
        <td><code>fill</code></td>
        <td><code>["fill", "#input-id", "Value"]</code></td>
        <td>Input text typing without simulated delays.</td>
      </tr>
      <tr>
        <td><code>press</code></td>
        <td><code>["press", "Escape"]</code></td>
        <td>Dispatch native keyboard events.</td>
      </tr>
      <tr>
        <td><code>wait</code></td>
        <td><code>["wait", "--fn", "&lt;js-expression&gt;"]</code></td>
        <td>Reactive wait until expression returns truthy.</td>
      </tr>
      <tr>
        <td><code>eval</code></td>
        <td><code>["eval", "&lt;js-code&gt;"]</code></td>
        <td>Execute JS closure in browser V8; throws on error.</td>
      </tr>
      <tr>
        <td><code>set</code></td>
        <td><code>["set", "viewport", "390", "844"]</code></td>
        <td>Dynamic viewport resize for responsive audits.</td>
      </tr>
      <tr>
        <td><code>screenshot</code></td>
        <td><code>["screenshot", "path/to/image.png"]</code></td>
        <td>Direct GPU compositor framebuffer capture.</td>
      </tr>
      <tr>
        <td><code>reload</code></td>
        <td><code>["reload"]</code></td>
        <td>Reload page to verify persistence/hydration.</td>
      </tr>
      <tr>
        <td><code>errors</code></td>
        <td><code>["errors"]</code></td>
        <td>Assert zero uncaught browser console exceptions.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Universal Test Runner (<code>browser-batch.mjs</code>)</h2>
  <pre><code>import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , session, file, ...extra] = process.argv;
if (!session || !file) {
  console.error('Usage: node browser-batch.mjs &lt;session-name&gt; &lt;scenario.json&gt; [--cdp &lt;port&gt;]');
  process.exit(1);
}

const commands = JSON.parse(readFileSync(file, 'utf8'));
const cliCandidates = [
  process.env.AGENT_BROWSER_CLI,
  resolve('.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js'),
  'agent-browser'
].filter(Boolean);

let cli = cliCandidates.find(c =&gt; existsSync(c)) || 'agent-browser';

const result = spawnSync(
  process.execPath,
  [cli, '--session', session, ...extra, 'batch', '--bail'],
  { input: JSON.stringify(commands), encoding: 'utf8', windowsHide: true, maxBuffer: 2e6, timeout: 180000, shell: process.platform === 'win32' }
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);</code></pre>

  <div class="page-break"></div>

  <h2>5. Complete Production Scenarios</h2>
  
  <h3>Scenario A: Standard Web App / SaaS Flow</h3>
  <pre><code>[
  ["tab", "t1"],
  ["wait", "--fn", "!!document.querySelector('[data-hydration-status=ready]')"],
  ["fill", "input[name=email]", "dan@example.com"],
  ["fill", "input[name=password]", "SecurePass123!"],
  ["find", "role", "button", "click", "--name", "Sign In", "--exact"],
  ["wait", "--fn", "location.pathname === '/dashboard'"],
  ["eval", "if (!localStorage.getItem('auth_token')) throw Error('Missing auth token');"],
  ["screenshot", "screenshots/dashboard.png"],
  ["set", "viewport", "390", "844"],
  ["eval", "for (const b of document.querySelectorAll('button, a')) if (b.getBoundingClientRect().height &lt; 44) throw Error('Touch target &lt; 44px');"],
  ["screenshot", "screenshots/mobile-audit.png"],
  ["set", "viewport", "1600", "1000"],
  ["errors"]
]</code></pre>

  <h3>Scenario B: 3D CAD &amp; Native Desktop Flow (Tauri / WebView2)</h3>
  <pre><code>[
  ["tab", "t1"],
  ["wait", "--fn", "!!document.querySelector('[data-hydration-status=ready]')"],
  ["eval", "if(!window.__TAURI_INTERNALS__) throw Error('Not native desktop app');"],
  ["find", "role", "button", "click", "--name", "Open 3D Model", "--exact"],
  ["wait", "--fn", "Number(document.querySelector('.canvas canvas')?.dataset.meshCount) === 198"],
  ["find", "role", "button", "click", "--name", "Front", "--exact"],
  ["find", "role", "button", "click", "--name", "Zoom in model", "--exact"],
  ["screenshot", "screenshots/native-front.png"],
  ["find", "role", "button", "click", "--name", "Fly", "--exact"],
  ["wait", "--fn", "document.querySelector('canvas')?.dataset.navigation === 'fly' &amp;&amp; !!document.pointerLockElement"],
  ["press", "Escape"],
  ["wait", "--fn", "document.querySelector('canvas')?.dataset.navigation === 'orbit'"],
  ["reload"],
  ["wait", "--fn", "!!document.querySelector('[data-hydration-status=ready]')"],
  ["errors"]
]</code></pre>

</body>
</html>`;

const tempHtml = path.resolve('temp-fast-testing-doc.html');
fs.writeFileSync(tempHtml, html);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outPdf = path.resolve('FAST-CDP-TESTING-REFERENCE.pdf');
const outPdfSkill = path.resolve('.agents/skills/fast-cdp-testing/FAST-CDP-TESTING-REFERENCE.pdf');

console.log('Generating PDF via headless Edge...');
execSync(`"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${outPdf}" --no-pdf-header-footer "${tempHtml}"`);

fs.copyFileSync(outPdf, outPdfSkill);
fs.unlinkSync(tempHtml);

const stats = fs.statSync(outPdf);
console.log('PDF generation complete!');
console.log('Primary: ' + outPdf);
console.log('Skill:   ' + outPdfSkill);
console.log('Size:    ' + (stats.size / 1024).toFixed(1) + ' KB');
