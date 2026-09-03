import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSnapPoint } from "./snapping.ts";
import type { Markup } from "./store.ts";

describe("Vector Snapping Engine", () => {
  it("should return the original cursor point if snapping is disabled", () => {
    const cursor = { x: 5.5, y: 3.2 };
    const markups: Markup[] = [];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, false);
    assert.deepEqual(result, {
      point: cursor,
      snapped: false,
      distance: 0,
    });
  });

  it("should return the original cursor point if no vertices are within the snap radius", () => {
    const cursor = { x: 100, y: 100 }; // Far away from any house linework
    const markups: Markup[] = [];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 2.0;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true);
    assert.deepEqual(result, {
      point: cursor,
      snapped: false,
      distance: 0,
    });
  });

  it("should snap to the nearest PLAN vertex if within the snap radius", () => {
    // Endpoints in PLAN walls include (0, 0)
    const cursor = { x: 0.1, y: 0.05 };
    const markups: Markup[] = [];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true);
    assert.equal(result.snapped, true);
    assert.deepEqual(result.point, { x: 0, y: 0 });
    assert.equal(result.kind, "vertex");
  });

  it("should snap to manual markups if they are closer than other candidate points", () => {
    const cursor = { x: 10.05, y: 10.05 };
    const markups: Markup[] = [
      {
        id: "m1",
        kind: "length",
        label: "Line",
        value: 1,
        unit: "m",
        sheet: 16,
        points: [{ x: 10, y: 10 }],
      },
    ];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true);
    assert.equal(result.snapped, true);
    assert.deepEqual(result.point, { x: 10, y: 10 });
    assert.equal(result.kind, "markup");
  });

  it("should snap to pending points when active", () => {
    const cursor = { x: 15.02, y: 15.01 };
    const markups: Markup[] = [];
    const pending = [{ x: 15, y: 15 }];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true);
    assert.equal(result.snapped, true);
    assert.deepEqual(result.point, { x: 15, y: 15 });
    assert.equal(result.kind, "markup");
  });

  it("should snap to elevation vertices correctly when sheetKind is elev and floors is 1", () => {
    // Ground level vertex at (0, 0)
    const cursor = { x: 0.1, y: 0.05 };
    const markups: Markup[] = [];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true, "elev", 1);
    assert.equal(result.snapped, true);
    assert.deepEqual(result.point, { x: 0, y: 0 });
    assert.equal(result.kind, "vertex");
  });

  it("should snap to stacked elevation vertices correctly when sheetKind is elev and floors is 3", () => {
    // 3rd floor bottom level vertex at y = 2 * 2.8 = 5.6
    const cursor = { x: 0.1, y: 5.65 };
    const markups: Markup[] = [];
    const pending: { x: number; y: number }[] = [];
    const snapRadius = 0.5;

    const result = getSnapPoint(cursor, markups, pending, snapRadius, true, "elev", 3);
    assert.equal(result.snapped, true);
    assert.deepEqual(result.point, { x: 0, y: 5.6 });
    assert.equal(result.kind, "vertex");
  });
});
