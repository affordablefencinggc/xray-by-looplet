import * as THREE from "three";
import { createCinematicPencils, PENCIL_COUNT, SCRIBBLE_SECONDS } from "./cinematicPencils.ts";
import type { SourceBuilding } from "./sourceBuilding.ts";
import { createBlueprintSheet, type BlueprintSheetResult, type BlueprintSheetMetadata } from "./blueprintSheet.ts";
import { createArchitecturalDimensioning, type DimensionData } from "./architecturalDimensioning.ts";
import { generatePlanBook, type BlueprintBookResult } from "./blueprintBook.ts";

export type DraftsmanPhase =
  | "datum_grid"
  | "ascending_wireframe"
  | "ink_strengthening"
  | "material_wash"
  | "complete";

export type DraftsmanMode = "idle" | "drawing" | "paused" | "complete";

export type SectionCutMode = "none" | "plan" | "section-x" | "section-z";

export interface DraftsmanStoreyItem {
  label: string;
  elevation: number;
  progress: number;
}

export interface DraftsmanStatus {
  mode: DraftsmanMode;
  phase: DraftsmanPhase;
  progress: number; // 0.0 to 1.0
  activeElevation: number;
  activeStoreyLabel: string;
  activeCategory: string;
  visibleMeshCount: number;
  totalMeshCount: number;
  speed: number;
  durationSeconds: number;
  cinematicOrbit: boolean;
  storeys: DraftsmanStoreyItem[];
  sectionCut: SectionCutMode;
  dimensionsVisible: boolean;
  dimensions?: DimensionData;
  pencilScale: number;
  pencilColor: string;
  dockPosition: "bottom-left" | "bottom-center";
}

interface ObjectRecord {
  id: string;
  category: string;
  label: string;
  storey?: string;
  minY: number;
  maxY: number;
  centerY: number;
  centerX: number;
  centerZ: number;
  targetOpacity: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  line: THREE.LineSegments;
  baseMaterial: THREE.MeshStandardMaterial;
}

export interface MagicPencilDraftsmanOptions {
  scene: THREE.Scene;
  model: SourceBuilding;
  meshMap: Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>;
  domElement: HTMLCanvasElement;
  onStatusChange?: (status: DraftsmanStatus) => void;
  invalidate: () => void;
  renderBeforeCapture?: () => void;
  durationSeconds?: number;
  camera?: THREE.Camera;
  controls?: { target: THREE.Vector3; update: () => void };
  pencilScale?: number;
  pencilColor?: string;
  dockPosition?: "bottom-left" | "bottom-center";
}


