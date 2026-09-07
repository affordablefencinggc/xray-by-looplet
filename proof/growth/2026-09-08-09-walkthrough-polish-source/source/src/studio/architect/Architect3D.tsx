import { useEffect, useRef } from "react";
import * as T from "three";
import { useState } from "react";
import { createFirstPersonNavigation } from "../FirstPersonNavigation";
import type { NavigationMode } from "../navigationMovement";
import type { WalkStart } from "../WalkStartDialog";
import { ArchitectWalkStart } from "./ArchitectWalkStart";
import { createWalkCollisionWorld, type WalkCollisionWorld } from "../walkCollision";
import { createWalkDoors, type WalkDoorState } from "../WalkDoors";
import { WalkDoorPrompt } from "../WalkDoorPrompt";
import { createFirstPersonArm } from "../FirstPersonArm";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { wallSolids, roofFaces, roofTrims, type Polygon } from "./geometry";
import { unit, add, mul, wallThickness, type ArchitectProject, type Point } from "./model";
function extrude(poly: Polygon, bottom: number, top: number) {
  const shape = new T.Shape(poly[0].map(([x, y]) => new T.Vector2(x / 1000, -y / 1000)));
  for (const h of poly.slice(1))
    shape.holes.push(new T.Path(h.map(([x, y]) => new T.Vector2(x / 1000, -y / 1000))));
  const g = new T.ExtrudeGeometry(shape, { depth: (top - bottom) / 1000, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom / 1000, 0);
  return g;
}
export function Architect3D({
  project,
  levelId,
  selected,
  onSelect,
  roofVisible,
  fitToken,
}: {
  project: ArchitectProject;
  levelId: string;
  selected: string | null;
  onSelect: (id: string) => void;
  roofVisible: boolean;
  fitToken: number;
}) {
  const [mode, setMode] = useState<NavigationMode>("orbit");
  const [capture, setCapture] = useState<"locked" | "drag" | null>(null);
  const [walkPicker, setWalkPicker] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [doorState, setDoorState] = useState<WalkDoorState | null>(null);
  const host = useRef<HTMLDivElement>(null),
    api = useRef<{
      update: (p: ArchitectProject, l: string, s: string | null, r: boolean) => void;
      fit: () => void;
      navigate: (mode: "fly" | "walk", start?: WalkStart) => Promise<void>;
      capture: () => Promise<boolean>;
      stop: () => void;
      interactDoor: () => void;
    } | null>(null),
    pick = useRef(onSelect);
  pick.current = onSelect;
  useEffect(() => {
    const el = host.current!;
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Live architectural 3D model");
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color("#e4e6e9");
    const camera = new T.PerspectiveCamera(38, 1, 0.05, 2000),
      controls = new OrbitControls(camera, renderer.domElement),
      group = new T.Group();
    scene.add(group);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI * 0.49;
    const hemi = new T.HemisphereLight("#ffffff", "#96968c", 2.2),
      sun = new T.DirectionalLight("#fff7e7", 3);
    sun.position.set(-12, 22, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 100 });
    sun.shadow.normalBias = 0.025;
    scene.add(hemi, sun, sun.target);
    const ground = new T.Mesh(
      new T.PlaneGeometry(2000, 2000),
      new T.MeshStandardMaterial({ color: "#e3e4df", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    scene.add(ground);
    let frame = 0,
      disposed = false,
      initial = true;
    let navigation: ReturnType<typeof createFirstPersonNavigation> | null = null;
    let walkWorld: WalkCollisionWorld | null = null;
    let doors: ReturnType<typeof createWalkDoors> | null = null;
    let arm: ReturnType<typeof createFirstPersonArm> | null = null;
    let currentDoorState: WalkDoorState | null = null;
    const navigationBounds = new T.Box3();
    let floorElevation = 0;
    const render = () => {
        frame = 0;
        if (disposed) return;
        const moving = navigation && navigation.mode !== "orbit" ? navigation.tick() : controls.update();
        const doorMoving = doors?.tick(navigation?.mode === "walk" && renderer.domElement.dataset.navigationTransition === "idle");
        arm?.tick(navigation?.mode === "walk" ? currentDoorState : null);
        renderer.render(scene, camera);
        renderer.domElement.dataset.cameraPosition = camera.position.toArray().join(",");
        renderer.domElement.dataset.frameCount = String(
          Number(renderer.domElement.dataset.frameCount ?? 0) + 1,
        );
        if (moving || doorMoving) invalidate();
      },
      invalidate = () => {
        if (!frame && !disposed) frame = requestAnimationFrame(render);
      };
    controls.addEventListener("change", invalidate);
    arm = createFirstPersonArm({ scene, camera, canvas: renderer.domElement, invalidate });
    navigation = createFirstPersonNavigation({
      canvas: renderer.domElement, camera, bounds: navigationBounds,
      floor: () => floorElevation, invalidate,
      onCaptureChange: setCapture,
      walkWorld: () => walkWorld,
      onInteract: () => doors?.interact(),
      interactionBusy: () => doors?.busy ?? false,
      onChange(next) {
        controls.enabled = next === "orbit";
        if (next === "orbit") {
          controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new T.Vector3()), 3);
          controls.update();
        }
        setMode(next);
      },
    });
    const fit = () => {
      navigation?.stop();
      const b = new T.Box3().setFromObject(group);
      if (b.isEmpty()) {
        b.min.set(0, 0, 0);
        b.max.set(9, 2.7, 6);
      }
      const c = b.getCenter(new T.Vector3()),
        s = b.getSize(new T.Vector3()),
        dist =
          (Math.max(s.x / camera.aspect, s.z, s.y, 3) /
            Math.tan(T.MathUtils.degToRad(camera.fov / 2))) *
          0.9;
      camera.position.copy(c).add(new T.Vector3(0.85, 0.85, 1.15).normalize().multiplyScalar(dist));
      controls.target.copy(c);
      camera.lookAt(c);
      controls.update();
      invalidate();
    };
    const clear = () => {
      group.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
      group.clear();
    };
    function update(p: ArchitectProject, l: string, s: string | null, roofs: boolean) {
      navigation?.stop();
      doors?.dispose(); doors = null; walkWorld = null;
      clear();
      const solids: T.Mesh[] = [], supports: T.Mesh[] = [];
      const doorLeaves: Parameters<typeof createWalkDoors>[0]["doors"][number][] = [];
      const mesh = (g: T.BufferGeometry, id: string, color: string, opacity = 1) => {
        const material = new T.MeshStandardMaterial({
            color: id === s ? "#bd7053" : color,
            roughness: 0.7,
            metalness: opacity < 1 ? 0.1 : 0,
            opacity,
            transparent: opacity < 1,
            depthWrite: opacity === 1,
            side: T.DoubleSide,
          }),
          m = new T.Mesh(g, material);
        m.userData.entityId = id;
        m.castShadow = opacity === 1;
        m.receiveShadow = true;
        group.add(m);
        solids.push(m);
        return m;
      };
      for (const solid of wallSolids(p).filter(
        (w) => w.kind !== "void" && (l === "all" || w.levelId === l),
      ))
        for (const poly of solid.polygons)
          mesh(
            extrude(poly, solid.bottom, solid.top),
            solid.wallId,
            solid.hatch === "brick" ? "#bba58c" : solid.hatch === "timber" ? "#bba581" : "#dedbd1",
          );
      for (const slab of p.slabs.filter((s) => l === "all" || s.levelId === l)) {
        const elevation = p.levels.find((l) => l.id === slab.levelId)!.elevation + slab.offset;
        supports.push(mesh(extrude([slab.points], elevation - slab.thickness, elevation), slab.id, "#b5b7b3"));
      }
      const beam = (
        a: Point,
        b: Point,
        bottom: number,
        height: number,
        thickness: number,
        id: string,
        color: string,
        opacity = 1,
      ) => {
        const g = new T.BoxGeometry(
          Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000,
          height / 1000,
          thickness / 1000,
        );
        g.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
        g.translate((a[0] + b[0]) / 2000, (bottom + height / 2) / 1000, (a[1] + b[1]) / 2000);
        return mesh(g, id, color, opacity);
      };
      for (const o of p.openings) {
        const w = p.walls.find((w) => w.id === o.wallId)!;
        if (l !== "all" && w.levelId !== l) continue;
        const y = p.levels.find((l) => l.id === w.levelId)!.elevation + o.sill,
          d = unit(w.a, w.b),
          a = add(w.a, mul(d, o.offset - o.width / 2)),
          b = add(a, mul(d, o.width));
        beam(a, add(a, mul(d, 40)), y, o.height, wallThickness(w), o.id, "#717e81");
        beam(add(b, mul(d, -40)), b, y, o.height, wallThickness(w), o.id, "#717e81");
        beam(a, b, y + o.height - 40, 40, wallThickness(w), o.id, "#717e81");
        if (o.kind === "window") {
          beam(a, b, y, 40, wallThickness(w), o.id, "#717e81");
          beam(a, b, y + 40, o.height - 80, 12, o.id, "#aac6c9", 0.5);
        } else {
          const hinge = o.hinge === "left" ? a : b;
          const leaf = beam(add(a, mul(d, 40)), add(b, mul(d, -40)), y + 5, o.height - 45, 40, o.id, "#c6c1b6");
          doorLeaves.push({ id: o.id, label: "Door", meshes: [leaf], motion: "swing",
            hinge: new T.Vector3(hinge[0] / 1000, y / 1000, hinge[1] / 1000),
            swingAngle: (o.hinge === "left" ? -1 : 1) * (o.swing === "in" ? 1 : -1) * Math.PI / 2 });
        }
      }
      if (roofs)
        for (const r of p.roofs.filter((r) => l === "all" || r.levelId === l)) {
          const y = p.levels.find((l) => l.id === r.levelId)!.elevation + r.offset;
          for (const f of roofFaces(r)) {
            const positions = [];
            for (let i = 1; i < f.points.length - 1; i++)
              for (const k of [0, i, i + 1])
                positions.push(
                  f.points[k][0] / 1000,
                  (y + f.heights[k]) / 1000,
                  f.points[k][1] / 1000,
                );
            const g = new T.BufferGeometry();
            g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
            g.computeVertexNormals();
            mesh(g, r.id, "#677175");
            const crease = new T.LineSegments(
              new T.EdgesGeometry(g, 15),
              new T.LineBasicMaterial({ color: "#b4bdbb", transparent: true, opacity: 0.55 }),
            );
            crease.userData.entityId = r.id;
            group.add(crease);
          }
        }
      if (roofs)
        for (const r of p.roofs.filter((r) => l === "all" || r.levelId === l)) {
          const y = p.levels.find((l) => l.id === r.levelId)!.elevation + r.offset;
          for (const trim of roofTrims(r)) {
            const positions: number[] = [];
            for (const face of trim.faces)
              for (let i = 1; i < face.length - 1; i++)
                for (const k of [0, i, i + 1])
                  positions.push(face[k][0] / 1000, (y + face[k][1]) / 1000, face[k][2] / 1000);
            const g = new T.BufferGeometry();
            g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
            g.computeVertexNormals();
            mesh(g, r.id, trim.kind === "fascia" ? "#b4b8af" : "#617073");
          }
        }
      const b = new T.Box3().setFromObject(group);
      walkWorld = createWalkCollisionWorld({ solids: () => solids, supports: () => supports });
      doors = createWalkDoors({ doors: doorLeaves, camera, canvas: renderer.domElement,
        solids: () => solids, onChange: (state) => { currentDoorState = state; setDoorState(state); }, invalidate });
      ground.position.y = b.isEmpty() ? -0.3 : b.min.y - 0.01;
      navigationBounds.copy(b);
      if (b.isEmpty()) navigationBounds.set(new T.Vector3(0, 0, 0), new T.Vector3(9, 2.7, 6));
      const nextFloor = (p.levels.find((level) => level.id === l) ?? p.levels[0]).elevation / 1000;
      if (nextFloor !== floorElevation) navigation?.stop();
      floorElevation = nextFloor;
      renderer.domElement.dataset.projectRevision = String(p.revision);
      renderer.domElement.dataset.meshCount = String(group.children.length);
      renderer.domElement.dataset.selected = s ?? "";
      if (initial) {
        initial = false;
        fit();
      }
      invalidate();
    }
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(Math.max(r.width, 1), Math.max(r.height, 1));
      camera.aspect = Math.max(r.width, 1) / Math.max(r.height, 1);
      camera.updateProjectionMatrix();
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    let down = [0, 0];
    const pointerDown = (e: PointerEvent) => {
        down = [e.clientX, e.clientY];
      },
      pointerUp = (e: PointerEvent) => {
        if (navigation?.mode !== "orbit") return;
        if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
        const r = renderer.domElement.getBoundingClientRect(),
          ray = new T.Raycaster();
        ray.setFromCamera(
          new T.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            (-(e.clientY - r.top) / r.height) * 2 + 1,
          ),
          camera,
        );
        const hit = ray.intersectObjects(group.children)[0];
        if (hit) pick.current(hit.object.userData.entityId);
      };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    api.current = { update, fit, navigate: (mode, start) => navigation!.start(mode, start), capture: () => navigation!.capture(), stop: () => navigation?.stop(), interactDoor: () => doors?.interact() };
    resize();
    return () => {
      disposed = true;
      navigation?.dispose();
      doors?.dispose();
      arm?.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      clear();
      ground.geometry.dispose();
      (ground.material as T.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(() => {
    api.current?.update(project, levelId, selected, roofVisible);
  }, [project, levelId, selected, roofVisible]);
  useEffect(() => {
    api.current?.fit();
  }, [fitToken]);
  function navigate(next: "fly" | "walk", start?: WalkStart) {
    setWalkPicker(false);
    setNavigationError(null);
    void api.current?.navigate(next, start).catch((e) => setNavigationError(String(e.message)));
  }
  return <div className="architect-3d">
    <div className="architect-3d-render" ref={host} />
    <div className="arch-navigation" aria-label="Architectural 3D navigation">
      <button aria-pressed={mode === "orbit"} onClick={() => api.current?.stop()}>Orbit</button>
      <button aria-pressed={mode === "fly"} onClick={() => navigate("fly")}>Fly</button>
      <button aria-pressed={mode === "walk"} onClick={() => { api.current?.stop(); setWalkPicker(true); }}>Walk-through</button>
      {mode !== "orbit" && capture === "drag" && <button onClick={() => { void api.current?.capture(); }}>Capture mouse</button>}
    </div>
    {mode !== "orbit" && <div className="architect-walk-overlay">
      {mode === "walk" && <WalkDoorPrompt state={doorState} onInteract={() => api.current?.interactDoor()} />}
      <p className="architect-3d-caption">WASD move · {capture === "locked" ? "mouse look" : "drag to look · Capture mouse for free look"} · Shift faster · Esc or Orbit to exit{mode === "fly" ? " · Space/Ctrl altitude" : " · solid boundaries · E opens doors"}</p>
    </div>}
    {navigationError && <p role="alert" className="architect-3d-caption">{navigationError}</p>}
    {walkPicker && <ArchitectWalkStart project={project} initialLevel={levelId} onClose={() => setWalkPicker(false)} onStart={(point) => navigate("walk", point)} />}
  </div>;
}
