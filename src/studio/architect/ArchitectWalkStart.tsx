import { useMemo, useState } from "react";
import { WorkspaceDialog } from "../WorkspaceDialog";
import type { WalkStart } from "../WalkStartDialog";
import type { ArchitectProject, Point } from "./model";
import { wallAtHeight } from "./geometry.ts";
import "../walkStartPlacement.css";

export function ArchitectWalkStart({ project, initialLevel, onClose, onStart }: {
  project: ArchitectProject; initialLevel: string; onClose: () => void; onStart: (point: WalkStart) => void;
}) {
  const levels = initialLevel === "all" ? project.levels : project.levels.filter(l => l.id === initialLevel);
  const [levelId, setLevelId] = useState(levels[0].id);
  const [point, setPoint] = useState<Point | null>(null);
  const walls = useMemo(() => project.walls.filter(w => w.levelId === levelId), [project, levelId]);
  const sections = useMemo(() => walls.map(w => ({ id: w.id, polygons: wallAtHeight(w, project, 1000) })), [walls, project]);
  const points = walls.flatMap(w => [w.a, w.b]);
  const minX = Math.min(0, ...points.map(p => p[0])) - 500, minZ = Math.min(0, ...points.map(p => p[1])) - 500;
  const width = Math.max(9000, ...points.map(p => p[0])) - minX + 500;
  const height = Math.max(6000, ...points.map(p => p[1])) - minZ + 500;
  const clamp = (p: Point): Point => [Math.max(minX, Math.min(minX + width, p[0])), Math.max(minZ, Math.min(minZ + height, p[1]))];
  return <WorkspaceDialog title="Pick your walkthrough starting point" onClose={onClose}>
    <div className="walk-start-picker">
      <p>Choose a floor and click its plan to place your starting point.</p>
      <label>Starting floor<select aria-label="Starting floor" value={levelId} onChange={e => { setLevelId(e.target.value); setPoint(null); }}>
        {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select></label>
      <div className="walk-plan-caption"><span>Floor plan · walls and openings</span><span>↑ Plan up</span></div>
      <svg className="arch-walk-plan" viewBox={`${minX} ${minZ} ${width} ${height}`} role="button" tabIndex={0} aria-label="Choose walking start on floor plan"
        onClick={e => { const matrix = e.currentTarget.getScreenCTM(); if (matrix) { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); setPoint(clamp([p.x, p.y])); } }}
        onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const p = point ?? [minX + width / 2, minZ + height / 2]; setPoint(clamp([p[0] + (e.key === "ArrowRight" ? 100 : e.key === "ArrowLeft" ? -100 : 0), p[1] + (e.key === "ArrowDown" ? 100 : e.key === "ArrowUp" ? -100 : 0)])); }}>
        <g className="walk-plan-floor">{project.slabs.filter(s=>s.levelId===levelId).map(s=><polygon key={s.id} points={s.points.map(p=>p.join(",")).join(" ")} vectorEffect="non-scaling-stroke" />)}</g>
        <g className="walk-plan-wall">{sections.map(s=><path key={s.id} fillRule="evenodd" d={s.polygons.flatMap(p=>p.map(r=>r.map((v,i)=>`${i?"L":"M"}${v[0]},${v[1]}`).join(" ")+" Z")).join(" ")} />)}</g>
        {project.openings.filter(o=>walls.some(w=>w.id===o.wallId)).map(o=>{
          const wall=walls.find(w=>w.id===o.wallId)!,length=Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1]);
          if(!length)return null;
          const at=(offset:number)=>[wall.a[0]+(wall.b[0]-wall.a[0])*offset/length,wall.a[1]+(wall.b[1]-wall.a[1])*offset/length],a=at(o.offset-o.width/2),b=at(o.offset+o.width/2);
          return <line key={o.id} className={`walk-plan-${o.kind}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />;
        })}
        <g className="walk-plan-labels" fontSize={Math.max(width,height)/48}>{project.roomTags.filter(t=>t.levelId===levelId).map(t=><text key={t.id} x={t.point[0]} y={t.point[1]} textAnchor="middle">{t.name}</text>)}</g>
        {point && <g className="walk-plan-chosen" transform={`translate(${point[0]} ${point[1]})`}><circle r={140} /><circle r={210} fill="none" /><path d="M0,-220 L0,-560 M0,-650 L-110,-460 L110,-460 Z" /></g>}
      </svg>
      <p>{point ? `Start: X ${(point[0] / 1000).toFixed(2)} m · Z ${(point[1] / 1000).toFixed(2)} m` : "Click the plan, or focus it and use the arrow keys."}</p>
      <button disabled={!point} onClick={() => point && onStart({ x: point[0] / 1000, z: point[1] / 1000, elevation: project.levels.find(l => l.id === levelId)!.elevation / 1000 })}>Start walking here</button>
      <p>Eye height 1.65 m above a modelled floor. Solid boundaries block walking; approach a door and press E to open it. Esc exits.</p>
    </div>
  </WorkspaceDialog>;
}
