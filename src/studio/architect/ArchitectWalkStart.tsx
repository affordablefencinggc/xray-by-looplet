import { useState } from "react";
import { WorkspaceDialog } from "../WorkspaceDialog";
import type { WalkStart } from "../WalkStartDialog";
import type { ArchitectProject, Point } from "./model";

export function ArchitectWalkStart({ project, initialLevel, onClose, onStart }: {
  project: ArchitectProject; initialLevel: string; onClose: () => void; onStart: (point: WalkStart) => void;
}) {
  const levels = initialLevel === "all" ? project.levels : project.levels.filter(l => l.id === initialLevel);
  const [levelId, setLevelId] = useState(levels[0].id);
  const [point, setPoint] = useState<Point | null>(null);
  const walls = project.walls.filter(w => w.levelId === levelId);
  const points = walls.flatMap(w => [w.a, w.b]);
  const minX = Math.min(0, ...points.map(p => p[0])) - 500, minZ = Math.min(0, ...points.map(p => p[1])) - 500;
  const width = Math.max(9000, ...points.map(p => p[0])) - minX + 500;
  const height = Math.max(6000, ...points.map(p => p[1])) - minZ + 500;
  const clamp = (p: Point): Point => [Math.max(minX, Math.min(minX + width, p[0])), Math.max(minZ, Math.min(minZ + height, p[1]))];
  return <WorkspaceDialog title="Pick your walking start" onClose={onClose}>
    <div className="walk-start-picker">
      <p>Choose a floor and click its plan to place your starting point.</p>
      <label>Starting floor<select aria-label="Starting floor" value={levelId} onChange={e => { setLevelId(e.target.value); setPoint(null); }}>
        {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select></label>
      <svg className="arch-walk-plan" viewBox={`${minX} ${minZ} ${width} ${height}`} role="button" tabIndex={0} aria-label="Choose walking start on floor plan"
        onClick={e => { const matrix = e.currentTarget.getScreenCTM(); if (matrix) { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); setPoint(clamp([p.x, p.y])); } }}
        onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const p = point ?? [minX + width / 2, minZ + height / 2]; setPoint(clamp([p[0] + (e.key === "ArrowRight" ? 100 : e.key === "ArrowLeft" ? -100 : 0), p[1] + (e.key === "ArrowDown" ? 100 : e.key === "ArrowUp" ? -100 : 0)])); }}>
        {walls.map(w => <line key={w.id} x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="currentColor" strokeWidth={100} />)}
        {point && <circle cx={point[0]} cy={point[1]} r={140} className="arch-walk-point" />}
      </svg>
      <p>{point ? `Start: X ${(point[0] / 1000).toFixed(2)} m · Z ${(point[1] / 1000).toFixed(2)} m` : "Click the plan, or focus it and use the arrow keys."}</p>
      <button disabled={!point} onClick={() => point && onStart({ x: point[0] / 1000, z: point[1] / 1000, elevation: project.levels.find(l => l.id === levelId)!.elevation / 1000 })}>Start walking here</button>
      <p>Eye height 1.65 m above the floor. Free walkthrough; walls do not block movement. Esc exits.</p>
    </div>
  </WorkspaceDialog>;
}
