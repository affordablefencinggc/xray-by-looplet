import { useId, useMemo, useState } from "react";
import type { ArchitectProject } from "./model";
import { primitives, type View } from "./drawing";
import { drawingBounds } from "./sheets";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage";
import "./alterationStagePreview.css";

const views: { value: View; label: string }[] = [
  { value: "plan", label: "Plan" }, { value: "section", label: "Section" },
  { value: "north", label: "North elevation" }, { value: "south", label: "South elevation" },
  { value: "east", label: "East elevation" }, { value: "west", label: "West elevation" },
];

function StageReview({ project }: { project: ArchitectProject }) {
  const referenceId = useId();
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [basis, setBasis] = useState<ReturnType<typeof createAlterationBasis> | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"before" | "proposed">("before");
  const [view, setView] = useState<View>("plan");
  const [levelId, setLevelId] = useState(project.levels[0].id);
  const resolved = useMemo(() => resolveAlterationStage(project, basis, stage), [project, basis, stage]);
  const drawing = useMemo(() => {
    if (!resolved.ready) return null;
    const items = primitives(resolved.model, levelId, view);
    const bounds = drawingBounds(items);
    const width = Math.max(bounds.max[0] - bounds.min[0], 1000);
    const height = Math.max(bounds.max[1] - bounds.min[1], 1000);
    const padding = Math.max(width, height) * 0.08;
    return { items, box: [bounds.min[0] - padding, bounds.min[1] - padding, width + 2 * padding, height + 2 * padding].join(" ") };
  }, [resolved, levelId, view]);
  const confirmBasis = () => {
    if (!confirmed || !reference.trim()) {
      setError("Enter a reference and confirm the unchanged geometry assumption before reviewing these stages.");
      return;
    }
    try { setBasis(createAlterationBasis(project, reference.trim())); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The stage review could not be prepared."); }
  };
  return <div className="alteration-stage-content">
    <p>Compare before and proposed geometry using the assigned work statuses. This read-only preview does not change your design.</p>
    <p>Existing and repaired elements use the current geometry in both stages. Review that assumption against your survey and brief; a changed shape needs separate before and proposed records.</p>
    <label htmlFor={referenceId}>Survey / brief reference for this review (required)</label>
    <input id={referenceId} value={reference} maxLength={500} placeholder="Document, revision and page or item"
      onChange={(event) => { setReference(event.target.value); setBasis(null); setConfirmed(false); setError(""); }} />
    <label className="alteration-stage-confirm">
      <input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setBasis(null); }} />
      <span>I confirm existing and repaired elements have unchanged geometry between before and proposed.</span>
    </label>
    <button type="button" className="alteration-stage-review" onClick={confirmBasis}>Review stage geometry</button>
    {error && <p className="alteration-stage-error" role="alert">{error}</p>}
    <p className="alteration-stage-note">This review is held for this session only. Reloading or editing the project requires a fresh review. It does not verify the source or approve quantities, exports or procurement.</p>
    <div className="alteration-stage-controls">
      <label>Stage<select aria-label="Alteration preview stage" value={stage} onChange={(event) => setStage(event.target.value as "before" | "proposed")}><option value="before">Before</option><option value="proposed">Proposed</option></select></label>
      <label>Level<select aria-label="Alteration preview level" value={levelId} onChange={(event) => setLevelId(event.target.value)}>{project.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      <label>View<select aria-label="Alteration preview view" value={view} onChange={(event) => setView(event.target.value as View)}>{views.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div>
    {!resolved.ready ? <div className="alteration-stage-blockers" role="status">
      <strong>Stage preview unavailable</strong>
      <ul>{resolved.blockers.map((blocker, index) => <li key={`${blocker.elementId}-${index}`}>{blocker.elementId && <span>{blocker.elementId}: </span>}{blocker.reason}</li>)}</ul>
      <p>Resolve every blocker before a stage drawing can be shown.</p>
    </div> : <>
      <p className="alteration-stage-note">Review reference: {resolved.basisReference}. {resolved.excludedIds.length} elements excluded from this stage.</p>
      <p className="alteration-stage-note">Shared annotations: grids, notes, dimensions and room labels are carried through for orientation and are not separate stage documentation.</p>
      {!resolved.model.walls.length && !resolved.model.openings.length && !resolved.model.slabs.length && !resolved.model.roofs.length && <p className="alteration-stage-note">No building elements belong to this stage. Any marks shown below are shared annotations.</p>}
      {drawing && <svg className="alteration-stage-drawing" role="img" aria-label={`${stage === "before" ? "Before" : "Proposed"} alteration ${views.find((item) => item.value === view)?.label.toLowerCase()}`} viewBox={drawing.box}>
        <DrawingPrimitives items={drawing.items} />
      </svg>}
    </>}
  </div>;
}

export function AlterationStagePreview({ project }: { project: ArchitectProject }) {
  return <details className="alteration-stage-preview" onKeyDown={(event) => event.stopPropagation()}>
    <summary>Before / proposed preview</summary>
    <StageReview key={`${project.id}:${project.revision}`} project={project} />
  </details>;
}
