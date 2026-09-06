import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { PhotoEvidence } from "./domain.ts";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "photo-evidence-panel-test-"));
const compiledPath = join(compiledDir, "PhotoEvidencePanel.cjs");
const source = readFileSync(join(here, "PhotoEvidencePanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: "PhotoEvidencePanel.tsx" }).outputText;
writeFileSync(compiledPath, compiled);
// Compile the panel's real local UI dependencies for this standalone SSR harness.
for (const name of ["EvidenceGallery", "WorkspaceDialog"]) {
  const dependency = ts.transpileModule(readFileSync(join(here, `${name}.tsx`), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: `${name}.tsx`,
  }).outputText;
  writeFileSync(join(compiledDir, `${name}.js`), dependency);
}
const require = createRequire(import.meta.url);
const { PhotoEvidencePanel } = require(compiledPath) as typeof import("./PhotoEvidencePanel");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const photo: PhotoEvidence = {
  id: "photo-1", revision: 3, name: "north-boundary.jpg", mimeType: "image/jpeg", sizeBytes: 2048,
  sha256: "a".repeat(64), order: 0, addedAt: "2026-09-04T00:00:00.000Z", updatedAt: "2026-09-04T00:00:00.000Z",
  capturedAt: null, source: "web", caption: "Existing timber fence", runIds: ["run-1"], gateIds: [],
};

const noop = () => {};

describe("photo evidence panel", () => {
  it("renders real previews, revision/hash provenance, captions, links, ordering and removal", () => {
    const markup = renderToStaticMarkup(React.createElement(PhotoEvidencePanel, {
      photos: [photo],
      photoPreviewUrls: { "photo-1": "blob:photo-1" },
      runs: [{ id: "run-1", label: "North boundary" }],
      gates: [{ id: "gate-1", label: "Driveway gate" }],
      error: null,
      onAddPhotos: async () => {},
      onUpdatePhoto: noop,
      onReorderPhoto: noop,
      onRemovePhoto: async () => {},
    }));
    assert.match(markup, /src="blob:photo-1"/);
    assert.match(markup, /Existing timber fence/);
    assert.match(markup, /Rev 3/);
    assert.match(markup, /SHA aaaaaaaaaa…/);
    assert.match(markup, /North boundary/);
    assert.match(markup, /Driveway gate/);
    assert.match(markup, /Move north-boundary\.jpg earlier/);
    assert.match(markup, /Move north-boundary\.jpg later/);
    assert.match(markup, /Remove north-boundary\.jpg/);
  });

  it("renders empty and explicit error states", () => {
    const markup = renderToStaticMarkup(React.createElement(PhotoEvidencePanel, {
      photos: [], photoPreviewUrls: {}, runs: [], gates: [], error: "JPEG exceeds 25 MB",
      onAddPhotos: async () => {}, onUpdatePhoto: noop, onReorderPhoto: noop, onRemovePhoto: async () => {},
    }));
    assert.match(markup, /Photo evidence needs attention/);
    assert.match(markup, /JPEG exceeds 25 MB/);
    assert.match(markup, /Add site photos/);
    assert.match(markup, /accept="image\/jpeg,image\/png,image\/webp"/);
  });

  it("passes expected revisions through every persisted mutation", () => {
    assert.match(source, /onUpdatePhoto\(photo\.id, photo\.revision/);
    assert.match(source, /onReorderPhoto\(photo\.id, index [+-] 1, photo\.revision\)/);
    assert.match(source, /onRemovePhoto\(photo\.id, photo\.revision\)/);
  });
});
