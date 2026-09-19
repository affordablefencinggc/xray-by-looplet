import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { z } from "zod";
import type { QuantityReport } from "./report.ts";
import { classifyQuantities } from "./classification.ts";
// Package-level test registration: `npm test` already executes this suite, so
// importing the companion contract suite keeps QS-03's highlight invariants in
// the mandatory regression gate as well as focused runs.
import "./qsEntityHighlight.test.ts";
import "./qsMeasuredGeometry.test.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve("node_modules/.cache"), { recursive: true });
import {
  QS_ITEM_BINDING_SCHEMA,
  describeItemBinding,
  evaluateItemBinding,
  qsBindingEvaluationSchema,
  qsEntityGeometrySchema,
  qsItemBindingSchema,
  reconcileBoundQuantity,
  shouldRepin,
  type QsEntityGeometry,
  type QsItemBinding,
} from "./qsItemBinding.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const AT = "2026-09-19T04:00:00.000Z";

// Built from the schema's *input* types, not its output. The helpers take
// untrusted input, so a null that the parser accepts must be typeable here —
// using the output type would reject `calibrationId: null` at compile time while
// parsing it happily at runtime, hiding a real contract behind a cast.
type BindingInput = z.input<typeof qsItemBindingSchema>;
type GeometryInput = z.input<typeof qsEntityGeometrySchema>;

const bindingInput = {
  format: QS_ITEM_BINDING_SCHEMA,
  itemId: "item-01",
  projectId: "project-01",
  entityId: "wall-run-7",
  entityType: "wall-run",
  measuredQuantity: "18.50",
  unit: "m",
  entityGeometrySha256: HASH_A,
  sourceSha256: HASH_B,
  calibrationId: "cal-01",
  boundAt: AT,
  boundBy: "estimator",
} satisfies BindingInput;

const parseBinding = (patch: Partial<BindingInput> = {}): QsItemBinding =>
  qsItemBindingSchema.parse({ ...bindingInput, ...patch });

const geometryInput = {
  entityId: "wall-run-7",
  entityType: "wall-run",
  geometrySha256: HASH_A,
  sourceSha256: HASH_B,
  calibrationId: "cal-01",
  unit: "m",
  measuredQuantity: "18.50",
} satisfies GeometryInput;

const parseGeometry = (patch: Partial<GeometryInput> = {}): QsEntityGeometry =>
  qsEntityGeometrySchema.parse({ ...geometryInput, ...patch });

// --- Schema invariants -----------------------------------------------------

test("A1: an item cannot be bound to itself", () => {
  assert.throws(() => parseBinding({ entityId: "item-01" }), /cannot be bound to itself/);
});

test("A2: a source-traced binding must record its calibration", () => {
  assert.throws(
    () => parseBinding({ sourceSha256: HASH_B, calibrationId: null }),
    /records the calibration/,
  );
});

test("A3: a binding with no source document may be uncalibrated", () => {
  const parsed = parseBinding({ sourceSha256: null, calibrationId: null });
  assert.equal(parsed.calibrationId, null);
});

test("A4: unknown keys are rejected", () => {
  assert.throws(() => qsItemBindingSchema.parse({ ...bindingInput, status: "stale-measurement" }), /Unrecognized key/);
});

test("A5: a quantity is exact decimal and never rounds", () => {
  assert.equal(parseBinding({ measuredQuantity: "18.50" }).measuredQuantity, "18.5");
  assert.equal(parseBinding({ measuredQuantity: "18.55" }).measuredQuantity, "18.55");
});

// Asserted on BOTH schemas separately. The two share one `quantity` declaration, so
// a single test asserting either one cannot tell which guard is live — a mutation
// that disabled the shared regex survived every other test in this file.
for (const [label, parse] of [
  ["binding", (value: string) => parseBinding({ measuredQuantity: value })],
  ["entity geometry", (value: string) => parseGeometry({ measuredQuantity: value })],
] as const) {
  test(`A5b: ${label} rejects non-decimal, scientific, signed and float quantities`, () => {
    for (const bad of ["18.5e-1", "1.8.5", "-2", "+2", "1,5", "18.5.0", ".5", "1.", " 18", "18 ", "1e3", "Infinity", "NaN"])
      assert.throws(() => parse(bad), /Invalid/, `${label} accepted ${JSON.stringify(bad)}`);
  });
}

test("A6: an unbindable entity type is rejected", () => {
  assert.throws(() => parseBinding({ entityType: "beam" as never }), /Invalid/);
});

