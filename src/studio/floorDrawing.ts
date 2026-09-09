import * as THREE from "three";
import type { FloorPart } from "./floorConstruction";

export const FLOOR_SCRIBBLE_SECONDS = 0.1;
export type FloorStroke = { a: THREE.Vector3; b: THREE.Vector3; color: THREE.Color; part: number };
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function floorStrokes(parts: FloorPart[], shade: boolean): FloorStroke[] {
  const strokes: FloorStroke[] = [];
  parts.forEach(({ mesh }, part) => {
    mesh.updateWorldMatrix(true, false);
    const color = shade ? mesh.material.color.clone() : new THREE.Color("#3f4540");
    if (!shade) {
      const edge = new THREE.EdgesGeometry(mesh.geometry, 30),
        p = edge.getAttribute("position");
      for (let i = 0; i < p.count; i += 2)
        strokes.push({
          a: new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld),
          b: new THREE.Vector3().fromBufferAttribute(p, i + 1).applyMatrix4(mesh.matrixWorld),
          color,
          part,
        });
      edge.dispose();
      return;
    }
    const p = mesh.geometry.getAttribute("position"),
      idx = mesh.geometry.index;
    const n = idx?.count ?? p.count;
    for (let i = 0; i < n; i += 3) {
      const a = new THREE.Vector3()
        .fromBufferAttribute(p, idx ? idx.getX(i) : i)
        .applyMatrix4(mesh.matrixWorld);
      const b = new THREE.Vector3()
        .fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1)
        .applyMatrix4(mesh.matrixWorld);
      const c = new THREE.Vector3()
        .fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2)
        .applyMatrix4(mesh.matrixWorld);
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(0.002);
      // Each hatch stays inside its actual surface triangle. Alternating directions
      // produce the left/right scribble; the persistent geometry is the nib path.
      for (let row = 0; row < 7; row++) {
        const t = (row + 0.5) / 7,
          from = a.clone().lerp(c, t).add(normal),
          to = b.clone().lerp(c, t).add(normal);
        strokes.push({ a: row % 2 ? to : from, b: row % 2 ? from : to, color, part });
      }
    }
  });
  return strokes;
}

export function floorLanePose(seconds: number, index: number, count: number) {
  const cycle = 0.173 + ((index * 37) % 89) / 1000;
  const time = Math.max(0, seconds - ((index * 19) % 97) / 1000);
  const burst = Math.floor(time / cycle),
    local = time - burst * cycle;
  const perBurst = 14;
  const cursor = Math.min(count, (burst + clamp(local / FLOOR_SCRIBBLE_SECONDS)) * perBurst);
  return { cursor, contact: local < FLOOR_SCRIBBLE_SECONDS, local, cycle, burst, perBurst };
}

function vintagePencil(
  color: THREE.Color,
  colored: boolean,
  ownGeo: THREE.BufferGeometry[],
  ownMat: THREE.Material[],
) {
  const group = new THREE.Group();
  const lacquer = new THREE.MeshStandardMaterial({
    color: colored ? color : "#d5a12e",
    roughness: 0.42,
  });
  const wood = new THREE.MeshStandardMaterial({ color: "#d5b88a", roughness: 0.92 });
  const lead = new THREE.MeshStandardMaterial({
    color: colored ? color : "#333632",
    roughness: 0.8,
  });
  const ferrule = new THREE.MeshStandardMaterial({
    color: "#a9a28a",
    metalness: 0.72,
    roughness: 0.43,
  });
  const eraser = new THREE.MeshStandardMaterial({ color: "#bd7a6e", roughness: 1 });
  ownMat.push(lacquer, wood, lead, ferrule, eraser);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    ownGeo.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    group.add(mesh);
  };
  const cone = (radius: number, height: number) => {
    const g = new THREE.ConeGeometry(radius, height, 6);
    g.rotateZ(Math.PI);
    return g;
  };
  add(cone(0.023, 0.105), lead, 0.0525);
  add(cone(0.064, 0.24), wood, 0.18);
  add(new THREE.CylinderGeometry(0.063, 0.063, 0.92, 6), lacquer, 0.76);
  if (colored) add(new THREE.CylinderGeometry(0.063, 0.063, 0.055, 6), lead, 1.245);
  else {
    add(new THREE.CylinderGeometry(0.066, 0.066, 0.14, 12), ferrule, 1.28);
    for (const y of [1.23, 1.27, 1.31])
      add(new THREE.TorusGeometry(0.066, 0.003, 4, 12).rotateX(Math.PI / 2), ferrule, y);
    add(new THREE.CylinderGeometry(0.061, 0.061, 0.12, 12), eraser, 1.41);
  }
  return {
    group,
    color(c: THREE.Color) {
      if (colored) {
        lacquer.color.copy(c);
        lead.color.copy(c);
      }
    },
  };
}

