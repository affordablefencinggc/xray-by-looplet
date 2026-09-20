import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceAreaDragCommitPoint, type SourceAreaDrag } from "./sourceAreaDrag.ts";
import type { FencingJob } from "./domain.ts";

const annotation: NonNullable<FencingJob["annotations"]>[number] = {
  id: "room", kind: "area", label: "Room", value: 1, unit: "m²", sheet: 0, documentId: "drawing", sourceSha256: "a".repeat(64), coordinateSpace: "source-page-v1",
  points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
  measurement: { entityType: "room-area", revision: 4, holes: [[{ x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }]], roofSlope: null },
};
const drag: SourceAreaDrag = { entityId: "room", documentId: "drawing", sourceSha256: "a".repeat(64), sheet: 0, revision: 4, ringIndex: 0, vertexIndex: 1, originalPoint: { x: 2, y: 0 }, point: { x: 3, y: 0 } };
const current = { documentId: "drawing", sourceSha256: "a".repeat(64), sheet: 0, annotation, allowed: true };

test("area pointer release commits only a changed point against its original exact entity", () => {
  assert.deepEqual(sourceAreaDragCommitPoint(drag, current), { x: 3, y: 0 });
  assert.deepEqual(sourceAreaDragCommitPoint({ ...drag, ringIndex: 1, vertexIndex: 0, originalPoint: { x: 0.5, y: 0.5 } }, current), { x: 3, y: 0 });
});

test("area pointer cancellation and source/revision/point changes never commit a stale drag", () => {
  assert.equal(sourceAreaDragCommitPoint(null, current), null);
  for (const change of [{ allowed: false }, { documentId: "other" }, { sourceSha256: "b".repeat(64) }, { sheet: 1 }, { annotation: undefined }])
    assert.equal(sourceAreaDragCommitPoint(drag, { ...current, ...change }), null);
  for (const change of [{ revision: 5 }, { entityId: "other" }, { point: { x: NaN, y: 0 } }, { point: drag.originalPoint }, { originalPoint: { x: 99, y: 0 } }, { vertexIndex: 99 }])
    assert.equal(sourceAreaDragCommitPoint({ ...drag, ...change }, current), null);
  assert.equal(sourceAreaDragCommitPoint(drag, { ...current, annotation: { ...annotation, measurement: { ...annotation.measurement!, revision: 5 } } }), null);
});