test("A7: a non-hex geometry hash is rejected", () => {
  assert.throws(() => parseBinding({ entityGeometrySha256: "not-a-hash" }), /Invalid/);
});

// --- Evaluation: the staleness function ------------------------------------

test("B1: an untouched entity verifies and permits pricing", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry());
  assert.equal(result.status, "verified");
  assert.equal(result.pricingPermitted, true);
  assert.deepEqual(result.reasons, []);
});

test("B2: changed geometry is stale and withholds pricing", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ geometrySha256: HASH_C }));
  assert.equal(result.status, "stale-measurement");
  assert.equal(result.pricingPermitted, false);
  assert.match(result.reasons[0], /geometry changed/);
});

test("B3: a changed calibration is stale even when geometry is unchanged", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ calibrationId: "cal-02" }));
  assert.equal(result.status, "stale-measurement");
  assert.equal(result.pricingPermitted, false);
});

test("B3b: a changed source hash makes the entity binding stale", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ sourceSha256: HASH_C }));
  assert.equal(result.status, "stale-measurement");
  assert.equal(result.pricingPermitted, false);
  assert.match(result.reasons[0], /Source identity changed/);
});

test("B4: a deleted entity reports missing-entity, not stale", () => {
  const result = evaluateItemBinding(parseBinding(), null);
  assert.equal(result.status, "missing-entity");
  assert.equal(result.pricingPermitted, false);
});

test("B5: an entity id that resolves to a different entity reports missing-entity", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ entityId: "wall-run-9" }));
  assert.equal(result.status, "missing-entity");
  assert.match(result.reasons[0], /resolved to/);
});

test("B6: a unit change withholds pricing before any hash comparison", () => {
  const result = evaluateItemBinding(
    parseBinding(),
    parseGeometry({ unit: "ft", geometrySha256: HASH_C }),
  );
  assert.equal(result.status, "unit-changed");
  assert.equal(result.pricingPermitted, false);
});

test("B7: an uncalibrated binding never verifies, even when hashes match", () => {
  const result = evaluateItemBinding(
    parseBinding({ sourceSha256: null, calibrationId: null }),
    parseGeometry({ calibrationId: null }),
  );
  assert.equal(result.status, "uncalibrated");
  assert.equal(result.pricingPermitted, false);
});

test("B8: a calibration cleared on the entity is stale, not uncalibrated", () => {
  // `uncalibrated` describes how the binding was made, not what happened to the
  // entity since. The binding is calibrated; the entity lost its scale. That is
  // a change to the entity and the user re-measures, not re-calibrates.
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ calibrationId: null }));
  assert.equal(result.status, "stale-measurement");
  assert.match(result.reasons[0], /Calibration changed from cal-01 to null/);
});

test("B9: a drifted measured quantity is stale", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry({ measuredQuantity: "19" }));
  assert.equal(result.status, "stale-measurement");
  assert.match(result.reasons[0], /Measured quantity changed from 18\.5 to 19 m/);
});

test("B9b: editing only the cost-plan quantity makes the immutable binding stale", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry(), { quantity: "19", unit: "m" });
  assert.equal(result.status, "stale-measurement");
  assert.equal(result.pricingPermitted, false);
  assert.match(result.reasons[0], /Cost-plan quantity changed from 18\.5 to 19 m/);
});

test("B9c: editing only the cost-plan unit withholds pricing as unit-changed", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry(), { quantity: "18.5", unit: "ft" });
  assert.equal(result.status, "unit-changed");
  assert.equal(result.pricingPermitted, false);
  assert.match(result.reasons[0], /Cost-plan unit changed from m to ft/);
});

test("B9d: equivalent decimal spelling does not make an unchanged quantity stale", () => {
  const result = evaluateItemBinding(parseBinding(), parseGeometry(), { quantity: "18.500", unit: "m" });
  assert.equal(result.status, "verified");
  assert.equal(result.pricingPermitted, true);
});

test("B9e: sample and inferred row evidence cannot verify against matching measured geometry", () => {
  const binding = parseBinding(), geometry = parseGeometry();
  for (const evidence of ["sample", "inferred"] as const) {
    const result = evaluateItemBinding(binding, geometry, { quantity: "18.5", unit: "m", evidence, projectId: binding.projectId });
    assert.equal(result.status, "ineligible-evidence");
    assert.equal(result.pricingPermitted, false);
    assert.match(result.reasons[0], new RegExp(`classified as ${evidence}`));
    assert.match(result.reasons[0], /cannot permit verified pricing/);
  }
  const measured = evaluateItemBinding(binding, geometry, { quantity: "18.5", unit: "m", evidence: "unverified", projectId: binding.projectId });
  assert.equal(measured.status, "verified", "a real measured binding can establish a previously unverified row");
  assert.equal(measured.pricingPermitted, true);
});