/** Reversible persistent stroke buffers, with a pencil nib at each live endpoint. */
export function createFloorDrawing(strokes: FloorStroke[], colored: boolean) {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  const count = colored ? 50 : 5;
  const lanes = Array.from({ length: count }, (_, i) => {
    const path = strokes.filter((_, j) => j % count === i);
    const positions = new Float32Array(path.length * 6),
      colors = new Float32Array(path.length * 6);
    path.forEach((s, j) => {
      s.a.toArray(positions, j * 6);
      s.b.toArray(positions, j * 6 + 3);
      s.color.toArray(colors, j * 6);
      s.color.toArray(colors, j * 6 + 3);
    });
    const geo = new THREE.BufferGeometry();
    geometries.push(geo);
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true });
    materials.push(mat);
    const line = new THREE.LineSegments(geo, mat);
    line.frustumCulled = false;
    group.add(line);
    const pencil = vintagePencil(
      path[0]?.color ?? new THREE.Color("#d5a12e"),
      colored,
      geometries,
      materials,
    );
    pencil.group.scale.setScalar(colored ? 0.65 : 1);
    group.add(pencil.group);
    const duration = (Math.ceil(path.length / 14) + 1) * (0.173 + ((i * 37) % 89) / 1000) + 0.1;
    return { path, geo, pencil, duration, previous: -1, drawn: 0, contact: false };
  });
  const duration = Math.max(...lanes.map((l) => l.duration));
  const tip = new THREE.Vector3();
  return {
    group,
    duration,
    count,
    update(seconds: number, showPencils = true) {
      let drawn = 0;
      const completed = new Map<number, number>();
      lanes.forEach((lane, i) => {
        const { path, geo, pencil } = lane,
          p = geo.getAttribute("position") as THREE.BufferAttribute;
        const beat = floorLanePose(seconds, i, path.length),
          whole = Math.floor(beat.cursor),
          fraction = beat.cursor - whole;
        if (lane.previous >= 0 && lane.previous < path.length) {
          const b = path[lane.previous].b;
          p.setXYZ(lane.previous * 2 + 1, b.x, b.y, b.z);
        }
        lane.previous = whole;
        lane.drawn = whole;
        lane.contact = beat.contact;
        geo.setDrawRange(0, whole * 2 + (fraction > 0 ? 2 : 0));
        for (let j = 0; j < whole; j++)
          completed.set(path[j].part, (completed.get(path[j].part) ?? 0) + 1);
        drawn += whole;
        pencil.group.visible = showPencils && whole < path.length && seconds >= 0;
        if (!path.length) return;
        const current = path[Math.min(whole, path.length - 1)];
        tip.lerpVectors(current.a, current.b, fraction);
        if (fraction > 0) p.setXYZ(whole * 2 + 1, tip.x, tip.y, tip.z);
        p.needsUpdate = true;
        if (!beat.contact && whole < path.length) {
          const from = path[Math.max(0, whole - 1)].b,
            to = current.a;
          const u = clamp((beat.local - 0.1) / (beat.cycle - 0.1)),
            lift = Math.sin(Math.PI * u);
          tip.lerpVectors(from, to, u);
          // Aggressive spatial feints and fizz only while lifted off the surface.
          tip.x += lift * (0.65 * Math.sin(u * 19 + i) + 0.12 * Math.sin(seconds * 197 + i));
          tip.z += lift * (0.52 * Math.cos(u * 23 + i * 2) + 0.1 * Math.sin(seconds * 233 + i));
          tip.y += lift * (0.4 + 0.09 * Math.sin(seconds * 181 + i));
        }
        pencil.group.position.copy(tip);
        pencil.color(current.color);
        pencil.group.rotation.set(
          0.09 * Math.sin(seconds * 91 + i),
          i * 2.4 + seconds,
          0.12 * Math.sin(seconds * 113 + i),
        );
      });
      return { drawn, total: strokes.length, completed };
    },
    poses() {
      return lanes.map((l) => ({
        tip: l.pencil.group.position.toArray(),
        contact: l.contact,
        drawn: l.drawn,
        color: (
          l.pencil.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
        ).material.color.getHexString(),
        visible: l.pencil.group.visible,
      }));
    },
    dispose() {
      group.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
