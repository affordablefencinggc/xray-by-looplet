import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { DraftsmanStatus } from "./MagicPencilDraftsman";
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
}: DraftsmanControlDockProps) {
  const [localProgress, setLocalProgress] = useState(status.progress);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    if (!isScrubbing) {
      setLocalProgress(status.progress);
    }
  }, [status.progress, isScrubbing]);

  const percent = Math.round(localProgress * 100);

  const phaseIndex =
    status.phase === "datum_grid"
      ? 0
      : status.phase === "ascending_wireframe"
        ? 1
        : status.phase === "ink_strengthening"
          ? 2
          : status.phase === "material_wash"
            ? 3
            : 4;

  const phases = [
    { id: "datum_grid", label: "1. Datum Grid", target: 0.08 },
    { id: "ascending_wireframe", label: "2. Wireframe Ascend", target: 0.40 },
    { id: "ink_strengthening", label: "3. Technical Ink", target: 0.72 },
    { id: "material_wash", label: "4. Material Wash", target: 0.90 },
  ];

  const speeds = [0.5, 1.0, 2.0, 5.0];

  return (
    <div
      className="draftsman-control-dock"
      role="region"
      aria-label="Magic Pencil drafting controls"
      data-testid="draftsman-dock"
      data-draftsman-phase={status.phase}
      data-draftsman-state={status.mode}
      data-draftsman-progress={status.progress.toFixed(2)}
    >
      <div className="draftsman-header">
        <div className="draftsman-badge">
          <Pencil size={13} className="draftsman-badge-icon" />
          <span className="draftsman-badge-title">MAGIC PENCIL</span>
          <span className="draftsman-badge-sub">ARCHITECTURAL DRAFTSMAN</span>
        </div>

        <div className="draftsman-readout">
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
        </div>

        <div className="draftsman-actions">
          <button
            type="button"
            className={`draftsman-tour-btn ${status.cinematicOrbit ? "active" : ""}`}
            onClick={onToggleTour}
            aria-pressed={status.cinematicOrbit}
            title="Toggle smooth 360° cinematic orbit tracking the rising elevation (T)"
          >
            <Camera size={13} className={status.cinematicOrbit ? "draftsman-pulse-icon" : ""} />
            <span>Tour</span>
          </button>
          <button
            type="button"
            className="draftsman-blueprint-btn"
            onClick={onCaptureBlueprint}
            title="Export Prussian Blue architectural blueprint sheet with datum ruler & title block (B)"
          >
            <Download size={13} />
            <span>Blueprint</span>
          </button>
          {onCapturePlanBook && <button type="button" className="draftsman-blueprint-btn" onClick={onCapturePlanBook} disabled={exportingBook} title="Download five illustrative model projections; not to scale">
            <Download size={13} /><span>{exportingBook ? "Preparing PDF…" : "Model sheets PDF"}</span>
          </button>}
          <button
            type="button"
            className="draftsman-finish-btn"
            onClick={onFinish}
            title="Finish drawing to solid (S)"
          >
            <CheckCircle2 size={13} />
            Solid Finish
          </button>
          <button
            type="button"
            className="draftsman-close-btn"
            onClick={onClose}
            aria-label="Close Draftsman mode"
            title="Exit Draw mode (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="draftsman-timeline">
        <button
          type="button"
          className="draftsman-playback-btn primary"
          onClick={status.mode === "drawing" ? onPause : onPlay}
          aria-label={status.mode === "drawing" ? "Pause drawing" : "Play drawing"}
          title={status.mode === "drawing" ? "Pause (Space)" : "Play (Space)"}
        >
          {status.mode === "drawing" ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <button
          type="button"
          className="draftsman-playback-btn"
          onClick={onReplay}
          aria-label="Replay drafting sequence"
          title="Replay from ground up (R)"
        >
          <RotateCcw size={14} />
        </button>

        <div className="draftsman-scrubber-wrapper">
          <div className="draftsman-scrubber-rail">
            <div
              className="draftsman-scrubber-fill"
              style={{ width: `${percent}%` }}
            />
            {phases.map((p, idx) => (
              <div
                key={p.id}
                className={`draftsman-phase-marker ${phaseIndex >= idx ? "passed" : ""}`}
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

        <span className="draftsman-percent">{percent}%</span>

        <div className="draftsman-speed-group" role="group" aria-label="Drawing speed">
          <FastForward size={12} className="draftsman-speed-icon" />
          {speeds.map((s) => (
            <button
              key={s}
              type="button"
              className={`draftsman-speed-btn ${status.speed === s ? "active" : ""}`}
              onClick={() => onSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="draftsman-phases" role="tablist" aria-label="Architectural drawing phases">
        {phases.map((p, idx) => {
          const isActive = phaseIndex === idx;
          const isDone = phaseIndex > idx;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`draftsman-phase-pill ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              onClick={() => onSeek(p.target)}
            >
              {isActive && <Sparkles size={11} className="draftsman-pill-icon" />}
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
