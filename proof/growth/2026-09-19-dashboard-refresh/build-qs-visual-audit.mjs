/**
 * Extend the existing SC09 interaction campaign with independent visual gates.
 * This builder only emits source-derived JSON; run the campaign on DANS1 only.
 * No fake product state, browser CSS injection or DOM layout mutation is used.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(outputDirectory, "../../..");
const basePath = "proof/growth/2026-09-19-sc09-entity-highlight/sc09-entity-highlight.scenario.json";
const baseBytes = readFileSync(resolve(root, basePath));
const scenario = JSON.parse(baseBytes.toString("utf8"));
const captureDirectory = "proof/growth/2026-09-19-dashboard-refresh/qs-visual-captures";

export const assertQsVisualLayout = `(() => {
  const ledger = document.querySelector('[data-testid="qs-item-binding-ledger"]');
  const pane = ledger?.closest('.studio-main');
  if (!ledger || !pane) throw Error('QS ledger and its estimate pane must be mounted');
  const roots = [ledger, ...document.querySelectorAll('.qs-quantity-report')];
  const diagnostics = { viewport: [innerWidth, innerHeight], ancestors: [], localScrollers: [], textSamples: 0, minContrast: 100, controls: 0 };
  const rect = element => element.getBoundingClientRect();
  const visible = element => {
    const box = rect(element);
    if (!box.width || !box.height) return false;
    for (let current = element; current; current = current.parentElement) {
      const css = getComputedStyle(current);
      if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) return false;
    }
    return true;
  };
  const identify = element => element.getAttribute('data-testid') || element.className || element.tagName;
  const visitedAncestors = new Set();
  for (const surface of roots) {
    for (let parent = surface; parent; parent = parent.parentElement) {
      if (!visitedAncestors.has(parent)) {
        visitedAncestors.add(parent);
        diagnostics.ancestors.push({ name: identify(parent), width: parent.clientWidth, content: parent.scrollWidth });
        if (parent.scrollWidth > parent.clientWidth + 1) throw Error('QS ancestor has horizontal overflow: ' + identify(parent) + ' ' + parent.scrollWidth + ' > ' + parent.clientWidth);
      }
      if (parent === pane) break;
    }
    const bounds = rect(surface);
    const paneBounds = rect(pane);
    if (bounds.left < paneBounds.left - 1 || bounds.right > paneBounds.right + 1) throw Error('QS surface extends beyond estimate pane: ' + identify(surface));
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) throw Error('Document overflows viewport');

  const localScroller = element => {
    const candidate = element.closest('.industry-table-wrap, .qs-hierarchy-section > div:last-child');
    return candidate && /auto|scroll/.test(getComputedStyle(candidate).overflowX) ? candidate : null;
  };
  for (const surface of roots) {
    for (const scroller of surface.querySelectorAll('.industry-table-wrap, .qs-hierarchy-section > div:last-child')) {
      const bounds = rect(scroller);
      const parent = rect(surface);
      if (bounds.left < parent.left - 1 || bounds.right > parent.right + 1) throw Error('Table wrapper expands QS surface');
      if (scroller.scrollWidth > scroller.clientWidth + 1) {
        if (!/auto|scroll/.test(getComputedStyle(scroller).overflowX)) throw Error('Wide table is clipped instead of locally scrollable');
        diagnostics.localScrollers.push({ name: identify(scroller), width: scroller.clientWidth, content: scroller.scrollWidth });
      }
    }
  }

  const rgba = value => {
    const values = value.match(/[\\d.]+/g)?.map(Number);
    if (!value.startsWith('rgb') || !values || values.length < 3) throw Error('Unsupported computed colour: ' + value);
    return [...values.slice(0, 3), values[3] ?? 1];
  };
  const over = (front, back) => {
    const alpha = front[3] + back[3] * (1 - front[3]);
    return [0, 1, 2].map(index => (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha).concat(alpha);
  };
  const background = element => {
    const chain = [];
    for (let current = element; current; current = current.parentElement) chain.unshift(current);
    return chain.reduce((colour, current) => over(rgba(getComputedStyle(current).backgroundColor), colour), [255, 255, 255, 1]);
  };
  const luminance = colour => colour.slice(0, 3).map(channel => {
    const normalized = channel / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
  const sampled = new Set();
  for (const surface of roots) {
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const text = node.textContent.trim();
      if (!text || !element || !visible(element) || element.closest(':disabled, option')) continue;
      if (element.closest('.qs-binding-table-wrap thead') && getComputedStyle(element.closest('thead')).position === 'absolute') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const boxes = [...range.getClientRects()].filter(box => box.width && box.height);
      if (!boxes.length) continue;
      if (!localScroller(element)) {
        const bounds = rect(surface);
        for (const box of boxes) {
          if (box.left < bounds.left - 1 || box.right > bounds.right + 1) throw Error('Text clips horizontally: ' + text.slice(0, 100));
        }
      }
      if (sampled.has(element)) continue;
      sampled.add(element);
      const css = getComputedStyle(element);
      const bg = background(element);
      const fg = over(rgba(css.color), bg);
      const a = luminance(fg), b = luminance(bg);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const size = parseFloat(css.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(css.fontWeight) >= 700);
      const required = large ? 3 : 4.5;
      diagnostics.textSamples++;
      diagnostics.minContrast = Math.min(diagnostics.minContrast, ratio);
      if (ratio < required) throw Error('Text contrast ' + ratio.toFixed(2) + ':1 < ' + required + ':1: ' + text.slice(0, 100));
    }
    for (const control of surface.querySelectorAll('button, select, summary')) {
      if (!visible(control)) continue;
      const bounds = rect(control);
      if (bounds.width < 43.99 || bounds.height < 43.99) throw Error('QS control below 44px: ' + control.textContent.trim().slice(0, 80));
      diagnostics.controls++;
    }
  }
  const rows = [...ledger.querySelectorAll('[data-testid^="qs-binding-row-"]')];
  if (!rows.length || diagnostics.textSamples < 12 || !diagnostics.controls) throw Error('Visual audit did not inspect real populated QS content');
  const cardLayout = ledger.clientWidth <= 740;
  if (rows.some(row => (getComputedStyle(row).display === 'grid') !== cardLayout)) throw Error('Ledger did not adapt to actual pane width');
  if (cardLayout && ledger.scrollWidth > ledger.clientWidth + 1) throw Error('Narrow evidence cards require horizontal scrolling');
  return { ...diagnostics, minContrast: Number(diagnostics.minContrast.toFixed(2)), ledgerWidth: ledger.clientWidth, cardLayout, rows: rows.length };
})()`;

const frameRow = item => `(() => {
  const row = document.querySelector('[data-testid="qs-binding-row-${item}"]');
  const pane = row?.closest('.studio-main');
  if (!row || !pane) throw Error('Cannot frame missing ledger row');
  row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  const r = row.getBoundingClientRect(), p = pane.getBoundingClientRect();
  if (r.top < p.top - 1 || r.bottom > p.bottom + 1 || r.left < p.left - 1 || r.right > p.right + 1) throw Error('Evidence card is not fully visible for its proof capture');
  for (const label of ['Item', 'Row quantity', 'Bound entity', 'Binding status', 'Pricing']) {
    if (![...row.querySelectorAll('.qs-binding-cell-label')].some(element => element.textContent === label)) throw Error('Evidence card missing label: ' + label);
  }
  return { item: '${item}', width: r.width, height: r.height, pane: [p.width, p.height] };
})()`;

const expanded = [];
for (const original of scenario) {
  const operation = original.map(value => typeof value === "string" ? value.replaceAll("http://127.0.0.1:8080", "{{ORIGIN}}") : value);
  if (operation[0] === "screenshot") {
    const name = operation[1].split("/").at(-1);
    operation[1] = `${captureDirectory}/${name}`;
    if (/bindings|edited-run-stale/.test(name)) expanded.push(["eval", assertQsVisualLayout]);
    expanded.push(operation);
    if (name === "sc09-two-current-bindings-desktop-1600x1000.png") {
      expanded.push(["eval", `(() => { const report = document.querySelector('.qs-quantity-report'); if (!report) throw Error('Classification report absent'); report.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' }); return true; })()`]);
      expanded.push(["eval", assertQsVisualLayout]);
      expanded.push(["screenshot", `${captureDirectory}/qs-report-desktop-1600x1000.png`]);
    }
    if (name === "sc09-only-edited-run-stale-tablet-1024x768.png") {
      for (const item of ["QS-WALL-A", "QS-WALL-B"]) {
        expanded.push(["eval", frameRow(item)], ["eval", assertQsVisualLayout]);
        expanded.push(["screenshot", `${captureDirectory}/qs-evidence-card-${item.toLowerCase()}-tablet-1024x768.png`]);
      }
    }
  } else expanded.push(operation);
}

const output = resolve(outputDirectory, "qs-visual-audit.scenario.json");
writeFileSync(output, JSON.stringify(expanded, null, 2) + "\n", "utf8");
writeFileSync(resolve(outputDirectory, "qs-visual-audit.source.json"), JSON.stringify({
  kind: "source-generation-only-not-executed-proof",
  basePath,
  baseSha256: createHash("sha256").update(baseBytes).digest("hex"),
  operations: expanded.length,
  captures: expanded.filter(operation => operation[0] === "screenshot").length,
  auditGates: ["ancestor-pane-no-horizontal-overflow", "localized-table-scroll", "text-ranges-not-clipped", "computed-wcag-aa-contrast", "44px-controls", "container-responsive-cards", "full-card-proof-frame"],
}, null, 2) + "\n", "utf8");
console.log(`Generated ${output}: ${expanded.length} operations. Execute on DANS1 only.`);
