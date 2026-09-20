import assert from "node:assert/strict";
import test from "node:test";
import { createQsAreaPreviewGeometry, type QsAreaPreviewInput } from "./qsAreaPreviewGeometry.ts";

const point = (x: number, y: number) => ({ x, y });
const rectangle = [point(0, 0), point(10, 0), point(10, 8), point(0, 8)];
const room = (): QsAreaPreviewInput => ({ entityId: "room-real-id", entityType: "room-area", points: rectangle,
  areaGeometry: { holes: [[point(2, 2), point(4, 2), point(4, 4), point(2, 4)]], pitchDegrees: null, azimuthDegrees: null, basis: { evidence: "declared" } } });
const frame = { centreX: 5, centreY: 4, scale: 1 };
const projectedArea = (result: ReturnType<typeof createQsAreaPreviewGeometry>) => {
  const p = result.geometry.getAttribute("position"), indices = result.geometry.index!;
  let area = 0;
  for (let index = 0; index < indices.count; index += 3) {
    const a = indices.getX(index), b = indices.getX(index + 1), c = indices.getX(index + 2);
    area += Math.abs((p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) - (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a))) / 2;
  }
  return area;
};
test("room triangulates its actual outer ring minus a hole without fake boundary walls", () => {
  const input = room(), before = structuredClone(input), result = createQsAreaPreviewGeometry(input, frame);
  try {
    assert.equal(projectedArea(result), 76); assert.equal(result.holeCount, 1); assert.equal(result.boundaries.length, 2);
    assert.equal(result.status, "room-polygon-preview"); assert.ok(result.triangleCount >= 4);
    assert.deepEqual(input, before); assert.equal(result.geometry.boundingBox!.min.y, result.geometry.boundingBox!.max.y);
  } finally { result.geometry.dispose(); }
});
test("concave room faces preserve void rather than filling the outer bounding rectangle", () => {
  const result = createQsAreaPreviewGeometry({ entityId: "L", entityType: "room-area", points: [point(0, 0), point(4, 0), point(4, 2), point(2, 2), point(2, 4), point(0, 4)] }, frame);
  try { assert.equal(projectedArea(result), 12); assert.equal(result.annotationAvailable, false); }
  finally { result.geometry.dispose(); }
});
test("outer vertices and hole edits rebuild the actual face without stale triangle operands", () => {
  const input = room();
  const original = createQsAreaPreviewGeometry(input, frame);
  const noHole = createQsAreaPreviewGeometry({ ...input, areaGeometry: { ...input.areaGeometry!, holes: [] } }, frame);
  const wider = createQsAreaPreviewGeometry({ ...input, points: [point(0, 0), point(12, 0), point(12, 8), point(0, 8)] }, frame);
  try {
    assert.equal(projectedArea(original), 76); assert.equal(projectedArea(noHole), 80); assert.equal(projectedArea(wider), 92);
    assert.equal(noHole.holeCount, 0); assert.equal(wider.boundaries[0][1].x, 7);
  } finally { original.geometry.dispose(); noHole.geometry.dispose(); wider.geometry.dispose(); }
});
test("explicit roof pitch and azimuth produce scale-consistent slope rising clockwise from page up", () => {
  const input = { ...room(), entityType: "roof-plane", areaGeometry: { ...room().areaGeometry!, pitchDegrees: 45, azimuthDegrees: 0 } };
  const result = createQsAreaPreviewGeometry(input, frame), scaled = createQsAreaPreviewGeometry(input, { ...frame, scale: 0.5 });
  try {
    assert.equal(result.status, "declared-slope-preview");
    assert.ok(Math.abs(result.geometry.boundingBox!.max.y - result.geometry.boundingBox!.min.y - 8) < 1e-5);
    assert.ok(Math.abs(scaled.geometry.boundingBox!.max.y - scaled.geometry.boundingBox!.min.y - 4) < 1e-5);
    assert.ok(result.boundaries[0][0].y > result.boundaries[0][2].y);
    assert.equal(projectedArea(scaled), 19);
  } finally { result.geometry.dispose(); scaled.geometry.dispose(); }
});
test("azimuth and pitch edits change every roof vertex using the declared operands", () => {
  const make = (pitchDegrees: number, azimuthDegrees: number) => createQsAreaPreviewGeometry({ ...room(), entityType: "roof-plane", areaGeometry: { ...room().areaGeometry!, pitchDegrees, azimuthDegrees } }, frame);
  const east = make(45, 90), flat = make(0, 90);
  try {
    assert.ok(east.boundaries[0][1].y > east.boundaries[0][0].y);
    assert.ok(Math.abs(east.geometry.boundingBox!.max.y - east.geometry.boundingBox!.min.y - 10) < 1e-5);
    assert.equal(flat.slopeKnown, true); assert.equal(flat.geometry.boundingBox!.max.y, flat.geometry.boundingBox!.min.y);
  } finally { east.geometry.dispose(); flat.geometry.dispose(); }
});
test("absent, nonfinite or unsupported roof operands remain visibly projected-only unknown", () => {
  for (const values of [{ pitchDegrees: null, azimuthDegrees: 0 }, { pitchDegrees: 30, azimuthDegrees: null }, { pitchDegrees: 90, azimuthDegrees: 0 }, { pitchDegrees: 30, azimuthDegrees: NaN }, { pitchDegrees: 30, azimuthDegrees: 360 }]) {
    const result = createQsAreaPreviewGeometry({ ...room(), entityType: "roof-plane", areaGeometry: { ...room().areaGeometry!, ...values } }, frame);
    try { assert.equal(result.slopeKnown, false); assert.equal(result.status, "projected-footprint-slope-unknown"); assert.equal(result.geometry.boundingBox!.min.y, result.geometry.boundingBox!.max.y); }
    finally { result.geometry.dispose(); }
  }
});
test("closed ring is accepted and unsupported or degenerate inputs are refused", () => {
  const closed = createQsAreaPreviewGeometry({ ...room(), points: [...rectangle, rectangle[0]] }, frame);
  try { assert.equal(projectedArea(closed), 76); } finally { closed.geometry.dispose(); }
  assert.throws(() => createQsAreaPreviewGeometry({ ...room(), entityType: "construction-run" }, frame));
  assert.throws(() => createQsAreaPreviewGeometry({ ...room(), points: [point(0, 0), point(1, 1), point(2, 2)] }, frame));
  assert.throws(() => createQsAreaPreviewGeometry({ ...room(), points: [point(0, 0), point(Infinity, 1), point(2, 2)] }, frame));
});
