import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Pencil,
  CheckCircle2,
  X,
  FastForward,
  Layers,
  Sparkles,
  Camera,
  Download,
  Minus,
  Plus,
  Maximize2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { DraftsmanStatus } from "./MagicPencilDraftsman";
import {
  clampDockX,
  dragDockX,
  presetDockX,
  readStoredDockX,
  resolveDockX,
  stepDockX,
  writeStoredDockX,
  type DockBounds,
  type DockPreset,
  type DockStorage,
} from "./draftsmanDockPosition";
import "./draftsman.css";

interface DraftsmanControlDockProps {
  status: DraftsmanStatus;
  onPlay: () => void;
  onPause: () => void;
  onReplay: () => void;
  onSeek: (progress: number) => void;
  onSpeed: (speed: number) => void;
  onFinish: () => void;
  onClose: () => void;
  onToggleTour?: () => void;
  onJumpStorey?: (storey: string | number) => void;
  onCaptureBlueprint?: () => void;
  onCapturePlanBook?: () => void;
  exportingBook?: boolean;
  onPencilScale?: (scale: number) => void;
  onPencilColor?: (color: string) => void;
  /** Legacy preset callback; the dock is now freely draggable, presets remain as jump targets. */
  onDockPositionChange?: (position: DockPreset) => void;
}

const PHASES = [
  { id: "datum_grid", label: "1. Datum Grid", short: "1 Datum", target: 0.08 },
  { id: "ascending_wireframe", label: "2. Wireframe Ascend", short: "2 Wireframe", target: 0.4 },
  { id: "ink_strengthening", label: "3. Technical Ink", short: "3 Ink", target: 0.72 },
  { id: "material_wash", label: "4. Material Wash", short: "4 Wash", target: 0.9 },
] as const;

const SPEEDS = [0.5, 1.0, 2.0, 5.0];

