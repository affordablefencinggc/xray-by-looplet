import { useContext, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Magnet } from "lucide-react";
import { HOUSE, PAL, PLAN, SHEETS, type Seg, type SheetKind } from "./geometry";
import { useStudio } from "./store";
import { mountWireframe, type Elem } from "./wireframeGl";
import { getSnapPoint, type SnapTarget } from "./snapping";
import { computeFaces } from "./faces";
import { buildElevationStack } from "./elevationStack";
import { buildWtcGeometry } from "./wtcModel";
import { buildFencingGeometry } from "./fencingModel";
import type { CalibrationPoint } from "./calibration";
import type { FenceRun } from "./domain";
import { sourceViewport, sourceToCanvas, canvasToSource, pointOnSource, snapSourcePoint, type SourceBounds } from "./documentViewport";

import { SourceScopeContext } from "./DocumentPreview";
import { PlanScope, type DrawScopeScene } from "./PlanScope";
import { scopeFrame, throughScope, insideScope, routeScopeWheel, type ScopeFrame } from "./precisionScope";
import "./planScope.css";
const EMPTY_CALIBRATION_POINTS: readonly CalibrationPoint[] = [];

export function IsoCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; az: number; el: number; pan: boolean } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const viewer = mountWireframe(canvas, {
      getElements() {
        const s = useStudio.getState();
        const out: Elem[] = [];

        // Project Preset 1: World Trade Center WTC 1 (281 columns)
        if (s.projectPreset === "wtc") {
          const wtc = buildWtcGeometry(s.wtcLayers);
          for (const seg of wtc.perimeter) {
            out.push({
              type: "perimeter",
              colour: PAL.cyan,
              a: [seg[0], seg[1], seg[2]],
              b: [seg[3], seg[4], seg[5]],
            });
          }
          for (const seg of wtc.core) {
            out.push({
              type: "core",
              colour: PAL.roof,
              a: [seg[0], seg[1], seg[2]],
              b: [seg[3], seg[4], seg[5]],
            });
          }
          for (const seg of wtc.floorLines) {
            out.push({
              type: "floors",
              colour: PAL.mist,
              a: [seg[0], seg[1], seg[2]],
              b: [seg[3], seg[4], seg[5]],
            });
          }
          return out;
        }

        // Project Preset 2: Fencing Boundary (48 lm Colorbond)
        if (s.projectPreset === "fencing") {
          const f = buildFencingGeometry();
          for (const seg of f) {
            out.push({
              type: "fencing",
              colour: PAL.cyan,
              a: [seg[0], seg[1], seg[2]],
              b: [seg[3], seg[4], seg[5]],
            });
          }
          return out;
        }

        const kind = SHEETS[s.sheet]?.kind ?? "elev";
        const geom = kind === "elev" || kind === "detail" ? HOUSE : PLAN;

        if (s.showSrc) {
          out.push(
            ...buildElevationStack({
              buildingSegs: geom.B,
              roofSegs: geom.R,
              floors: s.floors,
              pose: s.pose,
              skin: s.skin,
              floorHeight: 2.8,
              explode: s.explodeFloors,
              activeFloor: s.activeFloor,
              showBld: s.showBld,
              showRoof: s.showRoof,
            })
          );
        }
        if (s.showMan) {
          for (const m of s.markups) {
            if (m.kind !== "sketch" && m.kind !== "length") continue;
            const pts = m.points;
            for (let i = 0; i < pts.length - 1; i++) {
              const y = s.height * (s.pose === "laid" ? 0.02 : 1);
              out.push({
                type: "manual",
                colour: PAL.manual,
                a: [pts[i].x, pts[i].y, y],
                b: [pts[i + 1].x, pts[i + 1].y, y],
              });
            }
          }
        }
        return out;
      },
      getFaces() {
        return computeFaces(useStudio.getState());
      },
      getCam() {
        const s = useStudio.getState();
        return { az: s.az, el: s.el, dist: s.dist };
      },
      getClear() {
        const navy = useStudio.getState().skin === "navy";
        return navy ? [0.02, 0.043, 0.078, 1] : [0.949, 0.929, 0.89, 1];
      },
    });

    const unsub = useStudio.subscribe((s, prev) => {
      if (
        s.sheet !== prev.sheet ||
        s.showSrc !== prev.showSrc ||
        s.showBld !== prev.showBld ||
        s.showRoof !== prev.showRoof ||
        s.showMan !== prev.showMan ||
        s.showSurfaces !== prev.showSurfaces ||
        s.floors !== prev.floors ||
        s.explodeFloors !== prev.explodeFloors ||
        s.activeFloor !== prev.activeFloor ||
        s.pose !== prev.pose ||
        s.skin !== prev.skin ||
        s.markups !== prev.markups ||
        s.height !== prev.height
      ) {
        viewer.rebuild();
      }
    });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStudio.getState();
      st.setDist(Math.max(0.1, Math.min(8, st.dist * (1 + Math.sign(e.deltaY) * 0.1))));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const onCtx = (e: Event) => e.preventDefault();
    canvas.addEventListener("contextmenu", onCtx);

    return () => {
      unsub();
      viewer.stop();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onCtx);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      onPointerDown={(e) => {
        const s = useStudio.getState();
        drag.current = { x: e.clientX, y: e.clientY, az: s.az, el: s.el, pan: e.button === 2 || e.shiftKey };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        useStudio.getState().setOrbit(
          drag.current.az + dx * 0.006,
          Math.max(-0.7, Math.min(1.4, drag.current.el - dy * 0.005)),
        );
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        drag.current.az = useStudio.getState().az;
        drag.current.el = useStudio.getState().el;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}

export type PlanCanvasViewport = {
  width: number;
  height: number;
  zoom: number;
  pan: CalibrationPoint;
  kind: SheetKind;
  floors: number;
  sourceBounds?: SourceBounds | null;
};

export type PlanCanvasProps = {
  interactive: boolean;
  sourceMode?: "procedural" | "overlay";
  sourceBounds?: SourceBounds | null;
  legacyReadOnly?: boolean;
  calibrationCaptureActive?: boolean;
  calibrationPoints?: readonly CalibrationPoint[];
  onCalibrationPoint?: (point: CalibrationPoint) => void;
  selectedRunId?: string | null;
  selectedVertexIndex?: number | null;
  editMode?: "select" | "move" | "insert";
  onSelectRun?: (runId: string | null) => void;
  onSelectVertex?: (runId: string, vertexIndex: number) => void;
  onMoveVertex?: (runId: string, vertexIndex: number, point: CalibrationPoint) => void;
};

function getPlanCanvasGeometry(viewport: PlanCanvasViewport) {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const totalHeight = viewport.kind === "elev" ? viewport.floors * 2.8 + 2 : 7.2;
  const padding = 48;
  const scale = Math.min(
    (viewport.width - padding * 2) / 18,
    (viewport.height - padding * 2) / totalHeight,
  );
  return {
    centerX,
    centerY,
    totalHeight,
    scale,
    offsetX: (viewport.width - 18 * scale) / 2,
    offsetY: (viewport.height - totalHeight * scale) / 2,
  };
}

/** Maps a pointer position in the rendered canvas to the document coordinates used by tracing. */
export function canvasPointToDocumentPoint(
  point: CalibrationPoint,
  viewport: PlanCanvasViewport,
): CalibrationPoint {
  if(viewport.sourceBounds) {
    const frame=sourceViewport(viewport.sourceBounds,viewport.width,viewport.height,viewport.zoom,viewport.pan);
    if(!frame)throw Error("Source viewport is unavailable.");
    return canvasToSource(point,frame);
  }
  const geometry = getPlanCanvasGeometry(viewport);
  const untransformedX = geometry.centerX
    + (point.x - geometry.centerX - viewport.pan.x) / viewport.zoom;
  const untransformedY = geometry.centerY
    + (point.y - geometry.centerY - viewport.pan.y) / viewport.zoom;

  return {
    x: (untransformedX - geometry.offsetX) / geometry.scale,
    y: viewport.kind === "elev"
      ? geometry.totalHeight - (untransformedY - geometry.offsetY) / geometry.scale
      : (untransformedY - geometry.offsetY) / geometry.scale,
  };
}

/** Inverse of canvasPointToDocumentPoint, including the current zoom and pan. */
export function documentPointToCanvasPoint(
  point: CalibrationPoint,
  viewport: PlanCanvasViewport,
): CalibrationPoint {
  if(viewport.sourceBounds) {
    const frame=sourceViewport(viewport.sourceBounds,viewport.width,viewport.height,viewport.zoom,viewport.pan);
    if(!frame)throw Error("Source viewport is unavailable.");
    return sourceToCanvas(point,frame);
  }
  const geometry = getPlanCanvasGeometry(viewport);
  const untransformedX = geometry.offsetX + point.x * geometry.scale;
  const untransformedY = viewport.kind === "elev"
    ? geometry.offsetY + (geometry.totalHeight - point.y) * geometry.scale
    : geometry.offsetY + point.y * geometry.scale;

  return {
    x: geometry.centerX + viewport.pan.x
      + (untransformedX - geometry.centerX) * viewport.zoom,
    y: geometry.centerY + viewport.pan.y
      + (untransformedY - geometry.centerY) * viewport.zoom,
  };
}

export function resolvePlanCanvasPointerMode(input: {
  calibrationCaptureActive: boolean;
  interactive: boolean;
  button: number;
  shiftKey: boolean;
  toolActive: boolean;
}): "calibration" | "pan" | "trace" {
  if (input.calibrationCaptureActive) return "calibration";
  if (!input.interactive || input.button === 2 || input.button === 1 || input.shiftKey || !input.toolActive) {
    return "pan";
  }
  return "trace";
}

export type RunPathHit = {
  runId: string;
  segmentIndex: number;
  distancePx: number;
};

export type RunVertexHit = {
  runId: string;
  vertexIndex: number;
  distancePx: number;
};

function distanceToSegment(
  point: CalibrationPoint,
  start: CalibrationPoint,
  end: CalibrationPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
  ));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Hit-tests the closest visible segment using a screen-pixel tolerance. */