export function createMagicPencilDraftsman(options: MagicPencilDraftsmanOptions) {
  const { scene, model, meshMap, domElement, onStatusChange, invalidate } = options;
  const durationSeconds = options.durationSeconds ?? 14;
  let pencilScale = options.pencilScale ?? 1.0;
  let pencilColor = options.pencilColor ?? "#1877F2";
  let dockPosition: "bottom-left" | "bottom-center" = options.dockPosition ?? "bottom-left";

  let mode: DraftsmanMode = "idle";
  let progress = 0;
  let speed = 1.0;
  let lastTime = 0;

  // Calculate building bounds and organize objects
  const bounds = new THREE.Box3(
    new THREE.Vector3(...model.bounds.min),
    new THREE.Vector3(...model.bounds.max),
  );
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const minY = bounds.min.y;
  const maxY = bounds.max.y;
  const height = Math.max(maxY - minY, 0.1);
  const span = Math.max(size.x, size.z);

  // Store original appearance state for clean restore
  const originalCameraPosition = options.camera?.position.clone();
  const originalCameraQuaternion = options.camera?.quaternion.clone();
  const originalControlTarget = options.controls?.target.clone();
  const originalMeshStates = new Map<
    string,
    {
      meshVisible: boolean;
      materialOpacity: number;
      materialTransparent: boolean;
      materialDepthWrite: boolean;
      materialVisible: boolean;
      materialClippingPlanes: THREE.Plane[] | null;
      lineVisible: boolean;
      lineOpacity: number;
      lineColor: number;
      lineTransparent: boolean;
      lineClippingPlanes: THREE.Plane[] | null;
    }
  >();

  // Process all objects into elevation-sorted records
  const records: ObjectRecord[] = [];
  for (const part of model.objects) {
    const mesh = meshMap.get(part.id);
    if (!mesh) continue;
    let line: THREE.LineSegments | null = null;
    for (const child of mesh.children) {
      if (child instanceof THREE.LineSegments) {
        line = child;
        break;
      }
    }
    if (!line) continue;

    let partMinY = Infinity;
    let partMaxY = -Infinity;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    const vertexCount = part.positions.length / 3;

    for (let i = 0; i < part.positions.length; i += 3) {
      const px = part.positions[i];
      const py = part.positions[i + 1];
      const pz = part.positions[i + 2];
      partMinY = Math.min(partMinY, py);
      partMaxY = Math.max(partMaxY, py);
      sumX += px;
      sumY += py;
      sumZ += pz;
    }

    const baseMaterial = (mesh.userData.baseMaterial as THREE.MeshStandardMaterial) ?? mesh.material;
    const targetOpacity = model.materials[part.material]?.opacity ?? 1;

    originalMeshStates.set(part.id, {
      meshVisible: mesh.visible,
      materialOpacity: baseMaterial.opacity,
      materialTransparent: baseMaterial.transparent,
      materialDepthWrite: baseMaterial.depthWrite,
      materialVisible: baseMaterial.visible,
      materialClippingPlanes: baseMaterial.clippingPlanes,
      lineVisible: line.visible,
      lineOpacity: (line.material as THREE.LineBasicMaterial).opacity,
      lineColor: (line.material as THREE.LineBasicMaterial).color.getHex(),
      lineTransparent: (line.material as THREE.LineBasicMaterial).transparent,
      lineClippingPlanes: (line.material as THREE.LineBasicMaterial).clippingPlanes,
    });

    records.push({
      id: part.id,
      category: part.category,
      label: part.label,
      storey: part.storey,
      minY: partMinY,
      maxY: partMaxY,
      centerY: vertexCount > 0 ? sumY / vertexCount : partMinY,
      centerX: vertexCount > 0 ? sumX / vertexCount : center.x,
      centerZ: vertexCount > 0 ? sumZ / vertexCount : center.z,
      targetOpacity,
      mesh,
      line,
      baseMaterial,
    });
  }

  // Priority order for elements at same elevation: slabs -> structural core/columns -> walls -> roof
  const categoryPriority: Record<string, number> = {
    slab: 1,
    column: 2,
    stair: 3,
    wall: 4,
    door: 5,
    window: 6,
    trim: 7,
    "roof-trim": 8,
    roof: 9,
    skylight: 10,
    solar: 11,
    fixture: 12,
    room: 13,
  };

  records.sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > 0.05) return a.minY - b.minY;
    const pA = categoryPriority[a.category] ?? 5;
    const pB = categoryPriority[b.category] ?? 5;
    return pA - pB;
  });

  // Storeys lookup
  const storeys = model.storeys ?? [
    { id: "ground", label: "Ground", elevation: minY },
    ...(model.floorElevations?.upper !== undefined
      ? [{ id: "upper", label: "Upper Floor", elevation: model.floorElevations.upper }]
      : []),
    { id: "roof", label: "Roof Level", elevation: maxY },
  ];

  const storeysList: DraftsmanStoreyItem[] = storeys.map((s) => {
    const fraction = height > 0 ? THREE.MathUtils.clamp((s.elevation - minY) / height, 0, 1) : 0;
    const storeyProgress = 0.15 + fraction * 0.50;
    return {
      label: s.label || s.id,
      elevation: s.elevation,
      progress: storeyProgress,
    };
  });


  // 1. Datum Construction Grid 3D Group
  const datumGroup = new THREE.Group();
  datumGroup.name = "magic-pencil-datum-grid";

  // Ground drafting grid
  const gridExtent = span * 1.5;
  const gridStep = Math.max(1, Math.round(span / 16));
  const gridPositions: number[] = [];
  const gridY = minY - 0.01;

  for (let x = -gridExtent; x <= gridExtent; x += gridStep) {
    gridPositions.push(center.x + x, gridY, center.z - gridExtent);
    gridPositions.push(center.x + x, gridY, center.z + gridExtent);
  }
  for (let z = -gridExtent; z <= gridExtent; z += gridStep) {
    gridPositions.push(center.x - gridExtent, gridY, center.z + z);
    gridPositions.push(center.x + gridExtent, gridY, center.z + z);
  }

    const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
  const gridMaterial = new THREE.LineBasicMaterial({
    color: "#1b406b",
    transparent: true,
    opacity: 0,
    depthTest: true,
  });
  const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
  datumGroup.add(gridLines);

  // Elevation datum benchmark axis (vertical measuring ruler with level ticks)
  const mastX = bounds.min.x - span * 0.18;
  const mastZ = center.z;
  const mastPositions: number[] = [];
  mastPositions.push(mastX, minY, mastZ, mastX, maxY + 2, mastZ);

  // Storey ticks
  for (const st of storeys) {
    mastPositions.push(mastX, st.elevation, mastZ);
    mastPositions.push(mastX + span * 0.08, st.elevation, mastZ);
  }

  const mastGeometry = new THREE.BufferGeometry();
  mastGeometry.setAttribute("position", new THREE.Float32BufferAttribute(mastPositions, 3));
  const mastMaterial = new THREE.LineBasicMaterial({
    color: pencilColor,
    transparent: true,
    opacity: 0,
    depthTest: true,
  });
  const mastLines = new THREE.LineSegments(mastGeometry, mastMaterial);
  datumGroup.add(mastLines);

  // Corner crop marks for architectural sheet aesthetic
  const cropPositions: number[] = [];
  const cropL = span * 0.06;
  const corners = [
    [bounds.min.x - 1, bounds.min.z - 1],
    [bounds.max.x + 1, bounds.min.z - 1],
    [bounds.max.x + 1, bounds.max.z + 1],
    [bounds.min.x - 1, bounds.max.z + 1],
  ];
  for (const [cx, cz] of corners) {
    cropPositions.push(cx - cropL, gridY, cz, cx + cropL, gridY, cz);
    cropPositions.push(cx, gridY, cz - cropL, cx, gridY, cz + cropL);
  }
  const cropGeometry = new THREE.BufferGeometry();
  cropGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cropPositions, 3));
  const cropMaterial = new THREE.LineBasicMaterial({
    color: "#3b82f6",
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const cropLines = new THREE.LineSegments(cropGeometry, cropMaterial);
  datumGroup.add(cropLines);

  scene.add(datumGroup);

  // Five upright drafting pencils share one seekable motion score.
  const pencilEnsemble = createCinematicPencils({ bounds, lines: records.map(r => r.line),
    duration: durationSeconds * 0.5, color: pencilColor, scale: pencilScale });
  const pencilGroup = pencilEnsemble.group;
  scene.add(pencilGroup);

  // 3. Section Cut Clipping Planes & Indicator
  let sectionCut: SectionCutMode = "none";
  const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  const sectionIndicatorGroup = new THREE.Group();
  sectionIndicatorGroup.name = "magic-pencil-section-indicator";
  sectionIndicatorGroup.visible = false;

  const secSpan = span * 1.5;
  const secFrameGeo = new THREE.BufferGeometry();
  const secHalf = secSpan / 2;
  const secFramePositions = [
    -secHalf, 0, -secHalf,  secHalf, 0, -secHalf,
     secHalf, 0, -secHalf,  secHalf, 0,  secHalf,
     secHalf, 0,  secHalf, -secHalf, 0,  secHalf,
    -secHalf, 0,  secHalf, -secHalf, 0, -secHalf,
  ];
  secFrameGeo.setAttribute("position", new THREE.Float32BufferAttribute(secFramePositions, 3));
  const secFrameMat = new THREE.LineBasicMaterial({
    color: pencilColor,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const secFrameLines = new THREE.LineSegments(secFrameGeo, secFrameMat);
  sectionIndicatorGroup.add(secFrameLines);

  const secFillGeo = new THREE.PlaneGeometry(secSpan, secSpan);
  secFillGeo.rotateX(-Math.PI / 2);
  const secFillMat = new THREE.MeshBasicMaterial({
    color: "#0c2747",
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const secFillMesh = new THREE.Mesh(secFillGeo, secFillMat);
  sectionIndicatorGroup.add(secFillMesh);
  scene.add(sectionIndicatorGroup);

  function updateClippingPlanes() {
    const planes = sectionCut !== "none" ? [sectionPlane] : [];
    for (const rec of records) {
      rec.baseMaterial.clippingPlanes = planes;
      (rec.line.material as THREE.LineBasicMaterial).clippingPlanes = planes;
    }
  }

  function updateSectionPlane() {
    if (sectionCut === "none") {
      sectionIndicatorGroup.visible = false;
      updateClippingPlanes();
      return;
    }

    sectionIndicatorGroup.visible = true;
    if (sectionCut === "plan") {
      const cutY = activeElevation + 1.2;
      sectionPlane.set(new THREE.Vector3(0, -1, 0), cutY);
      sectionIndicatorGroup.position.set(center.x, cutY, center.z);
      sectionIndicatorGroup.rotation.set(0, 0, 0);
    } else if (sectionCut === "section-x") {
      sectionPlane.set(new THREE.Vector3(-1, 0, 0), center.x);
      sectionIndicatorGroup.position.set(center.x, center.y, center.z);
      sectionIndicatorGroup.rotation.set(0, 0, Math.PI / 2);
    } else if (sectionCut === "section-z") {
      sectionPlane.set(new THREE.Vector3(0, 0, -1), center.z);
      sectionIndicatorGroup.position.set(center.x, center.y, center.z);
      sectionIndicatorGroup.rotation.set(Math.PI / 2, 0, 0);
    }
    updateClippingPlanes();
  }

  // 4. Architectural Dimensioning Engine
  const dimensioning = createArchitecturalDimensioning({
    scene,
    bounds,
    storeys: storeysList,
    invalidate,
  });

  function determinePhase(p: number): DraftsmanPhase {
    if (p <= 0.15) return "datum_grid";
    if (p <= 0.65) return "ascending_wireframe";
    if (p <= 0.82) return "ink_strengthening";
    if (p < 1.0) return "material_wash";
    return "complete";
  }

  function getStoreyAtElevation(y: number) {
    let current = storeys[0];
    for (const st of storeys) {
      if (y >= st.elevation - 0.2) current = st;
      else break;
    }
    return current;
  }

  let visibleMeshesCount = 0;
  let activeElevation = minY;
  let activeStoreyLabel = storeys[0]?.label ?? "Foundation";
  let activeCategory = "Grid";

  function applyProgress(p: number) {
    progress = THREE.MathUtils.clamp(p, 0, 1);
    const phase = determinePhase(progress);

    // 1. Datum Grid Phase (0.0 -> 0.15)
    if (progress <= 0.15) {
      const t = progress / 0.15; // 0 to 1
      datumGroup.visible = true;
      gridMaterial.opacity = t * 0.45;
      mastMaterial.opacity = t * 0.85;
      cropMaterial.opacity = t * 0.9;
      pencilGroup.visible = false;

      activeElevation = minY;
      activeStoreyLabel = "Construction Datum & Grid";
      activeCategory = "Grid Axis";
      visibleMeshesCount = 0;

      // All building elements hidden during initial grid layout
      for (const rec of records) {
        rec.mesh.visible = false;
        rec.line.visible = false;
      }
    }
    // 2. Ascending Wireframe Tracing Phase (0.15 -> 0.65)
    else if (progress <= 0.65) {
      datumGroup.visible = true;
      gridMaterial.opacity = 0.35;
      mastMaterial.opacity = 0.65;
      cropMaterial.opacity = 0.7;

      const t = (progress - 0.15) / 0.5; // 0 to 1
      activeElevation = minY + height * t;
      const st = getStoreyAtElevation(activeElevation);
      activeStoreyLabel = `${st.label} (${activeElevation >= 0 ? "+" : ""}${activeElevation.toFixed(1)}m)`;

      pencilGroup.visible = true;

      // Find objects on active frontier to position the pencil
      let frontierCategory = "Structure";

      let count = 0;
      for (const rec of records) {
        const isPastElevation = rec.minY <= activeElevation;
        rec.mesh.visible = isPastElevation;

        if (isPastElevation) {
          count++;
          // Wireframe line visible with drafting pencil weight
          rec.line.visible = true;
          const lineMat = rec.line.material as THREE.LineBasicMaterial;
          lineMat.transparent = true;
          lineMat.opacity = 0.70;
          lineMat.color.set(pencilColor);

          // Solid mesh invisible during wireframe phase
          rec.baseMaterial.visible = false;

          // If this element is right at the active cutting edge
          if (rec.maxY >= activeElevation - 1.2 && rec.minY <= activeElevation + 0.5) {
            frontierCategory = rec.category;
          }
        } else {
          rec.line.visible = false;
          rec.baseMaterial.visible = false;
        }
      }

      visibleMeshesCount = count;
      activeCategory = frontierCategory.charAt(0).toUpperCase() + frontierCategory.slice(1);

      pencilEnsemble.update(t * durationSeconds * 0.5);
    }
    // 3. Ink Strengthening & Line Weight Phase (0.65 -> 0.82)
    else if (progress <= 0.82) {
      datumGroup.visible = true;
      gridMaterial.opacity = 0.25;
      mastMaterial.opacity = 0.5;
      pencilGroup.visible = false;

      const t = (progress - 0.65) / 0.17; // 0 to 1
      activeElevation = maxY;
      activeStoreyLabel = "All Levels Traced";
      activeCategory = "Technical Ink & Profile Weight";
      visibleMeshesCount = records.length;

      // Interpolate from pencil (#1877F2, 0.65) to deep technical slate ink (#0c2340, 0.95)
      const currentOpacity = 0.65 + 0.3 * t;
      const inkColor = new THREE.Color(pencilColor).lerp(new THREE.Color("#0c2340"), t);

      for (const rec of records) {
        rec.mesh.visible = true;
        rec.line.visible = true;
        rec.baseMaterial.visible = false;
        const lineMat = rec.line.material as THREE.LineBasicMaterial;
        lineMat.transparent = true;
        lineMat.opacity = currentOpacity;
        lineMat.color.copy(inkColor);
      }
    }
    // 4. Material Wash & Solid Shading Phase (0.82 -> 1.0)
    else {
      datumGroup.visible = progress < 0.98;
      gridMaterial.opacity = Math.max(0, 0.25 * (1 - (progress - 0.82) / 0.18));
      mastMaterial.opacity = Math.max(0, 0.5 * (1 - (progress - 0.82) / 0.18));
      pencilGroup.visible = false;

      const t = (progress - 0.82) / 0.18; // 0 to 1
      const washY = minY + height * t;
      activeElevation = washY;
      activeStoreyLabel = progress >= 1.0 ? "Fully Rendered" : `Material Wash (+${washY.toFixed(1)}m)`;
      activeCategory = "Architectural Surface Wash";
      visibleMeshesCount = records.length;

      for (const rec of records) {
        rec.mesh.visible = true;
        rec.line.visible = true;

        const isWashed = rec.minY <= washY;
        rec.baseMaterial.visible = true;

        if (isWashed) {
          const depth = Math.min(1, Math.max(0, (washY - rec.minY) / (height * 0.25) + 0.3));
          rec.baseMaterial.transparent = true;
          rec.baseMaterial.opacity = rec.targetOpacity * Math.min(1, depth);
          rec.baseMaterial.depthWrite = progress >= 0.99 ? rec.targetOpacity >= 0.99 : false;
        } else {
          rec.baseMaterial.transparent = true;
          rec.baseMaterial.opacity = rec.targetOpacity * 0.05 * t;
          rec.baseMaterial.depthWrite = false;
        }

        // Return edge lines smoothly to clean slate edge weight
        const lineMat = rec.line.material as THREE.LineBasicMaterial;
        lineMat.opacity = THREE.MathUtils.lerp(0.95, 0.35, t);
        lineMat.color.set("#2c3b4d");
      }
    }

    if (sectionCut === "plan") {
      updateSectionPlane();
    }

    // Telemetry on canvas element for Fast CDP automated testing
    domElement.dataset.drawMode = mode !== "idle" ? "active" : "inactive";
    domElement.dataset.drawState = mode;
    domElement.dataset.drawPhase = phase;
    domElement.dataset.drawProgress = progress.toFixed(3);
    domElement.dataset.drawStorey = activeStoreyLabel;
    domElement.dataset.drawElevation = activeElevation.toFixed(2);
    domElement.dataset.drawVisibleMeshes = String(visibleMeshesCount);
    domElement.dataset.drawTotalMeshes = String(records.length);
    domElement.dataset.drawSection = sectionCut;
    domElement.dataset.drawDimensions = dimensioning.isVisible() ? "active" : "inactive";
    domElement.dataset.drawPencilScale = pencilScale.toFixed(2);
    domElement.dataset.drawPencilCount = String(PENCIL_COUNT);
    domElement.dataset.drawScribbleSeconds = String(SCRIBBLE_SECONDS);
    domElement.dataset.drawPencilColor = pencilColor;
    domElement.dataset.drawDockPosition = dockPosition;
    domElement.dataset.drawSpeed = speed.toFixed(2);

    if (onStatusChange) {
      onStatusChange({
        mode,
        phase,
        progress,
        activeElevation,
        activeStoreyLabel,
        activeCategory,
        visibleMeshCount: visibleMeshesCount,
        totalMeshCount: records.length,
        speed,
        durationSeconds,
        cinematicOrbit,
        storeys: storeysList,
        sectionCut,
        dimensionsVisible: dimensioning.isVisible(),
        dimensions: dimensioning.getData(),
        pencilScale,
        pencilColor,
        dockPosition,
      });
    }

    invalidate();
  }

  let cinematicOrbit = false;
  let orbitAngle = 0;

  function toggleCinematicOrbit(): boolean {
    cinematicOrbit = !cinematicOrbit;
    if (cinematicOrbit && options.camera && options.controls) {
      const offset = options.camera.position.clone().sub(options.controls.target);
      orbitAngle = Math.atan2(offset.z, offset.x);
    }
    applyProgress(progress);
    return cinematicOrbit;
  }

  function setCinematicOrbit(enabled: boolean) {
    cinematicOrbit = enabled;
    if (cinematicOrbit && options.camera && options.controls) {
      const offset = options.camera.position.clone().sub(options.controls.target);
      orbitAngle = Math.atan2(offset.z, offset.x);
    }
    applyProgress(progress);
  }

  function jumpToStorey(storeyIndexOrLabel: number | string) {
    const query = String(storeyIndexOrLabel).trim().toLowerCase();
    let target = storeysList.find((s) => {
      const lbl = s.label.toLowerCase();
      if (lbl === query || lbl.includes(query)) return true;
      const queryDigits = query.replace(/\D/g, "");
      const labelDigits = lbl.replace(/\D/g, "");
      if (queryDigits && labelDigits && parseInt(queryDigits, 10) === parseInt(labelDigits, 10)) {
        return true;
      }
      return false;
    });
    if (!target && typeof storeyIndexOrLabel === "number") {
      const idx = Math.max(0, Math.min(storeysList.length - 1, Math.floor(storeyIndexOrLabel)));
      target = storeysList[idx];
    }
    if (target) {
      seek(target.progress);
    }
  }

  function captureBlueprint(filename?: string): BlueprintSheetResult {
    options.renderBeforeCapture?.();
    const meta: BlueprintSheetMetadata = {
      projectTitle: model.source.title ?? model.source.name.replace(/\.pdf$/i, ""),
      phaseLabel: determinePhase(progress),
      storeyLabel: activeStoreyLabel,
      elevationMetres: activeElevation,
      meshCount: visibleMeshesCount,
      totalMeshes: records.length,
      speed,
      sourceSha256: model.source.sha256,
    };
    const result = createBlueprintSheet(domElement, meta);
    if (filename) result.download(filename);
    return result;
  }

  function toggleSectionCut(): SectionCutMode {
    const modes: SectionCutMode[] = ["none", "plan", "section-x", "section-z"];
    const nextIdx = (modes.indexOf(sectionCut) + 1) % modes.length;
    sectionCut = modes[nextIdx];
    updateSectionPlane();
    applyProgress(progress);
    return sectionCut;
  }

  function setSectionCut(mode: SectionCutMode) {
    sectionCut = mode;
    updateSectionPlane();
    applyProgress(progress);
  }

  function toggleDimensions(): boolean {
    const v = dimensioning.toggle();
    applyProgress(progress);
    return v;
  }

  function setDimensions(enabled: boolean) {
    dimensioning.setVisible(enabled);
    applyProgress(progress);
  }

  function capturePlanBook(): BlueprintBookResult {
    options.renderBeforeCapture?.();
    return generatePlanBook({
      model,
      storeys: storeysList,
      canvasSnapshot: domElement,
      activeStoreyLabel,
      activeElevation,
      dimensions: dimensioning.getData(),
    });
  }

  function setPencilScale(scale: number) {
    pencilScale = Math.max(0.2, Math.min(5.0, scale));
    pencilEnsemble.setScale(pencilScale);
    domElement.dataset.drawPencilScale = pencilScale.toFixed(2);
    applyProgress(progress);
    invalidate();
  }

  function getPencilScale(): number {
    return pencilScale;
  }

  function setPencilColor(color: string) {
    pencilColor = color === "facebook-blue" ? "#1877F2" : color;
    pencilEnsemble.setColor(pencilColor);
    mastMaterial.color.set(pencilColor);
    secFrameMat.color.set(pencilColor);
    domElement.dataset.drawPencilColor = pencilColor;
    applyProgress(progress);
    invalidate();
  }

  function getPencilColor(): string {
    return pencilColor;
  }

  function setDockPosition(pos: "bottom-left" | "bottom-center") {
    dockPosition = pos;
    domElement.dataset.drawDockPosition = dockPosition;
    applyProgress(progress);
    invalidate();
  }

  function getDockPosition(): "bottom-left" | "bottom-center" {
    return dockPosition;
  }

  function tick(timestamp: number): boolean {
    let needsInvalidate = false;

    if (!lastTime) {
      lastTime = timestamp;
      return mode === "drawing" || cinematicOrbit;
    }

    const deltaMs = timestamp - lastTime;
    lastTime = timestamp;

    if (mode === "drawing") {
      const deltaProgress = (deltaMs / 1000 / durationSeconds) * speed;
      const nextProgress = progress + deltaProgress;

      if (nextProgress >= 1.0) {
        mode = "complete";
        applyProgress(1.0);
      } else {
        applyProgress(nextProgress);
        needsInvalidate = true;
      }
    }

    if (cinematicOrbit && options.camera && options.controls) {
      const deltaSec = deltaMs / 1000;
      orbitAngle += 0.22 * deltaSec; // ~12 degrees per second
      const radius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 1.5;
      const target = options.controls.target;
      const targetY = minY + (activeElevation - minY) * 0.45;

      options.camera.position.x = center.x + radius * Math.cos(orbitAngle);
      options.camera.position.z = center.z + radius * Math.sin(orbitAngle);
      options.camera.position.y = targetY + radius * 0.45;
      target.x = center.x;
      target.z = center.z;
      target.y = targetY;
      options.controls.update();
      needsInvalidate = true;
    }

    return needsInvalidate;
  }

  function play() {
    if (progress >= 1.0) progress = 0;
    mode = "drawing";
    lastTime = 0;
    applyProgress(progress);
  }

  function pause() {
    mode = "paused";
    lastTime = 0;
    applyProgress(progress);
  }

  function replay() {
    progress = 0;
    mode = "drawing";
    lastTime = 0;
    applyProgress(0);
  }

  function seek(p: number) {
    if (!Number.isFinite(p)) throw Error("Drawing progress must be finite.");
    if (mode === "idle") mode = "paused";
    applyProgress(p);
    if (p >= 1.0) mode = "complete";
    else if (mode === "complete") mode = "paused";
  }

  function setSpeed(s: number) {
    if (!Number.isFinite(s)) throw Error("Drawing speed must be finite.");
    speed = Math.max(0.1, Math.min(10, s));
    applyProgress(progress);
  }

  function finish() {
    mode = "complete";
    applyProgress(1.0);
  }

  function restoreOriginal() {
    mode = "idle";
    cinematicOrbit = false;
    lastTime = 0;
    datumGroup.visible = false;
    pencilGroup.visible = false;
    for (const [id, original] of originalMeshStates) {
      const mesh = meshMap.get(id);
      if (!mesh) continue;
      mesh.visible = original.meshVisible;
      const base = (mesh.userData.baseMaterial as THREE.MeshStandardMaterial) ?? mesh.material;
      base.visible = original.materialVisible;
      base.opacity = original.materialOpacity;
      base.transparent = original.materialTransparent;
      base.depthWrite = original.materialDepthWrite;
      base.clippingPlanes = original.materialClippingPlanes;

      for (const child of mesh.children) {
        if (child instanceof THREE.LineSegments) {
          child.visible = original.lineVisible;
          const mat = child.material as THREE.LineBasicMaterial;
          mat.opacity = original.lineOpacity;
          mat.color.setHex(original.lineColor);
          mat.transparent = original.lineTransparent;
          mat.clippingPlanes = original.lineClippingPlanes;
        }
      }
    }
    sectionCut = "none";
    if (options.controls && originalControlTarget) options.controls.target.copy(originalControlTarget);
    if (options.camera && originalCameraPosition && originalCameraQuaternion) {
      options.camera.position.copy(originalCameraPosition);
      options.camera.quaternion.copy(originalCameraQuaternion);
      options.controls?.update();
    }
    sectionIndicatorGroup.visible = false;
    dimensioning.setVisible(false);
    domElement.dataset.drawMode = "inactive";
    domElement.dataset.drawState = "idle";
    domElement.dataset.drawSection = "none";
    domElement.dataset.drawDimensions = "inactive";
    invalidate();
  }

  function dispose() {
    restoreOriginal();
    dimensioning.dispose();
    scene.remove(sectionIndicatorGroup);
    secFrameGeo.dispose();
    secFrameMat.dispose();
    secFillGeo.dispose();
    secFillMat.dispose();
    scene.remove(datumGroup);
    scene.remove(pencilGroup);
    gridGeometry.dispose();
    gridMaterial.dispose();
    mastGeometry.dispose();
    mastMaterial.dispose();
    cropGeometry.dispose();
    cropMaterial.dispose();
    pencilEnsemble.dispose();
    if (typeof window !== "undefined") {
      const host = window as unknown as { __magicPencil?: typeof api };
      if (host.__magicPencil === api) delete host.__magicPencil;
    }
  }

  // Register on window for Fast CDP opcode test execution
  const api = {
    getPencilMotion: () => ({ count: PENCIL_COUNT, scribbleSeconds: SCRIBBLE_SECONDS, visible: pencilGroup.visible, poses: pencilEnsemble.getPoses() }),
    play,
    pause,
    replay,
    seek,
    setSpeed,
    finish,
    toggleCinematicOrbit,
    setCinematicOrbit,
    jumpToStorey,
    captureBlueprint,
    toggleSectionCut,
    setSectionCut,
    toggleDimensions,
    setDimensions,
    capturePlanBook,
    setPencilScale,
    getPencilScale,
    setPencilColor,
    getPencilColor,
    setDockPosition,
    getDockPosition,
    getDimensions: () => dimensioning.getData(),
    getStoreys: () => storeysList,
    getStatus: (): DraftsmanStatus => ({
      mode,
      phase: determinePhase(progress),
      progress,
      activeElevation,
      activeStoreyLabel,
      activeCategory,
      visibleMeshCount: visibleMeshesCount,
      totalMeshCount: records.length,
      speed,
      durationSeconds,
      cinematicOrbit,
      storeys: storeysList,
      sectionCut,
      dimensionsVisible: dimensioning.isVisible(),
      dimensions: dimensioning.getData(),
      pencilScale,
      pencilColor,
      dockPosition,
    }),
    tick,
    dispose,
    restoreOriginal,
  };

  if (typeof window !== "undefined") {
    (window as unknown as { __magicPencil: typeof api }).__magicPencil = api;
  }

  return api;
}
