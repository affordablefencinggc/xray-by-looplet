import * as THREE from 'three';

export const PENCIL_COUNT = 5;
export const SCRIBBLE_SECONDS = 0.2;
const CYCLE_SECONDS = 0.86;
const CYCLES = [0.86, 1.03, 0.73, 0.94, 1.17];
const OFFSETS = [0, 0.23, 0.49, 0.12, 0.67];
const TRAIL_POINTS = 22;
const smooth = (v: number) => v * v * (3 - 2 * v);
type Stroke = { center: THREE.Vector3; direction: THREE.Vector3 };

/** A seekable score: the same time always gives the same pose, including trails. */
export function pencilBeat(seconds: number, index: number) {
  const cycleSeconds = CYCLES[index % PENCIL_COUNT] ?? CYCLE_SECONDS;
  const time = Math.max(0, seconds + OFFSETS[index % PENCIL_COUNT]);
  const cycle = Math.floor(time / cycleSeconds);
  const local = time - cycle * cycleSeconds;
  return { cycle, local, cycleSeconds, scribbling: local < SCRIBBLE_SECONDS,
    travel: smooth(Math.max(0, (local - SCRIBBLE_SECONDS) / (cycleSeconds - SCRIBBLE_SECONDS))) };
}

/** Two short flutter bursts, fading to zero at contact and between transfers. */
export function pencilFizz(seconds: number, index: number) {
  const beat = pencilBeat(seconds, index);
  if (beat.scribbling) return 0;
  const u = (beat.local - SCRIBBLE_SECONDS) / (beat.cycleSeconds - SCRIBBLE_SECONDS);
  return Math.sin(Math.PI * u) * (Math.exp(-(((u - 0.16) / 0.13) ** 2)) + Math.exp(-(((u - 0.84) / 0.13) ** 2)));
}

