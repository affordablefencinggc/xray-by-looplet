import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const proofRoot = resolve(here, "..");
const immutableScenarioPath = resolve(
  proofRoot,
  "campaigns/sc09rr-bf09e36e3100-room-roof-dev2/output/scenario.json",
);
const outputPath = resolve(proofRoot, "scenarios/sc09-room-roof.dev2-op54-diagnostic.json");
const immutableScenarioSha256 = "0cb1a7938e113c7afd60073926333a371f209f72c61eb4814580f765f0d248b6";

const sourceBytes = await readFile(immutableScenarioPath);
assert.equal(
  createHash("sha256").update(sourceBytes).digest("hex"),
  immutableScenarioSha256,
  "Refusing to derive a diagnostic from a changed dev2 scenario",
);

const source = JSON.parse(sourceBytes.toString("utf8"));
assert.ok(Array.isArray(source), "The immutable dev2 scenario must be an opcode array");
assert.equal(source.length, 92, "The immutable dev2 scenario operation count changed");
assert.deepEqual(source[53].slice(0, 2), ["wait", "--fn"], "Dev2 op53 is no longer the source-area wait");
assert.equal(source[54][0], "eval", "Dev2 op54 is no longer an eval operation");
assert.match(source[54][1], /Move area vertices/, "Dev2 op54 is no longer the failed Move area vertices click");

const diagnosticExpression = String.raw`(() => {
  const attributes = element => element
    ? Object.fromEntries(element.getAttributeNames().sort().map(name => [name, element.getAttribute(name)]))
    : null;
  const box = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const moveButton = [...document.querySelectorAll("button")]
    .find(button => button.textContent.trim() === "Move area vertices") ?? null;
  const fieldset = moveButton?.closest("fieldset") ?? null;
  const result = document.querySelector('[data-testid="source-area-result"]');
  const editor = document.querySelector('[data-testid="source-area-editor"]');
  const sourceAreaSelect = document.querySelector('select[aria-label="Source area"]');
  const preview = document.querySelector(".measure-document-preview");
  const viewport = preview?.querySelector(".document-preview-viewport") ?? null;
  const sourceContainer = preview?.querySelector(".document-preview-source") ?? null;
  const overlay = preview?.querySelector(".document-preview-overlay") ?? null;
  const sourcePage = preview?.querySelector(".document-source-page") ?? null;
  const planCanvas = preview?.querySelector('canvas[aria-label="Plan drawing canvas"]') ?? null;
  const messages = [...(preview?.querySelectorAll('.document-preview-message, [role="alert"], [role="status"]') ?? [])]
    .map(element => ({ role: element.getAttribute("role"), text: element.textContent.trim() }));
  return {
    diagnostic: "sc09-room-roof-dev2-op54",
    moveButton: {
      exists: Boolean(moveButton),
      disabledProperty: moveButton ? moveButton.disabled : null,
      matchesDisabled: moveButton ? moveButton.matches(":disabled") : null,
      ariaDisabled: moveButton?.getAttribute("aria-disabled") ?? null,
      ariaPressed: moveButton?.getAttribute("aria-pressed") ?? null,
      attributes: attributes(moveButton),
    },
    ancestorFieldset: {
      exists: Boolean(fieldset),
      disabledProperty: fieldset instanceof HTMLFieldSetElement ? fieldset.disabled : null,
      matchesDisabled: fieldset ? fieldset.matches(":disabled") : null,
      attributes: attributes(fieldset),
    },
    sourceAreaResult: {
      exists: Boolean(result),
      entityId: result?.getAttribute("data-entity-id") ?? null,
      family: result?.getAttribute("data-family") ?? null,
      measuredQuantity: result?.getAttribute("data-measured-quantity") ?? null,
      attributes: attributes(result),
      text: result?.textContent.trim() ?? null,
    },
    sourceAreaEditor: {
      exists: Boolean(editor),
      selectedAreaId: sourceAreaSelect instanceof HTMLSelectElement ? sourceAreaSelect.value : null,
      attributes: attributes(editor),
    },
    documentPreview: {
      exists: Boolean(preview),
      sourceReady: preview?.getAttribute("data-source-ready") ?? null,
      ariaBusy: preview?.getAttribute("aria-busy") ?? null,
      attributes: attributes(preview),
      box: box(preview),
      viewport: { exists: Boolean(viewport), attributes: attributes(viewport), box: box(viewport) },
      sourceContainer: { exists: Boolean(sourceContainer), attributes: attributes(sourceContainer), box: box(sourceContainer) },
      overlay: { exists: Boolean(overlay), attributes: attributes(overlay), box: box(overlay) },
      sourcePage: {
        exists: Boolean(sourcePage),
        tagName: sourcePage?.tagName ?? null,
        attributes: attributes(sourcePage),
        box: box(sourcePage),
        complete: sourcePage instanceof HTMLImageElement ? sourcePage.complete : null,
        naturalWidth: sourcePage instanceof HTMLImageElement ? sourcePage.naturalWidth : null,
        naturalHeight: sourcePage instanceof HTMLImageElement ? sourcePage.naturalHeight : null,
        visibility: sourcePage ? getComputedStyle(sourcePage).visibility : null,
      },
      planCanvas: {
        exists: planCanvas instanceof HTMLCanvasElement,
        attributes: attributes(planCanvas),
        box: box(planCanvas),
        width: planCanvas instanceof HTMLCanvasElement ? planCanvas.width : null,
        height: planCanvas instanceof HTMLCanvasElement ? planCanvas.height : null,
        highlightedEntity: planCanvas?.getAttribute("data-highlighted-entity") ?? null,
      },
      messages,
    },
  };
})()`;

// Fast-CDP failure accounting is zero-based: dev2 completed ops 0..53 and failed
// while attempting source[54]. Preserve that prefix byte-for-byte at the parsed
// opcode level, then replace only the failed click with a non-mutating probe.
const diagnostic = [
  ...source.slice(0, 54),
  ["eval", diagnosticExpression],
  ["screenshot", "captures/dev2-op54-move-area-diagnostic-1600x1000.png"],
  ["errors"],
];

assert.equal(diagnostic.length, 57, "The diagnostic must contain 54 prefix ops plus eval, screenshot, and errors");
assert.deepEqual(diagnostic.slice(0, 54), source.slice(0, 54), "The immutable dev2 prefix changed");

await writeFile(outputPath, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8");
const outputBytes = await readFile(outputPath);
process.stdout.write(`${JSON.stringify({
  output: outputPath,
  operations: diagnostic.length,
  sha256: createHash("sha256").update(outputBytes).digest("hex"),
})}\n`);
