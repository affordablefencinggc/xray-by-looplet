import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BomAssumption, BomBuildResponse, BomIssue } from "./bomContract.ts";
import type { BomStateEnvelope } from "./bomState.ts";
import type { BomPanel as BomPanelType } from "./BomPanel.tsx";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "bom-panel-test-"));
const compiledPath = join(compiledDir, "BomPanel.cjs");
const source = readFileSync(join(here, "BomPanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  fileName: "BomPanel.tsx",
}).outputText;
writeFileSync(compiledPath, compiled);

const require = createRequire(import.meta.url);
let BomPanel: typeof BomPanelType;
let response: Extract<BomBuildResponse, { ok: true }>;

before(() => {
  ({ BomPanel } = require(compiledPath) as typeof import("./BomPanel.tsx"));
  const value = JSON.parse(readFileSync(resolve("engine/fixtures/bom-contract/colorbond.response.json"), "utf8")) as BomBuildResponse;
  assert.equal(value.ok, true);
  response = value;
});

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const noop = () => {};
const T0 = "2026-09-04T00:00:00.000Z";
const hash = "a".repeat(64);

function emptyState(overrides: Partial<BomStateEnvelope> = {}): BomStateEnvelope {
  return {
    schema: "xray.bom-state/v1",
    stateRevision: 0,
    jobId: "job-colorbond",
    pending: null,
    snapshot: null,
    invalidation: null,
    lastFailure: null,
    ...overrides,
  };
}

function snapshotState(stale = false): BomStateEnvelope {
  const binding = {
    jobId: response.bom.jobId,
    jobRevision: response.bom.jobRevision,
    documentSha256: response.bom.documentSha256,
    recipeSetId: response.bom.recipeSet.id,
    recipeSetRevision: response.bom.recipeSet.revision,
    recipeSetDigest: response.bom.recipeSet.digest,
    ruleset: response.bom.ruleset,
    inputDigest: response.bom.inputDigest,
  };
  return emptyState({
    stateRevision: stale ? 2 : 1,
    snapshot: { schema: "xray.bom-snapshot/v1", commitRevision: 1, committedAt: T0, requestId: response.requestId, binding, response },
    invalidation: stale ? { invalidatedAt: T0, reasons: ["job-changed"], observedBinding: { ...binding, jobRevision: binding.jobRevision + 1, inputDigest: hash } } : null,
  });
}

function assumption(status: "accepted" | "unresolved"): BomAssumption {
  return {
    id: "assumption-spacing",
    key: "post-spacing-mm",
    label: "Maximum post spacing",
    value: "2400",
    unit: "mm",
    source: "Approved recipe",
    effectiveAt: T0,
    status,
    acceptedBy: status === "accepted" ? "Estimator" : null,
    acceptedAt: status === "accepted" ? T0 : null,
  };
}

function render(state: BomStateEnvelope, extras: Partial<React.ComponentProps<typeof BomPanelType>> = {}) {
  return renderToStaticMarkup(React.createElement(BomPanel, {
    state,
    recipeAssumptions: [],
    onGenerate: noop,
    onCancel: noop,
    onRetry: noop,
    onAcceptAssumption: noop,
    onReopenAssumption: noop,
    onOpenEvidence: noop,
    ...extras,
  }));
}

