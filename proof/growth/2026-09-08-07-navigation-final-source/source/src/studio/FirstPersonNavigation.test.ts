import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFirstPersonNavigation } from "./FirstPersonNavigation.ts";

function fixture(t: TestContext, reducedMotion = true) {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const doc = Object.assign(new EventTarget(), {
    pointerLockElement: null as unknown,
    activeElement: null as unknown,
    hidden: false,
    exitPointerLock() {
      doc.pointerLockElement = null;
      doc.dispatchEvent(new Event("pointerlockchange"));
    },
  });
  const win = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    dataset: {} as Record<string, string>,
    tabIndex: -1,
    focus() {
      doc.activeElement = this;
    },
    closest() {
      return null;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    requestPointerLock: (() => Promise.reject(Error("Denied"))) as
      (() => Promise<void>) | undefined,
  });
  let now = 0;
  for (const [name, value] of Object.entries({
    document: doc,
    window: win,
    matchMedia: () => ({ matches: reducedMotion }),
    performance: { now: () => now },
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  const camera = new THREE.PerspectiveCamera(48);
  camera.position.set(10, 15, 20);
  const changes: string[] = [],
    captures: unknown[] = [];
  const api = createFirstPersonNavigation({
    canvas: canvas as unknown as HTMLCanvasElement,
    camera,
    bounds: new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10)),
    floor: () => 0,
    onChange: (mode) => changes.push(mode),
    onCaptureChange: (mode) => captures.push(mode),
    invalidate() {},
  });
  const event = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => {
    const e = Object.assign(new Event(type, { cancelable: true }), props);
    target.dispatchEvent(e);
    return e;
  };
  t.after(() => {
    api.dispose();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  return {
    api,
    camera,
    canvas,
    doc,
    win,
    changes,
    captures,
    event,
    tick(ms = 50) {
      now += ms;
      return api.tick();
    },
    lock() {
      doc.pointerLockElement = canvas;
      event(doc, "pointerlockchange");
    },
  };
}
const start = { x: 2, z: 4, elevation: 3, yaw: 0 };

test("denied and missing capture enter functional walk with chosen heading and original orbit FOV", async (t) => {
  const f = fixture(t);
  await f.api.start("walk", { ...start, yaw: Math.PI / 2 });
  assert.equal(f.api.mode, "walk");
  assert.equal(f.canvas.dataset.navigationCapture, "drag");
  assert.deepEqual(f.camera.position.toArray(), [2, 4.65, 4]);
  const direction = f.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(direction.x < -0.99);
  f.event(f.doc, "keydown", { code: "KeyW" });
  f.tick();
  assert.ok(f.camera.position.x < 2);
  f.api.stop();
  assert.equal(f.camera.fov, 48);
  f.canvas.requestPointerLock = undefined;
  await f.api.start("fly");
  assert.equal(f.api.mode, "fly");
  assert.equal(f.canvas.dataset.navigationCapture, "drag");
  f.api.stop();
  assert.equal(f.camera.fov, 48);
});

test("fresh capture upgrades drag controls; browser unlock and rapid reentry remain functional", async (t) => {
  const f = fixture(t);
  await f.api.start("walk", start);
  f.canvas.requestPointerLock = async () => f.lock();
  assert.equal(await f.api.capture(), true);
  assert.equal(f.canvas.dataset.navigationCapture, "locked");
  f.event(f.doc, "mousemove", { movementX: 30, movementY: -10 });
  assert.ok(f.camera.getWorldDirection(new THREE.Vector3()).x > 0);
  f.doc.exitPointerLock();
  assert.equal(f.api.mode, "orbit");
  assert.equal(f.canvas.dataset.navigationCapture, "none");
  f.canvas.requestPointerLock = async () => {
    throw Error("Escape cooldown");
  };
  await f.api.start("walk", start);
  assert.equal(f.api.mode, "walk");
  assert.equal(f.canvas.dataset.navigationCapture, "drag");
  f.event(f.doc, "keydown", { code: "Escape" });
  assert.equal(f.api.mode, "orbit");
});

test("stale start rejection does not overwrite a newer walk or its camera", async (t) => {
  const f = fixture(t);
  let reject!: (reason: Error) => void;
  f.canvas.requestPointerLock = () =>
    new Promise<void>((_, no) => {
      reject = no;
    });
  const first = f.api.start("fly");
  f.api.stop();
  f.canvas.requestPointerLock = async () => {
    throw Error("Denied");
  };
  await f.api.start("walk", start);
  const position = f.camera.position.clone(),
    rotation = f.camera.quaternion.clone();
  reject(Error("Late denial"));
  await first;
  assert.equal(f.api.mode, "walk");
  assert.ok(position.equals(f.camera.position));
  assert.ok(rotation.equals(f.camera.quaternion));
  assert.deepEqual(f.changes, ["fly", "orbit", "walk"]);
});

test("late granted request after stop or dispose releases lock and cannot revive navigation", async (t) => {
  const f = fixture(t);
  let finish!: () => void;
  f.canvas.requestPointerLock = () =>
    new Promise<void>((yes) => {
      finish = () => {
        f.doc.pointerLockElement = f.canvas;
        yes();
      };
    });
  const first = f.api.start("walk", start);
  f.api.stop();
  finish();
  await first;
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.api.mode, "orbit");
  const second = f.api.start("fly");
  f.api.dispose();
  finish();
  await second;
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.api.mode, "orbit");
  assert.equal(f.camera.fov, 48);
  assert.equal(await f.api.capture(), false);
});

