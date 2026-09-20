import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { HvacNetwork } from "./hvacNetwork.ts";
import "./hvacCoordination.css";

export type HvacPreviewRun = { id: string; a: [number, number, number]; b: [number, number, number]; width: number; height: number; round: boolean; insulation: number; clash: boolean };
/** Display-only envelopes. Meshes never become measured or billable quantities. */
export function HVACNetworkViewer({ runs, beams = [], label = "HVAC network 3D preview" }: { runs: HvacPreviewRun[]; beams?: HvacNetwork["beams"]; label?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading"), [attempt, setAttempt] = useState(0);
  const serialized = JSON.stringify({ runs, beams });
  useEffect(() => {
    const element = host.current; if (!element) return;
    const data: { runs: HvacPreviewRun[]; beams: HvacNetwork["beams"] } = JSON.parse(serialized);
    const canvas = document.createElement("canvas");
    let context: WebGL2RenderingContext | null = null;
    try { context = canvas.getContext("webgl2", { antialias: true, alpha: true }); } catch { /* recoverable */ }
    if (!context) { setStatus("unavailable"); return; }
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ canvas, context, antialias: true, alpha: true }); } catch { setStatus("unavailable"); return; }
    canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", label); element.append(canvas);
    const scene = new T.Scene(), model = new T.Group(); scene.add(model);
    scene.add(new T.HemisphereLight(0xffffff, 0x334155, 3));
    const light = new T.DirectionalLight(0xffffff, 3); light.position.set(4, 8, 6); scene.add(light);
    const add = (geometry: T.BufferGeometry, color: number, opacity = 1) => { const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: .6, depthWrite: opacity === 1 })); model.add(mesh); return mesh; };
    for (const run of data.runs) {
      const a = new T.Vector3(...run.a), b = new T.Vector3(...run.b), delta = b.clone().sub(a), length = delta.length();
      if (length <= 0) continue;
      const geometry = (t: number) => run.round ? new T.CylinderGeometry(run.width / 2 + t, run.width / 2 + t, length, 32).rotateX(Math.PI / 2) : new T.BoxGeometry(run.width + 2 * t, run.height + 2 * t, length);
      const place = (mesh: T.Mesh) => { mesh.position.copy(a).add(b).multiplyScalar(.5); const forward = delta.clone().normalize(); const right = new T.Vector3(0, 1, 0).cross(forward); if (right.lengthSq() < 1e-10) right.set(1, 0, 0); right.normalize(); const up = forward.clone().cross(right).normalize(); mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, forward)); };
      const core = add(geometry(0), run.clash ? 0xef4444 : 0x38bdf8); core.userData.runId = run.id; place(core);
      if (run.insulation > 0) place(add(geometry(run.insulation), 0xfbbf24, .28));
    }
    for (const beam of data.beams) { const size = beam.max.map((v, i) => v - beam.min[i]); const mesh = add(new T.BoxGeometry(...size as [number, number, number]), 0x94a3b8, .45); mesh.position.set(...beam.min.map((v, i) => (v + beam.max[i]) / 2) as [number, number, number]); }
    const bounds = new T.Box3().setFromObject(model), center = bounds.isEmpty() ? new T.Vector3() : bounds.getCenter(new T.Vector3());
    const span = Math.max(1, bounds.isEmpty() ? 1 : bounds.getSize(new T.Vector3()).length());
    const camera = new T.PerspectiveCamera(40, 1, .01, span * 20); camera.position.copy(center).add(new T.Vector3(1, .8, 1).multiplyScalar(span * 1.2));
    const controls = new OrbitControls(camera, canvas); controls.target.copy(center); controls.enableDamping = false; controls.update();
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render(); };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const lost = (event: Event) => { event.preventDefault(); setStatus("lost"); }, restored = () => { setStatus("ready"); resize(); };
    canvas.addEventListener("webglcontextlost", lost); canvas.addEventListener("webglcontextrestored", restored);
    resize(); setStatus("ready");
    return () => { observer.disconnect(); controls.dispose(); canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); model.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } }); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); };
  }, [serialized, attempt, label]);
  return <section className="hvac-preview" aria-label={label} data-graphics-status={status} data-run-count={runs.length} data-clash-count={runs.filter(r => r.clash).length}>
    <div ref={host} className="hvac-preview-canvas" />
    {(status === "unavailable" || status === "lost") && <div role="status"><p>3D preview {status}. Your worksheet is unchanged.</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry HVAC preview</button></div>}
    <p className="industry-note">Blue: duct core · Gold: insulation envelope · Red: clearance review · Grey: beam. Drag to orbit; scroll to zoom. Display only.</p>
  </section>;
}