test("B9f: copied bindings from another project stay stale even when entity IDs and hashes match", () => {
  const binding = parseBinding(), geometry = parseGeometry();
  for (const projectId of ["another-project", "", "p".repeat(240)]) {
    const result = evaluateItemBinding(binding, geometry, { quantity: "18.5", unit: "m", projectId });
    assert.equal(result.status, "stale-measurement");
    assert.equal(result.pricingPermitted, false);
    assert.match(result.reasons[0], /belongs to another project/);
  }
  assert.equal(evaluateItemBinding(binding, geometry, { quantity: "18.5", unit: "m", projectId: binding.projectId }).status, "verified");
  assert.equal(evaluateItemBinding(binding, geometry).status, "verified", "legacy callers may omit row context");
});

test("B10: evaluation is pure — the same inputs always give the same verdict", () => {
  const binding = parseBinding();
  const geometry = parseGeometry({ geometrySha256: HASH_C });
  assert.deepEqual(evaluateItemBinding(binding, geometry), evaluateItemBinding(binding, geometry));
  // And the binding itself is never mutated by evaluating it.
  assert.equal(binding.entityGeometrySha256, HASH_A);
});

test("B11: a binding stores no verdict field", () => {
  const parsed = parseBinding() as Record<string, unknown>;
  for (const forbidden of ["status", "stale", "pricingPermitted", "verified"])
    assert.equal(parsed[forbidden], undefined, `${forbidden} must not be stored on a binding`);
});

// --- Evaluation shape invariants -------------------------------------------

test("C1: pricingPermitted true with a non-verified status is rejected", () => {
  assert.throws(
    () => qsBindingEvaluationSchema.parse({ status: "stale-measurement", pricingPermitted: true, reasons: ["x"] }),
    /Only a verified binding may permit pricing/,
  );
});

test("C2: a non-verified status with no reason is rejected", () => {
  assert.throws(
    () => qsBindingEvaluationSchema.parse({ status: "uncalibrated", pricingPermitted: false, reasons: [] }),
    /states at least one reason/,
  );
});

test("C3: a verified status carrying findings is rejected", () => {
  assert.throws(
    () => qsBindingEvaluationSchema.parse({ status: "verified", pricingPermitted: true, reasons: ["why"] }),
    /carries no findings/,
  );
});

test("C4: pricingPermitted false on a verified status is rejected", () => {
  assert.throws(
    () => qsBindingEvaluationSchema.parse({ status: "verified", pricingPermitted: false, reasons: [] }),
    /Only a verified binding may permit pricing/,
  );
});

// --- Reconciliation and description ----------------------------------------

test("D1: a bound quantity that disagrees with the row is a finding, not a correction", () => {
  const result = reconcileBoundQuantity(parseBinding(), "18.5");
  assert.equal(result.agrees, true);
  assert.equal(result.binding, "18.5");
  assert.equal(result.row, "18.5");

  const disagreement = reconcileBoundQuantity(parseBinding(), "21");
  assert.equal(disagreement.agrees, false);
  assert.equal(disagreement.binding, "18.5");
  assert.equal(disagreement.row, "21");
});

test("D2: the audit line states identity, not a verdict", () => {
  const line = describeItemBinding(parseBinding());
  assert.match(line, /wall-run wall-run-7/);
  assert.match(line, /18\.5 m/);
  assert.match(line, /cal-01/);
  assert.doesNotMatch(line, /verified|stale|valid/i);
});

test("D3: an uncalibrated binding says so in its audit line", () => {
  const line = describeItemBinding(parseBinding({ sourceSha256: null, calibrationId: null }));
  assert.match(line, /uncalibrated/);
});

// --- F: the pin rule. The ledger can only ever report staleness if the pinned
// binding is left alone while the live geometry moves. These tests pin that
// asymmetry down directly, because a render test cannot reach it: the panel
// renders the same markup whether or not it re-pinned on the way there.

