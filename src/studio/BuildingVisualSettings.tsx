import { useEffect, useRef, useState } from "react";
import type { ModelScopeOptions } from "./ModelScope";
import { ChevronRight, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_APPEARANCE,
  VISUAL_PRESETS,
  nextPreset,
  presetAppearance,
  type BuildingAppearance,
} from "./buildingAppearance";
function AppearanceColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = /^#[\da-f]{6}$/i.test(draft);
  const commit = () => {
    if (valid) onChange(draft.toUpperCase());
    else setDraft(value);
  };
  return (
    <label>
      {label}
      <input
        type="color"
        aria-label={`${label} picker`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="visual-hex"
        aria-label={`${label} hex`}
        type="text"
        value={draft}
        maxLength={7}
        spellCheck={false}
        aria-invalid={!valid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function BuildingVisualSettings({
  value,
  onChange,
  warning,
  scope,
  onScopeChange,
}: {
  value: BuildingAppearance;
  onChange: (v: BuildingAppearance) => void;
  warning: string | null;
  scope: ModelScopeOptions;
  onScopeChange: (value: ModelScopeOptions) => void;
}) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open]);
  const custom = (patch: Partial<BuildingAppearance>) =>
    onChange({ ...value, ...patch, preset: "custom" });
  return (
    <div className="building-visual-settings">
      <div className="building-appearance-triggers">
        <button
          type="button"
          aria-label="Scope zoom"
          aria-pressed={scope.enabled}
          onClick={() => onScopeChange({ ...scope, enabled: !scope.enabled })}
        >
          Scope
        </button>
        <button
          type="button"
          className="visual-cycle"
          aria-label="Next visual preset"
          title="Cycle visual presets"
          onClick={() => onChange(nextPreset(value.preset))}
        >
          <span
            className="visual-palette-dot"
            style={{ background: value.background, borderColor: value.wire }}
          />
          <ChevronRight size={14} />
        </button>
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls="building-visual-panel"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal size={15} />
          <span>Visual settings</span>
        </button>
      </div>
      {open && (
        <section
          id="building-visual-panel"
          className="building-visual-panel"
          aria-label="Visual settings"
        >
          <header>
            <div>
              <span>APPEARANCE</span>
              <h2>Make it yours</h2>
            </div>
            <button
              type="button"
              aria-label="Close visual settings"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </header>
          <label>
            Preset
            <select
              aria-label="Visual preset"
              value={value.preset}
              onChange={(e) => onChange(presetAppearance(e.target.value))}
            >
              {value.preset === "custom" && <option value="custom">Custom</option>}
              {VISUAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="visual-colors">
            <AppearanceColor
              label="Background"
              value={value.background}
              onChange={(background) => custom({ background })}
            />
            <AppearanceColor
              label="Wire color"
              value={value.wire}
              onChange={(wire) => custom({ wire })}
            />
          </div>
          <label>
            Wire opacity <output>{Math.round(value.opacity * 100)}%</output>
            <input
              type="range"
              aria-label="Wire opacity"
              min=".1"
              max="1"
              step=".05"
              value={value.opacity}
              onChange={(e) => custom({ opacity: Number(e.target.value) })}
            />
          </label>
          <label>
            Lighting <output>{value.lighting.toFixed(1)}×</output>
            <input
              type="range"
              aria-label="Lighting intensity"
              min=".2"
              max="2"
              step=".1"
              value={value.lighting}
              onChange={(e) => custom({ lighting: Number(e.target.value) })}
            />
          </label>
          <label className="visual-check">
            <input
              type="checkbox"
              checked={value.shadows}
              onChange={(e) => custom({ shadows: e.target.checked })}
            />
            Cast shadows in solid view
          </label>
          <p>
            Colours and wire opacity also apply to PNG and SVG exports. Lighting and shadows affect
            the solid view.
          </p>
          <fieldset className="visual-scope-controls">
            <legend>Scope zoom</legend>
            <label>
              Magnification
              <select
                aria-label="Scope magnification"
                value={scope.zoom}
                onChange={(e) => onScopeChange({ ...scope, zoom: Number(e.target.value) })}
              >
                <option value="2">2x</option>
                <option value="4">4x</option>
                <option value="8">8x</option>
              </select>
            </label>
            <label>
              Scope diameter <output>{scope.diameter}px</output>
              <input
                type="range"
                aria-label="Scope diameter"
                min="160"
                max="360"
                step="20"
                value={scope.diameter}
                onChange={(e) => onScopeChange({ ...scope, diameter: Number(e.target.value) })}
              />
            </label>
            <p>
              Move over the model to magnify. Escape turns the scope off; the main camera stays in
              place.
            </p>
          </fieldset>
          {warning && <p role="status">{warning}</p>}
          <button
            type="button"
            className="visual-reset"
            onClick={() => onChange({ ...DEFAULT_APPEARANCE })}
          >
            <RotateCcw size={13} />
            Reset appearance
          </button>
        </section>
      )}
    </div>
  );
}
