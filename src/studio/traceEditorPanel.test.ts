import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createGateSpecification, createReviewDecision, createRunSpecification } from "./domain.ts";
import type { EditableFenceRun, PlacedGate } from "./tracing.ts";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "trace-editor-panel-test-"));
const compiledPath = join(compiledDir, "TraceEditorPanel.cjs");
const source = readFileSync(join(here, "TraceEditorPanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: "TraceEditorPanel.tsx",
}).outputText;
writeFileSync(compiledPath, compiled);
const require = createRequire(import.meta.url);
const { TraceEditorPanel, canRemoveRunVertex, canSplitRunAt } = require(compiledPath) as typeof import("./TraceEditorPanel");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

function run(overrides: Partial<EditableFenceRun> = {}): EditableFenceRun {
  return {
    id: "run-1",
    revision: 4,
    sheet: 0,
    label: "North boundary",
    points: [{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }],
    lengthM: 10.5,
    grossLengthM: 12,
    gateDeductionM: 1.5,
    netLengthM: 10.5,
    specification: createRunSpecification(),
    photoIds: [],
    review: createReviewDecision(),
    ...overrides,
  };
}

function gate(overrides: Partial<PlacedGate> = {}): PlacedGate {
  return {
    id: "gate-1",
    revision: 2,
    sheet: 0,
    label: "Driveway gate",
    point: { x: 7, y: 0 },
    runId: "run-1",
    segmentIndex: 1,
    segmentT: 0.4,
    ...createGateSpecification(),
    widthM: 3.2,
    type: "sliding",
    photoIds: [],
    review: createReviewDecision(),
    ...overrides,
  };
}

const noop = () => {};
const secondRun = run({ id: "run-2", label: "West return", revision: 1 });

function render(overrides: Partial<React.ComponentProps<typeof TraceEditorPanel>> = {}) {
  return renderToStaticMarkup(React.createElement(TraceEditorPanel, {
    selectedRun: null,
    selectedGate: null,
    selectedVertexIndex: null,
    editMode: "select",
    canUndo: false,
    canRedo: false,
    mergeRunOptions: [secondRun],
    mergeTargetRunId: null,
    mergeFirstEndpoint: "end",
    mergeSecondEndpoint: "start",
    gateRunOptions: [run(), secondRun],
    onUndo: noop,
    onRedo: noop,
    onEditModeChange: noop,
    onSelectVertex: noop,
    onInsertAfterSelectedVertex: noop,
    onRemoveSelectedVertex: noop,
    onSplitAtSelectedVertex: noop,
    onMergeTargetRunChange: noop,
    onMergeFirstEndpointChange: noop,
    onMergeSecondEndpointChange: noop,
    onMergeRuns: noop,
    onGateSpecificationChange: noop,
    onGateRunChange: noop,
    onRemoveGate: noop,
    ...overrides,
  }));
}

describe("trace editor panel", () => {
  it("allows split only at internal vertices and removal only when geometry remains valid", () => {
    const selected = run();
    assert.equal(canSplitRunAt(selected, 0), false);
    assert.equal(canSplitRunAt(selected, 1), true);
    assert.equal(canSplitRunAt(selected, 2), false);
    assert.equal(canRemoveRunVertex(selected, 1), true);
    assert.equal(canRemoveRunVertex(run({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }), 0), false);
  });

  it("renders revisioned length accounting and makes merge an explicit endpoint action", () => {
    const markup = render({ selectedRun: run(), selectedVertexIndex: 1, editMode: "move", canUndo: true });

    assert.match(markup, /North boundary/);
    assert.match(markup, /Revision 4/);
    assert.match(markup, /12\.00 m/);
    assert.match(markup, /−1\.50 m/);
    assert.match(markup, /10\.50 m/);
    assert.match(markup, /Merge is always manual/);
    assert.match(markup, /West return · rev 1/);
    assert.match(markup, /Merge selected endpoints/);
    assert.match(markup, /aria-pressed="true">Move vertex/);
    assert.match(markup, /Split here/);
  });

  it("renders controlled gate type, width and run association fields", () => {
    const markup = render({ selectedGate: gate() });

    assert.match(markup, /Driveway gate/);
    assert.match(markup, /Revision 2/);
    assert.match(markup, /value="3\.2"/);
    assert.match(markup, /value="sliding" selected=""/);
    assert.match(markup, /value="run-1" selected=""/);
    assert.match(markup, /Opening direction/);
    assert.match(markup, /Hinge side/);
    assert.match(markup, /Gate post size/);
    assert.match(markup, /Motorised gate/);
    assert.match(markup, /Gate notes/);
    assert.match(markup, /recalculates the affected run’s net length/);
    assert.match(markup, /Remove gate/);
  });

  it("renders a clear empty state with disabled history actions", () => {
    const markup = render();
    assert.match(markup, /Select a run or gate/);
    assert.match(markup, /Undo last trace edit/);
    assert.match(markup, /Redo trace edit/);
    assert.equal((markup.match(/disabled=""/g) ?? []).length, 2);
  });
});
