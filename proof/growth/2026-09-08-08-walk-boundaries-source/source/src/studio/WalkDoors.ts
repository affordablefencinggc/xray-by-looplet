import * as THREE from "three";
import { capsuleFaceDistanceSq } from "./walkCollision.ts";

export type WalkDoorMotion = "swing" | "slide" | "lift";
export type WalkDoorState = { id: string; label: string; open: boolean; busy: boolean; progress: number; motion: WalkDoorMotion; blockedReason?: string };
export type WalkDoorDefinition = {
  id: string; label: string; meshes: THREE.Mesh[]; motion?: WalkDoorMotion;
  /** World-space hinge and signed opening angle, when known by the authoring model. */
  hinge?: THREE.Vector3; swingAngle?: number;
};
type Original = { mesh: THREE.Mesh; matrix: THREE.Matrix4; world: THREE.Matrix4; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; auto: boolean };
type Door = { definition: WalkDoorDefinition; originals: Original[]; bounds: THREE.Box3; axis: THREE.Vector3; normal: THREE.Vector3; hinge: THREE.Vector3; width: number; height: number; angle: number; progress: number; open: boolean };
const REACH = 1.5, DURATION = 620, BODY_RADIUS = 0.27;

/** View-only leaf transforms; the same mesh objects remain available to collision checks. */
export function createWalkDoors({ doors, camera, canvas, onChange, invalidate, solids, now = () => performance.now(), reducedMotion }: {
  doors: readonly WalkDoorDefinition[]; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement;
  onChange: (state: WalkDoorState | null) => void; invalidate: () => void;
  solids?: () => readonly THREE.Object3D[]; now?: () => number; reducedMotion?: () => boolean;
}) {
  const claimed = new Set<THREE.Mesh>(), identities = new Set<string>();
  const records: Door[] = doors.map(definition => {
    if (!definition.id || identities.has(definition.id) || !definition.meshes.length) throw Error("Door identities and leaves must be unique and non-empty.");
    identities.add(definition.id);
    const corners: THREE.Vector3[] = [];
    const originals = definition.meshes.map(mesh => {
      if (claimed.has(mesh)) throw Error("A door leaf cannot belong to two door controls.");
      claimed.add(mesh); mesh.updateWorldMatrix(true, false);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box || box.isEmpty()) throw Error("Door leaf geometry is empty.");
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
      return { mesh, matrix: mesh.matrix.clone(), world: mesh.matrixWorld.clone(), position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone(), auto: mesh.matrixAutoUpdate };
    });
    const bounds = new THREE.Box3().setFromPoints(corners), centre = bounds.getCenter(new THREE.Vector3());
    let xx = 0, zz = 0, xz = 0;
    for (const p of corners) { xx += (p.x - centre.x) ** 2; zz += (p.z - centre.z) ** 2; xz += (p.x - centre.x) * (p.z - centre.z); }
    const yaw = Math.atan2(2 * xz, xx - zz) / 2;
    const axis = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), normal = new THREE.Vector3(-axis.z, 0, axis.x);
    const along = corners.map(p => p.dot(axis)), across = corners.map(p => p.dot(normal));
    const min = Math.min(...along), width = Math.max(...along) - min, height = bounds.max.y - bounds.min.y;
    if (![width, height, ...centre.toArray()].every(Number.isFinite) || width < 0.05 || height < 0.2) throw Error("Door leaf dimensions are invalid.");
    const hinge = definition.hinge?.clone() ?? axis.clone().multiplyScalar(min).addScaledVector(normal, (Math.min(...across) + Math.max(...across)) / 2).setY(bounds.min.y);
    if (!hinge.toArray().every(Number.isFinite) || (definition.swingAngle !== undefined && (!Number.isFinite(definition.swingAngle) || Math.abs(definition.swingAngle) < 0.01 || Math.abs(definition.swingAngle) > Math.PI))) throw Error("Door hinge or swing angle is invalid.");
    return { definition, originals, bounds, axis, normal, hinge, width, height, angle: definition.swingAngle ?? Math.PI / 2, progress: 0, open: false };
  });
  let disposed = false, active = false, candidate: Door | null = null, lastState = "";
  let animation: { door: Door; from: number; to: number; started: number } | null = null;
  const eye = new THREE.Vector3(), facing = new THREE.Vector3(), raycaster = new THREE.Raycaster();
  const rayMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const rayProxies = new WeakMap<THREE.Mesh, THREE.Mesh>();
  function cameraPosition() { camera.updateWorldMatrix(true, false); return camera.getWorldPosition(eye); }
  function delta(door: Door, progress: number) {
    const motion = door.definition.motion ?? "swing";
    if (motion === "slide") return new THREE.Matrix4().makeTranslation(...door.axis.clone().multiplyScalar(door.width * 1.04 * progress).toArray());
    if (motion === "lift") return new THREE.Matrix4().makeTranslation(0, door.height * 1.04 * progress, 0);
    return new THREE.Matrix4().makeTranslation(...door.hinge.toArray()).multiply(new THREE.Matrix4().makeRotationY(door.angle * progress)).multiply(new THREE.Matrix4().makeTranslation(...door.hinge.clone().negate().toArray()));
  }
  function apply(door: Door, progress: number) {
    const transform = delta(door, progress);
    for (const original of door.originals) {
      const { mesh } = original;
      mesh.parent?.updateWorldMatrix(true, false);
      const inverseParent = mesh.parent ? mesh.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
      mesh.matrix.copy(inverseParent.multiply(transform.clone().multiply(original.world)));
      mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.matrixAutoUpdate = false; mesh.matrixWorldNeedsUpdate = true; mesh.updateWorldMatrix(false, false);
    }
    door.progress = progress;
  }
  function visible(object: THREE.Object3D) { for (let part: THREE.Object3D | null = object; part; part = part.parent) if (!part.visible) return false; return true; }
  function currentBounds(door: Door) {
    const box = new THREE.Box3();
    for (const { mesh } of door.originals) box.union(new THREE.Box3().setFromObject(mesh));
    return box;
  }
  function obstructed(door: Door, target: THREE.Vector3) {
    if (!solids) return false;
    const direction = target.clone().sub(eye), distance = direction.length();
    if (distance < 0.04) return false;
    raycaster.set(eye, direction.normalize()); raycaster.near = 0; raycaster.far = Math.max(0, distance - 0.025);
    const leaves = new Set(door.definition.meshes), checked = new Set<THREE.Mesh>();
    let blocked = false;
    for (const solid of solids()) solid.traverse(object => {
      if (blocked || !(object instanceof THREE.Mesh) || leaves.has(object) || checked.has(object) || !visible(object)) return;
      checked.add(object); object.updateWorldMatrix(true, false);
      let proxy = rayProxies.get(object);
      if (!proxy) { proxy = new THREE.Mesh(object.geometry, rayMaterial); rayProxies.set(object, proxy); }
      proxy.geometry = object.geometry; proxy.matrixWorld.copy(object.matrixWorld);
      const hits: THREE.Intersection[] = []; proxy.raycast(raycaster, hits);
      if (hits.length) blocked = true;
    });
    return blocked;
  }
  function chooseSwing(door: Door) {
    if (!door.open && door.definition.swingAngle === undefined) {
      const side = cameraPosition().clone().sub(door.hinge).dot(door.normal);
      door.angle = side >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  function sweepBlocked(door: Door) {
    const position = cameraPosition();
    const feet = position.y - 1.65;
    const low = new THREE.Vector3(position.x, feet + BODY_RADIUS, position.z);
    const high = new THREE.Vector3(position.x, feet + 1.8 - BODY_RADIUS, position.z);
    const bodyBounds = new THREE.Box3(new THREE.Vector3(position.x - BODY_RADIUS, feet, position.z - BODY_RADIUS),
      new THREE.Vector3(position.x + BODY_RADIUS, feet + 1.8, position.z + BODY_RADIUS));
    // Bounding boxes are only a broad phase: joined mullion meshes contain empty
    // space. The same triangle/capsule narrow phase as walking preserves those gaps.
    for (let i = 0; i <= 16; i++) {
      const transform = delta(door, i / 16);
      for (const original of door.originals) {
        const world = transform.clone().multiply(original.world), localBox = original.mesh.geometry.boundingBox!;
        const worldBox = localBox.clone().applyMatrix4(world);
        if (!worldBox.intersectsBox(bodyBounds)) continue;
        const geometry = original.mesh.geometry, vertices = geometry.getAttribute("position"), index = geometry.index;
        const triangle = new THREE.Triangle(), faceBounds = new THREE.Box3();
        for (let j = 0; j < (index?.count ?? vertices.count); j += 3) {
          for (const [offset, point] of [triangle.a, triangle.b, triangle.c].entries()) point.fromBufferAttribute(vertices, index ? index.getX(j + offset) : j + offset).applyMatrix4(world);
          faceBounds.setFromPoints([triangle.a, triangle.b, triangle.c]);
          if (faceBounds.intersectsBox(bodyBounds) && capsuleFaceDistanceSq(low, high, triangle) < (BODY_RADIUS - 0.002) ** 2) return true;
        }
      }
    }
    return false;
  }
  function eligible(door: Door) {
    if (!door.originals.some(({ mesh }) => visible(mesh))) return null;
    cameraPosition(); camera.getWorldDirection(facing);
    if (eye.y < door.bounds.min.y - 0.1 || eye.y > door.bounds.max.y + 0.35) return null;
    const target = (door.open ? door.bounds : currentBounds(door)).clampPoint(eye, new THREE.Vector3()), distance = target.distanceTo(eye);
    const toward = target.clone().sub(eye);
    if (distance > REACH || (distance > 0.01 && toward.normalize().dot(facing) < 0.35) || obstructed(door, target)) return null;
    return distance;
  }
  function choose() {
    let best: Door | null = null, nearest = Infinity;
    for (const door of records) { const distance = eligible(door); if (distance !== null && distance < nearest) { best = door; nearest = distance; } }
    return best;
  }
  function publish(door: Door | null) {
    if (door && !animation) chooseSwing(door);
    const state: WalkDoorState | null = door ? { id: door.definition.id, label: door.definition.label, open: door.open, busy: animation?.door === door, progress: Math.round(door.progress * 1000) / 1000, motion: door.definition.motion ?? "swing",
      ...(!animation && sweepBlocked(door) ? { blockedReason: door.open ? "Step clear of the doorway before closing." : "Step back to open the door." } : {}) } : null;
    const text = JSON.stringify(state);
    if (text !== lastState) { lastState = text; onChange(state); }
    canvas.dataset.walkDoor = state?.id ?? "";
    canvas.dataset.walkDoorProgress = state ? String(state.progress) : "";
    canvas.dataset.walkDoorBusy = String(state?.busy ?? false);
    canvas.dataset.walkDoorOpen = String(state?.open ?? false);
    // Door transforms persist when the viewer turns away and the nearby prompt hides.
    // Keep physical state separate from prompt eligibility for diagnostics and QA.
    canvas.dataset.walkDoors = JSON.stringify(records.map(record => ({ id: record.definition.id, open: record.open, progress: Math.round(record.progress * 1000) / 1000 })));
  }
  function reset() {
    animation = null; candidate = null;
    for (const door of records) {
      for (const original of door.originals) {
        const { mesh } = original;
        mesh.position.copy(original.position); mesh.quaternion.copy(original.quaternion); mesh.scale.copy(original.scale);
        mesh.matrix.copy(original.matrix); mesh.matrixAutoUpdate = original.auto; mesh.matrixWorldNeedsUpdate = true; mesh.updateWorldMatrix(true, false);
      }
      door.progress = 0; door.open = false;
    }
    publish(null); invalidate();
  }
  return {
    get busy() { return animation !== null; },
    tick(nextActive: boolean) {
      if (disposed) return false;
      if (active && !nextActive) reset();
      active = nextActive;
      if (!active) return false;
      if (animation && sweepBlocked(animation.door)) {
        // Another movement can enter the sweep after interaction. Stop at the current
        // safe pose rather than animate a solid leaf through the camera body.
        animation.door.open = animation.door.progress > 0.001; animation = null;
      }
      if (animation) {
        const run = animation, t = Math.min(1, Math.max(0, (now() - run.started) / DURATION));
        const eased = t * t * (3 - 2 * t);
        apply(run.door, run.from + (run.to - run.from) * eased);
        if (t === 1) { run.door.open = run.to === 1; animation = null; }
      }
      candidate = animation?.door ?? choose(); publish(candidate);
      return animation !== null;
    },
    interact() {
      if (disposed || !active || animation) return;
      candidate = choose();
      if (!candidate) { publish(null); return; }
      chooseSwing(candidate);
      if (sweepBlocked(candidate)) { publish(candidate); return; }
      const to = candidate.open ? 0 : 1;
      const reduce = reducedMotion?.() ?? canvas.ownerDocument?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      if (reduce) { apply(candidate, to); candidate.open = to === 1; }
      else animation = { door: candidate, from: candidate.progress, to, started: now() };
      publish(candidate); invalidate();
    },
    reset,
    dispose() { if (disposed) return; reset(); active = false; disposed = true; rayMaterial.dispose(); },
  };
}
