import { useEffect, useMemo, useRef, useState } from "react";
import type { SourceBuilding } from "./sourceBuilding";
import { floorKey, planBounds } from "./componentLocation";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { assessWalkStart, listWalkFloors, recommendWalkStarts, type WalkPlacement } from "./walkStartPlacement.ts";
import "./walkStartPlacement.css";

/** yaw=0 faces world -Z; positive yaw turns toward -X (THREE camera basis). */
export type WalkStart = { x: number; z: number; elevation: number; level?: string; yaw?: number };

export function WalkStartDialog({ model, initialFloor, onClose, onStart }: {
  model: SourceBuilding; initialFloor: string; onClose: () => void;
  onStart: (floor: string, point: WalkStart) => void;
}) {
  const floors = useMemo(() => listWalkFloors(model), [model]);
  const [floor, setFloor] = useState(floors.find(f => f.id === initialFloor)?.id ?? floors[0]?.id ?? "");
  const suggestions = useMemo(() => recommendWalkStarts(model, floor), [model, floor]);
  const [chosen, setChosen] = useState<{ floor: string; point: WalkPlacement } | null>(null);
  const [error, setError] = useState("");
  const point = chosen?.floor === floor ? chosen.point : suggestions[0] ?? null;
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useMemo(() => model.objects.filter(p => floorKey(p) === floor), [model, floor]);
  const bounds = planBounds(parts), width = 600, height = 360;
  const scale = Math.min(552 / Math.max(.1, bounds[2] - bounds[0]), 312 / Math.max(.1, bounds[3] - bounds[1]));
  const ox = (width - (bounds[2] - bounds[0]) * scale) / 2 - bounds[0] * scale;
  const oz = (height - (bounds[3] - bounds[1]) * scale) / 2 - bounds[1] * scale;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    const tokens = getComputedStyle(canvas.current!), ink = tokens.getPropertyValue("--color-ink").trim() || "#182126";
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = tokens.getPropertyValue("--color-muted").trim() || "#646a70"; ctx.lineWidth = .6;
    for (const p of [...parts].sort((a, b) => Number(!["room", "slab"].includes(a.category)) - Number(!["room", "slab"].includes(b.category)))) {
      ctx.fillStyle = ["room", "slab"].includes(p.category) ? (tokens.getPropertyValue("--color-selected").trim() || "#d4d6d8") : (tokens.getPropertyValue("--color-line").trim() || "#a0a4a6");
      for (let i = 0; i + 2 < p.indices.length; i += 3) {
        ctx.beginPath();
        for (let j = 0; j < 3; j++) { const n = p.indices[i + j] * 3, x = ox + p.positions[n] * scale, z = oz + p.positions[n + 2] * scale; if (j === 0) ctx.moveTo(x, z); else ctx.lineTo(x, z); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    suggestions.forEach((suggestion, index) => {
      const x = ox + suggestion.x * scale, y = oz + suggestion.z * scale;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
      ctx.fillStyle = tokens.getPropertyValue("--color-paper").trim() || "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(index + 1), x, y);
    });
    if (point) {
      const x = ox + point.x * scale, y = oz + point.z * scale, dx = -Math.sin(point.yaw), dz = -Math.cos(point.yaw);
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + dx * 15, y + dz * 15); ctx.lineTo(x + dx * 40, y + dz * 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + dx * 42, y + dz * 42); ctx.lineTo(x + dx * 29 - dz * 7, y + dz * 29 + dx * 7); ctx.lineTo(x + dx * 29 + dz * 7, y + dz * 29 - dx * 7); ctx.closePath(); ctx.fillStyle = ink; ctx.fill();
    }
  }, [model, floor, point, suggestions]);
  function choose(x: number, z: number) {
    const result = assessWalkStart(model, floor, { x, z });
    if (result.ok) { setChosen({ floor, point: result.placement }); setError(""); }
    else setError(result.reason);
  }
  const headingLabel = point ? Math.round((Math.atan2(-Math.sin(point.yaw), Math.cos(point.yaw)) * 180 / Math.PI + 360) % 360) + "° clockwise from plan up" : "";
  return <WorkspaceDialog title="Pick your walking start" onClose={onClose}>
    <div className="walk-start-picker" data-start-ready={Boolean(point) && !error} data-start-floor={floor} data-start-yaw={point?.yaw ?? ""}>
      <p>Choose a suggested clear area or click the floor plan. The arrow shows your starting view.</p>
      <label>Starting floor<select aria-label="Starting floor" value={floor} onChange={e => { setFloor(e.target.value); setChosen(null); setError(""); }}>
        {floors.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select></label>
      {!floors.length && <p role="alert">This model has no supported floor elevations for walking. Use orbit navigation to inspect it.</p>}
      {suggestions.length > 0 && <div className="walk-start-suggestions" role="group" aria-label="Suggested walking starts">{suggestions.map((p, i) => <button className="pill" key={p.supportId} aria-pressed={point?.x === p.x && point?.z === p.z} onClick={() => { setChosen({ floor, point: p }); setError(""); }}>
        <strong>{i + 1}. {p.label.split(" / ")[0]}</strong><span>{p.clearView.toFixed(1)} m clear starting view</span>
      </button>)}</div>}
      {floor && !suggestions.length && <p>No clear starting area could be suggested for this floor. Select a supported clear area, or use orbit navigation.</p>}
      <canvas ref={canvas} width={width} height={height} tabIndex={0} role="button" aria-label="Choose walking start on floor plan"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); choose((((e.clientX - r.left) * width) / r.width - ox) / scale, (((e.clientY - r.top) * height) / r.height - oz) / scale); }}
        onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
          e.preventDefault(); const p = point ?? { x: (bounds[0] + bounds[2]) / 2, z: (bounds[1] + bounds[3]) / 2 };
          choose(p.x + (e.key === "ArrowRight" ? .5 : e.key === "ArrowLeft" ? -.5 : 0), p.z + (e.key === "ArrowDown" ? .5 : e.key === "ArrowUp" ? -.5 : 0));
        } }} />
      {error && <p role="alert">{error} The previous start is retained; select a clear point before continuing.</p>}
      {point && <p className="walk-start-selected" role="status"><strong>{point.label}</strong><span>X {point.x.toFixed(2)} m · Z {point.z.toFixed(2)} m · floor {point.elevation.toFixed(2)} m</span><span>View: {headingLabel} · {point.clearView.toFixed(1)} m clear ahead</span></p>}
      <p className="walk-start-inference">Suggested position and heading are inferred from modelled room/slab surfaces and solid geometry. They are not a verified access route. Eye height is 1.65 m above the selected surface.</p>
      <div className="walk-start-footer"><span><kbd>Esc</kbd> exits navigation</span><button className="pill-dark" disabled={!point || !!error} onClick={() => {
        if (!point) return; const result = assessWalkStart(model, floor, point);
        if (!result.ok) { setError(result.reason); return; }
        onStart(floor, { x: result.placement.x, z: result.placement.z, elevation: result.placement.elevation, level: floor, yaw: result.placement.yaw });
      }}>Start walking here</button></div>
      <small>Walking follows modelled floors and stairs. Solid boundaries and closed doors block movement; press E near a door to open it.</small>
    </div>
  </WorkspaceDialog>;
}