describe("SC-07H BOM panel states", () => {
  it("distinguishes no recipe from a confirmed recipe that is ready to compile", () => {
    const noRecipe = render(emptyState(), { recipeAssumptions: null });
    assert.match(noRecipe, /No materials recipe/);
    assert.doesNotMatch(noRecipe, /Generate BOM/);

    const ready = render(emptyState(), { recipeAssumptions: [assumption("accepted")] });
    assert.match(ready, /Recipe assumptions confirmed/);
    assert.match(ready, /Generate BOM/);
    assert.match(ready, /Accepted project assumptions/);
    assert.match(ready, /Accepted by Estimator/);
    assert.match(ready, /Reopen/);
  });

  it("keeps browser-only generation explicitly unavailable", () => {
    const markup = render(emptyState(), {
      recipeAssumptions: [assumption("accepted")],
      generationAvailable: false,
    });
    assert.match(markup, /Desktop quantity engine required/);
    assert.match(markup, /cannot generate a new BOM/);
    assert.doesNotMatch(markup, /Generate BOM/);
  });

  it("requires explicit confirmation for every unresolved recipe assumption", () => {
    const markup = render(emptyState(), { recipeAssumptions: [assumption("unresolved")] });
    assert.match(markup, /Review recipe assumptions/);
    assert.match(markup, /Maximum post spacing/);
    assert.match(markup, /2400 mm/);
    assert.match(markup, /Accept assumption/);
    assert.doesNotMatch(markup, /Generate BOM/);
  });

  it("renders compiling state with a cancellable pending build", () => {
    const markup = render(emptyState({ pending: {
      requestId: "request-pending", expectedJobRevision: 12, startedAt: T0,
      binding: { jobId: "job-colorbond", jobRevision: 12, documentSha256: hash, recipeSetId: "recipe", recipeSetRevision: 1, recipeSetDigest: hash, ruleset: { id: "fencing-v1", version: 1 }, inputDigest: hash },
    } }), { transportStatus: { phase: "pending", message: "Waiting for the quantity engine." } });
    assert.match(markup, /aria-busy="true"/);
    assert.match(markup, /Compiling quantities/);
    assert.match(markup, /Waiting for the quantity engine/);
    assert.match(markup, /Cancel build/);
  });

  it("separates transport failure from domain issues and offers the correct recovery", () => {
    const transport = render(emptyState(), { transportStatus: { phase: "failed", message: "Connection ended before a verified response." } });
    assert.match(transport, /BOM could not be generated/);
    assert.match(transport, /Connection ended before a verified response/);
    assert.match(transport, /Retry build/);

    const issue: BomIssue = { code: "calibration", message: "Sheet 1 needs a locked calibration.", entityId: "run-1", path: "runs[0].calibration" };
    const domain = render(emptyState(), { compileIssues: [issue] });
    assert.match(domain, /Resolve before generating/);
    assert.match(domain, /Sheet 1 needs a locked calibration/);
    assert.match(domain, /runs\[0\]\.calibration/);
    assert.match(domain, /Check again/);
    assert.doesNotMatch(domain, /BOM could not be generated/);
  });

  it("renders a current result with quantity, calculation, confidence and complete lineage", () => {
    const markup = render(snapshotState());
    assert.match(markup, /Current result/);
    assert.match(markup, /CB-POST-END/);
    assert.match(markup, /End Colorbond post/);
    assert.match(markup, /2 ea/);
    assert.match(markup, /two outer run endpoints = 2 end posts/);
    assert.match(markup, /post-role-sites@1/);
    assert.match(markup, /No separate operands recorded/);
    assert.match(markup, /Result/);
    assert.match(markup, /Single source/);
    assert.match(markup, /run:run-boundary rev 5/);
    assert.match(markup, /a-spacing/);
    assert.match(markup, /Line items/);
    assert.match(markup, />11</);
    assert.match(markup, /Quantities only — unpriced and not sent/);
  });

  it("retains a stale snapshot but warns that it is not current", () => {
    const markup = render(snapshotState(true));
    assert.match(markup, /Retained result/);
    assert.match(markup, /Stale — source inputs changed/);
    assert.match(markup, /job changed/);
    assert.match(markup, /must not be treated as current/);
    assert.match(markup, /CB-POST-END/);
    assert.match(markup, /Regenerate BOM/);
  });

  it("keeps stale regeneration unavailable in a browser-only host", () => {
    const markup = render(snapshotState(true), { generationAvailable: false });
    assert.doesNotMatch(markup, /Regenerate BOM/);
    assert.match(markup, /desktop workbench to regenerate/);
  });

  it("does not make commercial, pricing, tax or handoff claims", () => {
    const markup = render(snapshotState());
    assert.doesNotMatch(markup, /\$|subtotal|total cost|tax|GST|supplier rate|sent successfully/i);
    assert.match(markup, /unpriced and not sent/i);
  });
});