export function hitTestFenceRuns(
  canvasPoint: CalibrationPoint,
  runs: readonly Pick<FenceRun, "id" | "points">[],
  viewport: PlanCanvasViewport,
  tolerancePx = 10,
): RunPathHit | null {
  let closest: RunPathHit | null = null;
  for (const run of runs) {
    for (let segmentIndex = 0; segmentIndex < run.points.length - 1; segmentIndex += 1) {
      const start = documentPointToCanvasPoint(run.points[segmentIndex], viewport);
      const end = documentPointToCanvasPoint(run.points[segmentIndex + 1], viewport);
      const distancePx = distanceToSegment(canvasPoint, start, end);
      if (distancePx <= tolerancePx && (!closest || distancePx < closest.distancePx)) {
        closest = { runId: run.id, segmentIndex, distancePx };
      }
    }
  }
  return closest;
}

/** Hit-tests the closest vertex handle on a selected run. */
export function hitTestRunVertices(
  canvasPoint: CalibrationPoint,
  run: Pick<FenceRun, "id" | "points">,
  viewport: PlanCanvasViewport,
  tolerancePx = 12,
): RunVertexHit | null {
  let closest: RunVertexHit | null = null;
  run.points.forEach((point, vertexIndex) => {
    const rendered = documentPointToCanvasPoint(point, viewport);
    const distancePx = Math.hypot(canvasPoint.x - rendered.x, canvasPoint.y - rendered.y);
    if (distancePx <= tolerancePx && (!closest || distancePx < closest.distancePx)) {
      closest = { runId: run.id, vertexIndex, distancePx };
    }
  });
  return closest;
}

