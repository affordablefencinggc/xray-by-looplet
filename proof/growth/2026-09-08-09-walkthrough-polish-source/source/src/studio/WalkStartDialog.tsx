import { useMemo, useState } from "react";
import type { SourceBuilding } from "./sourceBuilding";
import { buildCleanWalkPlan, planPath } from "./cleanWalkPlan.ts";
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
  const plan = useMemo(() => buildCleanWalkPlan(model, floor), [model, floor]);
  const bounds = plan.bounds, span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1], 1), pad = span * .055;
  const marker = span / 48, labelSize = span / 38;
  function choose(x: number, z: number) {
    const result = assessWalkStart(model, floor, { x, z });
    if (result.ok) { setChosen({ floor, point: result.placement }); setError(""); }
    else setError(result.reason);
  }
  const headingLabel = point ? Math.round((Math.atan2(-Math.sin(point.yaw), Math.cos(point.yaw)) * 180 / Math.PI + 360) % 360) + "° clockwise from plan up" : "";
  return <WorkspaceDialog title="Pick your walkthrough starting point" onClose={onClose}>
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
      <div className="walk-plan-caption"><span>Floor plan · walls, openings and stairs</span><span>↑ Plan up</span></div>
      <svg className="walk-clean-plan" viewBox={`${bounds[0]-pad} ${bounds[1]-pad} ${bounds[2]-bounds[0]+pad*2} ${bounds[3]-bounds[1]+pad*2}`}
        data-plan-bounds={bounds.join(",")} tabIndex={0} role="button" aria-label="Choose walking start on floor plan"
        onClick={e => { const matrix = e.currentTarget.getScreenCTM(); if (matrix) { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); choose(p.x, p.y); } }}
        onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
          e.preventDefault(); const p = point ?? { x: (bounds[0] + bounds[2]) / 2, z: (bounds[1] + bounds[3]) / 2 };
          choose(p.x + (e.key === "ArrowRight" ? .5 : e.key === "ArrowLeft" ? -.5 : 0), p.z + (e.key === "ArrowDown" ? .5 : e.key === "ArrowUp" ? -.5 : 0));
        } }}>
        {["floor", "stair", "wall", "window", "door"].map(kind => <g key={kind} className={`walk-plan-${kind}`}>{plan.shapes.filter(s => s.kind === kind).map(shape => <path key={shape.id} d={planPath(shape.loops)} fillRule="evenodd" vectorEffect="non-scaling-stroke" />)}</g>)}
        <g className="walk-plan-labels" fontSize={labelSize}>{plan.labels.map(label => <text key={label.id} x={label.point[0]} y={label.point[1] + labelSize * 1.5} textAnchor="middle">{label.text}</text>)}</g>
        {suggestions.map((suggestion,index) => <g key={suggestion.supportId} className="walk-plan-suggestion" transform={`translate(${suggestion.x} ${suggestion.z})`}>
          <circle r={marker} /><text textAnchor="middle" dominantBaseline="central" fontSize={marker*1.2}>{index+1}</text>
        </g>)}
        {point && <g className="walk-plan-chosen" transform={`translate(${point.x} ${point.z})`}>
          <circle r={marker*1.4} fill="none" vectorEffect="non-scaling-stroke" />
          {!suggestions.some(s=>s.x===point.x&&s.z===point.z) && <circle r={marker*.55} />}
          <g transform={`rotate(${-point.yaw*180/Math.PI})`}><path d={`M0,${-marker*1.5} L0,${-marker*3.6}`} vectorEffect="non-scaling-stroke"/><path d={`M0,${-marker*4.1} L${-marker*.6},${-marker*3.1} L${marker*.6},${-marker*3.1} Z`} /></g>
        </g>}
      </svg>
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
