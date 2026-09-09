import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box, Download, Expand, Layers, MousePointer2, Pencil, ScanLine, X, ZoomIn, ZoomOut } from "lucide-react";
import { useStudio } from "./store";
import { inspectPlanBytes } from "./documents";
import {
  BUILDING_CATALOG,
  ROOF_CATEGORIES,
  WALL_CATEGORIES,
  fetchBuildingBytes,
  parseSourceBuilding,
  sourceBytesMatch,
  type SourceBuilding,
} from "./sourceBuilding";
import "./sourceBuilding.css";
import { createModelScope, type ModelScopeOptions } from "./ModelScope";
import { BuildingVisualSettings } from "./BuildingVisualSettings";
import { createFirstPersonNavigation } from "./FirstPersonNavigation";
import { WalkStartDialog, type WalkStart } from "./WalkStartDialog";
import type { NavigationMode } from "./navigationMovement";
import { createWalkCollisionWorld } from "./walkCollision";
import { createWalkDoors, type WalkDoorState } from "./WalkDoors";
import { WalkDoorPrompt } from "./WalkDoorPrompt";
import { prepareSourceWalkDoors } from "./sourceWalkDoors";
import { createFirstPersonArm } from "./FirstPersonArm";
import { publishModelView } from "./modelViewSnapshot";
import {
  DEFAULT_APPEARANCE,
  loadAppearance,
  saveAppearance,
  type BuildingAppearance,
} from "./buildingAppearance";
import { createMagicPencilDraftsman, type DraftsmanStatus } from "./MagicPencilDraftsman";
import { DraftsmanControlDock } from "./DraftsmanControlDock";
import { registerDraftsmanController } from "./assistant/draftsmanBridge";

type ViewOptions = {
  wireframe: boolean;
  roof: boolean;
  cutaway: boolean;
  explode: boolean;
  plan: boolean;
  level: "all" | "ground" | "upper";
};
type SceneApi = {
  navigate: (mode: "fly" | "walk", start?: WalkStart) => Promise<void>;
  captureNavigation: () => Promise<boolean>;
  stopNavigation: () => void;
  interactDoor: () => void;
  options: (value: ViewOptions) => void;
  select: (id: string | null) => void;
  fit: () => void;
  view: (direction: [number, number, number]) => void;
  zoom: (factor: number) => void;
  png: () => void;
  appearance: (value: BuildingAppearance) => void;
  scope: (value: ModelScopeOptions) => void;
  startDraftsman: () => void;
  stopDraftsman: () => void;
  draftsmanPlay: () => void;
  draftsmanPause: () => void;
  draftsmanReplay: () => void;
  draftsmanSeek: (p: number) => void;
  draftsmanSpeed: (s: number) => void;
  draftsmanFinish: () => void;
  draftsmanToggleOrbit: () => void;
  draftsmanJumpToStorey: (storey: number | string) => void;
  draftsmanCaptureBlueprint: (filename?: string) => unknown;
  draftsmanCapturePlanBook: () => Promise<void>;
  getDraftsmanStatus: () => DraftsmanStatus | null;
  dispose: () => void;
};
const sessionViewOptions = new Map<string, ViewOptions>();