function safeStorage(): DockStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function DraftsmanControlDock({
  status,
  onPlay,
  onPause,
  onReplay,
  onSeek,
  onSpeed,
  onFinish,
  onClose,
  onToggleTour,
  onJumpStorey,
  onCaptureBlueprint,
  onCapturePlanBook,
  exportingBook,
  onPencilScale,
}: DraftsmanControlDockProps) {
  const [localProgress, setLocalProgress] = useState(status.progress);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dockX, setDockX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const dockXRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startClientX: number; startX: number } | null>(null);
  const presetRef = useRef<DockPreset | null>(null);
  const currentPreset: DockPreset = status.dockPosition ?? "bottom-left";
  const currentScale = status.pencilScale ?? 1.0;

  useEffect(() => {
    if (!isScrubbing) {
      setLocalProgress(status.progress);
    }
  }, [status.progress, isScrubbing]);

  useEffect(() => {
    dockXRef.current = dockX;
  }, [dockX]);

  /** Measure the containing block and the dock itself for clamping. */
  const measure = useCallback((): DockBounds | null => {
    const el = dockRef.current;
    if (!el) return null;
    const parent = (el.offsetParent as HTMLElement | null) ?? el.parentElement;
    const containerWidth = parent?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth : 0);
    return { containerWidth, dockWidth: el.offsetWidth };
  }, []);

  const commit = useCallback((x: number, persist: boolean) => {
    dockXRef.current = x;
    setDockX(x);
    if (persist) writeStoredDockX(safeStorage(), x);
  }, []);

  // Initial placement: stored x (re-clamped) or the legacy preset.
  useLayoutEffect(() => {
    const bounds = measure();
    if (!bounds) return;
    presetRef.current = currentPreset;
    commit(resolveDockX(readStoredDockX(safeStorage()), currentPreset, bounds), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-clamp whenever the stage or window resizes so the dock never leaves the viewport.
  useEffect(() => {
    const reclamp = () => {
      const bounds = measure();
      const x = dockXRef.current;
      if (!bounds || x === null) return;
      const next = clampDockX(x, bounds);
      if (next !== x) commit(next, false);
    };
    window.addEventListener("resize", reclamp);
    const parent = dockRef.current?.offsetParent;
    let observer: ResizeObserver | null = null;
    if (parent && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(reclamp);
      observer.observe(parent);
      if (dockRef.current) observer.observe(dockRef.current);
    }
    return () => {
      window.removeEventListener("resize", reclamp);
      observer?.disconnect();
    };
  }, [measure, commit]);

  // Legacy preset changes (assistant "set_dock_position") still jump the dock.
  useEffect(() => {
    if (presetRef.current === null || presetRef.current === currentPreset) return;
    presetRef.current = currentPreset;
    const bounds = measure();
    if (!bounds) return;
    commit(presetDockX(currentPreset, bounds), true);
  }, [currentPreset, measure, commit]);

  function onGripPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const bounds = measure();
    if (!bounds) return;
    const startX = dockXRef.current ?? clampDockX(dockRef.current?.offsetLeft ?? 0, bounds);
    dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startX };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture unsupported */
    }
    setDragging(true);
  }

  function onGripPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const bounds = measure();
    if (!bounds) return;
    e.preventDefault();
    commit(dragDockX(drag.startX, drag.startClientX, e.clientX, bounds), false);
  }

  function onGripPointerEnd(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDragging(false);
    const x = dockXRef.current;
    if (x !== null) writeStoredDockX(safeStorage(), x);
  }

  function onGripKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const bounds = measure();
    if (!bounds) return;
    const next = stepDockX(dockXRef.current ?? 0, e.key, bounds);
    if (next === null) return;
    e.preventDefault();
    commit(next, true);
  }

  const percent = Math.round(localProgress * 100);
  const phaseIndex = Math.max(0, PHASES.findIndex((p) => p.id === status.phase));
  const resolvedPhaseIndex = PHASES.some((p) => p.id === status.phase) ? phaseIndex : PHASES.length;

  function stepScale(delta: number) {
    const next = Math.round(Math.min(2.5, Math.max(0.5, currentScale + delta)) * 100) / 100;
    onPencilScale?.(next);
  }

  function cycleSpeed() {
    const idx = SPEEDS.findIndex((s) => s >= status.speed);
    const next = SPEEDS[(idx === -1 ? 0 : idx + 1) % SPEEDS.length];
    onSpeed(next);
  }

  const speedLabel = `${status.speed % 1 === 0 ? status.speed.toFixed(0) : status.speed}x`;
  const summary = `Magic Pencil · Architectural Draftsman · ${status.activeStoreyLabel} · ${status.activeCategory} · ${status.visibleMeshCount} / ${status.totalMeshCount} parts`;

  return (
    <div
      ref={dockRef}
      className="draftsman-control-dock"
      role="region"
      aria-label="Magic Pencil drafting controls"
      data-testid="draftsman-dock"
      data-dock-position={currentPreset}
      data-dock-x={dockX ?? ""}
      data-dock-dragging={dragging ? "true" : undefined}
      data-dock-tools={toolsOpen ? "open" : "closed"}
      data-pencil-scale={currentScale.toFixed(2)}
      data-pencil-color={status.pencilColor ?? "#1877F2"}
      data-draftsman-phase={status.phase}
      data-draftsman-state={status.mode}
      data-draftsman-progress={status.progress.toFixed(2)}
      style={dockX === null ? undefined : { left: `${dockX}px` }}
    >
      {/* Row 1: grip · mode chip · play/replay · scrubber · % · speed · finish · close */}
      <div className="draftsman-row draftsman-row-primary">
        <button
          type="button"
          className="draftsman-grip"
          aria-label="Move drafting controls"
          title="Drag left or right · Arrow keys move 16px · Home/End snap to the edges"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerEnd}
          onPointerCancel={onGripPointerEnd}
          onKeyDown={onGripKeyDown}
        >
          <span className="draftsman-face draftsman-face-ghost draftsman-face-icon">
            <GripVertical size={14} />
          </span>
        </button>

        <div className="draftsman-mode-chip" title={summary} data-testid="draftsman-mode-chip">
          <Pencil size={12} className="draftsman-badge-icon" />
          <span className="draftsman-mode-chip-title">PENCIL</span>
        </div>

        <button
          type="button"
          className="draftsman-playback-btn"
          onClick={status.mode === "drawing" ? onPause : onPlay}
          aria-label={status.mode === "drawing" ? "Pause drawing" : "Play drawing"}
          title={status.mode === "drawing" ? "Pause (Space)" : "Play (Space)"}
        >
          <span className="draftsman-face draftsman-face-primary draftsman-face-icon">
            {status.mode === "drawing" ? <Pause size={14} /> : <Play size={14} />}
          </span>
        </button>

        <button
          type="button"
          className="draftsman-playback-btn"
          onClick={onReplay}
          aria-label="Replay drafting sequence"
          title="Replay from ground up (R)"
        >
          <span className="draftsman-face draftsman-face-white draftsman-face-icon">
            <RotateCcw size={13} />
          </span>
        </button>

        <div className="draftsman-scrubber-wrapper">
          <div className="draftsman-scrubber-rail">
            <div className="draftsman-scrubber-fill" style={{ width: `${percent}%` }} />
            {PHASES.map((p, idx) => (
              <div
                key={p.id}
                className={`draftsman-phase-marker ${resolvedPhaseIndex >= idx ? "passed" : ""}`}
                style={{ left: `${p.target * 100}%` }}
                title={p.label}
              />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={localProgress}
            aria-label="Drafting progress"
            className="draftsman-scrubber"
            onPointerDown={() => setIsScrubbing(true)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setLocalProgress(val);
              onSeek(val);
            }}
            onPointerUp={() => setIsScrubbing(false)}
          />
        </div>

        <span className="draftsman-percent" aria-live="off">{percent}%</span>

        <button
          type="button"
          className="draftsman-speed-cycle"
          onClick={cycleSpeed}
          aria-label={`Drawing speed ${speedLabel}, press for next speed`}
          title={`Drawing speed ${speedLabel} · click to cycle 0.5x → 1x → 2x → 5x`}
          data-speed={status.speed}
        >
          <span className="draftsman-face draftsman-face-white">
            <FastForward size={12} />
            <span>{speedLabel}</span>
          </span>
        </button>

        <button
          type="button"
          className="draftsman-finish-btn"
          onClick={onFinish}
          aria-label="Finish drawing to solid"
          title="Finish drawing to solid (S)"
        >
          <span className="draftsman-face draftsman-face-white draftsman-face-icon draftsman-face-finish">
            <CheckCircle2 size={14} />
          </span>
        </button>

        <button
          type="button"
          className="draftsman-close-btn"
          onClick={onClose}
          aria-label="Close Draftsman mode"
          title="Exit Draw mode (Esc)"
        >
          <span className="draftsman-face draftsman-face-ghost draftsman-face-icon">
            <X size={14} />
          </span>
        </button>
      </div>

      {/* Row 2: compact phase tabs + more-tools toggle */}
      <div className="draftsman-row draftsman-row-phases">
        <div className="draftsman-tablist" role="tablist" aria-label="Architectural drawing phases">
          {PHASES.map((p, idx) => {
            const isActive = resolvedPhaseIndex === idx;
            const isDone = resolvedPhaseIndex > idx;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={p.label}
                title={p.label}
                className={`draftsman-phase-tab ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                onClick={() => onSeek(p.target)}
              >
                <span className="draftsman-face draftsman-face-tab">
                  {isActive && <Sparkles size={10} className="draftsman-pill-icon" />}
                  {p.short}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="draftsman-tools-toggle"
          aria-expanded={toolsOpen}
          aria-controls="draftsman-dock-tools"
          aria-label={toolsOpen ? "Hide drafting tools" : "Show drafting tools"}
          title={toolsOpen ? "Hide tour, blueprint, sheets and pencil size" : "Tour, blueprint, sheets and pencil size"}
          onClick={() => setToolsOpen((open) => !open)}
        >
          <span className="draftsman-face draftsman-face-ghost draftsman-face-icon">
            {toolsOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </button>
      </div>

      {/* Row 3 (collapsible): secondary actions and readout */}
      {toolsOpen && (
        <div className="draftsman-row draftsman-row-tools" id="draftsman-dock-tools">
          {status.storeys && status.storeys.length > 1 ? (
            <div className="draftsman-storey-picker" title="Quick-jump to floor level">
              <Layers size={12} className="draftsman-storey-icon" />
              <select
                className="draftsman-storey-select"
                aria-label="Floor level selector"
                value={status.activeStoreyLabel}
                onChange={(e) => {
                  if (e.target.value) onJumpStorey?.(e.target.value);
                }}
              >
                {status.storeys.map((st) => (
                  <option key={st.label} value={st.label}>
                    {st.label} ({st.elevation >= 0 ? "+" : ""}{st.elevation.toFixed(1)}m)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="draftsman-storey-badge">
              <Layers size={12} />
              {status.activeStoreyLabel}
            </span>
          )}
          <span className="draftsman-category-badge">{status.activeCategory}</span>
          <span className="draftsman-mesh-count">
            {status.visibleMeshCount} / {status.totalMeshCount} parts
          </span>

          <button
            type="button"
            className="draftsman-action-pill"
            data-testid="magic-pencil-test-btn"
            onClick={() => {
              onReplay();
              onPlay();
            }}
            title="Run Magic Pencil 3D drafting animation test"
          >
            <span className="draftsman-face draftsman-face-primary">
              <Pencil size={12} />
              <span>Pencil Test</span>
            </span>
          </button>

          <button
            type="button"
            className="draftsman-action-pill"
            onClick={onToggleTour}
            aria-pressed={status.cinematicOrbit}
            title="Toggle smooth 360° cinematic orbit tracking the rising elevation (T)"
          >
            <span className={`draftsman-face draftsman-face-white ${status.cinematicOrbit ? "active" : ""}`}>
              <Camera size={12} className={status.cinematicOrbit ? "draftsman-pulse-icon" : ""} />
              <span>Tour</span>
            </span>
          </button>

          <button
            type="button"
            className="draftsman-action-pill"
            onClick={onCaptureBlueprint}
            title="Export Prussian Blue architectural blueprint sheet with datum ruler & title block (B)"
          >
            <span className="draftsman-face draftsman-face-white">
              <Download size={12} />
              <span>Blueprint</span>
            </span>
          </button>

          {onCapturePlanBook && (
            <button
              type="button"
              className="draftsman-action-pill"
              onClick={onCapturePlanBook}
              disabled={exportingBook}
              title="Download five illustrative model projections; not to scale"
            >
              <span className="draftsman-face draftsman-face-white">
                <Download size={12} />
                <span>{exportingBook ? "Preparing PDF…" : "Model sheets PDF"}</span>
              </span>
            </button>
          )}

          <div className="draftsman-adjuster-stepper" role="group" aria-label="Actual 3D pencil size">
            <span className="draftsman-adjuster-label">
              <Maximize2 size={11} />
              <span>Size</span>
            </span>
            <button
              type="button"
              className="draftsman-stepper-btn"
              onClick={() => stepScale(-0.25)}
              disabled={currentScale <= 0.5}
              title="Decrease pencil size"
              aria-label="Decrease pencil size"
            >
              <span className="draftsman-face draftsman-face-white draftsman-face-icon draftsman-face-mini">
                <Minus size={11} />
              </span>
            </button>
            <span className="draftsman-stepper-value">{currentScale.toFixed(2)}x</span>
            <button
              type="button"
              className="draftsman-stepper-btn"
              onClick={() => stepScale(0.25)}
              disabled={currentScale >= 2.5}
              title="Increase pencil size"
              aria-label="Increase pencil size"
            >
              <span className="draftsman-face draftsman-face-white draftsman-face-icon draftsman-face-mini">
                <Plus size={11} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