export function resolveTracingCanvasPointerMode(input: {
  calibrationCaptureActive: boolean;
  interactive: boolean;
  button: number;
  shiftKey: boolean;
  toolActive: boolean;
  vertexHit: boolean;
  runHit: boolean;
  vertexEditingEnabled: boolean;
  runSelectionEnabled: boolean;
  placementToolActive?: boolean;
  editMode?: "select" | "move" | "insert";
}): "calibration" | "move-vertex" | "select-vertex" | "select-run" | "pan" | "trace" {
  if (input.calibrationCaptureActive) return "calibration";
  if (!input.interactive || input.button === 2 || input.button === 1 || input.shiftKey) return "pan";
  if (input.toolActive || input.placementToolActive) return "trace";
  if (input.vertexHit && input.vertexEditingEnabled && input.editMode === "move") return "move-vertex";
  if (input.vertexHit && input.runSelectionEnabled) return "select-vertex";
  if (input.runSelectionEnabled && input.runHit) return "select-run";
  return input.toolActive ? "trace" : "pan";
}

export type VertexDragPreview = {
  documentId: string | null; sourceSha256: string | null; sheet: number; runId: string; runRevision: number;
  vertexIndex: number; originalPoint: CalibrationPoint; point: CalibrationPoint;
};

/** A release may commit only against the exact source and run where the gesture began. */
export function vertexDragCommitPoint(preview: VertexDragPreview | null, current: {
  documentId: string | null; sourceSha256: string | null; sheet: number; run?: Pick<FenceRun, "id" | "revision" | "points">;
  allowed: boolean;
}): CalibrationPoint | null {
  if (!preview || !current.allowed || preview.documentId !== current.documentId || preview.sourceSha256 !== current.sourceSha256 || preview.sheet !== current.sheet ||
    preview.runId !== current.run?.id || preview.runRevision !== (current.run.revision ?? 1)) return null;
  const original = current.run.points[preview.vertexIndex];
  if (!original || original.x !== preview.originalPoint.x || original.y !== preview.originalPoint.y ||
    !Number.isFinite(preview.point.x) || !Number.isFinite(preview.point.y) ||
    (preview.point.x === original.x && preview.point.y === original.y)) return null;
  return preview.point;
}

