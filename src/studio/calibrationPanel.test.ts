import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Calibration } from "./calibration";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "calibration-panel-test-"));
const compiledPath = join(compiledDir, "CalibrationPanel.cjs");
const source = readFileSync(join(here, "CalibrationPanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: "CalibrationPanel.tsx",
}).outputText;
writeFileSync(compiledPath, compiled);
const require = createRequire(import.meta.url);
const { CalibrationPanel, deriveCalibrationPanelState } = require(compiledPath) as typeof import("./CalibrationPanel");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const firstCandidate = {
  id: "declared-a",
  source: "declared" as const,
  metresPerUnit: 0.01,
  confidence: 0.82,
  inputDistance: null,
  knownDistanceM: null,
  points: null,
  provenance: { method: "PDF scale note", evidence: "Scale 1:100 on title block", documentId: "plan-1" },
};

const secondCandidate = {
  ...firstCandidate,
  id: "manual-b",
  source: "manual" as const,
  metresPerUnit: 0.012,
  confidence: 1,
  inputDistance: { value: 6, unit: "m" as const },
  knownDistanceM: 6,
  points: [{ x: 10, y: 10 }, { x: 510, y: 10 }] as [{ x: number; y: number }, { x: number; y: number }],
  provenance: { method: "Two-point measurement", evidence: "6 m boundary dimension", documentId: "plan-1" },
};

function calibration(overrides: Partial<Calibration> = {}): Calibration {
  return {
    sheet: 0,
    metresPerUnit: 1,
    source: "unverified",
    confidence: 0,
    locked: false,
    knownDistanceM: null,
    points: null,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    inputDistance: null,
    candidates: [],
    selectedCandidateId: null,
    conflict: null,
    ...overrides,
  };
}

const noop = () => {};

function render(value: Calibration | null, extras: Partial<React.ComponentProps<typeof CalibrationPanel>> = {}) {
  return renderToStaticMarkup(React.createElement(CalibrationPanel, {
    sheetNumber: 1,
    calibration: value,
    captureActive: false,
    capturedPoints: 0,
    distanceValue: "",
    unit: "m",
    onDistanceValueChange: noop,
    onUnitChange: noop,
    onStartCapture: noop,
    onCancelCapture: noop,
    onSelectCandidate: noop,
    onLock: noop,
    onUnlock: noop,
    ...extras,
  }));
}

describe("calibration panel trust states", () => {
  it("derives only locked calibrations as trusted", () => {
    assert.equal(deriveCalibrationPanelState(null), "uncalibrated");
    assert.equal(deriveCalibrationPanelState(calibration({ candidates: [firstCandidate] })), "uncalibrated");
    assert.equal(deriveCalibrationPanelState(calibration({ candidates: [firstCandidate], selectedCandidateId: firstCandidate.id })), "ready");
    assert.equal(deriveCalibrationPanelState(calibration({
      candidates: [firstCandidate, secondCandidate],
      conflict: { candidateIds: [firstCandidate.id, secondCandidate.id], maxRelativeDifference: 1 / 6 },
    })), "needs-resolution");
    assert.equal(deriveCalibrationPanelState(calibration({
      candidates: [firstCandidate, secondCandidate],
      selectedCandidateId: secondCandidate.id,
      conflict: { candidateIds: [firstCandidate.id, secondCandidate.id], maxRelativeDifference: 1 / 6 },
    })), "ready");
    assert.equal(deriveCalibrationPanelState(calibration({
      locked: true,
      source: "manual",
      confidence: 1,
      candidates: [secondCandidate],
      selectedCandidateId: secondCandidate.id,
    })), "locked");
  });

  it("renders candidate comparison and explicit conflict guidance without implying trust", () => {
    const markup = render(calibration({
      candidates: [firstCandidate, secondCandidate],
      conflict: { candidateIds: [firstCandidate.id, secondCandidate.id], maxRelativeDifference: 1 / 6 },
    }));

    assert.match(markup, /Needs resolution/);
    assert.match(markup, /Scale evidence conflicts/);
    assert.match(markup, /PDF scale note/);
    assert.match(markup, /Two-point measurement/);
    assert.match(markup, /Confidence 82%/);
    assert.match(markup, /Select the evidence you trust before locking/);
    assert.match(markup, /Lock scale/);
    assert.match(markup, /disabled=""/);
    assert.doesNotMatch(markup, /Scale is locked for measurements/);
  });

  it("exposes capture progress and replaces lock controls after a trusted lock", () => {
    const captureMarkup = render(null, { captureActive: true, capturedPoints: 1, distanceValue: "6" });
    assert.match(captureMarkup, /1 of 2 points captured/);
    assert.match(captureMarkup, /Cancel/);

    const lockedMarkup = render(calibration({
      metresPerUnit: secondCandidate.metresPerUnit,
      source: "manual",
      confidence: 1,
      locked: true,
      candidates: [secondCandidate],
      selectedCandidateId: secondCandidate.id,
    }));
    assert.match(lockedMarkup, /Locked scale/);
    assert.match(lockedMarkup, /Unlock to change/);
    assert.doesNotMatch(lockedMarkup, /Pick two points/);
  });
});