test("F1: an uncalculated draft never re-pins, however much its rows changed", () => {
  // This is the whole slice. Editing a quantity sets `calculated` false; if that
  // edit were allowed to re-pin, the binding would be re-derived from the new
  // number and the ledger would verify it — a clean bill of health for a
  // measurement nobody confirmed.
  assert.equal(shouldRepin({ calculated: false, draftKey: "a 99 m2", pinnedFor: "a 0.1 m2" }), false);
  assert.equal(shouldRepin({ calculated: false, draftKey: "a 99 m2", pinnedFor: "" }), false);
});

test("F2: a calculated draft re-pins when its rows changed", () => {
  assert.equal(shouldRepin({ calculated: true, draftKey: "a 99 m2", pinnedFor: "a 0.1 m2" }), true);
});

test("F3: a calculated draft with unchanged rows does not re-pin", () => {
  // Re-pinning an unchanged draft would churn `boundAt` and re-run a hash for
  // nothing, and would mask a bug where the key failed to track the rows.
  assert.equal(shouldRepin({ calculated: true, draftKey: "a 0.1 m2", pinnedFor: "a 0.1 m2" }), false);
});

test("F4: an empty draft never pins, even when the pin in force is off an older draft", () => {
  // The discriminating case. `draftKey: ""` with `pinnedFor: ""` returns false
  // from the inequality check alone, so an assertion written that way passes
  // whether or not the empty-draft guard exists — it proves nothing. Only a
  // non-empty `pinnedFor` isolates the guard: without it the empty key differs
  // from the stale pin and the rule would repin, clearing every binding the
  // moment the last row is deleted.
  assert.equal(shouldRepin({ calculated: true, draftKey: "", pinnedFor: "a 0.1 m2" }), false);
  assert.equal(shouldRepin({ calculated: true, draftKey: "", pinnedFor: "" }), false);
});

test("F5: the pin rule is pure", () => {
  const input = { calculated: true, draftKey: "a 1 m", pinnedFor: "b 2 m" } as const;
  const once = shouldRepin(input);
  assert.equal(once, shouldRepin(input));
  assert.deepEqual(input, { calculated: true, draftKey: "a 1 m", pinnedFor: "b 2 m" });
});

// --- E: the ledger surface (QS-03). The contract tests above prove the
// evaluation; these prove the panel actually asks it on every render, rather
// than reading a status that was written once.

const CACHE = mkdtempSync(resolve("node_modules/.cache/qs-binding-ledger-"));
for (const name of ["qsItemBinding.ts", "qsEntityHighlight.ts", "QSItemBindingLedger.tsx", "report.ts", "classification.ts"]) {
  const code = ts.transpileModule(readFileSync(join(HERE, name), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: name,
  }).outputText.replace(/require\("\.\/(\w+)(?:\.tsx?)?"\)/g, 'require("./$1.cjs")');
  writeFileSync(join(CACHE, basename(name).replace(/\.tsx?$/, ".cjs")), code);
}
after(() => rmSync(CACHE, { recursive: true, force: true }));
const ledgerRequire = createRequire(import.meta.url);
const { QSItemBindingLedger } = ledgerRequire(join(CACHE, "QSItemBindingLedger.cjs")) as typeof import("./QSItemBindingLedger");

// Built by the real classifier rather than hand-written. A literal report object
// would be a guess at a shape that classifyQuantities owns, and the guess would
// stay green after the real one changed.
const REPORT: QuantityReport = classifyQuantities({
  hierarchyId: "QA", hierarchyRevision: "1",
  nodes: [{ id: "w", label: "Wall finishes", parentId: null }],
  items: [{ id: "item-01", quantity: "18.5", unit: "m", evidence: "unverified", source: null }],
  assignments: [{ itemId: "item-01", nodeId: "w" }],
});

const renderLedger = (bindings: ReadonlyMap<string, QsItemBinding>, entities: ReadonlyMap<string, QsEntityGeometry>) =>
  renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: REPORT.rows.map(row => ({ id: row.id, quantity: row.quantity, unit: row.unit })),
    bindings,
    entities,
  }));

const statusOf = (html: string) => html.match(/data-binding-status="([^"]+)"/)?.[1];

test("E1: an item with no binding renders as not bound, never as verified", () => {
  const html = renderLedger(new Map(), new Map());
  assert.equal(statusOf(html), "unbound");
  assert.match(html, /No measured entity bound/);
  assert.match(html, /Withheld/);
});

