import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ArchitectProject } from "./model";
import { primitives, type View } from "./drawing";
import { drawingBounds } from "./sheets";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage";
import { calculateAlterationQuantities } from "./alterationQuantities";
import { exportAlterationStagePdf } from "./alterationExport";
import { appendAlterationDraft, createAlterationDraft, exportSavedAlterationDraftPdf, removeAlterationDraft } from "./alterationDrafts";
import { useDesignConfirmation } from "./useDesignConfirmation";
import "./alterationStagePreview.css";

const views: { value: View; label: string }[] = [
  { value: "plan", label: "Plan" }, { value: "section", label: "Section" },
  { value: "north", label: "North elevation" }, { value: "south", label: "South elevation" },
  { value: "east", label: "East elevation" }, { value: "west", label: "West elevation" },
];

type StageProps = { project: ArchitectProject; onChange: (project: ArchitectProject) => boolean };

function StageReview({ project, onChange }: StageProps) {
  const referenceId = useId();
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [basis, setBasis] = useState<ReturnType<typeof createAlterationBasis> | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"before" | "proposed">("before");
  const [view, setView] = useState<View>("plan");
  const [levelId, setLevelId] = useState(project.levels[0].id);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const mounted = useRef(true);
  const selectionEpoch = useRef(0);
  const currentSelection = useRef({ project, basis, stage, levelId, view });
  currentSelection.current = { project, basis, stage, levelId, view };
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const invalidateExport = () => { selectionEpoch.current += 1; setExportError(""); setExportNotice(""); };
  const resolved = useMemo(() => resolveAlterationStage(project, basis, stage), [project, basis, stage]);
  const quantities = useMemo(() => calculateAlterationQuantities(project, basis), [project, basis]);
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
    invalidateExport();
    if (!confirmed || !reference.trim()) {
      setError("Enter a reference and confirm the unchanged geometry assumption before reviewing these stages.");
      return;
    }
    try { setBasis(createAlterationBasis(project, reference.trim())); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The stage review could not be prepared."); }
  };
  const downloadStage = async () => {
    if (!basis || !resolved.ready || exportBusy) return;
    const requested = currentSelection.current;
    const requestedEpoch = selectionEpoch.current;
    const isCurrent = () => {
      const current = currentSelection.current;
      return mounted.current && selectionEpoch.current === requestedEpoch && current.project === requested.project && current.basis === requested.basis &&
        current.stage === requested.stage && current.levelId === requested.levelId && current.view === requested.view;
    };
    setExportBusy(true); setExportError(""); setExportNotice("");
    try {
      const bytes = await exportAlterationStagePdf(project, basis, stage, { levelId, view });
      if (!isCurrent()) { if (mounted.current) setExportNotice("The review or view changed. The earlier PDF was discarded; export the current selection again."); return; }
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `alteration-${stage}-${view}-${project.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-r${project.revision}-draft.pdf`;
      document.body.appendChild(link);
      try { link.click(); setExportNotice("Draft stage PDF prepared for download."); }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) {
      if (isCurrent()) setExportError(cause instanceof Error ? cause.message : "The draft stage PDF could not be exported.");
    } finally { if (mounted.current) setExportBusy(false); }
  };
  const volume = (value: number) => `${value.toLocaleString("en-AU", { maximumFractionDigits: 6 })} m³`;
  const saveDraft = () => {
    if (!basis || !resolved.ready) return;
    try {
      const record = createAlterationDraft(project, basis, stage, { levelId, view }, { id: crypto.randomUUID(), savedAt: new Date().toISOString() });
      if (!onChange(appendAlterationDraft(project, record))) {
        setExportNotice("");
        setExportError("The stage draft was not saved. Check the workspace save message and try again.");
      }
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : "The stage draft could not be saved."); }
  };
  return <div className="alteration-stage-content">
    <p>Compare before and proposed geometry using the assigned work statuses. This read-only preview does not change your design.</p>
    <p>Existing and repaired elements use the current geometry in both stages. Review that assumption against your survey and brief; a changed shape needs separate before and proposed records.</p>
    <label htmlFor={referenceId}>Survey / brief reference for this review (required)</label>
    <input id={referenceId} value={reference} maxLength={500} placeholder="Document, revision and page or item"
      onChange={(event) => { invalidateExport(); setReference(event.target.value); setBasis(null); setConfirmed(false); setError(""); }} />
    <label className="alteration-stage-confirm">
      <input type="checkbox" checked={confirmed} onChange={(event) => { invalidateExport(); setConfirmed(event.target.checked); setBasis(null); }} />
      <span>I confirm existing and repaired elements have unchanged geometry between before and proposed.</span>
    </label>
    <button type="button" className="alteration-stage-review" onClick={confirmBasis}>Review stage geometry</button>
    {error && <p className="alteration-stage-error" role="alert">{error}</p>}
    <p className="alteration-stage-note">This review is held for this session only. Reloading or editing the project requires a fresh review. It does not verify the source or approve quantities, exports or procurement.</p>
    <div className="alteration-stage-controls">
      <label>Stage<select aria-label="Alteration preview stage" value={stage} onChange={(event) => { invalidateExport(); setStage(event.target.value as "before" | "proposed"); }}><option value="before">Before</option><option value="proposed">Proposed</option></select></label>
      <label>Level<select aria-label="Alteration preview level" value={levelId} onChange={(event) => { invalidateExport(); setLevelId(event.target.value); }}>{project.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      <label>View<select aria-label="Alteration preview view" value={view} onChange={(event) => { invalidateExport(); setView(event.target.value as View); }}>{views.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div>
    <div className="alteration-stage-export">
      <button type="button" className="alteration-stage-download" disabled={!resolved.ready || !basis || exportBusy} onClick={() => void downloadStage()}>{exportBusy ? "Preparing draft PDF…" : "Download current stage PDF"}</button>
      <button type="button" className="alteration-stage-save" disabled={!resolved.ready || !basis || (project.alterationDrafts?.length ?? 0) >= 5} onClick={saveDraft}>Save reviewed stage draft</button>
      <p className="alteration-stage-note">Draft drawing of the selected stage, level and view. Shared annotations and the reviewed basis remain identified.</p>
      {exportError && <p className="alteration-stage-error" role="alert">{exportError}</p>}
      {exportNotice && <p role="status">{exportNotice}</p>}
    </div>
    <section className="alteration-stage-quantities" aria-label="Solid wall volume comparison">
      <strong>Solid wall volume · all project levels</strong>
      <p className="alteration-stage-note">Solid wall layers only, across all levels. Assembly layers block this comparison. The change is proposed minus before geometry; it is not a disposal, ordering or procurement quantity.</p>
      {quantities.ready ? <>
        <dl className="alteration-volume-values">
          <div><dt>Before</dt><dd>{volume(quantities.beforeWallSolidVolumeM3)}</dd></div>
          <div><dt>Proposed</dt><dd>{volume(quantities.proposedWallSolidVolumeM3)}</dd></div>
          <div><dt>Change (proposed − before)</dt><dd>{volume(quantities.deltaWallSolidVolumeM3)}</dd></div>
        </dl>
        <p className="alteration-stage-note">Review reference: {quantities.basisReference}</p>
        <ul>{quantities.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </> : <div className="alteration-quantity-blockers" role="status">
        <strong>Volume comparison unavailable</strong>
        <ul>{quantities.blockers.map((blocker, index) => <li key={`${blocker.elementId}-${index}`}>{blocker.elementId && <span>{blocker.elementId}: </span>}{blocker.reason}</li>)}</ul>
        <p>Resolve all blockers before totals can be shown.</p>
      </div>}
    </section>
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

function SavedStageDrafts({ project, onChange }: StageProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirmDesign, confirmation } = useDesignConfirmation();
  const mounted = useRef(true), currentProject = useRef(project);
  currentProject.current = project;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const downloadSaved = async (id: string) => {
    if (busyId) return;
    const snapshot = project;
    setBusyId(id); setError(""); setNotice("");
    try {
      const bytes = await exportSavedAlterationDraftPdf(snapshot, id);
      if (!mounted.current) return;
      if (currentProject.current !== snapshot) { setNotice("The project changed. The earlier download was discarded; choose the saved draft again."); return; }
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url; link.download = `saved-alteration-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}-draft.pdf`;
      document.body.appendChild(link);
      try { link.click(); setNotice("Saved draft PDF prepared from its frozen source."); }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) {
      if (mounted.current && currentProject.current === snapshot) setError(cause instanceof Error ? cause.message : "The saved draft could not be exported.");
    } finally { if (mounted.current) setBusyId(null); }
  };
  const remove = async (id: string) => {
    const snapshot = project;
    if (!(await confirmDesign("Remove this saved stage draft? The project undo command can restore it."))) return;
    if (!mounted.current || currentProject.current !== snapshot) return;
    try {
      if (!onChange(removeAlterationDraft(snapshot, id))) {
        setNotice(""); setError("The saved draft was not removed. Check the workspace save message and try again."); return;
      }
      setError(""); setNotice("Saved stage draft removed. Undo can restore it.");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The saved draft could not be removed."); }
  };
  const records = project.alterationDrafts ?? [];
  return <section className="alteration-saved-drafts" aria-label="Saved stage drafts">
    <strong>Saved stage drafts · {records.length}/5</strong>
    <p>Each draft preserves its reviewed source, reference and drawing selection. Re-export works after the live review changes. These are frozen drafts, not issued drawings; regenerated PDFs may differ byte for byte.</p>
    <p>Up to five drafts per project, each limited to 256,000 JSON characters and 512,000 UTF-8 bytes.</p>
    {records.length === 0 && <p>No stage drafts saved yet.</p>}
    {records.map((record) => <article key={record.id} className="alteration-saved-row">
      <strong>{record.stage === "before" ? "Before" : "Proposed"} · {record.selection.view} · model revision {record.projectRevision}</strong>
      <p>Level: {record.selection.levelId} · Design revision: {record.designRevision || "—"}</p>
      <p>Reference: {record.basis.reference}</p>
      <time dateTime={record.savedAt}>{new Date(record.savedAt).toLocaleString("en-AU")}</time>
      <div className="alteration-saved-actions">
        <button type="button" disabled={busyId !== null} onClick={() => void downloadSaved(record.id)}>{busyId === record.id ? "Preparing saved PDF…" : "Re-export saved draft"}</button>
        <button type="button" onClick={() => void remove(record.id)}>Remove saved draft</button>
      </div>
    </article>)}
    {error && <p className="alteration-stage-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {confirmation}
  </section>;
}

export function AlterationStagePreview({ project, onChange }: StageProps) {
  return <details className="alteration-stage-preview" onKeyDown={(event) => event.stopPropagation()}>
    <summary>Before / proposed preview</summary>
    <StageReview key={`${project.id}:${project.revision}`} project={project} onChange={onChange} />
    <SavedStageDrafts key={project.id} project={project} onChange={onChange} />
  </details>;
}