function createBuildingScene(
  host: HTMLDivElement,
  model: SourceBuilding,
  onSelect: (id: string | null) => void,
  onError: (message: string) => void,
  onScopeZoom: (zoom: number) => void,
  binding: { documentId: string; sceneId: string; sceneSha256: string },
  onNavigation: (mode: NavigationMode) => void,
  onCapture: (capture: "locked" | "drag" | null) => void,
  onDoor: (state: WalkDoorState | null) => void,
  onDraftsmanStatus?: (status: DraftsmanStatus | null) => void,
): SceneApi {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute("aria-label", "Interactive source building model");
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.dataset.sourceSha256 = model.source.sha256;
  renderer.domElement.dataset.meshCount = String(model.objects.length);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e5e5df");
  const bounds = new THREE.Box3(
      new THREE.Vector3(...model.bounds.min),
      new THREE.Vector3(...model.bounds.max),
    ),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3()),
    span = Math.max(size.x, size.z);
  const perspective = new THREE.PerspectiveCamera(36, 1, 0.05, span * 12),
    orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, span * 12);
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspective;
  let controls: OrbitControls<THREE.PerspectiveCamera | THREE.OrthographicCamera> =
    new OrbitControls(camera, renderer.domElement);
  let options: ViewOptions = {
    wireframe: false,
    roof: true,
    cutaway: false,
    explode: false,
    plan: false,
    level: "all",
  };
  let scope: ReturnType<typeof createModelScope> | null = null;
  let navigation: ReturnType<typeof createFirstPersonNavigation> | null = null;
  let doors: ReturnType<typeof createWalkDoors> | null = null;
  let arm: ReturnType<typeof createFirstPersonArm> | null = null;
  let currentDoorState: WalkDoorState | null = null;
  let draftsman: ReturnType<typeof createMagicPencilDraftsman> | null = null;
  let disposed = false,
    frame = 0;
  const render = () => {
    frame = 0;
    if (disposed) return;
    const changing = navigation && navigation.mode !== "orbit" ? navigation.tick() : controls.update();
    const doorChanging = doors?.tick(navigation?.mode === "walk" && renderer.domElement.dataset.navigationTransition === "idle");
    const draftsmanChanging = draftsman ? draftsman.tick(performance.now()) : false;
    arm?.tick(navigation?.mode === "walk" ? currentDoorState : null);
    renderer.render(scene, camera);
    scope?.render();
    renderer.domElement.dataset.renderCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.frameCount = String(
      Number(renderer.domElement.dataset.frameCount ?? 0) + 1,
    );
    renderer.domElement.dataset.cameraPosition = camera.position.toArray().join(",");
    renderer.domElement.dataset.cameraTarget = controls.target.toArray().join(",");
    renderer.domElement.dataset.cameraZoom = String(camera.zoom);
    publishModelView({
      ...binding,
      sourceSha256: model.source.sha256,
      view: { ...options },
      camera: {
        projection: camera instanceof THREE.PerspectiveCamera ? "perspective" : "orthographic",
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        up: camera.up.toArray() as [number, number, number],
        zoom: camera.zoom,
        near: camera.near,
        far: camera.far,
        projectionMatrix: camera.projectionMatrix.toArray(),
      },
    });
    if (changing || doorChanging || draftsmanChanging) invalidate();
  };
  const invalidate = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  };
  const configureControls = () => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2;
    controls.maxDistance = span * 6;
    controls.target.copy(center);
    controls.addEventListener("change", invalidate);
  };
  configureControls();
  const ambient = new THREE.HemisphereLight("#ffffff", "#8f9083", 2.25);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff6df", 3.2);
  sun.position.copy(center).add(new THREE.Vector3(-span * 0.5, span * 0.9, span * 0.55));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = span * 4;
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.00008;
  scene.add(sun, sun.target);
  const groundGeometry = new THREE.PlaneGeometry(span * 5, span * 5),
    groundMaterial = new THREE.MeshStandardMaterial({ color: "#d9dbd3", roughness: 1 }),
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, bounds.min.y, center.z);
  ground.receiveShadow = true;
  scene.add(ground);
  const meshMap = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(),
    parts = new Map(model.objects.map((p) => [p.id, p])),
    edges: THREE.LineSegments[] = [],
    materials = new Map<string, THREE.MeshStandardMaterial>();
  let upperMin = Infinity;
  for (const part of model.objects)
    if (part.level === "upper") {
      for (let i = 1; i < part.positions.length; i += 3)
        upperMin = Math.min(upperMin, part.positions[i]);
    }
  const cutHeight =
    model.floorElevations?.upper ?? (Number.isFinite(upperMin) ? Math.max(upperMin, 0) : 0);
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2),
    edgeMaterial = new THREE.LineBasicMaterial({
      color: "#273735",
      transparent: true,
      opacity: model.presentation?.edgeOpacity ?? 0.26,
    }),
    highlight = new THREE.MeshStandardMaterial({
      color: "#b8d3cb",
      emissive: "#234e43",
      emissiveIntensity: 0.22,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
  const wireMaterial = new THREE.LineBasicMaterial({
    color: "#315f59",
    transparent: true,
    opacity: 0.72,
    depthTest: false,
  });
  const clippedWireMaterial = wireMaterial.clone(),
    selectedWireMaterial = new THREE.LineBasicMaterial({ color: "#b25b21", depthTest: false }),
    selectedClippedWireMaterial = selectedWireMaterial.clone();
  for (const part of model.objects) {
    const spec = model.materials[part.material],
      key = part.material + ":" + (WALL_CATEGORIES.has(part.category) ? "wall" : "solid");
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: spec.roughness ?? 0.8,
        metalness: spec.metalness ?? 0,
        opacity: spec.opacity ?? 1,
        transparent: (spec.opacity ?? 1) < 1,
        depthWrite: (spec.opacity ?? 1) >= 1,
        side: THREE.DoubleSide,
      });
      materials.set(key, material);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setIndex(part.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = (spec.opacity ?? 1) > 0.9;
    mesh.receiveShadow = true;
    mesh.userData = { partId: part.id, baseMaterial: material };
    meshMap.set(part.id, mesh);
    scene.add(mesh);
    {
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), edgeMaterial);
      line.userData.solidEdge = !["room", "fixture", "solar", "fence"].includes(part.category);
      line.raycast = () => {};
      mesh.add(line);
      edges.push(line);
    }
  }
  let selected: string | null = null;
  const doorGeometry = prepareSourceWalkDoors(model, meshMap);
  const collisionMeshes = [...meshMap.values(), ...doorGeometry.extraMeshes];
  const supportMeshes = model.objects.filter((part) => ["room", "slab", "stair"].includes(part.category))
    .map((part) => meshMap.get(part.id)!);
  const walkWorld = createWalkCollisionWorld({ solids: () => collisionMeshes, supports: () => supportMeshes });
  doors = createWalkDoors({ doors: doorGeometry.doors, camera: perspective, canvas: renderer.domElement,
    solids: () => collisionMeshes, onChange: (state) => { currentDoorState = state; onDoor(state); }, invalidate });
  arm = createFirstPersonArm({ scene, camera: perspective, canvas: renderer.domElement, invalidate });
  const visiblePart = (part: SourceBuilding["objects"][number]) =>
    !(
      options.wireframe &&
      /^(Clapboard reveal|Shutter louver)$/.test(part.label) &&
      selected !== part.id
    ) &&
    (!ROOF_CATEGORIES.has(part.category) || options.roof) &&
    (options.level === "all" ||
      (options.level === "ground"
        ? part.level !== "upper" && part.level !== "roof"
        : part.level !== "ground"));
  const fit = (direction?: [number, number, number]) => {
    const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    const dir = new THREE.Vector3(...(direction ?? model.presentation?.cameraDirection ?? [0.8, 0.67, 1.2] as [number, number, number])).normalize(),
      right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize(),
      up = new THREE.Vector3().crossVectors(dir, right),
      tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    let distance = 1;
    const effective = new THREE.Box3();
    const vertex = new THREE.Vector3();
    for (const part of model.objects)
      if (visiblePart(part))
        for (let i = 0; i < part.positions.length; i += 3)
          effective.expandByPoint(
            vertex.set(part.positions[i], part.positions[i + 1], part.positions[i + 2]),
          );
    if (effective.isEmpty()) effective.copy(bounds);
    if (options.explode) effective.max.y += 4;
    const center = effective.getCenter(new THREE.Vector3()),
      size = effective.getSize(new THREE.Vector3());
    for (const x of [effective.min.x, effective.max.x])
      for (const y of [effective.min.y, effective.max.y])
        for (const z of [effective.min.z, effective.max.z]) {
          const delta = new THREE.Vector3(x, y, z).sub(center);
          distance = Math.max(
            distance,
            Math.abs(delta.dot(up)) / tan + delta.dot(dir),
            Math.abs(delta.dot(right)) / (tan * aspect) + delta.dot(dir),
          );
        }
    perspective.position.copy(center).addScaledVector(dir, distance * 1.08);
    perspective.up.set(0, 1, 0);
    perspective.lookAt(center);
    const half = Math.max(size.z / 2, size.x / (2 * aspect)) * 1.25;
    orthographic.left = -half * aspect;
    orthographic.right = half * aspect;
    orthographic.top = half;
    orthographic.bottom = -half;
    orthographic.zoom = 1;
    orthographic.position.copy(center).add(new THREE.Vector3(0, span * 2, 0));
    orthographic.up.fromArray(model.presentation?.planUp ?? [0, 0, -1]);
    orthographic.lookAt(center);
    orthographic.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    invalidate();
  };
  const resize = () => {
    renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
    if (navigation && navigation.mode !== "orbit") {
      perspective.aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
      perspective.updateProjectionMatrix();
      invalidate();
    } else fit();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const apply = () => {
    plane.constant =
      (options.level === "upper" ? cutHeight : 0) + 1.2 + (options.explode ? 1.5 : 0);
    ground.visible = !options.wireframe;
    highlight.visible = !options.wireframe;
    clippedWireMaterial.clippingPlanes = options.cutaway ? [plane] : [];
    selectedClippedWireMaterial.clippingPlanes = options.cutaway ? [plane] : [];
    for (const [id, mesh] of [...meshMap, ...doorGeometry.extraMeshes.map((mesh) => [mesh.userData.partId as string, mesh] as const)]) {
      const part = parts.get(id)!;
      mesh.visible = visiblePart(part);
      if (mesh.matrixAutoUpdate) mesh.position.y = options.explode
        ? ROOF_CATEGORIES.has(part.category)
          ? 4
          : WALL_CATEGORIES.has(part.category) || part.category === "column"
            ? 1.5
            : part.category === "room"
              ? 0.12
              : 0
        : 0;
      const base = mesh.userData.baseMaterial as THREE.MeshStandardMaterial;
      base.visible = !options.wireframe;
      mesh.castShadow = !options.wireframe && (model.materials[part.material].opacity ?? 1) > 0.9;
      base.clipShadows = true;
      base.clippingPlanes = options.cutaway && WALL_CATEGORIES.has(part.category) ? [plane] : [];
      mesh.material = selected === id ? highlight : base;
      if (selected === id) highlight.clippingPlanes = base.clippingPlanes;
      for (const child of mesh.children) {
        const line = child as THREE.LineSegments;
        line.material = options.wireframe
          ? selected === id
            ? WALL_CATEGORIES.has(part.category)
              ? selectedClippedWireMaterial
              : selectedWireMaterial
            : WALL_CATEGORIES.has(part.category)
              ? clippedWireMaterial
              : wireMaterial
          : edgeMaterial;
        line.visible =
          options.wireframe ||
          (line.userData.solidEdge && (!options.cutaway || !WALL_CATEGORIES.has(part.category)));
      }
    }
    renderer.domElement.dataset.displayMode = options.wireframe ? "wireframe" : "solid";
    renderer.domElement.dataset.cameraPosition = camera.position.toArray().join(",");
    renderer.domElement.dataset.level = options.level;
    renderer.domElement.dataset.roof = String(options.roof);
    renderer.domElement.dataset.cutaway = String(options.cutaway);
    renderer.domElement.dataset.explode = String(options.explode);
    renderer.domElement.dataset.projection = options.plan ? "orthographic-plan" : "perspective";
    renderer.domElement.dataset.visibleMeshCount = String(
      [...meshMap.values()].filter((m) => m.visible).length,
    );
    invalidate();
  };
  const pointer = new THREE.Vector2(),
    ray = new THREE.Raycaster();
  let down: { x: number; y: number } | null = null;
  const onDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: PointerEvent) => {
    if (navigation && navigation.mode !== "orbit") return;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) {
      down = null;
      return;
    }
    down = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray
      .intersectObjects(
        [...meshMap.values()].filter((m) => m.visible),
        false,
      )
      .find(
        (h) =>
          !options.cutaway ||
          !WALL_CATEGORIES.has(parts.get(h.object.userData.partId)!.category) ||
          h.point.y <= plane.constant,
      );
    onSelect(hit?.object.userData.partId ?? null);
  };
  const lost = (event: Event) => {
    event.preventDefault();
    onError("The 3D graphics context was interrupted. Reopen Model to restore the viewer.");
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  scope = createModelScope({
    host,
    renderer,
    scene,
    getCamera: () => camera,
    onInvalidate: invalidate,
    onZoomChange: onScopeZoom,
  });
  apply();
  navigation = createFirstPersonNavigation({
    canvas: renderer.domElement, camera: perspective, bounds,
    floor: () => model.storeys?.find((s) => s.id === options.level)?.elevation
      ?? model.floorElevations?.[options.level === "upper" ? "upper" : "ground"] ?? bounds.min.y,
    invalidate,
    onCaptureChange: onCapture,
    walkWorld: () => walkWorld,
    onInteract: () => doors?.interact(),
    interactionBusy: () => doors?.busy ?? false,
    onChange(mode) {
      controls.enabled = mode === "orbit";
      if (mode === "orbit") {
        controls.target.copy(perspective.position).addScaledVector(perspective.getWorldDirection(new THREE.Vector3()), 5);
        controls.update();
      }
      onNavigation(mode);
    },
  });
  return {
    interactDoor: () => doors?.interact(),
    navigate: (mode, start) => navigation!.start(mode, start),
    captureNavigation: () => navigation!.capture(),
    stopNavigation: () => navigation?.stop(),
    scope(value) {
      scope?.setOptions(value);
      invalidate();
    },
    appearance(value) {
      scene.background = new THREE.Color(value.background);
      groundMaterial.color.set(value.background);
      for (const material of [wireMaterial, clippedWireMaterial]) {
        material.color.set(value.wire);
        material.opacity = value.opacity;
      }
      ambient.intensity = 2.25 * value.lighting;
      sun.intensity = 3.2 * value.lighting;
      renderer.shadowMap.enabled = value.shadows;
      renderer.domElement.dataset.appearance = JSON.stringify(value);
      invalidate();
    },
    options(next) {
      const changed = next.plan !== options.plan,
        exploded = next.explode !== options.explode || next.level !== options.level;
      if (changed || exploded) { navigation?.stop(); doors?.reset(); }
      options = next;
      if (changed) {
        controls.dispose();
        camera = options.plan ? orthographic : perspective;
        controls = new OrbitControls(camera, renderer.domElement);
        configureControls();
        controls.enableRotate = !options.plan;
        fit();
      }
      if (exploded) fit();
      apply();
    },
    select(id) {
      selected = id;
      renderer.domElement.dataset.selectedPart = id ?? "";
      apply();
    },
    fit() { navigation?.stop(); fit(); },
    view(direction) { navigation?.stop(); fit(direction); },
    zoom(factor) {
      navigation?.stop();
      if (camera === orthographic) {
        orthographic.zoom = THREE.MathUtils.clamp(orthographic.zoom * factor, 0.25, 12);
        orthographic.updateProjectionMatrix();
      } else {
        const offset = perspective.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance);
        perspective.position.copy(controls.target).add(offset.setLength(distance));
      }
      controls.update();
      invalidate();
    },
    png() {
      renderer.render(scene, camera);
      const anchor = document.createElement("a");
      anchor.download = model.source.name.replace(/\.pdf$/i, "") + "-reconstruction.png";
      const output = document.createElement("canvas"),
        source = renderer.domElement;
      const scale = renderer.getPixelRatio(),
        footer = 66 * scale;
      output.width = source.width;
      output.height = source.height + footer;
      const context = output.getContext("2d");
      if (!context) {
        onError("The image export canvas is unavailable.");
        return;
      }
      context.drawImage(source, 0, 0);
      context.fillStyle = "#f2ede3";
      context.fillRect(0, source.height, output.width, footer);
      context.fillStyle = "#25372f";
      context.font = `${11 * scale}px sans-serif`;
      const attribution = [
        model.source.title ?? model.source.name,
        model.source.author,
        model.source.license,
      ]
        .filter(Boolean)
        .join(" / ");
      context.fillText(
        attribution,
        16 * scale,
        source.height + 20 * scale,
        output.width - 32 * scale,
      );
      context.fillText(
        "Curated approximate reconstruction / changes: source drawings converted to 3D / not for construction",
        16 * scale,
        source.height + 38 * scale,
        output.width - 32 * scale,
      );
      context.fillText(
        model.source.licenseUrl ?? `Source SHA-256: ${model.source.sha256}`,
        16 * scale,
        source.height + 54 * scale,
        output.width - 32 * scale,
      );
      anchor.href = output.toDataURL("image/png");
      anchor.click();
    },
    startDraftsman() {
      navigation?.stop();
      if (!draftsman) {
        draftsman = createMagicPencilDraftsman({
          scene,
          model,
          meshMap,
          domElement: renderer.domElement,
          invalidate,
          renderBeforeCapture: () => renderer.render(scene, camera),
          camera,
          controls,
          onStatusChange: (status) => {
            onDraftsmanStatus?.(status);
          },
        });
      }
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) draftsman.seek(0.08);
      else draftsman.play();
      invalidate();
    },
    stopDraftsman() {
      if (draftsman) {
        draftsman.restoreOriginal();
        draftsman.dispose();
        draftsman = null;
      }
      onDraftsmanStatus?.(null);
      apply();
      invalidate();
    },
    draftsmanPlay() {
      draftsman?.play();
      invalidate();
    },
    draftsmanPause() {
      draftsman?.pause();
      invalidate();
    },
    draftsmanReplay() {
      draftsman?.replay();
      invalidate();
    },
    draftsmanSeek(p: number) {
      draftsman?.seek(p);
      invalidate();
    },
    draftsmanSpeed(s: number) {
      draftsman?.setSpeed(s);
      invalidate();
    },
    draftsmanFinish() {
      draftsman?.finish();
      invalidate();
    },
    draftsmanToggleOrbit() {
      draftsman?.toggleCinematicOrbit();
      invalidate();
    },
    draftsmanJumpToStorey(storey: number | string) {
      draftsman?.jumpToStorey(storey);
      invalidate();
    },
    draftsmanCaptureBlueprint(filename?: string) {
      return draftsman?.captureBlueprint(filename ?? "architectural-blueprint.png");
    },
    async draftsmanCapturePlanBook() {
      if (!draftsman) throw Error("Open Magic Pencil before exporting model sheets.");
      const book = draftsman.capturePlanBook();
      await book.downloadPdf();
    },
    getDraftsmanStatus() {
      return draftsman?.getStatus() ?? null;
    },
    dispose() {
      disposed = true;
      if (draftsman) {
        draftsman.dispose();
        draftsman = null;
      }
      navigation?.dispose();
      doors?.dispose();
      arm?.dispose();
      cancelAnimationFrame(frame);
      scope?.dispose();
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      for (const mesh of meshMap.values()) mesh.geometry.dispose();
      for (const mesh of doorGeometry.extraMeshes) {
        mesh.geometry.dispose();
        for (const child of mesh.children) if (child instanceof THREE.LineSegments) child.geometry.dispose();
      }
      for (const edge of edges) edge.geometry.dispose();
      for (const material of materials.values()) material.dispose();
      edgeMaterial.dispose();
      wireMaterial.dispose();
      clippedWireMaterial.dispose();
      selectedWireMaterial.dispose();
      selectedClippedWireMaterial.dispose();
      highlight.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function SourceBuildingViewer() {
  const controlDock = useRef<HTMLDivElement>(null);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("orbit");
  const [navigationCapture, setNavigationCapture] = useState<"locked" | "drag" | null>(null);
  const [walkPicker, setWalkPicker] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [doorState, setDoorState] = useState<WalkDoorState | null>(null);
  const [scopeOptions, setScopeOptions] = useState<ModelScopeOptions>({
    enabled: false,
    zoom: 4,
    diameter: 240,
  });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setScopeOptions((value) => ({ ...value, enabled: false }));
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, []);
  const [appearance, setAppearance] = useState<BuildingAppearance>({ ...DEFAULT_APPEARANCE }),
    [appearanceLoaded, setAppearanceLoaded] = useState(false),
    [preferenceWarning, setPreferenceWarning] = useState<string | null>(null),
    [sceneDigest, setSceneDigest] = useState("");
  useEffect(() => {
    try {
      setAppearance(loadAppearance(window.localStorage));
    } catch {
      setPreferenceWarning("Appearance preferences are unavailable in this browser.");
    }
    setAppearanceLoaded(true);
  }, []);
  useEffect(() => {
    if (!appearanceLoaded) return;
    try {
      saveAppearance(window.localStorage, appearance);
      setPreferenceWarning(null);
    } catch {
      setPreferenceWarning("Appearance works here, but these settings could not be saved.");
    }
  }, [appearance, appearanceLoaded]);
  const pageIndex = useStudio((s) => s.sheet),
    activeDocument = useStudio((s) => s.job.documents.find((d) => d.id === s.job.activeDocumentId));
  const documentError = useStudio((s) => s.documentError);
  const binary = useStudio((s) => s.activePlanBinary),
    hydrated = useStudio((s) => s.persistenceHydrated),
    [model, setModel] = useState<SourceBuilding | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [matched, setMatched] = useState(false),
    [checking, setChecking] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [sourceIndex, setSourceIndex] = useState(0),
    [options, setOptions] = useState<ViewOptions>(
      () =>
        sessionViewOptions.get(binary?.sha256 ?? "") ?? {
          wireframe: false,
          roof: true,
          cutaway: false,
          explode: false,
          plan: false,
          level: "all",
        },
    );
  useEffect(() => {
    if (binary) sessionViewOptions.set(binary.sha256, options);
  }, [binary, options]);
  const [chosen, setChosen] = useState<string>(BUILDING_CATALOG[0].id);
  const config = BUILDING_CATALOG.find((c) => c.id === chosen)!;
  const [verifiedBytes, setVerifiedBytes] = useState<Uint8Array | null>(null);
  const [draftsmanActive, setDraftsmanActive] = useState(false);
  const [draftsmanStatus, setDraftsmanStatus] = useState<DraftsmanStatus | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [exportingBook, setExportingBook] = useState(false);
  useEffect(() => {
    setPreviewMode(false);
    setDraftsmanActive(false);
    setDraftsmanStatus(null);
  }, [chosen]);
  const [svgAvailable, setSvgAvailable] = useState(false);
  const svgProjection = options.plan
    ? options.level === "upper"
      ? "upper"
      : "ground"
    : "axonometric";
  const svgUrl = `/models/caroline/wireframe-${svgProjection}.svg`;
  useEffect(() => {
    let active = true;
    setSvgAvailable(false);
    if (config.id !== "caroline") return;
    void fetch(svgUrl, { method: "HEAD" })
      .then((response) => {
        if (active)
          setSvgAvailable(
            response.ok && response.headers.get("content-type")?.includes("image/svg+xml") === true,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [config, svgUrl]);
  useEffect(() => {
    const entry = BUILDING_CATALOG.find((c) => c.sha256 === binary?.sha256);
    if (entry) setChosen(entry.id);
  }, [binary?.sha256]);
  const host = useRef<HTMLDivElement>(null),
    api = useRef<SceneApi | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setModel(null);
    setMatched(false);
    setError(null);
    void fetchBuildingBytes(config.sceneUrl, 20 * 1024 * 1024, abort.signal)
      .then(async (bytes) => {
        const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
        if (!abort.signal.aborted)
          setSceneDigest(
            Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join(""),
          );
        return parseSourceBuilding(JSON.parse(new TextDecoder().decode(bytes)));
      })
      .then((value) => {
        if (value.source.sha256 !== config.sha256)
          throw Error("Reconstruction source identity does not match the selected plan.");
        if (!abort.signal.aborted) setModel(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => abort.abort();
  }, [config]);
  useEffect(() => {
    let active = true;
    setMatched(false);
    setVerifiedBytes(null);
    setSelected(null);
    if (!model || !binary) {
      setChecking(false);
      return;
    }
    setChecking(true);
    void sourceBytesMatch(model, binary.bytes, binary.sha256)
      .then((value) => {
        if (active) {
          setMatched(value);
          setVerifiedBytes(value ? binary.bytes : null);
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) {
          setChecking(false);
          setError("The imported original could not be verified.");
        }
      });
    return () => {
      active = false;
    };
  }, [model, binary]);
  useEffect(() => {
    if (!model || (!matched && !previewMode) || !host.current || !sceneDigest) return;
    try {
      api.current = createBuildingScene(
        host.current,
        model,
        setSelected,
        setError,
        (zoom) => setScopeOptions((value) => ({ ...value, zoom })),
        { documentId: binary?.documentId ?? config.id, sceneId: config.id, sceneSha256: sceneDigest },
        setNavigationMode,
        setNavigationCapture,
        setDoorState,
        (status) => setDraftsmanStatus(status),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      api.current?.dispose();
      api.current = null;
    };
  }, [model, matched, previewMode, binary?.documentId, sceneDigest, config.id]);
  useEffect(() => api.current?.options(options), [options, matched, previewMode]);
  useEffect(() => api.current?.appearance(appearance), [appearance, matched, previewMode]);
  useEffect(() => api.current?.scope(scopeOptions), [scopeOptions, matched, previewMode]);

  useEffect(() => {
    const unregister = registerDraftsmanController({
      control: async (input) => {
        if (!previewMode && !matched) {
          throw Error("Open the model preview or its matching source before using drawing playback.");
        }
        if (!api.current) throw Error("The model viewer is not ready. Wait for it to finish loading.");
        switch (input.action) {
          case "play":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            api.current?.draftsmanPlay();
            break;
          case "pause":
            api.current?.draftsmanPause();
            break;
          case "replay":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            api.current?.draftsmanReplay();
            break;
          case "seek":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            if (input.progress !== undefined) {
              api.current?.draftsmanSeek(input.progress);
            }
            break;
          case "set_speed":
            if (input.speed !== undefined) {
              api.current?.draftsmanSpeed(input.speed);
            }
            break;
          case "finish":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            api.current?.draftsmanFinish();
            break;
          case "exit":
            api.current?.stopDraftsman();
            setDraftsmanActive(false);
            break;
          case "tour":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            api.current?.draftsmanToggleOrbit();
            break;
          case "jump_storey":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            if (input.storey !== undefined) {
              api.current?.draftsmanJumpToStorey(input.storey);
            }
            break;
          case "blueprint":
            if (!draftsmanActive) {
              api.current?.startDraftsman();
              setDraftsmanActive(true);
            }
            api.current?.draftsmanCaptureBlueprint(input.filename);
            break;
          case "status":
            break;
          default:
            throw Error(`The ${input.action} command is not connected to this viewer yet. No action was performed.`);
        }
        return api.current?.getDraftsmanStatus() ?? null;
      },
      getStatus: () => api.current?.getDraftsmanStatus() ?? null,
      isActive: () => api.current?.getDraftsmanStatus() != null,
      getModelInfo: () => ({
        id: config.id,
        title: config.title,
        meshCount: model?.objects.length ?? 0,
      }),
    });
    return unregister;
  }, [previewMode, matched, draftsmanActive, config.id, config.title, model?.objects.length]);


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest('button, [role="button"], [role="tab"], [contenteditable="true"]'))) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (draftsmanActive) {
        if (e.code === "Space") {
          e.preventDefault();
          if (draftsmanStatus?.mode === "drawing") {
            api.current?.draftsmanPause();
          } else {
            api.current?.draftsmanPlay();
          }
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          api.current?.draftsmanReplay();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          api.current?.draftsmanFinish();
        } else if (e.key === "t" || e.key === "T") {
          e.preventDefault();
          api.current?.draftsmanToggleOrbit();
        } else if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          api.current?.draftsmanCaptureBlueprint("architectural-blueprint.png");
        } else if (e.key === "Escape") {
          e.preventDefault();
          api.current?.stopDraftsman();
          setDraftsmanActive(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftsmanActive, draftsmanStatus?.mode]);
  function navigate(mode: "fly" | "walk", start?: WalkStart) {
    const next: ViewOptions = { ...options, plan: false, explode: false, level: mode === "walk" ? "all" : options.level };
    api.current?.options(next);
    setOptions(next);
    setWalkPicker(false);
    setNavigationError(null);
    void api.current?.navigate(mode, start).catch((e) => setNavigationError(String(e.message)));
  }
  useEffect(() => {
    api.current?.select(selected);
    setSourceIndex(0);
  }, [selected, matched]);
  async function openSource() {
    if (!model) return;
    const previousBinary = useStudio.getState().activePlanBinary;
    setLoading(true);
    setError(null);
    try {
      const bytes = await fetchBuildingBytes(config.sourceUrl, 100 * 1024 * 1024);
      const imported = await inspectPlanBytes({
        name: model.source.name,
        bytes,
        source: "web",
        takeoff: null,
      });
      if (!(await sourceBytesMatch(model, imported.binary.bytes, imported.binary.sha256)))
        throw Error("The original PDF does not match this reconstruction. Nothing was imported.");
      if (useStudio.getState().activePlanBinary !== previousBinary)
        throw Error(
          "A different plan was opened while this source was loading. The newer plan was preserved.",
        );
      await useStudio.getState().importPlan(imported);
      useStudio.getState().setPane("model");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  async function exportSvg() {
    try {
      const bytes = await fetchBuildingBytes(svgUrl, 10 * 1024 * 1024),
        text = new TextDecoder().decode(bytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error("Unsupported SVG document declaration.");
      const document = new DOMParser().parseFromString(text, "image/svg+xml"),
        provenance = JSON.parse(
          document.querySelector("#source-provenance")?.textContent ?? "null",
        );
      if (
        document.querySelector("parsererror,script,foreignObject,image") ||
        provenance?.source?.sha256 !== model?.source.sha256 ||
        provenance?.sceneSha256 !== sceneDigest
      )
        throw Error("SVG source geometry does not match the current reconstruction.");
      const background = document.querySelector("#drawing-background"),
        edges = document.querySelector("#building-edges");
      if (!background || !edges) throw Error("SVG palette metadata is unavailable.");
      background.setAttribute("fill", appearance.background);
      edges.setAttribute("stroke", appearance.wire);
      edges.setAttribute("stroke-opacity", String(appearance.opacity));
      for (const label of document.querySelectorAll('[data-palette-role="text"]'))
        label.setAttribute("fill", appearance.wire);
      const metadata = document.createElementNS("http://www.w3.org/2000/svg", "metadata");
      metadata.setAttribute("id", "viewer-appearance");
      metadata.textContent = JSON.stringify({
        background: appearance.background,
        wire: appearance.wire,
        opacity: appearance.opacity,
        projection: svgProjection,
        scope:
          "Fixed Python-generated projection; palette adapted in viewer; source paths unchanged.",
      });
      document.documentElement.append(metadata);
      const blob = new Blob([new XMLSerializer().serializeToString(document)], {
          type: "image/svg+xml",
        }),
        url = URL.createObjectURL(blob),
        anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `caroline-wireframe-${svgProjection}.svg`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const part = model?.objects.find((p) => p.id === selected) ?? null,
    ref = part?.sourceRefs[sourceIndex],
    sheet = ref
      ? model?.sourceSheets.find((s) => s.page === ref.page)
      : (model?.sourceSheets.find((s) =>
          options.level === "upper"
            ? /upstairs|upper/i.test(s.title)
            : options.level === "ground"
              ? /downstairs|ground plan/i.test(s.title)
              : s.role === "elevation",
        ) ?? model?.sourceSheets[0]),
    ready =
      matched &&
      !!model &&
      verifiedBytes === binary?.bytes &&
      model.source.sha256 === binary?.sha256 &&
      model.source.sha256 === config.sha256,
    isDisplayable = (ready || previewMode) && !!model;
  useEffect(() => {
    const dock = controlDock.current;
    if (!isDisplayable || !dock) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--model-controls-clearance", `${Math.max(34, innerHeight - dock.getBoundingClientRect().top + 8)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    if (dock.parentElement) observer.observe(dock.parentElement);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--model-controls-clearance");
    };
  }, [isDisplayable]);
  return (
    <div
      className="source-building"
      data-model-status={ready ? "ready" : previewMode ? "preview" : checking ? "checking" : model ? "unmatched" : "loading"}
    >
      <div className="building-workspace">
        <nav className="building-left-nav" aria-label="Source sheets and models">
          <h2>MODELS</h2>
          {BUILDING_CATALOG.map((c) => (
            <button
              type="button"
              className={config.id === c.id ? "active" : ""}
              key={c.id}
              onClick={() => setChosen(c.id)}
              disabled={loading}
            >
              <Box size={14} />
              {c.title}
            </button>
          ))}
          <h2>
            SHEETS <span>{activeDocument?.pageCount ?? 0}</span>
          </h2>
          <p className="building-nav-file" title={binary?.name}>
            {binary?.name ?? "Open a source PDF"}
          </p>
          {binary &&
            Array.from({ length: activeDocument?.pageCount ?? 0 }, (_, i) => {
              const sourceSheet =
                model?.source.sha256 === binary.sha256
                  ? model.sourceSheets.find((p) => p.page === i + 1)
                  : undefined;
              return (
                <button
                  type="button"
                  key={i}
                  className={pageIndex === i ? "active" : ""}
                  aria-label={`Open source page ${i + 1}`}
                  onClick={() => {
                    useStudio.getState().setSheet(i);
                    useStudio.getState().setPane("sheets");
                  }}
                >
                  <span className="building-page-number">{String(i + 1).padStart(2, "0")}</span>
                  <span>{sourceSheet?.title ?? `Sheet ${i + 1}`}</span>
                  {sourceSheet && <img src={sourceSheet.image} alt="" loading="lazy" />}
                </button>
              );
            })}
        </nav>
        <div className="building-center-column">
          <div className="building-heading">
            <div>
              <span className="building-eyebrow">
                SOURCE RECONSTRUCTION / {config.title.toUpperCase()}
              </span>
              <h1>{ready ? "The drawing, in three dimensions" : `Explore ${config.title}`}</h1>
            </div>
            {!ready && (
              <select
                className="building-scene-picker"
                aria-label="Prepared building"
                value={config.id}
                disabled={loading}
                onChange={(e) => setChosen(e.target.value)}
              >
                {BUILDING_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
            <span className="building-source-state">
              {ready ? (
                <>
                  <span className="building-dot" />
                  Original PDF matched / {model.source.pageCount} sheets
                </>
              ) : config.sample ? (
                "Sample reconstruction - visual fidelity incomplete"
              ) : (
                "Curated from your architectural plans"
              )}
            </span>
          </div>
          {(error || documentError) && (
            <div className="building-error" role="alert">
              {error || documentError}
              <button
                type="button"
                aria-label="Dismiss model error"
                onClick={() => {
                  setError(null);
                  useStudio.setState({ documentError: null });
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="building-stage">
          {isDisplayable && (
            <BuildingVisualSettings
              value={appearance}
              onChange={setAppearance}
              warning={preferenceWarning}
              scope={scopeOptions}
              onScopeChange={setScopeOptions}
            />
          )}
          {isDisplayable ? (
            <>
              <div className="building-canvas" ref={host} />
              <div className="building-toolbar" role="toolbar" aria-label="3D view controls">
                <div className="building-tool-group">
                  <button
                    type="button"
                    aria-pressed={!options.wireframe && !draftsmanActive}
                    onClick={() => {
                      if (draftsmanActive) {
                        api.current?.stopDraftsman();
                        setDraftsmanActive(false);
                      }
                      setOptions((o) => ({ ...o, wireframe: false }));
                    }}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    aria-pressed={options.wireframe && !draftsmanActive}
                    onClick={() => {
                      if (draftsmanActive) {
                        api.current?.stopDraftsman();
                        setDraftsmanActive(false);
                      }
                      setOptions((o) => ({ ...o, wireframe: true }));
                    }}
                  >
                    Wireframe
                  </button>
                  <button
                    type="button"
                    className="magic-pencil-btn"
                    aria-pressed={draftsmanActive}
                    title="Animate architectural drafting from ground datum up"
                    onClick={() => {
                      if (draftsmanActive) {
                        api.current?.stopDraftsman();
                        setDraftsmanActive(false);
                      } else {
                        api.current?.startDraftsman();
                        setDraftsmanActive(true);
                      }
                    }}
                  >
                    <Pencil size={14} />
                    Magic Pencil
                  </button>
                </div>
                <div className="building-tool-group">
                  <button
                    type="button"
                    aria-pressed={!options.plan && navigationMode === "orbit"}
                    onClick={() => { api.current?.stopNavigation(); setOptions((o) => ({ ...o, plan: false })); }}
                  >
                    <Box size={15} />
                    Orbit
                  </button>
                  <button type="button" aria-pressed={navigationMode === "fly"} onClick={() => navigate("fly")}>Fly</button>
                  <button type="button" aria-pressed={navigationMode === "walk"} onClick={() => { api.current?.stopNavigation(); setWalkPicker(true); }}>Walk-through</button>
                  {navigationMode !== "orbit" && navigationCapture === "drag" && <button type="button" onClick={() => { void api.current?.captureNavigation(); }}>Capture mouse</button>}
                  <button
                    type="button"
                    aria-pressed={options.plan}
                    onClick={() => setOptions((o) => ({ ...o, plan: true }))}
                  >
                    <ScanLine size={15} />
                    Plan
                  </button>
                </div>
                <div className="building-tool-group">
                  {model.objects.some((p) => p.level) && (
                    <select
                      aria-label="Building floor"
                      value={options.level}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          level: e.target.value as ViewOptions["level"],
                          roof: e.target.value === "all",
                          cutaway: e.target.value === "all" ? false : o.cutaway,
                        }))
                      }
                    >
                      <option value="all">Whole building</option>
                      <option value="ground">Ground floor</option>
                      <option value="upper">Upper floor</option>
                    </select>
                  )}
                  <button
                    type="button"
                    aria-pressed={options.roof}
                    onClick={() =>
                      setOptions((o) => ({
                        ...o,
                        roof: !o.roof,
                        level: !o.roof ? "all" : o.level,
                        cutaway: !o.roof ? false : o.cutaway,
                      }))
                    }
                  >
                    Roof {options.roof ? "on" : "off"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={options.cutaway}
                    onClick={() =>
                      setOptions((o) => ({
                        ...o,
                        cutaway: !o.cutaway,
                        level:
                          !o.cutaway && o.level === "all" && model.floorElevations
                            ? "ground"
                            : o.level,
                        roof: o.cutaway ? o.roof : false,
                      }))
                    }
                  >
                    Wall cutaway
                  </button>
                  <button
                    type="button"
                    aria-pressed={options.explode}
                    onClick={() => setOptions((o) => ({ ...o, explode: !o.explode }))}
                  >
                    <Layers size={15} />
                    Explode
                  </button>
                </div>
                  <button type="button" onClick={() => api.current?.fit()}><Expand size={15} />Fit</button>
                <button
                  type="button"
                  aria-label="Download model PNG"
                  onClick={() => api.current?.png()}
                >
                  <Download size={15} />
                  <span>PNG</span>
                </button>
              </div>
              {navigationError && <p className="building-navigation-hint" role="alert">{navigationError}</p>}
              {navigationMode !== "orbit" && <div className="building-walk-overlay">
                {navigationMode === "walk" && <WalkDoorPrompt state={doorState} onInteract={() => api.current?.interactDoor()} />}
                <p className="building-navigation-hint">{navigationMode === "fly" ? "Fly · Space/Ctrl altitude" : "Walk · solid boundaries · stairs follow floor · E opens doors"} · WASD move · {navigationCapture === "locked" ? "mouse look" : "drag to look · Capture mouse for free look"} · Shift faster · Esc or Orbit to exit</p>
              </div>}
              {walkPicker && <WalkStartDialog model={model} initialFloor={options.level} onClose={() => setWalkPicker(false)} onStart={(_floor, point) => navigate("walk", point)} />}
              {config.id === "caroline" && (
                <div className="building-svg-export">
                  {svgAvailable ? (
                    <button type="button" onClick={() => void exportSvg()}>
                      <Download size={13} /> SVG /{" "}
                      {options.plan
                        ? options.level === "upper"
                          ? "upper plan"
                          : "ground plan"
                        : "fixed axonometric"}
                    </button>
                  ) : (
                    <span>SVG export preparing</span>
                  )}
                </div>
              )}
              <div className="building-canvas-note">
                <MousePointer2 size={13} /> Drag to orbit · wheel to zoom · right-drag to pan ·
                click a part
              </div>
              <div
                className="building-view-label"
                style={{ color: appearance.wire, background: appearance.background }}
              >
                {options.wireframe
                  ? "X-RAY EDGES / DECORATIVE REPEATS OMITTED"
                  : options.plan
                    ? "ORTHOGRAPHIC PLAN"
                    : "PERSPECTIVE"}
                <span>{model.objects.length} {ready ? "source-linked parts" : "preview parts · source unverified"}</span>
              </div>
              {draftsmanActive && draftsmanStatus && (
                <DraftsmanControlDock
                  status={draftsmanStatus}
                  onPlay={() => api.current?.draftsmanPlay()}
                  onPause={() => api.current?.draftsmanPause()}
                  onReplay={() => api.current?.draftsmanReplay()}
                  onSeek={(p) => api.current?.draftsmanSeek(p)}
                  onSpeed={(s) => api.current?.draftsmanSpeed(s)}
                  onFinish={() => api.current?.draftsmanFinish()}
                  onClose={() => {
                    api.current?.stopDraftsman();
                    setDraftsmanActive(false);
                  }}
                  onToggleTour={() => api.current?.draftsmanToggleOrbit()}
                  onJumpStorey={(st) => api.current?.draftsmanJumpToStorey(st)}
                  onCaptureBlueprint={() => api.current?.draftsmanCaptureBlueprint("architectural-blueprint.png")}
                  exportingBook={exportingBook}
                  onCapturePlanBook={async () => {
                    if (exportingBook || !api.current) return;
                    setExportingBook(true);
                    try { await api.current.draftsmanCapturePlanBook(); }
                    catch (error) { setError(error instanceof Error ? error.message : "Model sheet export failed."); }
                    finally { setExportingBook(false); }
                  }}
                />
              )}
            </>
          ) : (
            <div className="building-empty">
              {model && (
                <img
                  src={
                    model.sourceSheets.find((s) => s.role.includes("elev"))?.image ??
                    model.sourceSheets[0].image
                  }
                  alt={`Original ${config.title} drawing`}
                />
              )}
              <div className="building-empty-content">
                <label className="building-part-picker">
                  Prepared reconstruction
                  <select
                    value={config.id}
                    disabled={loading}
                    onChange={(e) => setChosen(e.target.value)}
                  >
                    {BUILDING_CATALOG.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="building-eyebrow">ONE REAL PLAN. ITS OWN BUILDING.</span>
                <h2>
                  {checking
                    ? "Checking original drawing bytes…"
                    : binary
                      ? "This plan has no prepared 3D reconstruction"
                      : "A real home, traced from its source"}
                </h2>
                <p>
                  {binary && !checking
                    ? `${binary.name} is kept separate from the ${config.title} model. Import the matching original to see this reconstruction.`
                    : `Open the ${model?.source.pageCount ?? "original"}-sheet ${config.title} PDF to explore its documented walls, openings, roof and rooms.`}
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                  <button
                    type="button"
                    className="building-primary"
                    disabled={!model || loading || !hydrated || checking}
                    onClick={() => void openSource()}
                  >
                    {loading ? "Importing and verifying PDF…" : `Open ${config.title} plan in 3D`}
                    <Box size={17} />
                  </button>
                  <button
                    type="button"
                    className="building-preview-cta"
                    disabled={!model || loading}
                    onClick={() => setPreviewMode(true)}
                    title="Inspect 3D wireframe and drafting animation immediately"
                  >
                    <Pencil size={15} />
                    Explore & Draw 3D Model
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {ready && (
              <div ref={controlDock} className="building-toolbar building-control-dock" role="toolbar" aria-label="Model navigation">
                <div className="building-tool-group" role="group" aria-label="Zoom and standard views">
                  <button type="button" aria-label="Zoom out model" onClick={() => api.current?.zoom(1 / 1.25)}><ZoomOut size={16} /></button>
                  <button type="button" aria-label="Zoom in model" onClick={() => api.current?.zoom(1.25)}><ZoomIn size={16} /></button>
                  <button type="button" onClick={() => api.current?.fit()}><Expand size={15} />Reset model view</button>
                  <button type="button" onClick={() => {
                    const next = { ...options, plan: false };
                    api.current?.options(next); setOptions(next); api.current?.view([0.12, 0.34, -1]);
                  }}>Front</button>
                  <button type="button" onClick={() => {
                    const next = { ...options, plan: false };
                    api.current?.options(next); setOptions(next); api.current?.view([0.12, 0.34, 1]);
                  }}>Rear</button>
                </div>

              </div>
        )}
        </div>
        <aside className="building-inspector" aria-label="Building source evidence">
          <div className="building-inspector-title">
            <span className="building-eyebrow">DRAWING EVIDENCE</span>
            {part && (
              <button
                type="button"
                aria-label="Clear part selection"
                onClick={() => setSelected(null)}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <h2>{part?.label ?? "Every part has a source"}</h2>
          <p className="building-evidence-state">
            {part
              ? `${part.category} · ${part.evidenceState}`
              : "Select geometry to inspect the original sheet."}
          </p>
          {ready && (
            <label className="building-part-picker">
              Building part
              <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}>
                <option value="">Choose a part…</option>
                {model.objects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {p.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sheet && (
            <>
              <a
                className="building-source-image"
                href={sheet.image}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open original source page ${sheet.page}`}
              >
                <img src={sheet.image} alt={`${sheet.title}, original page ${sheet.page}`} />
                {ref && (
                  <span
                    className="building-source-region"
                    style={{
                      left: `${(ref.region[0] / sheet.width) * 100}%`,
                      top: `${(ref.region[1] / sheet.height) * 100}%`,
                      width: `${((ref.region[2] - ref.region[0]) / sheet.width) * 100}%`,
                      height: `${((ref.region[3] - ref.region[1]) / sheet.height) * 100}%`,
                    }}
                  />
                )}
              </a>
              <div className="building-sheet-label">
                <b>Page {sheet.page}</b>
                <span>{sheet.title}</span>
              </div>
            </>
          )}
          {part && (
            <div className="building-part-evidence">
              <label>
                Evidence reference
                <select
                  value={sourceIndex}
                  onChange={(e) => setSourceIndex(Number(e.target.value))}
                >
                  {part.sourceRefs.map((r, i) => (
                    <option value={i} key={i}>
                      Page {r.page} · {r.evidenceState}
                    </option>
                  ))}
                </select>
              </label>
              {ref?.dimension && (
                <p>
                  <b>
                    {ref.dimension.value} {ref.dimension.unit}
                  </b>
                  <span>Source annotation: {ref.dimension.text}</span>
                </p>
              )}
              <p>{ref?.note}</p>
              {part.note && <p>{part.note}</p>}
            </div>
          )}
          <div className="building-boundary">
            <b>Curated reconstruction</b>
            {model?.source.author && (
              <p>
                {model.source.title}
                <br />
                {model.source.author}
                <br />
                {model.source.licenseUrl ? (
                  <a href={model.source.licenseUrl} target="_blank" rel="noreferrer">
                    {model.source.license}
                  </a>
                ) : (
                  model.source.license
                )}
                <br />
                Adaptation: source drawings reconstructed in 3D.
              </p>
            )}
            <p>
              Preliminary, approximate geometry. Not for construction or verified quantities.
              {config.sample
                ? "Undisclosed interiors are left unpartitioned."
                : "The disclosed floor layouts are reconstructed; source assumptions remain explicit."}
            </p>
            <details>
              <summary>Source and assumptions</summary>
              <p className="building-hash">
                PDF SHA-256
                <br />
                {model?.source.sha256}
              </p>
              {model?.assumptions.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
}