test("E2: a binding whose entity is present and matching renders verified and permits pricing", () => {
  const binding = parseBinding();
  const entity = qsEntityGeometrySchema.parse({ entityId: binding.entityId, entityType: binding.entityType,
    geometrySha256: binding.entityGeometrySha256, sourceSha256: binding.sourceSha256, calibrationId: binding.calibrationId, unit: binding.unit, measuredQuantity: binding.measuredQuantity });
  const html = renderLedger(new Map([[binding.itemId, binding]]), new Map([[entity.entityId, entity]]));
  assert.equal(statusOf(html), "verified");
  assert.match(html, /Permitted/);
  assert.doesNotMatch(html, /qs-binding-withheld-notice/);
});

test("E3: the ledger derives staleness from live geometry — the same stored binding goes stale when the entity moves", () => {
  const binding = parseBinding();
  const moved = qsEntityGeometrySchema.parse({ entityId: binding.entityId, entityType: binding.entityType,
    geometrySha256: HASH_C, sourceSha256: binding.sourceSha256, calibrationId: binding.calibrationId, unit: binding.unit, measuredQuantity: binding.measuredQuantity });
  const html = renderLedger(new Map([[binding.itemId, binding]]), new Map([[moved.entityId, moved]]));
  assert.equal(statusOf(html), "stale-measurement");
  assert.match(html, /Withheld/);
});

test("E4: a bound item whose entity is absent renders missing-entity rather than silently verified", () => {
  const binding = parseBinding();
  const html = renderLedger(new Map([[binding.itemId, binding]]), new Map());
  assert.equal(statusOf(html), "missing-entity");
  assert.match(html, /Withheld/);
});

test("E5: the withheld notice appears for unverified items and names each status present", () => {
  // Asserted in BOTH directions. The banner is the only surface-level claim that
  // pricing is being withheld, so an assertion that it is absent when everything
  // verifies says nothing about whether it ever renders — deleting it entirely
  // leaves that half green. The unverified half is the one that carries the guard.
  const binding = parseBinding();
  const matching = qsEntityGeometrySchema.parse({ entityId: binding.entityId, entityType: binding.entityType,
    geometrySha256: binding.entityGeometrySha256, sourceSha256: binding.sourceSha256, calibrationId: binding.calibrationId, unit: binding.unit, measuredQuantity: binding.measuredQuantity });
  const moved = qsEntityGeometrySchema.parse({ entityId: binding.entityId, entityType: binding.entityType,
    geometrySha256: HASH_C, sourceSha256: binding.sourceSha256, calibrationId: binding.calibrationId, unit: binding.unit, measuredQuantity: binding.measuredQuantity });

  const verifiedLedger = renderLedger(new Map([[binding.itemId, binding]]), new Map([[matching.entityId, matching]]));
  assert.doesNotMatch(verifiedLedger, /Pricing withheld on/);
  assert.match(verifiedLedger, /data-testid="qs-binding-pricing-item-01"[^>]*>.*?Permitted/s);

  const staleLedger = renderLedger(new Map([[binding.itemId, binding]]), new Map([[moved.entityId, moved]]));
  assert.match(staleLedger, /data-testid="qs-binding-withheld-notice"/);
  assert.match(staleLedger, /Pricing withheld on 1 item</);
  assert.match(staleLedger, /1 stale-measurement/);
  assert.match(staleLedger, /data-testid="qs-binding-pricing-item-01"[^>]*>.*?Withheld/s);

  const unboundLedger = renderLedger(new Map(), new Map());
  assert.match(unboundLedger, /Pricing withheld on 1 item</);
  assert.match(unboundLedger, /1 unbound/);
});

// --- G: the highlight control (SC-09's human gate). The ledger must be able to
// send a user to the entity it names, and must not offer to when it cannot.

const renderLedgerWithHighlight = (
  bindings: ReadonlyMap<string, QsItemBinding>,
  entities: ReadonlyMap<string, QsEntityGeometry>,
  surfacesAvailable: boolean,
) => ({
  html: renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: REPORT.rows.map(row => ({ id: row.id, quantity: row.quantity, unit: row.unit })),
    bindings,
    entities,
    onHighlight: () => {},
    surfacesAvailable,
  })),
  // Without a handler the row is inert no matter what, so this renders the
  // handler-less form to prove the control is genuinely gated on having one.
  inert: renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: REPORT.rows.map(row => ({ id: row.id, quantity: row.quantity, unit: row.unit })),
    bindings,
    entities,
  })),
});

