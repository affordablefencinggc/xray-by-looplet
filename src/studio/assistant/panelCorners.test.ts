import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changeAssistantRect, defaultAssistantRect, fitAssistantRect } from "./panelGeometry.ts";
import {
  CORNERS,
  CORNER_HIT_SIZE,
  cornerAtPoint,
  cornerCursor,
  cornerHitBoxes,
  resizeAssistantRectFromCorner,
  type Corner,
} from "./panelCorners.ts";

const viewport = { width: 1440, height: 900 };
const MARGIN = 12;
const LAUNCHER = 52;
const anchorOf = (rect: { x: number; y: number; width: number; height: number }, corner: Corner) => ({
  x: corner === "ne" || corner === "se" ? rect.x : rect.x + rect.width,
  y: corner === "sw" || corner === "se" ? rect.y : rect.y + rect.height,
});
const insideViewport = (rect: { x: number; y: number; width: number; height: number }) =>
  rect.x >= MARGIN &&
  rect.y >= MARGIN &&
  rect.x + rect.width <= viewport.width - MARGIN &&
  rect.y + rect.height <= viewport.height - LAUNCHER - MARGIN;

describe("corner resize", () => {
  it("matches the legacy top-right resize for in-range drags", () => {
    const rect = { x: 400, y: 200, width: 500, height: 400 };
    for (const [dx, dy] of [[40, -30], [-60, 50], [0, 0], [120, -80], [-150, 90]])
      assert.deepEqual(resizeAssistantRectFromCorner(rect, "ne", dx, dy, viewport), changeAssistantRect(rect, dx, dy, "resize", viewport), `dx=${dx} dy=${dy}`);
  });

  it("keeps the opposite corner fixed and grows or shrinks toward the dragged corner", () => {
    const rect = { x: 400, y: 200, width: 500, height: 400 };
    const expected: Record<Corner, { x: number; y: number; width: number; height: number }> = {
      nw: { x: 370, y: 180, width: 530, height: 420 },
      ne: { x: 400, y: 180, width: 470, height: 420 },
      sw: { x: 370, y: 200, width: 530, height: 380 },
      se: { x: 400, y: 200, width: 470, height: 380 },
    };
    for (const corner of CORNERS) {
      const next = resizeAssistantRectFromCorner(rect, corner, -30, -20, viewport);
      assert.deepEqual(next, expected[corner], corner);
      assert.deepEqual(anchorOf(next, corner), anchorOf(rect, corner), `${corner} anchor`);
    }
  });

  it("never drops below the 300 px minimum, never leaves the viewport, and never slides the anchor", () => {
    const rect = { x: 400, y: 200, width: 500, height: 400 };
    for (const corner of CORNERS)
      for (const d of [-99999, 99999]) {
        const next = resizeAssistantRectFromCorner(rect, corner, d, d, viewport);
        assert.ok(next.width >= 300 && next.height >= 300, `${corner} ${d} minimum`);
        assert.ok(insideViewport(next), `${corner} ${d} inside`);
        assert.deepEqual(anchorOf(next, corner), anchorOf(rect, corner), `${corner} ${d} anchor`);
      }
    // Shrinking far past the minimum from the bottom-right leaves the top-left untouched at 300x300.
    assert.deepEqual(resizeAssistantRectFromCorner(rect, "se", -99999, -99999, viewport), { x: 400, y: 200, width: 300, height: 300 });
    // Growing from the top-left fills exactly to the viewport margins on that side.
    assert.deepEqual(resizeAssistantRectFromCorner(rect, "nw", -99999, -99999, viewport), { x: MARGIN, y: MARGIN, width: 900 - MARGIN, height: 600 - MARGIN });
  });

  it("honours custom minimums and collapses gracefully on a tiny viewport", () => {
    const rect = { x: 400, y: 200, width: 500, height: 400 };
    assert.deepEqual(resizeAssistantRectFromCorner(rect, "se", -99999, -99999, viewport, { minWidth: 360, minHeight: 320 }), { x: 400, y: 200, width: 360, height: 320 });
    const tiny = { width: 320, height: 400 };
    const start = defaultAssistantRect(tiny);
    for (const corner of CORNERS)
      for (const d of [-500, 500])
        assert.deepEqual(resizeAssistantRectFromCorner(start, corner, d, d, tiny), fitAssistantRect(resizeAssistantRectFromCorner(start, corner, d, d, tiny), tiny), `${corner} ${d} stays fitted`);
  });
});

describe("corner hit boxes", () => {
  it("places four 44 px boxes inside the panel and resolves pointer positions to corners", () => {
    const rect = { x: 100, y: 50, width: 360, height: 400 };
    const boxes = cornerHitBoxes(rect);
    assert.deepEqual(boxes.map((b) => b.corner), ["nw", "ne", "sw", "se"]);
    for (const box of boxes) {
      assert.equal(box.size, CORNER_HIT_SIZE);
      assert.ok(box.x >= rect.x && box.x + box.size <= rect.x + rect.width, `${box.corner} inside horizontally`);
      assert.ok(box.y >= rect.y && box.y + box.size <= rect.y + rect.height, `${box.corner} inside vertically`);
    }
    assert.equal(cornerAtPoint(rect, 101, 51), "nw");
    assert.equal(cornerAtPoint(rect, 459, 51), "ne");
    assert.equal(cornerAtPoint(rect, 101, 449), "sw");
    assert.equal(cornerAtPoint(rect, 459, 449), "se");
    assert.equal(cornerAtPoint(rect, 280, 250), null, "panel body");
    assert.equal(cornerAtPoint(rect, 99, 49), null, "outside");
    assert.equal(cornerAtPoint(rect, 100 + 44, 50), null, "just past the north-west box");
  });
  it("shrinks boxes to fit a panel smaller than the hit size", () => {
    const boxes = cornerHitBoxes({ x: 0, y: 0, width: 30, height: 60 });
    for (const box of boxes) assert.equal(box.size, 30);
    assert.deepEqual(boxes.find((b) => b.corner === "se"), { corner: "se", x: 0, y: 30, size: 30 });
  });
  it("maps corners to the diagonal resize cursors", () => {
    assert.equal(cornerCursor("nw"), "nwse-resize");
    assert.equal(cornerCursor("se"), "nwse-resize");
    assert.equal(cornerCursor("ne"), "nesw-resize");
    assert.equal(cornerCursor("sw"), "nesw-resize");
  });
});