export function PlanCanvas({
  interactive,
  sourceMode = "procedural",
  sourceBounds = null,
  legacyReadOnly = false,
  calibrationCaptureActive = false,
  calibrationPoints = EMPTY_CALIBRATION_POINTS,
  onCalibrationPoint,
  selectedRunId = null,
  selectedVertexIndex = null,
  editMode = "select",
  onSelectRun,
  onSelectVertex,
  onMoveVertex,
}: PlanCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useStudio();
  const zoom = s.zoom2d;
  const pan = s.pan2d;
  const activeDocument = s.job.documents.find((document) => document.id === s.job.activeDocumentId);
  const pageCount = activeDocument?.pageCount ?? 1;
  const [vertexPreview, setVertexPreview] = useState<VertexDragPreview | null>(null);
  const vertexPreviewRef = useRef<VertexDragPreview | null>(null);
  const updateVertexPreview = (preview: VertexDragPreview | null) => { vertexPreviewRef.current = preview; setVertexPreview(preview); };
  const currentRuns = s.job.runs.filter((run) => run.sheet === s.sheet).map(run =>
    vertexPreview && vertexPreview.runId === run.id && vertexPreview.documentId === s.job.activeDocumentId &&
    vertexPreview.sheet === s.sheet && vertexPreview.runRevision === (run.revision ?? 1)
      ? { ...run, points: run.points.map((point, index) => index === vertexPreview.vertexIndex ? vertexPreview.point : point) } : run);
  const currentGates = s.job.gates.filter((gate) => gate.sheet === s.sheet);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverSnap, setHoverSnap] = useState<SnapTarget | null>(null);
  const drag = useRef<
    | { kind: "pan"; x: number; y: number }
    | { kind: "vertex"; runId: string; vertexIndex: number }
    | null
  >(null);
  const lastPointerMode = useRef<ReturnType<typeof resolveTracingCanvasPointerMode> | null>(null);
  const paintSource = useContext(SourceScopeContext);
  const [scopeEnabled, setScopeEnabled] = useState(false);
  const [scopeZoom, setScopeZoom] = useState(4);
  const [scopeAnchor, setScopeAnchor] = useState<{ x: number; y: number } | null>(null);
  const [placingScope, setPlacingScope] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [scopeDraw, setScopeDraw] = useState<DrawScopeScene | null>(null);
  const precisionFrame = useMemo(() => scopeEnabled && (sourceMode !== "overlay" || sourceBounds)
    ? scopeFrame(canvasSize.width, canvasSize.height, scopeAnchor ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 },
      { enabled: true, zoom: scopeZoom, diameter: 280 }, window.devicePixelRatio || 1) : null,
    [scopeEnabled, scopeAnchor, scopeZoom, canvasSize, sourceMode, sourceBounds]);
  const lensRef = useRef(precisionFrame); lensRef.current = precisionFrame;
  useEffect(() => {
    setScopeAnchor(null); setPlacingScope(false); drag.current = null; updateVertexPreview(null); setIsDragging(false);
  }, [s.sheet, s.job.activeDocumentId]);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const resize = () => setCanvasSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setScopeEnabled(false); setPlacingScope(false); drag.current = null; updateVertexPreview(null); setIsDragging(false); } };
    window.addEventListener("keydown", escape);
    return () => { observer.disconnect(); window.removeEventListener("keydown", escape); };
  }, []);
  const canvasPointer = (e: { clientX: number; clientY: number }) => {
    const canvas = ref.current!, r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.clientWidth / r.width, y: (e.clientY - r.top) * canvas.clientHeight / r.height };
  };
  const precisePointer = (e: { clientX: number; clientY: number }) => {
    const point = canvasPointer(e);
    return lensRef.current ? throughScope(point, lensRef.current) : point;
  };
  const pointerMagnification = (e: { clientX: number; clientY: number }) =>
    lensRef.current && insideScope(canvasPointer(e), lensRef.current) ? scopeZoom : 1;


  const zoomCenter = (factor: number) => {
    const oldZoom = s.zoom2d;
    const newZoom = Math.max(0.1, Math.min(20, oldZoom * factor));
    const ratio = newZoom / oldZoom;
    s.setZoom2d(newZoom);
    s.setPan2d({ x: s.pan2d.x * ratio, y: s.pan2d.y * ratio });
  };

  const handleZoomIn = () => {
    zoomCenter(1.25);
  };

  const handleZoomOut = () => {
    zoomCenter(1 / 1.25);
  };

  const handleReset = () => {
    s.setZoom2d(1);
    s.setPan2d({ x: 0, y: 0 });
  };

  function toWorld(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    const kind = SHEETS[s.sheet]?.kind ?? "elev";
    return canvasPointToDocumentPoint(
      precisePointer(e),
      { width: canvas.clientWidth, height: canvas.clientHeight, zoom, pan, kind, floors: s.floors, sourceBounds },
    );
  }

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const onWheel = (e: WheelEvent) => {
      if (routeScopeWheel(e, canvasPointer(e), lensRef.current, scopeZoom, setScopeZoom)) return;
      e.preventDefault();
      const zoomFactor = 1.1;
      const f = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
      
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      const st = useStudio.getState();
      const oldZoom = st.zoom2d;
      const newZoom = Math.max(0.1, Math.min(20, oldZoom * f));
      const ratio = newZoom / oldZoom;
      st.setZoom2d(newZoom);
      st.setPan2d({
        x: mx - cx - (mx - cx - st.pan2d.x) * ratio,
        y: my - cy - (my - cy - st.pan2d.y) * ratio,
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    const drawScene = (ctx: CanvasRenderingContext2D, crop?: ScopeFrame) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      if (!crop) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        const scale = crop.pixels / crop.sampleSize;
        ctx.setTransform(scale, 0, 0, scale, -crop.sampleLeft * scale, -crop.sampleTop * scale);
      }

      const drawZoom = zoom * (crop ? crop.diameter / crop.sampleSize : 1);
      const navy = s.skin === "navy";
      if (!crop) ctx.clearRect(0, 0, w, h);
      else { ctx.fillStyle = "#e4e5e7"; ctx.fillRect(crop.sampleLeft, crop.sampleTop, crop.sampleSize, crop.sampleSize); }
      if (crop && sourceMode === "overlay") paintSource?.(ctx);
      if(sourceMode === "overlay" && (!sourceBounds || legacyReadOnly))return;
      if (sourceMode === "procedural") {
        ctx.fillStyle = navy ? PAL.navy : PAL.paper;
        ctx.fillRect(0, 0, w, h);
      }

      // Apply zoom & pan transformations
      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(pan.x, pan.y);
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      const kind = SHEETS[s.sheet]?.kind ?? "elev";
      const geom = kind === "elev" || kind === "detail" ? HOUSE : PLAN;
      const totalH = kind === "elev" ? (s.floors * 2.8 + 2.0) : 7.2;
      const pad = 48;
      const sx_factor = (w - pad * 2) / 18;
      const sy_factor = (h - pad * 2) / totalH;
      const sc = Math.min(sx_factor, sy_factor);
      const ox = (w - 18 * sc) / 2;
      const oy = (h - totalH * sc) / 2;
      const sourceFrame=sourceBounds?sourceViewport(sourceBounds,w,h):null;
      const to = (x: number, z_or_y: number): [number, number] => {
        if(sourceMode === "overlay" && sourceFrame){const p=sourceToCanvas({x,y:z_or_y},sourceFrame);return [p.x,p.y];}
        if (kind === "elev") {
          return [ox + x * sc, oy + (totalH - z_or_y) * sc];
        } else {
          return [ox + x * sc, oy + z_or_y * sc];
        }
      };

      if (s.showSrc && sourceMode === "procedural") {
        if (s.showBld) {
          ctx.strokeStyle = navy ? PAL.cyan : PAL.planInk;
          ctx.lineWidth = 1.6 / drawZoom;
          if (kind === "elev") {
            for (let f = 0; f < s.floors; f++) {
              const yOffset = f * 2.8;
              for (const seg of geom.B) {
                const a = to(seg[0], seg[1] + yOffset);
                const b = to(seg[3], seg[4] + yOffset);
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
              }
            }
          } else {
            for (const seg of geom.B) {
              const a = to(seg[0], seg[2]);
              const b = to(seg[3], seg[5]);
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.stroke();
            }
          }
        }
        if (s.showRoof) {
          ctx.strokeStyle = navy ? PAL.roof : "#c9a227";
          ctx.lineWidth = 1.1 / drawZoom;
          if (kind === "elev") {
            const topOffset = (s.floors - 1) * 2.8;
            for (const seg of geom.R) {
              const a = to(seg[0], seg[1] + topOffset);
              const b = to(seg[3], seg[4] + topOffset);
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.stroke();
            }
          } else {
            for (const seg of geom.R) {
              const a = to(seg[0], seg[2]);
              const b = to(seg[3], seg[5]);
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.stroke();
            }
          }
        }

        if (kind !== "elev") {
          // Room footprints
          const rooms = [
            { name: "LIVING / KITCHEN", rect: [0.4, 0.4, 5.3, 2.6], col: navy ? "rgba(127,219,255,0.06)" : "rgba(28,110,164,0.06)" },
            { name: "MASTER BED", rect: [0.4, 3.8, 5.3, 3.0], col: navy ? "rgba(232,179,57,0.06)" : "rgba(201,162,39,0.06)" },
            { name: "GARAGE / WORKSHOP", rect: [12.6, 0.4, 5.0, 6.4], col: navy ? "rgba(192,122,91,0.06)" : "rgba(192,122,91,0.08)" },
            { name: "ENTRY / PATIO", rect: [6.5, 0.4, 5.3, 6.4], col: navy ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
          ];
          for (const rm of rooms) {
            const p0 = to(rm.rect[0], rm.rect[1]);
            const p1 = to(rm.rect[0] + rm.rect[2], rm.rect[1] + rm.rect[3]);
            ctx.fillStyle = rm.col;
            ctx.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
            ctx.fillStyle = navy ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)";
            ctx.font = `${Math.max(9, 10 / drawZoom)}px monospace`;
            ctx.fillText(rm.name, p0[0] + 8 / drawZoom, p0[1] + 16 / drawZoom);
          }
        }

        // Drawing titleblock
        const tb0 = to(13.2, kind === "elev" ? (s.floors * 2.8 + 0.2) : 5.4);
        const tb1 = to(17.6, kind === "elev" ? (s.floors * 2.8 + 1.6) : 6.8);
        ctx.strokeStyle = navy ? "rgba(127,219,255,0.4)" : "rgba(28,110,164,0.4)";
        ctx.lineWidth = 1 / drawZoom;
        ctx.strokeRect(tb0[0], tb0[1], tb1[0] - tb0[0], tb1[1] - tb0[1]);
        ctx.fillStyle = navy ? "rgba(127,219,255,0.7)" : "rgba(28,110,164,0.8)";
        ctx.font = `bold ${Math.max(9, 10 / drawZoom)}px monospace`;
        ctx.fillText("X-RAY TAKEOFF STUDIO", tb0[0] + 6 / drawZoom, tb0[1] + 14 / drawZoom);
        ctx.font = `${Math.max(8, 8.5 / drawZoom)}px monospace`;
        
        let dynamicSheetTitle = "SHEET 17 · GROUND FLOOR PLAN";
        if (kind === "cover") {
          dynamicSheetTitle = `SHEET ${s.sheet + 1} · COVER PAGE`;
        } else if (kind === "plan") {
          dynamicSheetTitle = `SHEET ${s.sheet + 1} · GROUND FLOOR PLAN`;
        } else if (kind === "elev") {
          dynamicSheetTitle = `SHEET ${s.sheet + 1} · ${s.floors > 1 ? `${s.floors}-STOREY ` : ""}ELEVATION`;
        } else if (kind === "detail") {
          dynamicSheetTitle = `SHEET ${s.sheet + 1} · DETAILS & SECTIONS`;
        }
        
        ctx.fillText(dynamicSheetTitle, tb0[0] + 6 / drawZoom, tb0[1] + 26 / drawZoom);
        ctx.fillText("LOCAL SKETCH · UNVERIFIED SCALE", tb0[0] + 6 / drawZoom, tb0[1] + 36 / drawZoom);
      }

      if (s.showBld && sourceMode === "procedural") {
        if (kind === "elev") {
          ctx.strokeStyle = navy ? PAL.cyan : PAL.planInk;
          ctx.lineWidth = 1.2 / drawZoom;
          for (let f = 0; f < s.floors; f++) {
            const yOffset = f * 2.8;
            for (const seg of geom.B) {
              const a = to(seg[0], seg[1] + yOffset);
              const b = to(seg[3], seg[4] + yOffset);
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.stroke();
            }
          }
        } else {
          const outlines = [
            [[0, 0], [18, 0], [18, 7.2], [0, 7.2]],
            [[0, 3.4], [6.1, 3.4]],
            [[12.2, 3.6], [18, 3.6]],
            [[6.1, 0], [6.1, 7.2]],
            [[12.2, 0], [12.2, 7.2]],
          ].map((pts) => pts.map(([x, y]) => to(x, y)));
          ctx.strokeStyle = navy ? PAL.cyan : PAL.planInk;
          ctx.lineWidth = 1.2 / drawZoom;
          for (const outline of outlines) {
            ctx.beginPath();
            ctx.moveTo(outline[0][0], outline[0][1]);
            outline.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
            ctx.stroke();
          }
        }
      }

      if (s.showMan) {
        ctx.strokeStyle = PAL.manual;
        ctx.fillStyle = PAL.manual;
        ctx.lineWidth = 1.2 / drawZoom;
        for (const m of s.markups) {
          if (m.sheet !== s.sheet) continue;
          if (currentRuns.some((run) => run.id === m.id)) continue;
          if (m.points.length === 0) continue;
          ctx.beginPath();
          m.points.forEach((p, i) => {
            const q = to(p.x, p.y);
            if (i === 0) ctx.moveTo(q[0], q[1]);
            else ctx.lineTo(q[0], q[1]);
          });
          if (m.kind === "area") ctx.closePath();
          ctx.stroke();
          if (m.kind === "count") {
            const q = to(m.points[0].x, m.points[0].y);
            ctx.beginPath();
            ctx.arc(q[0], q[1], 4 / drawZoom, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        for (const run of currentRuns) {
          if (run.points.length < 2) continue;
          const selected = run.id === selectedRunId;
          ctx.save();
          ctx.strokeStyle = selected ? "#ffb000" : navy ? PAL.cyan : PAL.planInk;
          ctx.lineWidth = (selected ? 4 : 2.5) / drawZoom;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          run.points.forEach((point, index) => {
            const rendered = to(point.x, point.y);
            if (index === 0) ctx.moveTo(rendered[0], rendered[1]);
            else ctx.lineTo(rendered[0], rendered[1]);
          });
          ctx.stroke();
          ctx.restore();
        }

        for (const gate of currentGates) {
          const rendered = to(gate.point.x, gate.point.y);
          const associatedRun = gate.runId
            ? currentRuns.find((run) => run.id === gate.runId)
            : undefined;
          let segmentIndex = gate.segmentIndex ?? null;
          if (associatedRun && (segmentIndex === null || segmentIndex >= associatedRun.points.length - 1)) {
            let closestDistance = Number.POSITIVE_INFINITY;
            associatedRun.points.slice(0, -1).forEach((point, index) => {
              const distance = distanceToSegment(gate.point, point, associatedRun.points[index + 1]);
              if (distance < closestDistance) {
                closestDistance = distance;
                segmentIndex = index;
              }
            });
          }

          ctx.save();
          const markerSize = 9 / drawZoom;
          ctx.strokeStyle = gate.runId === selectedRunId ? "#ffb000" : "#ff4f87";
          ctx.fillStyle = navy ? PAL.navy : "#ffffff";
          ctx.lineWidth = 3 / drawZoom;
          if (associatedRun && segmentIndex !== null) {
            const start = to(associatedRun.points[segmentIndex].x, associatedRun.points[segmentIndex].y);
            const end = to(associatedRun.points[segmentIndex + 1].x, associatedRun.points[segmentIndex + 1].y);
            const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
            const normalX = -(end[1] - start[1]) / length;
            const normalY = (end[0] - start[0]) / length;
            ctx.beginPath();
            ctx.moveTo(rendered[0] - normalX * markerSize, rendered[1] - normalY * markerSize);
            ctx.lineTo(rendered[0] + normalX * markerSize, rendered[1] + normalY * markerSize);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(rendered[0], rendered[1], 5 / drawZoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        const selectedRun = currentRuns.find((run) => run.id === selectedRunId);
        if (selectedRun) {
          selectedRun.points.forEach((point, vertexIndex) => {
            const rendered = to(point.x, point.y);
            const selected = vertexIndex === selectedVertexIndex;
            ctx.save();
            ctx.fillStyle = selected ? "#ff4f87" : "#ffffff";
            ctx.strokeStyle = "#ffb000";
            ctx.lineWidth = 2.5 / drawZoom;
            ctx.beginPath();
            ctx.arc(rendered[0], rendered[1], (selected ? 7 : 5.5) / drawZoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          });
        }

        if (s.pending.length) {
          ctx.strokeStyle = PAL.manual;
          ctx.lineWidth = 1.2 / drawZoom;
          ctx.setLineDash([4 / drawZoom, 4 / drawZoom]);
          ctx.beginPath();
          s.pending.forEach((p, i) => {
            const q = to(p.x, p.y);
            if (i === 0) ctx.moveTo(q[0], q[1]);
            else ctx.lineTo(q[0], q[1]);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Rubber-band preview line for active measurement/sketching tools
      if (!calibrationCaptureActive && interactive && s.tool !== "none" && s.pending.length > 0 && hoverSnap) {
        const lastPt = s.pending[s.pending.length - 1];
        const qLast = to(lastPt.x, lastPt.y);
        const qHover = to(hoverSnap.point.x, hoverSnap.point.y);

        ctx.save();
        ctx.strokeStyle = PAL.manual;
        ctx.lineWidth = 1.2 / drawZoom;
        ctx.setLineDash([4 / drawZoom, 4 / drawZoom]);
        ctx.beginPath();
        ctx.moveTo(qLast[0], qLast[1]);
        ctx.lineTo(qHover[0], qHover[1]);
        ctx.stroke();
        ctx.restore();

        // Draw active segment length label along the line
        const dist = Math.hypot(hoverSnap.point.x - lastPt.x, hoverSnap.point.y - lastPt.y) * s.scaleM;
        ctx.save();
        ctx.font = `bold ${Math.max(9, 10 / drawZoom)}px monospace`;
        const text = `${dist.toFixed(2)} m`;
        const midX = (qLast[0] + qHover[0]) / 2;
        const midY = (qLast[1] + qHover[1]) / 2;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = navy ? "rgba(5, 11, 20, 0.75)" : "rgba(242, 237, 227, 0.75)";
        ctx.fillRect(midX + 2 / drawZoom, midY - 12 / drawZoom, textWidth + 6 / drawZoom, 12 / drawZoom);
        ctx.fillStyle = navy ? "#7fdbff" : "#1c6ea4";
        ctx.fillText(text, midX + 5 / drawZoom, midY - 3 / drawZoom);
        ctx.restore();
      }

      // Snapping visual indicator
      if (!calibrationCaptureActive && hoverSnap && hoverSnap.snapped && s.snappingEnabled && s.tool !== "none") {
        const sp = to(hoverSnap.point.x, hoverSnap.point.y);
        ctx.save();
        ctx.strokeStyle = "#ff007f";
        ctx.fillStyle = "rgba(255, 0, 127, 0.3)";
        ctx.lineWidth = 1.8 / drawZoom;
        const sz = 7 / drawZoom;
        // Diamond
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1] - sz);
        ctx.lineTo(sp[0] + sz, sp[1]);
        ctx.lineTo(sp[0], sp[1] + sz);
        ctx.lineTo(sp[0] - sz, sp[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(sp[0] - sz * 1.5, sp[1]);
        ctx.lineTo(sp[0] + sz * 1.5, sp[1]);
        ctx.moveTo(sp[0], sp[1] - sz * 1.5);
        ctx.lineTo(sp[0], sp[1] + sz * 1.5);
        ctx.stroke();

        // Coordinates callout
        ctx.font = `bold ${Math.max(9, 10 / drawZoom)}px monospace`;
        ctx.fillStyle = navy ? "#7fdbff" : "#050b14";
        ctx.fillText(
          `SNAP (${hoverSnap.point.x.toFixed(2)}, ${hoverSnap.point.y.toFixed(2)}) ${sourceMode === "overlay" ? "source units" : "m"}`,
          sp[0] + sz * 1.6,
          sp[1] - sz * 0.6
        );
        ctx.restore();
      }

      if (calibrationPoints.length > 0) {
        const visiblePoints = calibrationPoints.slice(0, 2).map((point) => to(point.x, point.y));
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (visiblePoints.length === 2) {
          ctx.strokeStyle = "#ffb000";
          ctx.lineWidth = 3 / drawZoom;
          ctx.setLineDash([8 / drawZoom, 5 / drawZoom]);
          ctx.beginPath();
          ctx.moveTo(visiblePoints[0][0], visiblePoints[0][1]);
          ctx.lineTo(visiblePoints[1][0], visiblePoints[1][1]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        visiblePoints.forEach(([x, y], index) => {
          ctx.fillStyle = "#ffb000";
          ctx.strokeStyle = navy ? PAL.navy : "#ffffff";
          ctx.lineWidth = 2 / drawZoom;
          ctx.beginPath();
          ctx.arc(x, y, 7 / drawZoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = navy ? PAL.navy : "#3a2500";
          ctx.font = `bold ${10 / drawZoom}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(index + 1), x, y + 0.5 / drawZoom);
        });
        ctx.restore();
      }
    };

    const draw = () => drawScene(ctx);
    draw();
    setScopeDraw(() => (context: CanvasRenderingContext2D, frame: ScopeFrame) => drawScene(context, frame));
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [
    paintSource,
    scopeZoom,
    s.skin,
    s.markups,
    s.job.runs,
    vertexPreview,
    s.job.gates,
    s.pending,
    s.sheet,
    s.showSrc,
    s.showBld,
    s.showRoof,
    s.showMan,
    s.snappingEnabled,
    s.tool,
    s.scaleM,
    interactive,
    sourceMode,
    sourceBounds,
    legacyReadOnly,
    calibrationCaptureActive,
    calibrationPoints,
    selectedRunId,
    selectedVertexIndex,
    hoverSnap,
    zoom,
    pan,
    s.floors,
  ]);

  return (
    <div className="relative h-full w-full select-none">
      <canvas
        ref={ref}
        aria-label={calibrationCaptureActive ? "Select calibration points on plan" : "Plan drawing canvas"}
        className={`block h-full w-full touch-none ${
          calibrationCaptureActive
            ? "cursor-crosshair"
            : !interactive || s.tool === "none"
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-crosshair"
        }`}
        onPointerDown={(e) => {
          const canvas = ref.current;
          if (!canvas) return;
          if(sourceMode === "overlay" && !sourceBounds)return;
          const rect = canvas.getBoundingClientRect();
          if (placingScope && e.button === 0) {
            setScopeAnchor(canvasPointer(e)); setPlacingScope(false); e.preventDefault(); return;
          }
          const canvasPoint = precisePointer(e);
          const viewport: PlanCanvasViewport = {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            zoom,
            pan,
            kind: SHEETS[s.sheet]?.kind ?? "elev",
            floors: s.floors,
            sourceBounds,
          };
          const selectedRun = currentRuns.find((run) => run.id === selectedRunId);
          const vertexHit = selectedRun && (onMoveVertex || onSelectVertex)
            ? hitTestRunVertices(canvasPoint, selectedRun, viewport, 12 / pointerMagnification(e))
            : null;
          const runHit = onSelectRun
            ? hitTestFenceRuns(canvasPoint, currentRuns, viewport, 10 / pointerMagnification(e))
            : null;
          const mode = resolveTracingCanvasPointerMode({
            calibrationCaptureActive: calibrationCaptureActive && !legacyReadOnly,
            interactive: interactive && !legacyReadOnly,
            button: e.button,
            shiftKey: e.shiftKey,
            toolActive: s.tool !== "none",
            placementToolActive: s.tool === "count",
            vertexHit: Boolean(vertexHit),
            runHit: Boolean(runHit),
            vertexEditingEnabled: Boolean(onMoveVertex),
            runSelectionEnabled: Boolean(onSelectRun),
            editMode,
          });
          lastPointerMode.current = mode;
          if(sourceMode === "overlay" && sourceBounds && mode !== "pan" && !pointOnSource(toWorld(e),sourceBounds))return;
          if (mode === "calibration") {
            if (hoverSnap) setHoverSnap(null);
            onCalibrationPoint?.(toWorld(e));
            e.preventDefault();
          } else if (mode === "move-vertex" && vertexHit) {
            if (hoverSnap) setHoverSnap(null);
            onSelectRun?.(vertexHit.runId);
            onSelectVertex?.(vertexHit.runId, vertexHit.vertexIndex);
            drag.current = {
              kind: "vertex",
              runId: vertexHit.runId,
              vertexIndex: vertexHit.vertexIndex,
            };
            const original = s.job.runs.find(run => run.id === vertexHit.runId)!;
            updateVertexPreview({ documentId: s.job.activeDocumentId, sourceSha256: activeDocument?.sha256 ?? null, sheet: s.sheet, runId: original.id,
              runRevision: original.revision ?? 1, vertexIndex: vertexHit.vertexIndex,
              originalPoint: { ...original.points[vertexHit.vertexIndex] }, point: { ...original.points[vertexHit.vertexIndex] } });
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
          } else if (mode === "select-vertex" && vertexHit) {
            if (hoverSnap) setHoverSnap(null);
            onSelectRun?.(vertexHit.runId);
            onSelectVertex?.(vertexHit.runId, vertexHit.vertexIndex);
            e.preventDefault();
          } else if (mode === "select-run" && runHit) {
            if (hoverSnap) setHoverSnap(null);
            onSelectRun?.(runHit.runId);
            e.preventDefault();
          } else if (mode === "pan") {
            drag.current = { kind: "pan", x: e.clientX, y: e.clientY };
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
          } else {
            const st = useStudio.getState();
            if (st.tool !== "none") {
              const world=toWorld(e);
              const frame=sourceBounds?sourceViewport(sourceBounds,rect.width,rect.height,zoom,pan):null;
              const targetPoint = sourceMode === "overlay" && frame
                ? snapSourcePoint(world,[...currentRuns.flatMap(run=>run.points),...s.pending],24/(frame.scale*pointerMagnification(e)),s.snappingEnabled).point
                : hoverSnap && hoverSnap.snapped && s.snappingEnabled ? hoverSnap.point : world;
              st.addPoint(targetPoint);
            }
          }
        }}
        onPointerMove={(e) => {
          if(sourceMode === "overlay" && !sourceBounds)return;
          if (placingScope) return;
          if (calibrationCaptureActive && !legacyReadOnly) {
            if (hoverSnap) setHoverSnap(null);
          } else if (drag.current?.kind === "vertex") {
            const point = toWorld(e), preview = vertexPreviewRef.current;
            if (preview && editMode === "move" && s.tool === "none" && !legacyReadOnly &&
              (sourceMode !== "overlay" || (sourceBounds && pointOnSource(point, sourceBounds))))
              updateVertexPreview({ ...preview, point });
            e.preventDefault();
          } else if (drag.current?.kind === "pan") {
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            s.setPan2d({ x: s.pan2d.x + dx, y: s.pan2d.y + dy });
            drag.current.x = e.clientX;
            drag.current.y = e.clientY;
          } else if (interactive && !legacyReadOnly && s.tool !== "none") {
            const w = toWorld(e);
            const canvas = ref.current;
            if (canvas) {
              const pad = 48;
              const kind = SHEETS[s.sheet]?.kind ?? "elev";
              const totalH = kind === "elev" ? (s.floors * 2.8 + 2.0) : 7.2;
              const sx_factor = (canvas.clientWidth - pad * 2) / 18;
              const sy_factor = (canvas.clientHeight - pad * 2) / totalH;
              const sc = Math.min(sx_factor, sy_factor);
              const snapRadius = 24 / (sc * zoom * pointerMagnification(e));
              const frame=sourceBounds?sourceViewport(sourceBounds,canvas.clientWidth,canvas.clientHeight,zoom,pan):null;
              const target = sourceMode === "overlay" && frame
                ? snapSourcePoint(w,[...currentRuns.flatMap(run=>run.points),...s.pending],24/(frame.scale*pointerMagnification(e)),s.snappingEnabled)
                : getSnapPoint(w, s.markups, s.pending, snapRadius, s.snappingEnabled, kind, s.floors);
              setHoverSnap(target);
            }
          } else {
            if (hoverSnap) setHoverSnap(null);
          }
        }}
        onPointerLeave={() => {
          if (hoverSnap) setHoverSnap(null);
        }}
        onPointerUp={(e) => {
          const preview = vertexPreviewRef.current;
          if (drag.current?.kind === "vertex" && preview) {
            const state = useStudio.getState();
            const point = vertexDragCommitPoint(preview, { documentId: state.job.activeDocumentId, sourceSha256: state.job.documents.find(doc => doc.id === state.job.activeDocumentId)?.sha256 ?? null, sheet: state.sheet,
              run: state.job.runs.find(run => run.id === preview.runId),
              allowed: editMode === "move" && state.tool === "none" && !legacyReadOnly && !state.calibrationCapture });
            if (point) onMoveVertex?.(preview.runId, preview.vertexIndex, point);
          }
          updateVertexPreview(null);
          if (drag.current) {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            drag.current = null;
            setIsDragging(false);
          }
        }}
        onPointerCancel={(e) => {
          updateVertexPreview(null);
          if (drag.current) {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            drag.current = null;
            setIsDragging(false);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        onDoubleClick={() => {
          if (interactive && !legacyReadOnly && (sourceMode !== "overlay" || sourceBounds) && !calibrationCaptureActive && lastPointerMode.current === "trace") {
            useStudio.getState().commitPending();
          }
        }}
      />

      {precisionFrame && <PlanScope frame={precisionFrame} zoom={scopeZoom} draw={scopeDraw} />}
      <div className="plan-scope-controls">
        <button type="button" aria-label="Drawing scope" aria-pressed={scopeEnabled}
          disabled={sourceMode === "overlay" && !sourceBounds}
          onClick={() => { setScopeEnabled(!scopeEnabled); setPlacingScope(false); }}>Scope</button>
        {scopeEnabled && <>
          <button type="button" aria-pressed={placingScope} onClick={() => setPlacingScope(!placingScope)}>Place scope</button>
          <label>Zoom <input type="range" aria-label="Drawing scope magnification" min="2" max="8" step=".01" value={scopeZoom} onChange={(e) => setScopeZoom(Number(e.target.value))} /><output>{scopeZoom.toFixed(2)}x</output></label>
        </>}
      </div>
      {scopeEnabled && <p className="plan-scope-help" role="status">{placingScope ? "Click the plan to place the scope. This click will not draw." : "Place scope, then draw inside the lens. Wheel changes magnification."}</p>}

      {/* Centered Floating Premium PDF-style Toolbar Overlay */}
      <div className="canvas-toolbar absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-navy/95 text-paper border border-white/10 backdrop-blur-md rounded-full shadow-xl px-4 py-1.5 pointer-events-auto select-none z-10 font-mono text-[11px]">
        {/* Page navigation */}
        <button
          onClick={() => s.setSheet(Math.max(0, s.sheet - 1))}
          disabled={s.sheet === 0}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex items-center justify-center min-w-[76px] text-white/90 text-center font-semibold px-1 select-none">
          Page {s.sheet + 1} / {pageCount}
        </span>
        <button
          onClick={() => s.setSheet(Math.min(pageCount - 1, s.sheet + 1))}
          disabled={s.sheet >= pageCount - 1}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-all cursor-pointer"
          title="Next Page"
        >
          <ChevronRight className="size-4" />
        </button>

        <span className="w-px h-4 bg-white/20 mx-1" />

        {/* Zoom controls */}
        <button
          onClick={handleZoomOut}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <span className="flex items-center justify-center min-w-[42px] text-white/90 text-center font-semibold px-1">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <button
          onClick={handleReset}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white transition-all cursor-pointer"
          title="Reset View"
        >
          <Maximize className="size-3.5" />
        </button>

        <span className="w-px h-4 bg-white/20 mx-1" />

        {/* Vector Snapping toggle */}
        <button
          onClick={() => s.toggleSnapping()}
          aria-pressed={s.snappingEnabled}
          type="button"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
            s.snappingEnabled ? "bg-amber-400 text-navy font-bold shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Toggle Vector Snapping (S)"
        >
          <Magnet className="size-3" />
          <span>Snap {s.snappingEnabled ? "ON" : "OFF"}</span>
        </button>

        <span className="w-px h-4 bg-white/20 mx-1" />

        {/* Layer visibility toggles */}
        <button
          onClick={() => s.toggle("showSrc")}
          aria-pressed={s.showSrc}
          type="button"
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
            s.showSrc ? "bg-cyan text-navy" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Toggle PDF Vector Layer"
        >
          Vectors
        </button>
        <button
          onClick={() => s.toggle("showMan")}
          aria-pressed={s.showMan}
          type="button"
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
            s.showMan ? "bg-manual text-navy" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Toggle Manual Markup Layer"
        >
          Manual
        </button>
      </div>
    </div>
  );
}