const boundPair = () => {
  const binding = parseBinding();
  const entity = qsEntityGeometrySchema.parse({ entityId: binding.entityId, entityType: binding.entityType,
    geometrySha256: binding.entityGeometrySha256, sourceSha256: binding.sourceSha256, calibrationId: binding.calibrationId, unit: binding.unit, measuredQuantity: binding.measuredQuantity });
  return { binding, entity };
};

test("G0a: the ledger withholds sample, inferred and foreign-project rows while preserving the current measured row", () => {
  const { binding, entity } = boundPair();
  const contexts = [
    { id: "sample-row", evidence: "sample" as const, projectId: binding.projectId },
    { id: "inferred-row", evidence: "inferred" as const, projectId: binding.projectId },
    { id: "foreign-row", evidence: "unverified" as const, projectId: "another-project" },
    { id: "current-row", evidence: "unverified" as const, projectId: binding.projectId },
  ];
  const html = renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: contexts.map(context => ({ ...context, quantity: binding.measuredQuantity, unit: binding.unit })),
    bindings: new Map(contexts.map(context => [context.id, parseBinding({ itemId: context.id })])),
    entities: new Map([[entity.entityId, entity]]),
    onHighlight: () => {},
    surfacesAvailable: true,
  }));
  const row = (id: string) => {
    const match = html.match(new RegExp(`<tr[^>]*data-testid="qs-binding-row-${id}"[^>]*>.*?<\\/tr>`, "s"));
    assert.ok(match, `${id} must render`);
    return match[0];
  };
  for (const id of ["sample-row", "inferred-row"]) {
    assert.match(row(id), /data-binding-status="ineligible-evidence"/);
    assert.match(row(id), /INELIGIBLE EVIDENCE/);
    assert.match(row(id), /Withheld/);
    assert.doesNotMatch(row(id), /Permitted|measured-and-current/);
  }
  assert.match(row("foreign-row"), /data-binding-status="stale-measurement"/);
  assert.match(row("foreign-row"), /belongs to another project/);
  assert.match(row("foreign-row"), /Withheld/);
  assert.match(row("current-row"), /data-binding-status="verified"/);
  assert.match(row("current-row"), /Permitted/);
  assert.match(html, /Pricing withheld on 3 items/);
  assert.match(html, /2 ineligible-evidence/);
});

test("G0: duplicate draft references cannot borrow a bound row's verified evidence", () => {
  const { binding, entity } = boundPair();
  const otherBinding = parseBinding({ itemId: "unique-item", entityId: "unique-wall" });
  const otherEntity = parseGeometry({ entityId: otherBinding.entityId });
  const render = (duplicate: boolean) => renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: [
      { id: binding.itemId, quantity: binding.measuredQuantity, unit: binding.unit },
      { id: duplicate ? binding.itemId : "renamed-unbound-item", quantity: binding.measuredQuantity, unit: binding.unit },
      { id: otherBinding.itemId, quantity: otherBinding.measuredQuantity, unit: otherBinding.unit },
    ],
    bindings: new Map([[binding.itemId, binding], [otherBinding.itemId, otherBinding]]),
    entities: new Map([[entity.entityId, entity], [otherEntity.entityId, otherEntity]]),
    onHighlight: () => {},
    surfacesAvailable: true,
  }));

  const ambiguous = render(true);
  const duplicates = [...ambiguous.matchAll(/<tr[^>]*data-testid="qs-binding-row-item-01"[^>]*>.*?<\/tr>/gs)].map(match => match[0]);
  assert.equal(duplicates.length, 2);
  for (const row of duplicates) {
    assert.match(row, /data-binding-status="unbound"/);
    assert.match(row, /data-ambiguous-reference="true"/);
    assert.match(row, /Duplicate item reference/);
    assert.match(row, /AMBIGUOUS REFERENCE/);
    assert.match(row, /Withheld/);
    assert.doesNotMatch(row, /Permitted|qs-binding-highlight-/);
  }
  assert.match(ambiguous, /Pricing withheld on 2 items/);
  assert.match(ambiguous, /data-testid="qs-binding-row-unique-item"[^>]*data-binding-status="verified"/);

  const repaired = render(false);
  assert.doesNotMatch(repaired, /AMBIGUOUS REFERENCE/);
  assert.match(repaired, /data-testid="qs-binding-row-item-01"[^>]*data-binding-status="verified"/);
  assert.match(repaired, /data-testid="qs-binding-row-renamed-unbound-item"[^>]*data-binding-status="unbound"/);
  assert.match(repaired, /Pricing withheld on 1 item</);
});

