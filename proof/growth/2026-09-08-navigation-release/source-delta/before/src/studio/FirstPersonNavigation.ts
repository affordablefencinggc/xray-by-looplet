import * as THREE from "three";
import { movementVector, type NavigationMode } from "./navigationMovement";
import type { WalkStart } from "./WalkStartDialog";
export function createFirstPersonNavigation({
  canvas,
  camera,
  bounds,
  floor,
  onChange,
  invalidate,
}: {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  bounds: THREE.Box3;
  floor: () => number;
  onChange: (mode: NavigationMode) => void;
  invalidate: () => void;
}) {
  let mode: NavigationMode = "orbit",
    yaw = 0,
    pitch = 0,
    last = 0,
    walkY = 0,
    orbitFov = camera.fov;
  const keys = new Set<string>(),
    velocity = new THREE.Vector3(),
    direction = new THREE.Vector3();
  let arrival: {
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    target: THREE.Vector3;
    targetRotation: THREE.Quaternion;
    started: number;
    arc: number;
  } | null = null;
  const supported = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
    "ControlLeft",
    "ControlRight",
    "ShiftLeft",
    "ShiftRight",
  ]);
  function stop() {
    if (mode === "orbit") return;
    mode = "orbit";
    camera.fov = orbitFov;
    camera.updateProjectionMatrix();
    arrival = null;
    canvas.dataset.navigationTransition = "idle";
    keys.clear();
    velocity.set(0, 0, 0);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    canvas.dataset.navigation = "orbit";
    onChange(mode);
    invalidate();
  }
  function keyDown(e: KeyboardEvent) {
    if (mode === "orbit") return;
    if (e.code === "Escape") {
      e.preventDefault();
      stop();
      return;
    }
    if (supported.has(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!arrival) keys.add(e.code);
      invalidate();
    }
  }
  function keyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function look(e: MouseEvent) {
    if (mode === "orbit" || arrival || document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * 0.002;
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.002, -1.48, 1.48);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    invalidate();
  }
  function lockChanged() {
    if (mode !== "orbit" && document.pointerLockElement !== canvas) stop();
  }
  function blur() {
    stop();
  }
  document.addEventListener("keydown", keyDown, true);
  document.addEventListener("keyup", keyUp, true);
  document.addEventListener("mousemove", look);
  document.addEventListener("pointerlockchange", lockChanged);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", blur);
  const api = {
    get mode() {
      return mode;
    },
    async start(next: "fly" | "walk", start?: WalkStart) {
      orbitFov = camera.fov;
      camera.fov = 65;
      camera.updateProjectionMatrix();
      const origin = camera.position.clone(),
        originRotation = camera.quaternion.clone();
      arrival = null;
      const center = bounds.getCenter(new THREE.Vector3()),
        size = bounds.getSize(new THREE.Vector3());
      walkY = (start?.elevation ?? floor()) + 1.65;
      if (next === "walk") {
        camera.position.set(start?.x ?? center.x, walkY, start?.z ?? bounds.max.z - 3);
        camera.lookAt(camera.position.x, walkY, camera.position.z - 10);
      } else {
        camera.position.set(
          center.x + size.x * 0.8,
          Math.max(walkY, center.y),
          bounds.max.z + size.x * 0.65,
        );
        camera.lookAt(center.x, Math.max(walkY, center.y), center.z);
      }
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      yaw = euler.y;
      pitch = euler.x;
      const target = camera.position.clone(),
        targetRotation = camera.quaternion.clone();
      const animate = next === "walk" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (animate) {
        camera.position.copy(origin);
        camera.quaternion.copy(originRotation);
      }
      velocity.set(0, 0, 0);
      keys.clear();
      last = performance.now();
      try {
        await canvas.requestPointerLock();
      } catch {
        camera.fov = orbitFov;
        camera.updateProjectionMatrix();
        camera.position.copy(origin);
        camera.quaternion.copy(originRotation);
        invalidate();
        throw Error("Mouse capture was unavailable. Click Fly or Walk again to enter navigation.");
      }
      if (document.pointerLockElement !== canvas) {
        camera.fov = orbitFov;
        camera.updateProjectionMatrix();
        camera.position.copy(origin);
        camera.quaternion.copy(originRotation);
        invalidate();
        throw Error("Click the model again to allow mouse capture.");
      }
      mode = next;
      if (animate)
        arrival = {
          position: origin,
          rotation: originRotation,
          target,
          targetRotation,
          started: performance.now(),
          arc: Math.min(12, origin.distanceTo(target) * 0.12),
        };
      canvas.dataset.navigationTransition = arrival ? "arriving" : "idle";
      canvas.dataset.navigation = mode;
      onChange(mode);
      invalidate();
    },
    stop,
    tick() {
      if (mode === "orbit") return false;
      const now = performance.now(),
        dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (arrival) {
        const t = Math.min(1, (now - arrival.started) / 1600);
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        camera.position.lerpVectors(arrival.position, arrival.target, eased);
        camera.position.y += Math.sin(Math.PI * eased) * arrival.arc;
        camera.quaternion.slerpQuaternions(arrival.rotation, arrival.targetRotation, eased);
        canvas.dataset.navigationTransitionProgress = String(t);
        if (t === 1) {
          arrival = null;
          canvas.dataset.navigationTransition = "idle";
        }
        return true;
      }
      const speed =
        (mode === "walk" ? 1.8 : 7) * (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3 : 1);
      const target = new THREE.Vector3(...movementVector(keys, yaw, pitch, mode)).multiplyScalar(
        speed,
      );
      velocity.lerp(target, 1 - Math.exp(-(mode === "walk" ? 5 : 10) * dt));
      camera.position.addScaledVector(velocity, dt);
      if (mode === "walk") camera.position.y = walkY;
      camera.getWorldDirection(direction);
      canvas.dataset.navigationYaw = String(yaw);
      canvas.dataset.navigationPitch = String(pitch);
      canvas.dataset.navigationSpeed = String(velocity.length());
      canvas.dataset.navigationDirection = direction.toArray().join(",");
      return true;
    },
    dispose() {
      stop();
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      document.removeEventListener("mousemove", look);
      document.removeEventListener("pointerlockchange", lockChanged);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    },
  };
  return api;
}
