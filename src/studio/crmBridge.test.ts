import test from "node:test";
import assert from "node:assert/strict";
import { buildLoopletQuoteLines, pushToLoopletCrm } from "./crmBridge.ts";
import type { Markup, Trade } from "./store.ts";

test("CRM Bridge — buildLoopletQuoteLines", () => {
  const markups: Markup[] = [
    { id: "m1", kind: "length", sheet: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], value: 10.0, unit: "m", label: "Front wall" },
    { id: "m2", kind: "area", sheet: 0, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }], value: 20.0, unit: "m²", label: "Slab" },
    { id: "m3", kind: "count", sheet: 0, points: [{ x: 2, y: 2 }], value: 4, unit: "ea", label: "Pylons" },
  ];
  const trades: Trade[] = [{ id: "t1", name: "Carpentry", note: "Studs" }];

  const staged = buildLoopletQuoteLines(markups, trades, "warehouse.pdf", 0);
  assert.equal(staged.sheet, 1);
  assert.equal(staged.lines.length, 3);

  const lengthLine = staged.lines.find(l => l.unit === "lm");
  assert.ok(lengthLine);
  assert.equal(lengthLine.quantity, 10.0);
  assert.equal(lengthLine.total_price, 450.0);

  const areaLine = staged.lines.find(l => l.unit === "m²");
  assert.ok(areaLine);
  assert.equal(areaLine.quantity, 20.0);
  assert.equal(areaLine.total_price, 1300.0);

  assert.equal(staged.subtotal, 450 + 1300 + 480);
  assert.equal(staged.tax, Math.round(staged.subtotal * 0.1 * 100) / 100);
  assert.equal(staged.total, staged.subtotal + staged.tax);

  const pushRes = pushToLoopletCrm(staged);
  assert.equal(pushRes.success, true);
  assert.ok(pushRes.url.includes("/quotes/composer"));
});

test("CRM Bridge — pushToLoopletCrm with window on localhost", () => {
  const staged = {
    planName: "localhost-test.pdf",
    sheet: 1,
    scaleM: 1.0,
    timestamp: new Date().toISOString(),
    lines: [],
    subtotal: 0,
    tax: 0,
    total: 0,
  };

  // Mock global window and localStorage
  const mockLocalStorage: Record<string, string> = {};
  const originalLocalStorage = (globalThis as any).localStorage;
  const originalWindow = (globalThis as any).window;

  (globalThis as any).localStorage = {
    setItem(key: string, value: string) {
      mockLocalStorage[key] = value;
    },
    getItem(key: string) {
      return mockLocalStorage[key] || null;
    }
  };
  (globalThis as any).window = {
    location: {
      hostname: "localhost"
    }
  };

  try {
    const res = pushToLoopletCrm(staged);
    assert.equal(res.success, true);
    assert.ok(res.url.startsWith("http://localhost:5173/quotes/composer"));
    assert.ok(res.url.includes("ref=localhost-test.pdf"));
    assert.ok(mockLocalStorage["looplet_staged_quote"]);
    assert.ok(mockLocalStorage["looplet_quote_lines"]);
  } finally {
    if (originalLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = originalLocalStorage;
    }
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

test("CRM Bridge — pushToLoopletCrm with window on production", () => {
  const staged = {
    planName: "production-test.pdf",
    sheet: 2,
    scaleM: 1.0,
    timestamp: new Date().toISOString(),
    lines: [],
    subtotal: 0,
    tax: 0,
    total: 0,
  };

  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {
    location: {
      hostname: "connect.looplet.com.au"
    }
  };

  try {
    const res = pushToLoopletCrm(staged);
    assert.equal(res.success, true);
    assert.ok(res.url.startsWith("https://connect.looplet.com.au/quotes/composer"));
    assert.ok(res.url.includes("ref=production-test.pdf"));
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});