test("G1: a resolvable bound item offers a highlight control naming its claim", () => {
  const { binding, entity } = boundPair();
  const { html } = renderLedgerWithHighlight(new Map([[binding.itemId, binding]]), new Map([[entity.entityId, entity]]), true);
  assert.match(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-highlight-resolvable="true"/);
  assert.match(html, /data-highlight-claim="measured-and-current"/);
  assert.match(html, /Show in plan \+ 3D/);
});

test("G2: no canvas mounted means no control, and the claim is not that it was shown", () => {
  const { binding, entity } = boundPair();
  const { html } = renderLedgerWithHighlight(new Map([[binding.itemId, binding]]), new Map([[entity.entityId, entity]]), false);
  assert.doesNotMatch(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-highlight-resolvable="false"/);
});

test("G3: a stale item is still highlightable, and says the geometry moved", () => {
  // The discriminating case. Refusing to highlight a stale item would hide the
  // one fact that makes it fixable, so the control must survive the staleness.
  const { binding, entity } = boundPair();
  const moved = qsEntityGeometrySchema.parse({ entityId: entity.entityId, entityType: entity.entityType,
    geometrySha256: HASH_C, sourceSha256: entity.sourceSha256, calibrationId: entity.calibrationId, unit: entity.unit, measuredQuantity: entity.measuredQuantity });
  const { html } = renderLedgerWithHighlight(new Map([[binding.itemId, binding]]), new Map([[moved.entityId, moved]]), true);
  assert.match(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-highlight-claim="measured-then-changed"/);
  assert.match(html, /geometry changed/);
});

test("G4: an unbound item offers no control and claims nothing was measured", () => {
  const { html } = renderLedgerWithHighlight(new Map(), new Map(), true);
  assert.doesNotMatch(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-highlight-claim="not-measured"/);
});

test("G5: without a handler the row is inert, not a button that does nothing", () => {
  const { binding, entity } = boundPair();
  const { inert } = renderLedgerWithHighlight(new Map([[binding.itemId, binding]]), new Map([[entity.entityId, entity]]), true);
  assert.doesNotMatch(inert, /data-testid="qs-binding-highlight-item-01"/);
});

test("G6: a bound item whose entity is gone offers no control", () => {
  const { binding } = boundPair();
  const { html } = renderLedgerWithHighlight(new Map([[binding.itemId, binding]]), new Map(), true);
  assert.doesNotMatch(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-highlight-resolvable="false"/);
});

// G1–G6 all render a single row, which cannot tell a highlight that is genuinely
// per-row from one that is frozen, misaligned, or borrowed from a neighbour.
// Only a ledger whose rows disagree can do that.
const mixedLedger = (surfacesAvailable?: boolean) => {
  const { binding, entity } = boundPair();
  const second = qsItemBindingSchema.parse({ ...binding, itemId: "item-02", entityId: "measured:item-02" });
  const secondEntity = qsEntityGeometrySchema.parse({ ...entity, entityId: "measured:item-02", geometrySha256: HASH_C });
  return renderToStaticMarkup(React.createElement(QSItemBindingLedger, {
    rows: [
      { id: "item-01", quantity: "18.5", unit: "m" },
      { id: "item-02", quantity: "18.5", unit: "m" },
      { id: "item-03", quantity: "18.5", unit: "m" },
    ],
    bindings: new Map([[binding.itemId, binding], [second.itemId, second]]),
    entities: new Map([[entity.entityId, entity], [secondEntity.entityId, secondEntity]]),
    onHighlight: () => {},
    ...(surfacesAvailable === undefined ? {} : { surfacesAvailable }),
  }));
};

/** Drives the ledger through the real reconciler and records what each row sends.
 *
 * Rendering to a string cannot answer this: once the resolution is mis-indexed,
 * row 2's markup looks exactly like row 1's, so the activation itself has to be
 * exercised.
 *
 * React 19 keeps its test renderer behind react-dom/test-utils, which this suite
 * does not depend on, so the component is called directly. Rather than stub each
 * hook, the real dispatcher is kept and only its memoisation is weakened: every
 * hook runs for real, it just recomputes, which is exactly the derivation this
 * assertion is about. The props are then walked to the rows and the same onClick
 * the DOM would call is invoked — the clickable path is a plain onClick, not a
 * synthesised event. */
