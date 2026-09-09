import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createFloorComponents, FLOOR_STAGES } from "./floorConstruction";
import { createFloorDrawing, floorStrokes } from "./floorDrawing";
import "./floorConstruction.css";

type Status = {
  time: number;
  total: number;
  stage: number;
  pass: string;
  drawn: number;
  strokes: number;
  pencils: number;
  parts: number;
  fps: number;
  playing: boolean;
};
type FloorApi = {
  seek: (time: number) => void;
  play: (on: boolean) => void;
  speed: (value: number) => void;
  stage: (index: number) => void;
  expose: (on: boolean) => void;
  shadows: (on: boolean) => void;
  background: (color: string) => void;
  fit: () => void;
  plan: () => void;
  capture: () => void;
  dispose: () => void;
};

function createStudio(host: HTMLDivElement, onStatus: (s: Status) => void): FloorApi {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-label", "One-floor construction model");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e8e5db");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  camera.position.set(14, 13, 17);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, 0);
  controls.enableDamping = true;
  controls.minDistance = 5;
  controls.maxDistance = 38;
  controls.maxPolarAngle = Math.PI * 0.49;
  const ambient = new THREE.HemisphereLight("#fff7e3", "#7f8789", 2.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff1d8", 3.5);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 1,
    far: 40,
  });
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d8e6ef", 1.1);
  fill.position.set(8, 6, -8);
  scene.add(fill);
  const floor = createFloorComponents();
  scene.add(floor.group);
  const floorGeo = new THREE.PlaneGeometry(200, 200),
    floorMat = new THREE.MeshStandardMaterial({ color: "#dedbd1", roughness: 1 });
  const ground = new THREE.Mesh(floorGeo, floorMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.9;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(16, 32, "#acae9e", "#cbcdc1");
  grid.position.y = -0.895;
  scene.add(grid);
  // Fine deterministic aggregate: real material texture, not a photographic asset.
  const paper = document.createElement("canvas");
  paper.width = paper.height = 128;
  const ctx = paper.getContext("2d")!;
  const pixels = ctx.createImageData(128, 128);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = 205 + (((i * 97) ^ ((i >>> 4) * 13)) % 38);
    pixels.data.set([v, v, v, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const concrete = new THREE.CanvasTexture(paper);
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  concrete.repeat.set(5, 5);
  concrete.colorSpace = THREE.SRGBColorSpace;
  floor.parts
    .filter((p) => p.id.startsWith("Concrete"))
    .forEach((p) => {
      p.mesh.material.map = concrete;
      p.mesh.material.bumpMap = concrete;
      p.mesh.material.bumpScale = 0.014;
    });
  const stages = FLOOR_STAGES.map((stage) => {
    const parts = floor.parts.filter((p) => p.stage === stage.id),
      wire = floorStrokes(parts, false),
      shade = floorStrokes(parts, true);
    const duration = (n: number, count: number) =>
      Math.max(
        ...Array.from(
          { length: count },
          (_, i) =>
            (Math.ceil(Math.ceil(Math.max(0, n - i) / count) / 14) + 1) *
              (0.173 + ((i * 37) % 89) / 1000) +
            0.1,
        ),
      );
    return {
      parts,
      wire,
      shade,
      wireDuration: duration(wire.length, 5),
      shadeDuration: duration(shade.length, 50),
      start: 0,
      end: 0,
    };
  });
  let total = 0;
  stages.forEach((s) => {
    s.start = total;
    total += s.wireDuration + s.shadeDuration + 0.65;
    s.end = total;
  });
  let time = 0,
    playing = !matchMedia("(prefers-reduced-motion: reduce)").matches,
    speed = 1,
    expose = false,
    active = -1;
  let drawing: ReturnType<typeof createFloorDrawing> | null = null,
    shading: ReturnType<typeof createFloorDrawing> | null = null;
  let last = performance.now(),
    lastStatus = 0,
    frame = 0,
    disposed = false,
    fps = 60;
  function paint(now: number) {
    frame = 0;
    if (disposed) return;
    const delta = Math.min((now - last) / 1000, 0.08);
    last = now;
    fps = fps * 0.95 + (1 / Math.max(0.001, delta)) * 0.05;
    if (playing && !document.hidden) time = Math.min(total, time + delta * speed);
    const index = Math.min(
        stages.findIndex((s) => time < s.end) === -1
          ? stages.length - 1
          : stages.findIndex((s) => time < s.end),
        stages.length - 1,
      ),
      stage = stages[index];
    if (index !== active) {
      drawing?.dispose();
      shading?.dispose();
      active = index;
      drawing = createFloorDrawing(stage.wire, false);
      shading = createFloorDrawing(stage.shade, true);
      scene.add(drawing.group, shading.group);
    }
    const local = time - stage.start,
      ink = local < stage.wireDuration,
      shadeTime = local - stage.wireDuration;
    drawing!.group.visible = shadeTime < stage.shadeDuration;
    shading!.group.visible = !ink && shadeTime < stage.shadeDuration;
    if (!ink) drawing!.update(stage.wireDuration, false);
    const result = ink
      ? drawing!.update(local)
      : shading!.update(shadeTime, shadeTime < stage.shadeDuration);
    const partTotals = new Map<number, number>();
    stage.shade.forEach((s) => partTotals.set(s.part, (partTotals.get(s.part) ?? 0) + 1));
    floor.parts.forEach((p) => {
      const order = FLOOR_STAGES.findIndex((s) => s.id === p.stage);
      p.mesh.visible =
        order < index ||
        (order === index &&
          !ink &&
          (result.completed.get(stage.parts.indexOf(p)) ?? 0) >=
            (partTotals.get(stage.parts.indexOf(p)) ?? Infinity));
      if (expose && p.id === "Concrete floor slab") p.mesh.visible = false;
      if (expose && ["gyprock", "painting", "flooring", "insulation"].includes(p.stage))
        p.mesh.visible = false;
    });
    const pass =
      time >= total
        ? "Complete"
        : ink
          ? "Graphite drawing"
          : shadeTime < stage.shadeDuration
            ? "Colour shading"
            : "Material resolved";
    const pencilCount = time >= total || pass === "Material resolved" ? 0 : ink ? 5 : 50;
    Object.assign(renderer.domElement.dataset, {
      floorReady: "true",
      floorStage: FLOOR_STAGES[index].id,
      floorPass: pass,
      floorTime: String(time),
      floorTotal: String(total),
      floorPencils: String(pencilCount),
      floorStrokes: String(result.drawn),
      floorStrokeTotal: String(result.total),
      floorParts: String(floor.parts.filter((p) => p.mesh.visible).length),
      floorScribbleSeconds: ".1",
      floorExposed: String(expose),
    });
    if (now - lastStatus > 100) {
      lastStatus = now;
      onStatus({
        time,
        total,
        stage: index,
        pass,
        drawn: result.drawn,
        strokes: result.total,
        pencils: pencilCount,
        parts: floor.parts.filter((p) => p.mesh.visible).length,
        fps: Math.round(fps),
        playing: playing && time < total,
      });
    }
    const moving = controls.update();
    renderer.render(scene, camera);
    if ((playing && time < total) || moving) invalidate();
  }
  function invalidate() {
    if (!disposed && !frame) frame = requestAnimationFrame(paint);
  }
  controls.addEventListener("change", invalidate);
  let viewportScale = 1;
  const fitFloor = () => {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0.7, 0);
    camera.position
      .set(14, 13, 17)
      .sub(controls.target)
      .multiplyScalar(viewportScale)
      .add(controls.target);
    controls.maxDistance = Math.max(38, 32 * viewportScale);
    controls.update();
  };
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(height, 1);
    const nextScale = Math.max(1, 1.3 / camera.aspect);
    camera.position
      .sub(controls.target)
      .multiplyScalar(nextScale / viewportScale)
      .add(controls.target);
    viewportScale = nextScale;
    controls.maxDistance = Math.max(38, 32 * viewportScale);
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  });
  resize.observe(host);
  const api: FloorApi = {
    seek(t) {
      time = Math.max(0, Math.min(total, t));
      playing = false;
      lastStatus = 0;
    },
    play(on) {
      if (on && time >= total) time = 0;
      playing = on;
      lastStatus = 0;
    },
    speed(v) {
      speed = v;
    },
    stage(i) {
      time = stages[Math.max(0, Math.min(stages.length - 1, i))].start;
      playing = true;
      lastStatus = 0;
    },
    expose(on) {
      expose = on;
      lastStatus = 0;
    },
    shadows(on) {
      renderer.shadowMap.enabled = on;
      renderer.domElement.dataset.floorShadows = String(on);
    },
    background(color) {
      scene.background = new THREE.Color(color);
      floorMat.color.set(color);
      renderer.domElement.dataset.floorBackground = color;
    },
    fit: fitFloor,
    plan() {
      camera.position.set(0, 23 * viewportScale, 0.01);
      controls.target.set(0, 0, 0);
      controls.update();
    },
    capture() {
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.href = renderer.domElement.toDataURL("image/png");
      link.download = "one-floor-construction.png";
      link.click();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      drawing?.dispose();
      shading?.dispose();
      floor.dispose();
      concrete.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete (window as unknown as Record<string, unknown>).__floorStudio;
    },
  };
  for (const [key, fn] of Object.entries(api))
    if (key !== "dispose") {
      (api as unknown as Record<string, (...args: unknown[]) => void>)[key] = (...args) => {
        (fn as (...args: unknown[]) => void)(...args);
        invalidate();
      };
    }
  (window as unknown as Record<string, unknown>).__floorStudio = {
    ...api,
    stages: stages.map((s, i) => ({
      id: FLOOR_STAGES[i].id,
      start: s.start,
      end: s.end,
      wireDuration: s.wireDuration,
      shadeDuration: s.shadeDuration,
      parts: s.parts.length,
    })),
    poses: () =>
      (time - stages[active].start < stages[active].wireDuration ? drawing : shading)?.poses(),
  };
  frame = requestAnimationFrame(paint);
  return api;
}

