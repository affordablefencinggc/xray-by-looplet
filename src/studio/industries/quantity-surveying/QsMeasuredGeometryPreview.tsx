import { useEffect, useRef } from "react";
import * as T from "three";

export type QsMeasuredGeometryRun = Readonly<{
  id: string;
  label: string;
  points: readonly Readonly<{ x: number; y: number }>[];
}>;

export type QsMeasuredGeometryPreviewProps = Readonly<{
  runs: readonly QsMeasuredGeometryRun[];
  selectedRunId: string | null;
}>;

type PreviewApi = {
  update: (runs: readonly QsMeasuredGeometryRun[], selectedRunId: string | null) => void;
};

const MODEL_SPAN = 8;
const WALL_HEIGHT = 0.72;
const WALL_THICKNESS = 0.12;

/**
 * Compact, read-only 3D context for measured project runs.
 *
 * Source-page coordinates are normalised only for presentation. The mesh keeps
 * every real run segment and its entity id, but makes no scale or verification
 * claim of its own.
 */
export function QsMeasuredGeometryPreview({ runs, selectedRunId }: QsMeasuredGeometryPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<PreviewApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Measured geometry 3D model");
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.dataset.qsHighlightSurface = "model-3d";
    Object.assign(renderer.domElement.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });
    host.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.05, 100);
    const model = new T.Group();
    scene.add(model);

    const hemisphere = new T.HemisphereLight("#f8fafc", "#334155", 2.1);
    const key = new T.DirectionalLight("#fff7e7", 3.2);
    key.position.set(-5, 9, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 30 });
    scene.add(hemisphere, key, key.target);

    const ground = new T.Mesh(
      new T.PlaneGeometry(12, 12),
      new T.MeshStandardMaterial({ color: "#e8e3d8", roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new T.GridHelper(12, 24, "#8fb3cc", "#d4cbb8");
    grid.position.y = -0.015;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.3;
    }
    scene.add(grid);

    const render = () => renderer.render(scene, camera);

    const clearModel = () => {
      const geometries = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      model.traverse((object) => {
        if (!(object instanceof T.Mesh) && !(object instanceof T.LineSegments)) return;
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of objectMaterials) materials.add(material);
      });
      model.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    };

    const update: PreviewApi["update"] = (nextRuns, nextSelectedRunId) => {
      clearModel();

      const finitePoints = nextRuns.flatMap((run) =>
        run.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      );
      const minX = finitePoints.length ? Math.min(...finitePoints.map((point) => point.x)) : 0;
      const maxX = finitePoints.length ? Math.max(...finitePoints.map((point) => point.x)) : 1;
      const minY = finitePoints.length ? Math.min(...finitePoints.map((point) => point.y)) : 0;
      const maxY = finitePoints.length ? Math.max(...finitePoints.map((point) => point.y)) : 1;
      const sourceSpan = Math.max(maxX - minX, maxY - minY, Number.EPSILON);
      const scale = MODEL_SPAN / sourceSpan;
      const centreX = (minX + maxX) / 2;
      const centreY = (minY + maxY) / 2;
      const selectedExists =
        nextSelectedRunId !== null && nextRuns.some((run) => run.id === nextSelectedRunId);
      let meshCount = 0;

      for (const run of nextRuns) {
        const selected = selectedExists && run.id === nextSelectedRunId;
        for (let index = 1; index < run.points.length; index += 1) {
          const start = run.points[index - 1];
          const end = run.points[index];
          if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) continue;

          const startX = (start.x - centreX) * scale;
          const startZ = (start.y - centreY) * scale;
          const endX = (end.x - centreX) * scale;
          const endZ = (end.y - centreY) * scale;
          const deltaX = endX - startX;
          const deltaZ = endZ - startZ;
          const length = Math.hypot(deltaX, deltaZ);
          if (length <= Number.EPSILON) continue;

          const geometry = new T.BoxGeometry(
            length,
            selected ? WALL_HEIGHT * 1.14 : WALL_HEIGHT,
            selected ? WALL_THICKNESS * 1.45 : WALL_THICKNESS,
          );
          const material = new T.MeshStandardMaterial({
            color: selected ? "#e8b339" : "#6e9bb8",
            emissive: selected ? "#6b3f08" : "#000000",
            emissiveIntensity: selected ? 0.32 : 0,
            roughness: selected ? 0.38 : 0.66,
            metalness: selected ? 0.12 : 0.04,
          });
          const wall = new T.Mesh(geometry, material);
          wall.name = `${run.label} segment ${index}`;
          wall.userData.entityId = run.id;
          wall.position.set(
            (startX + endX) / 2,
            (selected ? WALL_HEIGHT * 1.14 : WALL_HEIGHT) / 2,
            (startZ + endZ) / 2,
          );
          wall.rotation.y = -Math.atan2(deltaZ, deltaX);
          wall.castShadow = true;
          wall.receiveShadow = true;
          model.add(wall);

          const outline = new T.LineSegments(
            new T.EdgesGeometry(geometry),
            new T.LineBasicMaterial({
              color: selected ? "#fff2b2" : "#33546a",
              transparent: true,
              opacity: selected ? 0.95 : 0.48,
            }),
          );
          outline.position.copy(wall.position);
          outline.rotation.copy(wall.rotation);
          outline.userData.entityId = run.id;
          model.add(outline);
          meshCount += 1;
        }
      }

      renderer.domElement.dataset.meshCount = String(meshCount);
      if (selectedExists) {
        renderer.domElement.dataset.highlightedEntity = nextSelectedRunId;
      } else {
        delete renderer.domElement.dataset.highlightedEntity;
      }

      const bounds = new T.Box3().setFromObject(model);
      const centre = bounds.isEmpty() ? new T.Vector3() : bounds.getCenter(new T.Vector3());
      const size = bounds.isEmpty()
        ? new T.Vector3(MODEL_SPAN, WALL_HEIGHT, MODEL_SPAN)
        : bounds.getSize(new T.Vector3());
      const radius = Math.max(size.x, size.z, size.y * 2, 2);
      camera.position
        .copy(centre)
        .add(new T.Vector3(0.88, 0.82, 1).normalize().multiplyScalar(radius * 1.45));
      camera.lookAt(centre.x, Math.min(centre.y, WALL_HEIGHT * 0.45), centre.z);
      camera.near = Math.max(radius / 200, 0.02);
      camera.far = Math.max(radius * 12, 50);
      camera.updateProjectionMatrix();
      render();
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(Math.round(bounds.width), 1);
      const height = Math.max(Math.round(bounds.height), 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    apiRef.current = { update };
    resize();

    return () => {
      resizeObserver.disconnect();
      clearModel();
      ground.geometry.dispose();
      (ground.material as T.Material).dispose();
      grid.geometry.dispose();
      for (const material of gridMaterials) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.update(runs, selectedRunId);
  }, [runs, selectedRunId]);

  return (
    <div
      ref={hostRef}
      className="qs-measured-model"
    />
  );
}
