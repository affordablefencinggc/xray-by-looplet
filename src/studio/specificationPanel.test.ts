import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createReviewDecision, createRunSpecification } from "./domain.ts";
import type { EditableFenceRun } from "./tracing.ts";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "specification-panel-test-"));
const compiledPath = join(compiledDir, "SpecificationPanel.cjs");
const source = readFileSync(join(here, "SpecificationPanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: "SpecificationPanel.tsx" }).outputText;
writeFileSync(compiledPath, compiled);
const require = createRequire(import.meta.url);
const { SpecificationPanel } = require(compiledPath) as typeof import("./SpecificationPanel");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

function run(): EditableFenceRun {
  return {
    id: "run-1", revision: 7, sheet: 0, label: "North boundary",
    points: [{ x: 0, y: 0 }, { x: 5, y: 1 }, { x: 10, y: 0 }],
    lengthM: 10, grossLengthM: 10, gateDeductionM: 0, netLengthM: 10,
    specification: {
      ...createRunSpecification(), system: "custom", customSystem: "Slatted aluminium", profile: "65 mm blade",
      removalRequired: true, removalMaterial: "Timber paling", removalLengthM: 10, disposalRequired: true,
      retainingRequired: true, retainingType: "concrete-sleeper", retainingHeightM: 0.6, retainingCondition: "Existing posts sound",
      corners: [{ id: "corner-1", vertexIndex: 1, treatment: "mitred", notes: "Keep clear" }],
      postOverrides: [{ id: "post-1", vertexIndex: 2, postSize: "100 SHS", lengthM: 3, embedmentM: 0.8, notes: "Gate post" }],
    },
    photoIds: [], review: createReviewDecision(),
  };
}

describe("run specification panel", () => {
  it("renders every frozen estimator group and revision", () => {
    const markup = renderToStaticMarkup(React.createElement(SpecificationPanel, { run: run(), onUpdate: () => {} }));
    for (const label of [
      "Fence system", "Profile / product", "Custom system", "Height (m)", "Bay width (m)", "Ground", "Slope", "Access", "Sleepers",
      "Existing fence removal", "Removal material", "Removal length (m)", "Disposal required",
      "Retaining", "Retaining type", "Retaining height (m)", "Retaining condition",
      "Corner treatments", "Post overrides", "Run notes",
    ]) assert.match(markup, new RegExp(label.replace(/[()]/g, "\\$&")));
    assert.match(markup, /Revision 7/);
    assert.match(markup, /Vertex 2 corner treatment/);
    assert.match(markup, /Vertex 3 post size/);
  });

  it("binds all updates to the selected run ID and expected revision", () => {
    assert.match(source, /onUpdate\(run\.id, run\.revision, value\)/);
    assert.doesNotMatch(source, /setTimeout|localStorage|useState/);
  });
});