export function FloorConstructionStudio() {
  const host = useRef<HTMLDivElement>(null),
    api = useRef<FloorApi | null>(null);
  const [status, setStatus] = useState<Status>({
    time: 0,
    total: 1,
    stage: 0,
    pass: "Preparing floor",
    drawn: 0,
    strokes: 0,
    pencils: 5,
    parts: 0,
    fps: 0,
    playing: true,
  });
  const [playing, setPlaying] = useState(true),
    [exposed, setExposed] = useState(false),
    [settings, setSettings] = useState(false),
    [shadow, setShadow] = useState(true),
    [background, setBackground] = useState("#e8e5db"),
    [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    try {
      api.current = createStudio(host.current, (s) => {
        setStatus(s);
        setPlaying(s.playing);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      api.current?.dispose();
      api.current = null;
    };
  }, []);
  const stage = FLOOR_STAGES[status.stage];
  return (
    <main className="floor-studio">
      <header className="floor-header">
        <Link to="/" aria-label="Back to X-Ray">
          X-RAY <span>/ MATERIAL STUDIES</span>
        </Link>
        <span className="floor-edition">01 / THE APARTMENT</span>
        <button
          onClick={() => {
            api.current?.capture();
          }}
        >
          Export image
        </button>
      </header>
      <div className="floor-workspace">
        <aside className="floor-story">
          <p className="floor-kicker">FROM A LINE TO A LIVED-IN SPACE</p>
          <h1>
            One floor.
            <br />
            Every layer.
          </h1>
          <p className="floor-intro">
            Watch the pencils draw, shade and assemble an apartment, component by component.
          </p>
          <nav aria-label="Construction stages">
            {FLOOR_STAGES.map((s, i) => (
              <button
                key={s.id}
                aria-current={status.stage === i ? "step" : undefined}
                onClick={() => {
                  api.current?.stage(i);
                  setPlaying(true);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{s.title}</strong>
                <i>{status.stage > i ? "✓" : status.stage === i ? "●" : "·"}</i>
              </button>
            ))}
          </nav>
          <p className="floor-provenance">
            ILLUSTRATIVE STUDY · 12 × 9 M<br />
            An authored apartment cutaway. Construction order is illustrative; this is not a
            surveyed building or installation plan.
          </p>
        </aside>
        <section className="floor-view" aria-label="Construction studio">
          <div className="floor-view-heading">
            <div>
              <span className="floor-kicker">
                {String(status.stage + 1).padStart(2, "0")} / {stage.title.toUpperCase()}
              </span>
              <h2>{status.pass}</h2>
            </div>
            <span className="floor-live">
              {status.pencils ? `${status.pencils} PENCILS · 0.1 S BURSTS` : "MATERIALS IN PLACE"}
            </span>
          </div>
          <div ref={host} className="floor-canvas" />
          {error && (
            <p role="alert" className="floor-error">
              {error}
            </p>
          )}
          <div className="floor-camera-controls">
            <button onClick={() => api.current?.fit()}>Fit floor</button>
            <button onClick={() => api.current?.plan()}>Plan view</button>
            <button
              aria-pressed={exposed}
              onClick={() => {
                setExposed(!exposed);
                api.current?.expose(!exposed);
              }}
            >
              Expose services
            </button>
            <button aria-expanded={settings} onClick={() => setSettings(!settings)}>
              Visual settings
            </button>
          </div>
          {settings && (
            <div className="floor-settings">
              <label>
                Backdrop
                <select
                  aria-label="Floor backdrop"
                  value={background}
                  onChange={(e) => {
                    setBackground(e.target.value);
                    api.current?.background(e.target.value);
                  }}
                >
                  <option value="#e8e5db">Warm paper</option>
                  <option value="#b9c9cb">Blue grey</option>
                  <option value="#333b3c">Charcoal</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shadow}
                  onChange={(e) => {
                    setShadow(e.target.checked);
                    api.current?.shadows(e.target.checked);
                  }}
                />{" "}
                Cast shadows
              </label>
              <button
                onClick={() => {
                  setBackground("#e8e5db");
                  setShadow(true);
                  api.current?.background("#e8e5db");
                  api.current?.shadows(true);
                }}
              >
                Reset appearance
              </button>
            </div>
          )}
          <div className="floor-caption">
            <p>{stage.detail}</p>
            <span>{status.parts} components placed · Drag to orbit · Scroll to zoom</span>
          </div>
          <div className="floor-playback">
            <button
              aria-label={
                playing && status.time < status.total ? "Pause construction" : "Play construction"
              }
              onClick={() => {
                const next = !(playing && status.time < status.total);
                setPlaying(next);
                api.current?.play(next);
              }}
            >
              {playing && status.time < status.total ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                api.current?.seek(0);
                api.current?.play(true);
                setPlaying(true);
              }}
            >
              Replay
            </button>
            <input
              aria-label="Construction progress"
              type="range"
              min="0"
              max={status.total}
              step=".01"
              value={status.time}
              onChange={(e) => {
                api.current?.seek(Number(e.target.value));
                setPlaying(false);
              }}
            />
            <span>{Math.round((status.time / status.total) * 100)}%</span>
            <select
              aria-label="Construction speed"
              defaultValue="1"
              onChange={(e) => api.current?.speed(Number(e.target.value))}
            >
              <option value=".5">½×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
            <button
              onClick={() => {
                api.current?.seek(status.total);
                setPlaying(false);
              }}
            >
              Finish
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