export function createCinematicPencils(options: {
  bounds: THREE.Box3; lines: THREE.LineSegments[]; duration: number; color: string; scale: number;
}) {
  const group = new THREE.Group();
  group.name = 'magic-pencil-cursor';
  group.visible = false;
  const size = options.bounds.getSize(new THREE.Vector3());
  const center = options.bounds.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 1);
  const height = Math.max(size.y, 1);
  const duration = Math.max(options.duration, 0.5);
  const bodyScale = Math.max(span * 0.065, height * 0.047, 0.7) / 2.8;
  const edges: Stroke[] = [];
  // Sample real world-space wire edges once. No geometry scans in the frame loop.
  const counts = options.lines.map(line => line.geometry.index?.count ?? line.geometry.getAttribute('position')?.count ?? 0);
  const stride = Math.max(1, Math.ceil(counts.reduce((a, b) => a + b, 0) / 12000));
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const line of options.lines) {
    line.updateWorldMatrix(true, false);
    const positions = line.geometry.getAttribute('position');
    if (!positions) continue;
    const indices = line.geometry.index;
    for (let i = 0; i + 1 < (indices?.count ?? positions.count); i += 2 * stride) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(line.matrixWorld);
      b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(line.matrixWorld);
      if (a.distanceToSquared(b) < 1e-8) continue;
      edges.push({ center: a.clone().add(b).multiplyScalar(0.5), direction: b.clone().sub(a).multiplyScalar(0.5) });
    }
  }
  const steps = Math.ceil(duration / Math.min(...CYCLES)) + 3;
  const score: Stroke[][] = [];
  for (let pencil = 0; pencil < PENCIL_COUNT; pencil++) {
    const path: Stroke[] = [];
    for (let k = 0; k < steps; k++) {
      const t = Math.min(1, Math.max(0, (k * CYCLES[pencil] - OFFSETS[pencil]) / duration));
      const angle = pencil * Math.PI * 2 / PENCIL_COUNT + t * Math.PI * (3.3 + pencil * 0.23) + 0.65 * Math.sin(k * 1.71 + pencil * 2.3);
      const desired = new THREE.Vector3(center.x + Math.cos(angle) * size.x * 0.48,
        options.bounds.min.y + height * t, center.z + Math.sin(angle) * size.z * 0.48);
      let best: Stroke | undefined, bestDistance = Infinity;
      for (const edge of edges) {
        const d = ((edge.center.x - desired.x) / span) ** 2 + ((edge.center.z - desired.z) / span) ** 2
          + 12 * ((edge.center.y - desired.y) / height) ** 2;
        if (d < bestDistance) { bestDistance = d; best = edge; }
      }
      // Fallback is used only for an empty wireframe, which remains a valid preview.
      const point = best?.center.clone() ?? desired;
      const direction = best?.direction.clone() ?? new THREE.Vector3(span * 0.012, 0, 0);
      direction.clampLength(0, span * 0.035);
      path.push({ center: point, direction });
    }
    score.push(path);
  }

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const ownGeo = <T extends THREE.BufferGeometry>(v: T) => { geometries.push(v); return v; };
  const ownMat = <T extends THREE.Material>(v: T) => { materials.push(v); return v; };
  const barrelGeo = ownGeo(new THREE.CylinderGeometry(0.16, 0.145, 1.9, 6));
  const noseGeo = ownGeo(new THREE.ConeGeometry(0.145, 0.48, 16)); noseGeo.rotateX(Math.PI);
  const nibGeo = ownGeo(new THREE.ConeGeometry(0.065, 0.22, 12)); nibGeo.rotateX(Math.PI);
  const bandGeo = ownGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 16));
  const capGeo = ownGeo(new THREE.SphereGeometry(0.16, 16, 8));
  const ringGeo = ownGeo(new THREE.RingGeometry(0.19, 0.22, 32)); ringGeo.rotateX(-Math.PI / 2);
  const metal = ownMat(new THREE.MeshStandardMaterial({ color: '#dce8f1', metalness: 0.78, roughness: 0.23 }));
  const graphite = ownMat(new THREE.MeshStandardMaterial({ color: '#132234', metalness: 0.45, roughness: 0.3 }));
  const lacquer = ownMat(new THREE.MeshStandardMaterial({ color: options.color, metalness: 0.48, roughness: 0.24 }));
  const accent = ownMat(new THREE.MeshBasicMaterial({ color: '#bcecff', transparent: true, opacity: 0.8, depthWrite: false }));
  const pencils: THREE.Group[] = [], trails: THREE.Line[] = [], rings: THREE.Mesh[] = [];
  for (let i = 0; i < PENCIL_COUNT; i++) {
    const pencil = new THREE.Group(); pencil.name = `cinematic-pencil-${i + 1}`;
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y; pencil.add(mesh); return mesh;
    };
    add(nibGeo, graphite, 0.11);
    add(noseGeo, metal, 0.46);
    add(barrelGeo, i % 2 === 0 ? lacquer : graphite, 1.64);
    add(bandGeo, metal, 0.76); add(bandGeo, metal, 2.54);
    add(capGeo, metal, 2.63);
    const ring = add(ringGeo, accent, 0.025); rings.push(ring);
    pencil.scale.setScalar(bodyScale * options.scale * (i === 0 ? 1.13 : 1));
    group.add(pencil); pencils.push(pencil);
    const geometry = ownGeo(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const colors = new Float32Array(TRAIL_POINTS * 3);
    const color = new THREE.Color(options.color).lerp(new THREE.Color('#dcf5ff'), 0.4);
    for (let j = 0; j < TRAIL_POINTS; j++) color.clone().multiplyScalar((1 - j / TRAIL_POINTS) ** 2).toArray(colors, j * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trail = new THREE.Line(geometry, ownMat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
    trail.name = `pencil-wake-${i + 1}`; trail.frustumCulled = false; group.add(trail); trails.push(trail);
  }
  const scratch = new THREE.Vector3();
  function positionAt(seconds: number, index: number, target: THREE.Vector3) {
    const beat = pencilBeat(seconds, index);
    const path = score[index];
    const from = path[Math.min(beat.cycle, path.length - 1)];
    const to = path[Math.min(beat.cycle + 1, path.length - 1)];
    if (beat.scribbling) {
      const u = beat.local / SCRIBBLE_SECONDS;
      // Four fast reversible strokes exactly on the selected wire edge; endpoints settle.
      target.copy(from.center).addScaledVector(from.direction, Math.sin(u * Math.PI * 8) * Math.sin(u * Math.PI));
    } else {
      const t = beat.travel;
      target.lerpVectors(from.center, to.center, t);
      const angle = Math.atan2(target.z - center.z, target.x - center.x);
      const lift = Math.sin(t * Math.PI);
      const radius = span * (0.065 + 0.025 * Math.sin(index * 2.3 + beat.cycle)) * lift;
      target.x += Math.cos(angle) * radius;
      target.z += Math.sin(angle) * radius;
      target.y += height * 0.012 * lift;
      // Different sideways feints on every transfer break the shared orbital cadence.
      const feint = span * 0.045 * lift * Math.sin(t * Math.PI * (2 + index % 3) + beat.cycle * 1.9 + index);
      target.x -= Math.sin(angle) * feint;
      target.z += Math.cos(angle) * feint;
      const fizz = pencilFizz(seconds, index) * span * 0.014;
      const phase = seconds * Math.PI * 2;
      target.x += fizz * (Math.sin(phase * 19 + index * 2.1) + 0.35 * Math.sin(phase * 31 + index));
      target.z += fizz * Math.sin(phase * 23 + index * 1.7);
      target.y += fizz * 0.3 * Math.sin(phase * 29 + index * 0.9);
    }
    return beat;
  }
  return {
    group,
    update(seconds: number) {
      for (let i = 0; i < pencils.length; i++) {
        const pencil = pencils[i];
        const beat = positionAt(Math.max(0, seconds), i, pencil.position);
        const energy = beat.scribbling ? Math.sin(beat.local / SCRIBBLE_SECONDS * Math.PI) : 0.5;
        const flutter = pencilFizz(seconds, i);
        // Upright nib-first attitude: bounded lean, never align the barrel to velocity.
        pencil.rotation.set(0.07 * Math.sin(seconds * 7 + i) * energy + flutter * 0.09 * Math.sin(seconds * 119 + i),
          seconds * 0.32 + i * 1.7, 0.11 * Math.cos(seconds * 6.1 + i) * energy + flutter * 0.09 * Math.cos(seconds * 137 + i));
        rings[i].visible = beat.scribbling;
        rings[i].scale.setScalar(0.8 + energy * 0.7);
        const attribute = trails[i].geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let j = 0; j < TRAIL_POINTS; j++) {
          positionAt(Math.max(0, seconds - j * 0.009), i, scratch);
          attribute.setXYZ(j, scratch.x, scratch.y, scratch.z);
        }
        attribute.needsUpdate = true;
        pencil.userData.beat = beat.scribbling ? 'scribble' : 'orbit';
      }
    },
    setScale(scale: number) { pencils.forEach((p, i) => p.scale.setScalar(bodyScale * scale * (i === 0 ? 1.13 : 1))); },
    setColor(color: string) { lacquer.color.set(color); },
    getPoses() { return pencils.map(p => ({ position: p.position.toArray(), rotation: p.rotation.toArray().slice(0, 3), beat: p.userData.beat })); },
    dispose() { group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
