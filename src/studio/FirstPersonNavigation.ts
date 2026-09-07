import * as THREE from "three";
import { movementVector, type NavigationMode } from "./navigationMovement.ts";
import type { WalkStart } from "./WalkStartDialog";
import type { WalkCollisionWorld } from "./walkCollision.ts";
export function createFirstPersonNavigation({
  canvas,
  camera,
  bounds,
  floor,
  onChange,
  onCaptureChange,
  walkWorld,
  onInteract,
  interactionBusy,
  invalidate,
}: {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  bounds: THREE.Box3;
  floor: () => number;
  onChange: (mode: NavigationMode) => void;
  onCaptureChange?: (capture: "locked" | "drag" | null) => void;
  walkWorld?: () => WalkCollisionWorld | null;
  onInteract?: () => void;
  interactionBusy?: () => boolean;
  invalidate: () => void;
}) {
  let mode: NavigationMode = "orbit",
    yaw = 0,
    pitch = 0,
    last = 0,
    walkY = 0,
    orbitFov = camera.fov;
  let disposed = false,
    generation = 0,
    captureSequence = 0,
    captureState: "locked" | "drag" | null = null;
  const pendingCaptures = new Set<number>();
  let drag: { id: number; x: number; y: number } | null = null;
  const originalTabIndex = canvas.tabIndex;
  canvas.tabIndex = Math.max(0, originalTabIndex);
  canvas.dataset.navigationCapture = "none";
  const keys = new Set<string>(),
    velocity = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    walkFeet = new THREE.Vector3();
  canvas.dataset.navigationBlocked = "false";
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
  function setCapture(value: typeof captureState) {
    canvas.dataset.navigationCapture = value ?? "none";
    if (captureState === value) return;
    captureState = value;
    onCaptureChange?.(value);
  }
  function clearInput() {
    keys.clear();
    velocity.set(0, 0, 0);
    if (drag) {
      const id = drag.id;
      drag = null;
      try {
        canvas.releasePointerCapture?.(id);
      } catch {
        /* Already released. */
      }
    }
  }
  function releaseLock() {
    if (document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch {
        /* A detached document may reject release. */
      }
    }
  }
  function stop() {
    generation++;
    clearInput();
    const changed = mode !== "orbit";
    mode = "orbit";
    if (changed) {
      camera.fov = orbitFov;
      camera.updateProjectionMatrix();
    }
    arrival = null;
    canvas.dataset.navigationTransition = "idle";
    setCapture(null);
    releaseLock();
    canvas.dataset.navigation = "orbit";
    canvas.dataset.navigationBlocked = "false";
    delete canvas.dataset.walkFeet;
    if (changed) onChange(mode);
    invalidate();
  }
  function editing(target: EventTarget | null) {
    return !!(target as Element | null)?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    );
  }
  function keyDown(e: KeyboardEvent) {
    if (mode === "orbit" || editing(e.target) || editing(document.activeElement)) return;
    if (e.code === "Escape") {
      e.preventDefault();
      stop();
      return;
    }
    if (e.code === "KeyE" && mode === "walk" && onInteract) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!arrival && !e.repeat && !keys.has(e.code) && !interactionBusy?.()) {
        keys.add(e.code);
        onInteract();
        invalidate();
      }
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
  function rotate(dx: number, dy: number) {
    yaw -= dx * 0.002;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.002, -1.48, 1.48);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    invalidate();
  }
  function look(e: MouseEvent) {
    if (mode === "orbit" || arrival || document.pointerLockElement !== canvas) return;
    rotate(e.movementX, e.movementY);
  }
  function dragStart(e: PointerEvent) {
    if (mode === "orbit" || arrival || captureState !== "drag" || e.button !== 0 || drag) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* Document listeners still end the drag. */
    }
  }
  function dragMove(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId || arrival || mode === "orbit" || captureState !== "drag")
      return;
    e.preventDefault();
    rotate(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function dragEnd(e: PointerEvent) {
    if (drag?.id !== e.pointerId) return;
    const id = drag.id;
    drag = null;
    try {
      canvas.releasePointerCapture?.(id);
    } catch {
      /* Already released. */
    }
  }
  function lockChanged() {
    pendingCaptures.clear();
    if (disposed) removeLockListeners();
    if (disposed || mode === "orbit") {
      releaseLock();
      return;
    }
    if (document.pointerLockElement === canvas) {
      clearInput();
      setCapture("locked");
    } else if (captureState === "locked") stop(); // Browser Escape may consume keydown.
  }
  function lockError() {
    pendingCaptures.clear();
    if (disposed) removeLockListeners();
    if (!disposed && mode !== "orbit" && document.pointerLockElement !== canvas) setCapture("drag");
  }
  function removeLockListeners() {
    document.removeEventListener("pointerlockchange", lockChanged);
    document.removeEventListener("pointerlockerror", lockError);
  }
  async function capture(): Promise<boolean> {
    if (disposed || mode === "orbit") return false;
    const requestedGeneration = generation;
    const requestId = ++captureSequence;
    if (document.pointerLockElement === canvas) {
      setCapture("locked");
      return true;
    }
    try {
      // Call immediately in the user's gesture. Older browsers return void and report via events.
      if (canvas.requestPointerLock) {
        pendingCaptures.add(requestId);
        const request = canvas.requestPointerLock();
        if (request && typeof request.then === "function") {
          await request;
          pendingCaptures.delete(requestId);
        }
      }
    } catch {
      pendingCaptures.delete(requestId); /* Mouse capture is optional. */
    }
    // Event handlers can stop navigation while the browser request is pending.
    if (disposed || requestedGeneration !== generation || isOrbit()) {
      if (disposed && !pendingCaptures.size) removeLockListeners();
      if (disposed || isOrbit()) releaseLock();
      return false;
    }
    const locked = document.pointerLockElement === canvas;
    setCapture(locked ? "locked" : "drag");
    invalidate();
    return locked;
  }
  function isOrbit() {
    return mode === "orbit";
  }
  function blur() {
    stop();
  }
  function visibilityChanged() {
    if (document.hidden) blur();
  }
  document.addEventListener("keydown", keyDown, true);
  document.addEventListener("keyup", keyUp, true);
  document.addEventListener("mousemove", look);
  document.addEventListener("pointerlockchange", lockChanged);
  document.addEventListener("pointerlockerror", lockError);
  canvas.addEventListener("pointerdown", dragStart);
  document.addEventListener("pointermove", dragMove);
  document.addEventListener("pointerup", dragEnd);
  document.addEventListener("pointercancel", dragEnd);
  canvas.addEventListener("lostpointercapture", dragEnd);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibilityChanged);
  const api = {
    get mode() {
      return mode;
    },
    async start(next: "fly" | "walk", start?: WalkStart & { yaw?: number }) {
      if (disposed) return;
      const previousFov = camera.fov;
      if (mode === "orbit") orbitFov = previousFov;
      generation++;
      clearInput();
      const origin = camera.position.clone(),
        originRotation = camera.quaternion.clone();
      try {
        if (start && ![start.x, start.z, start.elevation, start.yaw ?? 0].every(Number.isFinite))
          throw Error("Choose a finite walk position and heading.");
        camera.fov = 65;
        camera.updateProjectionMatrix();
        arrival = null;
        const center = bounds.getCenter(new THREE.Vector3()),
          size = bounds.getSize(new THREE.Vector3());
        const floorY = start?.elevation ?? floor();
        walkY = floorY + 1.65;
        if (next === "walk") {
          const feet = new THREE.Vector3(
            start?.x ?? center.x,
            floorY,
            start?.z ?? bounds.max.z - 3,
          );
          const world = walkWorld?.();
          if (
            !feet.toArray().every(Number.isFinite) ||
            (walkWorld && (!world || !world.validStart(feet.clone())))
          )
            throw Error(
              "This walking start has no clear, supported landing. Choose another start.",
            );
          walkFeet.copy(feet);
          camera.position.set(feet.x, walkY, feet.z);
          camera.rotation.set(0, start?.yaw ?? 0, 0, "YXZ");
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
        canvas.dataset.navigationBlocked = "false";
        if (mode === "walk") canvas.dataset.walkFeet = walkFeet.toArray().join(",");
        else delete canvas.dataset.walkFeet;
        setCapture(document.pointerLockElement === canvas ? "locked" : "drag");
        canvas.focus({ preventScroll: true });
        onChange(mode);
        invalidate();
      } catch (error) {
        stop();
        camera.fov = previousFov;
        camera.position.copy(origin);
        camera.quaternion.copy(originRotation);
        camera.updateProjectionMatrix();
        invalidate();
        throw error;
      }
      await capture();
    },
    capture,
    stop,
    tick() {
      if (mode === "orbit") return false;
      const now = performance.now(),
        dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (editing(document.activeElement)) {
        clearInput();
        return false;
      }
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
      if (mode === "walk") {
        const before = walkFeet.clone(),
          displacement = velocity.clone().multiplyScalar(dt);
        let blocked = false;
        if (interactionBusy?.()) {
          velocity.set(0, 0, 0);
        } else {
          try {
            const world = walkWorld?.();
            if (walkWorld && !world) {
              blocked = true;
              velocity.set(0, 0, 0);
            } else if (world) {
              const resolved = world.move(before.clone(), displacement);
              if (!resolved.position.toArray().every(Number.isFinite))
                throw Error("Invalid walking position");
              walkFeet.copy(resolved.position);
              blocked = resolved.blocked;
              // Keep the collision solver's slide direction while removing motion into the obstacle.
              if (blocked && dt > 0)
                velocity.set((walkFeet.x - before.x) / dt, 0, (walkFeet.z - before.z) / dt);
            } else walkFeet.add(displacement);
          } catch {
            // A missing/invalid collision result must never turn into unrestricted movement.
            walkFeet.copy(before);
            velocity.set(0, 0, 0);
            blocked = true;
          }
        }
        walkY = walkFeet.y + 1.65;
        camera.position.x = walkFeet.x;
        camera.position.z = walkFeet.z;
        const heightDelta = walkY - camera.position.y;
        camera.position.y =
          Math.abs(heightDelta) < 0.001
            ? walkY
            : camera.position.y + heightDelta * (1 - Math.exp(-12 * dt));
        canvas.dataset.walkFeet = walkFeet.toArray().join(",");
        canvas.dataset.navigationBlocked = String(blocked);
      } else {
        camera.position.addScaledVector(velocity, dt);
        canvas.dataset.navigationBlocked = "false";
      }
      camera.getWorldDirection(direction);
      canvas.dataset.navigationYaw = String(yaw);
      canvas.dataset.navigationPitch = String(pitch);
      canvas.dataset.navigationSpeed = String(velocity.length());
      canvas.dataset.navigationDirection = direction.toArray().join(",");
      return true;
    },
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      canvas.tabIndex = originalTabIndex;
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      document.removeEventListener("mousemove", look);
      // A legacy void-returning request may grant lock after disposal; release it once it reports.
      if (!pendingCaptures.size) removeLockListeners();
      canvas.removeEventListener("pointerdown", dragStart);
      document.removeEventListener("pointermove", dragMove);
      document.removeEventListener("pointerup", dragEnd);
      document.removeEventListener("pointercancel", dragEnd);
      canvas.removeEventListener("lostpointercapture", dragEnd);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibilityChanged);
    },
  };
  return api;
}