const activateRow = (rowId: string, options: { stale?: boolean } = {}) => {
  const received: Array<{ entityId: string; claim: string }> = [];
  const { binding, entity } = boundPair();
  // Optionally move the live geometry so the row is stale at activation time. A
  // stale row must still be able to send the user to where the geometry went.
  const live = options.stale
    ? qsEntityGeometrySchema.parse({ ...entity, geometrySha256: HASH_C })
    : entity;
  const second = qsItemBindingSchema.parse({ ...binding, itemId: "item-02", entityId: "measured:item-02" });
  const secondEntity = qsEntityGeometrySchema.parse({ ...entity, entityId: "measured:item-02", geometrySha256: HASH_C });
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } | null;
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (!internals) throw new Error("React internals are unavailable; cannot drive the component");
  const previous = internals.H;
  internals.H = { useMemo: (compute: () => unknown) => compute(), useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => {}], useCallback: (fn: unknown) => fn, useEffect: () => {}, useRef: (initial: unknown) => ({ current: initial }) };
  let element: React.ReactElement;
  try {
    element = QSItemBindingLedger({
    rows: [
      { id: "item-01", quantity: "18.5", unit: "m" },
      { id: "item-02", quantity: "18.5", unit: "m" },
    ],
    bindings: new Map([[binding.itemId, binding], [second.itemId, second]]),
    entities: new Map([[live.entityId, live], [secondEntity.entityId, secondEntity]]),
    onHighlight: (_itemId, resolution) => received.push({ entityId: resolution.entityId, claim: resolution.claim }),
    surfacesAvailable: true,
    }) as React.ReactElement;
  } finally { internals.H = previous; }
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    const props = (node as { props?: Record<string, unknown> }).props;
    if (!props) return;
    if (props["data-testid"] === `qs-binding-highlight-${rowId}` && typeof props.onClick === "function") {
      (props.onClick as () => void)();
      return;
    }
    walk(props.children);
  };
  walk(element);
  return received;
};

test("G10: activating a row sends that row's own entity, not its neighbour's", () => {
  assert.deepEqual(activateRow("item-01").map(r => r.entityId), ["wall-run-7"]);
  assert.deepEqual(activateRow("item-02").map(r => r.entityId), ["measured:item-02"]);
});

test("G11: an unbound row has nothing to activate", () => {
  assert.deepEqual(activateRow("item-03"), []);
});

test("G12: activating a stale row still sends the user to the entity, and says it moved", () => {
  // The one case where the claim at activation time has to disagree with a clean
  // verification. A highlight that reported the row as current because the click
  // itself was authorised would send the user to geometry they cannot trust.
  const [resolution] = activateRow("item-01", { stale: true });
  assert.equal(resolution.entityId, "wall-run-7");
  assert.equal(resolution.claim, "measured-then-changed");
});

const rowOf = (html: string, id: string) => {
  const at = html.indexOf(`data-testid="qs-binding-row-${id}"`);
  return html.slice(at, html.indexOf("</tr>", at));
};

test("G7: highlight state is per row — a verified row and a stale row disagree", () => {
  const html = mixedLedger(true);
  assert.match(rowOf(html, "item-01"), /data-highlight-claim="measured-and-current"/);
  assert.match(rowOf(html, "item-02"), /data-highlight-claim="measured-then-changed"/);
  // item-03 is unbound. A highlight borrowed from a neighbour, or frozen at the
  // first row, would show up here as some other claim entirely.
  assert.match(rowOf(html, "item-03"), /data-highlight-claim="not-measured"/);
  assert.match(rowOf(html, "item-03"), /data-highlight-resolvable="false"/);
});

test("G8: a ledger that is not told about the surfaces assumes there are none", () => {
  // The prop is optional, so a caller that forgets it exists. Defaulting the
  // other way would let a row offer a highlight no canvas was ever mounted for.
  const html = mixedLedger(undefined);
  assert.equal((html.match(/data-highlight-resolvable="true"/g) ?? []).length, 0);
});

test("G8b: with no surface to draw on, no row in a mixed ledger claims resolvable", () => {
  const html = mixedLedger(false);
  assert.equal((html.match(/data-highlight-resolvable="true"/g) ?? []).length, 0);
  assert.equal((html.match(/data-highlight-resolvable="false"/g) ?? []).length, 3);
});

test("G9: a mixed ledger offers a control only on the rows it can show", () => {
  const html = mixedLedger(true);
  assert.match(html, /data-testid="qs-binding-highlight-item-01"/);
  assert.match(html, /data-testid="qs-binding-highlight-item-02"/);
  assert.doesNotMatch(html, /data-testid="qs-binding-highlight-item-03"/);
});
