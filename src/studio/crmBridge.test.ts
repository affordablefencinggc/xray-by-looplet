import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLoopletQuoteLines,
  EXTERNAL_HANDOFF_UNAVAILABLE,
  pushToLoopletCrm,
} from "./crmBridge.ts";
import type { Markup, Trade } from "./store.ts";

const markups: Markup[] = [
  { id: "m1", kind: "length", sheet: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], value: 10, unit: "m", label: "Line" },
  { id: "m2", kind: "area", sheet: 0, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }], value: 20, unit: "m²", label: "Area" },
  { id: "m3", kind: "count", sheet: 0, points: [{ x: 2, y: 2 }], value: 4, unit: "ea", label: "Count" },
];
const trades: Trade[] = [{ id: "t1", name: "Carpentry", note: "Recorded by user" }];

test("quantity draft contains observations but no invented rates or totals", () => {
  const draft = buildLoopletQuoteLines(markups, trades, "warehouse.pdf", 0);

  assert.equal(draft.sheet, 1);
  assert.equal(draft.lines.length, 3);
  assert.equal(draft.pricingStatus, "unavailable");
  assert.equal(draft.handoffStatus, "unavailable");
  assert.deepEqual(
    draft.lines.map(({ quantity, unit, pricingStatus }) => ({ quantity, unit, pricingStatus })),
    [
      { quantity: 10, unit: "m", pricingStatus: "unavailable" },
      { quantity: 20, unit: "m²", pricingStatus: "unavailable" },
      { quantity: 4, unit: "ea", pricingStatus: "unavailable" },
    ],
  );
  assert.equal("unit_price" in draft.lines[0], false);
  assert.equal("total" in draft, false);
});

test("external handoff always fails closed and does not write browser state", () => {
  const draft = buildLoopletQuoteLines(markups, trades, "warehouse.pdf", 0);
  const writes: string[] = [];
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { setItem: (key: string) => writes.push(key) },
  });

  try {
    const result = pushToLoopletCrm(draft);
    assert.deepEqual(result, { success: false, url: null, reason: EXTERNAL_HANDOFF_UNAVAILABLE });
    assert.deepEqual(writes, []);
  } finally {
    if (originalLocalStorage === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
    }
  }
});
