import { test } from "node:test";
import assert from "node:assert/strict";
import { publishModelView, latestModelView, recordedModelView, matchingModelView, recordModelView, invalidateModelViews } from "./modelViewSnapshot.ts";
const source = "a".repeat(64);
const input = () => ({ documentId: "plan-a", sourceSha256: source, sceneId: "caroline", sceneSha256: "c".repeat(64), view: { wireframe: false, roof: true, cutaway: false, explode: false, plan: false, level: "all" as const }, camera: { projection: "perspective" as const, position: [10, 20, 30] as [number, number, number], target: [0, 1, 2] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1, near: .05, far: 400, projectionMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] } });
test("high-rise floor identity survives camera recording and malformed IDs are rejected", () => {
  const data = input();
  const snapshot = publishModelView({ ...data, sceneId: "crown-wharf", view: { ...data.view, level: "L18" } });
  assert.equal(snapshot.view.level, "L18");
  assert.equal(recordModelView("plan-a", source).view.level, "L18");
  for (const level of ["", "x".repeat(81), "floor with spaces"])
    assert.throws(() => publishModelView({ ...data, view: { ...data.view, level } }));
});
test("records actual structured camera only for the matching document and SHA", () => {
  invalidateModelViews(null, null); const snapshot = publishModelView(input());
  assert.equal(recordModelView("plan-a", source), snapshot); assert.deepEqual(recordedModelView()?.camera.position, [10,20,30]);
  assert.equal(matchingModelView(snapshot, "plan-b", source), null); assert.equal(matchingModelView(snapshot, "plan-a", "b".repeat(64)), null);
  assert.throws(() => recordModelView("plan-b", source), /matching source/);
});
test("published arrays are copied and immutable; recorded view stays separate from later orbit", () => {
  const data = input(), first = publishModelView(data); recordModelView("plan-a", source);
  data.camera.position[0] = 99; data.camera.projectionMatrix[0] = 3;
  assert.equal(first.camera.position[0], 10); assert.equal(first.camera.projectionMatrix[0], 1);
  publishModelView(data); assert.equal(latestModelView()?.camera.position[0], 99); assert.equal(recordedModelView()?.camera.position[0], 10);
  assert.throws(() => { (first.camera.position as unknown as number[])[0] = 8; });
});
test("source replacement clears both views while same-source tab changes preserve them", () => {
  publishModelView(input()); recordModelView("plan-a", source); invalidateModelViews("plan-a", source); assert.ok(recordedModelView());
  invalidateModelViews("plan-b", "b".repeat(64)); assert.equal(latestModelView(), null); assert.equal(recordedModelView(), null); assert.throws(() => recordModelView("plan-a", source));
});
test("malformed projection, source or nonfinite camera cannot enter the session", () => {
  for (const mutate of [(x: ReturnType<typeof input>) => { x.camera.zoom = 0; }, (x: ReturnType<typeof input>) => { x.camera.position[0] = NaN; }, (x: ReturnType<typeof input>) => { x.sourceSha256 = "wrong"; }, (x: ReturnType<typeof input>) => { x.camera.projectionMatrix.pop(); }]) {
    const data = input(); mutate(data); assert.throws(() => publishModelView(data));
  }
});
test("identical view does not republish while scene and options remain immutable", () => {
  const data = input(), first = publishModelView(data); assert.equal(publishModelView(input()), first);
  data.view.roof = false; const second = publishModelView(data);
  assert.notEqual(second, first); assert.equal(first.view.roof, true); assert.equal(second.view.roof, false);
  assert.equal(second.sceneSha256, "c".repeat(64));
  assert.throws(() => publishModelView({ ...data, sceneSha256: "wrong" }));
  assert.throws(() => publishModelView({ ...data, view: { ...data.view, plan: true } }));
});
