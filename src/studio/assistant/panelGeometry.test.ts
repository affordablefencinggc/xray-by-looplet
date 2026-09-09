import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultAssistantRect,
  changeAssistantRect,
  readAssistantRect,
  fitAssistantRect,
} from "./panelGeometry.ts";
import { referenceMessage, validateReferenceFile } from "./referenceImages.ts";
test("compact default sits at bottom right and survives dragging/resizing at viewport edges", () => {
  const viewport = { width: 1440, height: 900 },
    rect = defaultAssistantRect(viewport);
  assert.equal(rect.x + rect.width, viewport.width - 16);
  assert.equal(rect.width, 360);
  assert.equal(rect.height, 400);
  assert.equal(rect.y + rect.height + 52, 884);
  for (const mode of ["move", "resize"] as const)
    for (const d of [-99999, 99999]) {
      const next = changeAssistantRect(rect, d, d, mode, viewport);
      assert.ok(next.x >= 12 && next.y >= 12);
      assert.ok(next.x + next.width <= 1428);
      assert.ok(next.y + next.height + 52 <= 888);
    }
});
test("persisted layout cannot strand controls after a smaller tablet viewport or malformed storage", () => {
  const viewport = { width: 1024, height: 768 };
  for (const text of [null, "bad", "{}", '{"x":null,"y":0,"width":2,"height":4}'])
    assert.deepEqual(readAssistantRect(text, viewport), defaultAssistantRect(viewport));
  const next = fitAssistantRect({ x: 2000, y: 2000, width: 1600, height: 1300 }, viewport);
  assert.ok(next.x + next.width <= 1012);
  assert.ok(next.y + next.height + 52 <= 756);
});
test("reference intent accompanies actual images and unsupported/oversized files fail before reading", () => {
  assert.match(
    referenceMessage("Compare these", [
      { id: "1", name: "Tower.jpg", kind: "Building style", mimeType: "image/jpeg", data: "a" },
    ]),
    /Image 1: Building style — Tower.jpg/,
  );
  assert.throws(() => validateReferenceFile({ type: "application/pdf", size: 100 }), /PNG/);
  assert.throws(() => validateReferenceFile({ type: "image/png", size: 501 * 1024 * 1024 }), /500 MB/);
  validateReferenceFile({ type: "image/png", size: 1024 });
});
