import * as THREE from "three";

export type WalkCollisionWorld = {
  move(feet: THREE.Vector3, displacement: THREE.Vector3): { position: THREE.Vector3; blocked: boolean };
  validStart(feet: THREE.Vector3): boolean;
};
const RADIUS = .27, HEIGHT = 1.8, STEP = .3, SKIN = .002, CELL = 2, SUBSTEP = .1;
type Face = { triangle: THREE.Triangle; bounds: THREE.Box3; normal: THREE.Vector3; owner: THREE.Mesh; solid: boolean; support: boolean };
type Cache = { stamp: string; geometry: THREE.BufferGeometry; position: unknown; index: unknown; valid: boolean; faces: Face[]; bounds: THREE.Box3; cells: Set<string> };
const finite = (v: THREE.Vector3) => [v.x, v.y, v.z].every(Number.isFinite);
const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

function segmentDistanceSq(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return p1.distanceToSquared(p2);
  if (a <= 1e-12) t = THREE.MathUtils.clamp(f / e, 0, 1);
  else {
    const c = d1.dot(r);
    if (e <= 1e-12) s = THREE.MathUtils.clamp(-c / a, 0, 1);
    else {
      const b = d1.dot(d2), denominator = a * e - b * b;
      if (Math.abs(denominator) > 1e-12) s = THREE.MathUtils.clamp((b * f - c * e) / denominator, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceToSquared(p2.clone().addScaledVector(d2, t));
}
export function capsuleFaceDistanceSq(low: THREE.Vector3, high: THREE.Vector3, triangle: THREE.Triangle) {
  const hit = new THREE.Ray(low, new THREE.Vector3(0, 1, 0)).intersectTriangle(triangle.a, triangle.b, triangle.c, false, new THREE.Vector3());
  if (hit && hit.y <= high.y) return 0;
  const nearest = new THREE.Vector3();
  let distance = Math.min(triangle.closestPointToPoint(low, nearest).distanceToSquared(low), triangle.closestPointToPoint(high, nearest).distanceToSquared(high));
  for (const [a, b] of [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]) distance = Math.min(distance, segmentDistanceSq(low, high, a, b));
  return distance;
}

/** Grounded capsule navigation over supplied world-space model geometry. Rendering visibility is not physical solidity. */
export function createWalkCollisionWorld({ solids, supports }: {
  solids: () => readonly THREE.Mesh[]; supports: () => readonly THREE.Mesh[];
}): WalkCollisionWorld {
  const cache = new Map<THREE.Mesh, Cache>(), grid = new Map<string, Set<Face>>(), large = new Set<Face>();
  let invalid = false;
  function remove(entry: Cache) {
    for (const key of entry.cells) { const bucket = grid.get(key); if (!bucket) continue; for (const face of entry.faces) bucket.delete(face); if (!bucket.size) grid.delete(key); }
    for (const face of entry.faces) large.delete(face);
  }
  function refresh() {
    invalid = false;
    const solidSet = new Set(solids()), supportSet = new Set(supports()), meshes = new Set([...solidSet, ...supportSet]);
    for (const [mesh, entry] of cache) if (!meshes.has(mesh)) { remove(entry); cache.delete(mesh); }
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry, position = geometry?.getAttribute("position"), index = geometry?.getIndex();
      if (!position || position.itemSize < 3 || !mesh.matrixWorld.elements.every(Number.isFinite)) { invalid = true; continue; }
      const version = "version" in position ? position.version : position.data.version;
      const stamp = `${version}/${index?.version ?? 0}/${position.count}/${index?.count ?? 0}/${solidSet.has(mesh)}/${supportSet.has(mesh)}/${mesh.matrixWorld.elements.join(",")}`;
      const previous = cache.get(mesh);
      if (previous?.stamp === stamp && previous.geometry === geometry && previous.position === position && previous.index === index) { if (!previous.valid) invalid = true; continue; }
      if (previous) remove(previous);
      const entry: Cache = { stamp, geometry, position, index, valid: true, faces: [], bounds: new THREE.Box3(), cells: new Set() };
      const count = index?.count ?? position.count;
      if (count % 3) { invalid = true; cache.delete(mesh); continue; }
      for (let i = 0; i < count; i += 3) {
        const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
        if (ids.some(id => !Number.isInteger(id) || id < 0 || id >= position.count)) { invalid = true; entry.valid = false; break; }
        const points = ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id).applyMatrix4(mesh.matrixWorld));
        if (!points.every(finite)) { invalid = true; entry.valid = false; break; }
        const triangle = new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
        if (triangle.getArea() < 1e-10) continue;
        const bounds = new THREE.Box3().setFromPoints(points), normal = triangle.getNormal(new THREE.Vector3());
        const face: Face = { triangle, bounds, normal, owner: mesh, solid: solidSet.has(mesh), support: supportSet.has(mesh) && Math.abs(normal.y) >= .65 };
        entry.faces.push(face); entry.bounds.union(bounds);
        const min = bounds.min.clone().divideScalar(CELL).floor(), max = bounds.max.clone().divideScalar(CELL).floor();
        if ((max.x - min.x + 1) * (max.y - min.y + 1) * (max.z - min.z + 1) > 2048) { large.add(face); continue; }
        for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) {
          const key = cellKey(x, y, z), bucket = grid.get(key) ?? new Set<Face>(); bucket.add(face); grid.set(key, bucket); entry.cells.add(key);
        }
      }
      cache.set(mesh, entry);
    }
  }
  function query(bounds: THREE.Box3) {
    const result = new Set<Face>();
    const min = bounds.min.clone().divideScalar(CELL).floor(), max = bounds.max.clone().divideScalar(CELL).floor();
    for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) {
      for (const face of grid.get(cellKey(x, y, z)) ?? []) if (face.bounds.intersectsBox(bounds)) result.add(face);
    }
    for (const face of large) if (face.bounds.intersectsBox(bounds)) result.add(face);
    return result;
  }
  function supportAt(x: number, z: number, minY: number, maxY: number, allowSteps = true): number | null {
    const bounds = new THREE.Box3(new THREE.Vector3(x - SKIN, minY - SKIN, z - SKIN), new THREE.Vector3(x + SKIN, maxY + SKIN, z + SKIN));
    const ray = new THREE.Ray(new THREE.Vector3(x, maxY + SKIN, z), new THREE.Vector3(0, -1, 0)), hit = new THREE.Vector3();
    let height: number | null = null;
    for (const face of query(bounds)) if ((face.support || (allowSteps && face.solid && Math.abs(face.normal.y) >= .65))
      && ray.intersectTriangle(face.triangle.a, face.triangle.b, face.triangle.c, false, hit)
      && hit.y >= minY - 1e-5 && hit.y <= maxY + 1e-5) {
      // Thresholds and raised finish details are real small steps, but cannot bridge missing floor.
      if (!face.support && supportAt(x, z, hit.y - STEP, hit.y + SKIN, false) === null) continue;
      height = height === null ? hit.y : Math.max(height, hit.y);
    }
    return height;
  }
  function collision(feet: THREE.Vector3): Face | null {
    const low = feet.clone().add(new THREE.Vector3(0, RADIUS, 0)), high = feet.clone().add(new THREE.Vector3(0, HEIGHT - RADIUS, 0));
    const bounds = new THREE.Box3(new THREE.Vector3(feet.x - RADIUS, feet.y + SKIN, feet.z - RADIUS), new THREE.Vector3(feet.x + RADIUS, feet.y + HEIGHT, feet.z + RADIUS));
    for (const face of query(bounds)) if (face.solid && capsuleFaceDistanceSq(low, high, face.triangle) < (RADIUS - SKIN) ** 2) return face;
    return null;
  }
  function insideSolid(feet: THREE.Vector3) {
    const point = feet.clone().add(new THREE.Vector3(0, HEIGHT / 2, 0));
    const ray = new THREE.Ray(point, new THREE.Vector3(1, .017, .031).normalize()), target = new THREE.Vector3();
    for (const [mesh, entry] of cache) {
      if (!entry.faces[0]?.solid || !entry.bounds.containsPoint(point)) continue;
      const hits: number[] = [];
      for (const face of entry.faces) if (ray.intersectTriangle(face.triangle.a, face.triangle.b, face.triangle.c, false, target)) {
        const distance = point.distanceTo(target); if (!hits.some(d => Math.abs(d - distance) < 1e-5)) hits.push(distance);
      }
      if (hits.length % 2 === 1) return mesh;
    }
    return null;
  }
  function footprint(feet: THREE.Vector3) {
    // A stair tread may support the centre while the heel spans two lower treads; an actual void has no supporting hit.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      if (supportAt(feet.x + Math.cos(angle) * (RADIUS - SKIN), feet.z + Math.sin(angle) * (RADIUS - SKIN), feet.y - STEP * 2.2, feet.y + STEP) === null) return false;
    }
    return true;
  }
  function trial(from: THREE.Vector3, dx: number, dz: number): { position?: THREE.Vector3; obstacle?: Face } {
    const x = from.x + dx, z = from.z + dz, floor = supportAt(x, z, from.y - STEP * 2.2, from.y + STEP);
    if (floor === null) return {};
    // Lift only onto nearby support, retaining the previous height briefly while a heel clears a descending riser.
    const heights = new Set([floor]);
    if (from.y >= floor) heights.add(from.y);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const height = supportAt(x + Math.cos(angle) * (RADIUS + SKIN), z + Math.sin(angle) * (RADIUS + SKIN), Math.max(floor, from.y - STEP), Math.min(from.y + STEP, floor + STEP));
      if (height !== null) heights.add(height);
    }
    // A narrow sill or grout strip can fall between the footprint rays. Inspect its real
    // projected triangle under the body instead of widening or deleting that geometry.
    const stepBounds = new THREE.Box3(new THREE.Vector3(x - RADIUS, from.y - STEP - 1e-5, z - RADIUS), new THREE.Vector3(x + RADIUS, Math.min(from.y + STEP, floor + STEP) + 1e-5, z + RADIUS));
    for (const face of query(stepBounds)) if ((face.support || face.solid) && Math.abs(face.normal.y) >= .65) {
      const flat = new THREE.Triangle(face.triangle.a.clone().setY(0), face.triangle.b.clone().setY(0), face.triangle.c.clone().setY(0));
      const point = new THREE.Vector3(x, 0, z), closest = flat.closestPointToPoint(point, new THREE.Vector3());
      if (closest.distanceToSquared(point) > RADIUS ** 2) continue;
      const bary = flat.getBarycoord(closest, new THREE.Vector3());
      if (!bary) continue;
      const height = bary.x * face.triangle.a.y + bary.y * face.triangle.b.y + bary.z * face.triangle.c.y;
      if (height < from.y - STEP - 1e-5 || height > Math.min(from.y + STEP, floor + STEP) + 1e-5) continue;
      if (!face.support && supportAt(closest.x, closest.z, height - STEP, height + SKIN, false) === null) continue;
      heights.add(height);
    }
    // Narrow treads can put the centre two risers below the trailing heel. Require an intermediate tread;
    // a single excessive ledge must not acquire the same permission to descend.
    if (from.y - floor > STEP + 1e-5 && ![...heights].some(h => h < from.y - SKIN && h >= from.y - STEP - 1e-5)) return {};
    let obstacle: Face | null = null;
    for (const height of [...heights].sort((a,b) => a-b)) {
      if (Math.abs(height - from.y) > STEP + 1e-5) continue;
      const target = new THREE.Vector3(x, height, z), hit = collision(target);
      if (!hit && footprint(target)) return { position: target };
      obstacle ??= hit;
    }
    return { obstacle: obstacle ?? undefined };
  }
  return {
    validStart(feet) {
      if (!finite(feet)) return false;
      refresh(); if (invalid) return false;
      const floor = supportAt(feet.x, feet.z, feet.y - .05, feet.y + .05);
      return floor !== null && !collision(feet) && footprint(feet) && !insideSolid(feet);
    },
    move(feet, displacement) {
      const position = feet.clone();
      if (!finite(feet) || !finite(displacement)) return { position, blocked: true };
      refresh();
      if (invalid || supportAt(feet.x, feet.z, feet.y - STEP * 2.2, feet.y + STEP) === null || !footprint(feet) || collision(feet) || insideSolid(feet)) return { position, blocked: true };
      const distance = Math.hypot(displacement.x, displacement.z), needed = Math.max(1, Math.ceil(distance / SUBSTEP)), steps = Math.min(needed, 512);
      const dx = displacement.x / needed, dz = displacement.z / needed;
      let blocked = needed > steps || Math.abs(displacement.y) > 1e-6;
      for (let i = 0; i < steps; i++) {
        const full = trial(position, dx, dz);
        if (full.position) { position.copy(full.position); continue; }
        blocked = true;
        if (full.obstacle) {
          const normal = full.obstacle.normal.clone().setY(0);
          if (normal.lengthSq() > .01) {
            normal.normalize(); const into = dx * normal.x + dz * normal.z;
            const slide = trial(position, dx - into * normal.x, dz - into * normal.z);
            if (slide.position && slide.position.distanceToSquared(position) > 1e-10) { position.copy(slide.position); continue; }
          }
        }
        const first = Math.abs(dx) >= Math.abs(dz) ? [dx, 0] : [0, dz], second = Math.abs(dx) >= Math.abs(dz) ? [0, dz] : [dx, 0];
        for (const [sx, sz] of [first, second]) if (Math.abs(sx) + Math.abs(sz) > 1e-8) { const axis = trial(position, sx, sz); if (axis.position) position.copy(axis.position); }
      }
      return { position, blocked };
    },
  };
}