test("legacy event-only capture handles errors, delayed success and disposal", async (t) => {
  const f = fixture(t);
  f.canvas.requestPointerLock = (() => undefined) as unknown as () => Promise<void>;
  await f.api.start("walk", start);
  assert.equal(f.canvas.dataset.navigationCapture, "drag");
  f.event(f.doc, "pointerlockerror");
  assert.equal(f.api.mode, "walk");
  await f.api.capture();
  f.lock();
  assert.equal(f.canvas.dataset.navigationCapture, "locked");
  f.api.stop();
  await f.api.start("walk", start);
  f.api.dispose();
  f.lock();
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.api.mode, "orbit");
});

test("drag look only responds to its active pointer, follows camera signs, and ends on cancel", async (t) => {
  const f = fixture(t);
  await f.api.start("walk", start);
  f.event(f.doc, "pointermove", { pointerId: 1, clientX: 30, clientY: 30 });
  assert.equal(f.camera.rotation.y, 0);
  f.event(f.canvas, "pointerdown", { pointerId: 1, button: 0, clientX: 10, clientY: 20 });
  f.event(f.doc, "pointermove", { pointerId: 2, clientX: 30, clientY: 30 });
  assert.equal(f.camera.rotation.y, 0);
  f.event(f.doc, "pointermove", { pointerId: 1, clientX: 40, clientY: 10 });
  const direction = f.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(direction.x > 0 && direction.y > 0);
  const rotation = f.camera.quaternion.clone();
  f.event(f.doc, "pointercancel", { pointerId: 1 });
  f.event(f.doc, "pointermove", { pointerId: 1, clientX: 80, clientY: 100 });
  assert.ok(rotation.equals(f.camera.quaternion));
});

test("W with A/D moves forward and to the viewer's left/right at both headings; fly vertical keys work", async (t) => {
  const f = fixture(t);
  for (const yaw of [0, Math.PI / 2])
    for (const [key, sign] of [
      ["KeyA", -1],
      ["KeyD", 1],
    ] as const) {
      await f.api.start("walk", { ...start, yaw });
      const origin = f.camera.position.clone();
      f.event(f.doc, "keydown", { code: "KeyW" });
      f.event(f.doc, "keydown", { code: key });
      f.tick();
      const moved = f.camera.position.clone().sub(origin),
        forward = f.camera.getWorldDirection(new THREE.Vector3()),
        right = new THREE.Vector3().crossVectors(forward, f.camera.up);
      assert.ok(moved.dot(forward) > 0);
      assert.ok(moved.dot(right) * sign > 0);
      assert.equal(moved.y, 0);
    }
  await f.api.start("fly");
  const height = f.camera.position.y;
  f.event(f.doc, "keydown", { code: "Space" });
  f.tick();
  assert.ok(f.camera.position.y > height);
  f.api.stop();
  await f.api.start("fly");
  const upper = f.camera.position.y;
  f.event(f.doc, "keydown", { code: "ControlLeft" });
  f.tick();
  assert.ok(f.camera.position.y < upper);
});

test("editable focus halts held movement, blur clears keys, and invalid setup restores camera", async (t) => {
  const f = fixture(t);
  await f.api.start("walk", start);
  f.event(f.doc, "keydown", { code: "KeyW" });
  f.tick();
  f.doc.activeElement = { closest: () => ({}) };
  const position = f.camera.position.clone();
  assert.equal(f.event(f.doc, "keydown", { code: "KeyD" }).defaultPrevented, false);
  f.tick();
  assert.ok(position.equals(f.camera.position));
  f.doc.activeElement = f.canvas;
  f.tick();
  assert.ok(position.equals(f.camera.position));
  f.event(f.win, "blur");
  await f.api.start("walk", start);
  const next = f.camera.position.clone();
  f.tick();
  assert.ok(next.equals(f.camera.position));
  f.api.stop();
  const origin = f.camera.position.clone(),
    rotation = f.camera.quaternion.clone();
  await assert.rejects(f.api.start("walk", { ...start, x: NaN }), /finite/);
  assert.equal(f.api.mode, "orbit");
  assert.equal(f.camera.fov, 48);
  assert.ok(origin.equals(f.camera.position));
  assert.ok(rotation.equals(f.camera.quaternion));
});

test("walk arrival finishes at requested position and yaw despite pointer-lock refusal", async (t) => {
  const f = fixture(t, false);
  const original = f.camera.position.clone();
  await f.api.start("walk", { ...start, yaw: Math.PI });
  assert.ok(original.equals(f.camera.position));
  assert.equal(f.canvas.dataset.navigationTransition, "arriving");
  f.tick(1600);
  assert.equal(f.canvas.dataset.navigationTransition, "idle");
  assert.deepEqual(f.camera.position.toArray(), [2, 4.65, 4]);
  assert.ok(f.camera.getWorldDirection(new THREE.Vector3()).z > 0.99);
});

test("old rejection cannot drop cleanup for a newer event-only request", async (t) => {
  const f = fixture(t);
  let reject!: (reason: Error) => void;
  f.canvas.requestPointerLock = () =>
    new Promise<void>((_, no) => {
      reject = no;
    });
  const old = f.api.start("fly");
  f.api.stop();
  f.canvas.requestPointerLock = (() => undefined) as unknown as () => Promise<void>;
  await f.api.start("walk", start);
  reject(Error("Old request rejected"));
  await old;
  f.api.dispose();
  f.lock();
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.api.mode, "orbit");
});
