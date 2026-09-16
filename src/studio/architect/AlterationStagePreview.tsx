import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ArchitectProject } from "./model";
import { primitives, type View } from "./drawing";
import { drawingBounds } from "./sheets";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { createAlterationBasis, resolveAlterationStage } from "./alterationStage";
import { calculateAlterationQuantities } from "./alterationQuantities";
import {
  calculateDemolitionSchedule,
  calculateSalvageDisposalSchedule,
  calculateRepairSchedule,
  calculateAlterationMaterialSchedule,
  demolitionScheduleCsv,
  salvageDisposalScheduleCsv,
  repairScheduleCsv,
  alterationMaterialScheduleCsv,
} from "./alterationSchedules";
import { SyncDesignMaterials } from "./SyncDesignMaterials";
import { exportAlterationStagePdf } from "./alterationExport";
import { appendAlterationDraft, createAlterationDraft, exportSavedAlterationDraftPdf, removeAlterationDraft } from "./alterationDrafts";
import { useDesignConfirmation } from "./useDesignConfirmation";
import {
  calculateStageOpeningSchedule,
  calculateStageRoomSchedule,
  verifyAnnotationCoordination,
  stageOpeningScheduleCsv,
  stageRoomScheduleCsv,
} from "./alterationCoordination";
import { AlterationIssueModal } from "./AlterationIssueModal";
import { AlterationIssueHistory } from "./AlterationIssueHistory";
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
  const [scheduleTab, setScheduleTab] = useState<"volumes" | "demolition" | "salvage" | "repair" | "materials" | "openings" | "rooms">("volumes");
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const mounted = useRef(true);
  const selectionEpoch = useRef(0);
  const currentSelection = useRef({ project, basis, stage, levelId, view });
  currentSelection.current = { project, basis, stage, levelId, view };
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const invalidateExport = () => { selectionEpoch.current += 1; setExportError(""); setExportNotice(""); };
  const resolved = useMemo(() => resolveAlterationStage(project, basis, stage), [project, basis, stage]);
  const quantities = useMemo(() => calculateAlterationQuantities(project, basis), [project, basis]);
  const demoSched = useMemo(() => calculateDemolitionSchedule(project, basis), [project, basis]);
  const salvageSched = useMemo(() => calculateSalvageDisposalSchedule(project, basis), [project, basis]);
  const repairSched = useMemo(() => calculateRepairSchedule(project, basis), [project, basis]);
  const matSched = useMemo(() => calculateAlterationMaterialSchedule(project, basis), [project, basis]);
  const openingSched = useMemo(() => calculateStageOpeningSchedule(project, basis, stage), [project, basis, stage]);
  const roomSched = useMemo(() => calculateStageRoomSchedule(project, basis, stage), [project, basis, stage]);
  const annotationAudit = useMemo(() => verifyAnnotationCoordination(project, basis), [project, basis]);

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  };
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
      setError("Enter a reference and confirm the recorded changes and remaining unchanged geometry before reviewing these stages.");
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
    <p>Existing and repaired elements use current geometry in both stages unless a repaired wall has an explicit before-repair height. Full opening infill uses the host wall layers in the proposed stage. Review these authored records against your survey and brief; other changed shapes need separate supported records.</p>
    <label htmlFor={referenceId}>Survey / brief reference for this review (required)</label>
    <input id={referenceId} value={reference} maxLength={500} placeholder="Document, revision and page or item"
      onChange={(event) => { invalidateExport(); setReference(event.target.value); setBasis(null); setConfirmed(false); setError(""); }} />
    <label className="alteration-stage-confirm">
      <input type="checkbox" checked={confirmed} onChange={(event) => { invalidateExport(); setConfirmed(event.target.checked); setBasis(null); }} />
      <span>I confirm the recorded infill and before-repair heights, and that other existing and repaired geometry is unchanged between stages.</span>
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
      <button type="button" className="alteration-stage-issue-btn" disabled={!resolved.ready || !basis} onClick={() => setIssueModalOpen(true)}>Issue coordinated alteration set</button>
      <p className="alteration-stage-note">Draft drawing of the selected stage, level and view. Shared annotations and the reviewed basis remain identified.</p>
      {exportError && <p className="alteration-stage-error" role="alert">{exportError}</p>}
      {exportNotice && <p role="status">{exportNotice}</p>}
    </div>
    {issueModalOpen && <AlterationIssueModal project={project} basis={basis} onClose={() => setIssueModalOpen(false)} onIssued={(nextProject) => { onChange(nextProject); setExportNotice("Coordinated alteration set issued successfully."); }} />}
    <section className="alteration-stage-quantities" aria-label="Alteration schedules and quantities">
      <strong>Alteration schedules & volume analysis · all project levels</strong>
      <p className="alteration-stage-note">Authored solid geometry, demolition, salvage/disposal, repair, and material scopes across all levels. Assembly layers block volume comparison.</p>
      {quantities.ready ? <>
        <dl className="alteration-volume-values">
          <div><dt>Before</dt><dd>{volume(quantities.beforeWallSolidVolumeM3)}</dd></div>
          <div><dt>Proposed</dt><dd>{volume(quantities.proposedWallSolidVolumeM3)}</dd></div>
          <div><dt>Change (proposed − before)</dt><dd>{volume(quantities.deltaWallSolidVolumeM3)}</dd></div>
        </dl>
        <div className="alteration-schedule-nav" role="tablist" aria-label="Alteration schedules">
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "volumes"} onClick={() => setScheduleTab("volumes")}>Wall breakdown</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "demolition"} onClick={() => setScheduleTab("demolition")}>Demolition ({demoSched.rows.length})</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "salvage"} onClick={() => setScheduleTab("salvage")}>Salvage & disposal ({salvageSched.rows.length})</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "repair"} onClick={() => setScheduleTab("repair")}>Repair ({repairSched.rows.length})</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "materials"} onClick={() => setScheduleTab("materials")}>Materials & sync ({matSched.rows.length})</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "openings"} onClick={() => setScheduleTab("openings")}>Stage openings ({openingSched.rows.length})</button>
          <button type="button" className="alteration-schedule-tab" role="tab" aria-selected={scheduleTab === "rooms"} onClick={() => setScheduleTab("rooms")}>Stage rooms ({roomSched.rows.length})</button>
        </div>

        {scheduleTab === "volumes" && <>
          <strong>Lifecycle work breakdown</strong>
          <table className="alteration-breakdown-table" aria-label="Lifecycle volume breakdown">
            <thead>
              <tr>
                <th scope="col">Classification</th>
                <th scope="col">Before</th>
                <th scope="col">Proposed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Existing (retained)</td>
                <td>{volume(quantities.breakdown.existingBeforeVolumeM3)}</td>
                <td>{volume(quantities.breakdown.existingProposedVolumeM3)}</td>
              </tr>
              <tr>
                <td>Demolished</td>
                <td>{volume(quantities.breakdown.demolishedVolumeM3)}</td>
                <td>—</td>
              </tr>
              <tr>
                <td>New</td>
                <td>—</td>
                <td>{volume(quantities.breakdown.newVolumeM3)}</td>
              </tr>
              <tr>
                <td>Repaired</td>
                <td>{volume(quantities.breakdown.repairedBeforeVolumeM3)}</td>
                <td>{volume(quantities.breakdown.repairedProposedVolumeM3)}</td>
              </tr>
              <tr>
                <td>Shared category junctions</td>
                <td>{volume(quantities.breakdown.beforeSharedJunctionVolumeM3)}</td>
                <td>{volume(quantities.breakdown.proposedSharedJunctionVolumeM3)}</td>
              </tr>
            </tbody>
          </table>
          <p className={`alteration-shared-notice ${quantities.breakdown.hasUnresolvedSharedAllocation ? "has-shared" : ""}`}>
            {quantities.breakdown.hasUnresolvedSharedAllocation
              ? "Notice: Shared junction volume between distinct lifecycle classifications is disclosed separately without arbitrary category priority or lexical ID assignment."
              : "No cross-category shared junction volume detected across stage boundaries."}
          </p>
        </>}

        {scheduleTab === "demolition" && <div className="alteration-schedule-view schedule-demolition" role="tabpanel" aria-label="Demolition schedule">
          <div className="alteration-actions-row">
            <strong>Demolition schedule · {demoSched.rows.length} elements</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(demolitionScheduleCsv(project, basis), `demolition-schedule-${project.id}-r${project.revision}.csv`)}>Download demolition CSV</button>
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Demolished solid volume</dt><dd>{demoSched.totalDemolishedVolumeM3.toFixed(3)} m³</dd></div>
            <div><dt>Demolished net area</dt><dd>{demoSched.totalDemolishedAreaM2.toFixed(2)} m²</dd></div>
          </div>
          {demoSched.unknowns.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Unknown conditions & assumptions</strong>
            <ul>{demoSched.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Demolition elements">
            <thead>
              <tr>
                <th scope="col">Element</th>
                <th scope="col">Kind</th>
                <th scope="col">Level</th>
                <th scope="col">Dimensions</th>
                <th scope="col">Net Area</th>
                <th scope="col">Volume</th>
                <th scope="col">Disposition</th>
              </tr>
            </thead>
            <tbody>
              {demoSched.rows.length === 0 ? <tr><td colSpan={7}>No demolished elements in this project.</td></tr> : demoSched.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.kind}</td>
                  <td>{r.levelName}</td>
                  <td>{r.dimensions}</td>
                  <td>{r.areaM2.toFixed(3)} m²</td>
                  <td>{r.volumeM3 !== null ? `${r.volumeM3.toFixed(3)} m³` : "—"}</td>
                  <td>{r.disposition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {scheduleTab === "salvage" && <div className="alteration-schedule-view schedule-salvage" role="tabpanel" aria-label="Salvage and disposal schedule">
          <div className="alteration-actions-row">
            <strong>Salvage & disposal schedule · {salvageSched.rows.length} items</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(salvageDisposalScheduleCsv(project, basis), `salvage-disposal-${project.id}-r${project.revision}.csv`)}>Download disposal CSV</button>
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Net demolished volume</dt><dd>{salvageSched.totalNetVolumeM3.toFixed(3)} m³</dd></div>
            <div><dt>Gross disposal volume (bulked)</dt><dd>{salvageSched.totalGrossDisposalVolumeM3.toFixed(3)} m³</dd></div>
            <div><dt>Estimated weight</dt><dd>{salvageSched.totalEstimatedWeightKg > 0 ? `${salvageSched.totalEstimatedWeightKg.toFixed(0)} kg` : "Unspecified"}</dd></div>
          </div>
          {salvageSched.unknowns.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Disposal assumptions & unknowns</strong>
            <ul>{salvageSched.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Salvage and disposal items">
            <thead>
              <tr>
                <th scope="col">Material / Layer</th>
                <th scope="col">Category</th>
                <th scope="col">Net Vol</th>
                <th scope="col">Bulking</th>
                <th scope="col">Gross Vol</th>
                <th scope="col">Route</th>
                <th scope="col">Salvage</th>
              </tr>
            </thead>
            <tbody>
              {salvageSched.rows.length === 0 ? <tr><td colSpan={7}>No demolished material items to dispose.</td></tr> : salvageSched.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.elementName} / {r.materialName}</td>
                  <td>{r.category}</td>
                  <td>{r.netVolumeM3 !== null ? `${r.netVolumeM3.toFixed(3)} m³` : "—"}</td>
                  <td>{r.bulkingFactor.toFixed(2)}x</td>
                  <td>{r.grossDisposalVolumeM3 !== null ? `${r.grossDisposalVolumeM3.toFixed(3)} m³` : "—"}</td>
                  <td>{r.routing}</td>
                  <td>{r.salvageable ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {scheduleTab === "repair" && <div className="alteration-schedule-view schedule-repair" role="tabpanel" aria-label="Repair schedule">
          <div className="alteration-actions-row">
            <strong>Repair schedule · {repairSched.rows.length} elements</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(repairScheduleCsv(project, basis), `repair-schedule-${project.id}-r${project.revision}.csv`)}>Download repair CSV</button>
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Total repair volume</dt><dd>{repairSched.totalRepairVolumeM3.toFixed(3)} m³</dd></div>
          </div>
          {repairSched.unknowns.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Repair assumptions & engineering notices</strong>
            <ul>{repairSched.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Repair elements">
            <thead>
              <tr>
                <th scope="col">Element</th>
                <th scope="col">Kind</th>
                <th scope="col">Level</th>
                <th scope="col">Before Dimensions</th>
                <th scope="col">Proposed Dimensions</th>
                <th scope="col">Repair Delta</th>
                <th scope="col">Basis Reference</th>
              </tr>
            </thead>
            <tbody>
              {repairSched.rows.length === 0 ? <tr><td colSpan={7}>No repaired elements in this project.</td></tr> : repairSched.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.kind}</td>
                  <td>{r.levelName}</td>
                  <td>{r.beforeDimensions}</td>
                  <td>{r.proposedDimensions}</td>
                  <td>{r.deltaVolumeM3 > 0 ? `${r.deltaVolumeM3.toFixed(3)} m³` : "In-situ"}</td>
                  <td>{r.repairBasisReference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {scheduleTab === "materials" && <div className="alteration-schedule-view schedule-materials" role="tabpanel" aria-label="Alteration material schedule">
          <div className="alteration-actions-row">
            <strong>Proposed new & repair material schedule · {matSched.rows.length} layers</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(alterationMaterialScheduleCsv(project, basis), `alteration-materials-${project.id}-r${project.revision}.csv`)}>Download materials CSV</button>
            <SyncDesignMaterials project={project} basis={basis} onError={setError} />
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Total net volume</dt><dd>{matSched.totalNetVolumeM3.toFixed(3)} m³</dd></div>
            <div><dt>Total order area (with waste)</dt><dd>{matSched.totalOrderAreaM2.toFixed(2)} m²</dd></div>
          </div>
          {matSched.unknowns.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Material unknowns & notes</strong>
            <ul>{matSched.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Alteration materials">
            <thead>
              <tr>
                <th scope="col">Material / Layer</th>
                <th scope="col">Source Element</th>
                <th scope="col">Lifecycle</th>
                <th scope="col">Net Area</th>
                <th scope="col">Waste %</th>
                <th scope="col">Order Area</th>
                <th scope="col">Net Volume</th>
              </tr>
            </thead>
            <tbody>
              {matSched.rows.length === 0 ? <tr><td colSpan={7}>No new or repaired material layers in this project.</td></tr> : matSched.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.materialName}</td>
                  <td>{r.sourceElementName}</td>
                  <td>{r.lifecycleStatus}</td>
                  <td>{r.netAreaM2.toFixed(3)} m²</td>
                  <td>{r.wastePercent}%</td>
                  <td>{r.orderAreaM2.toFixed(3)} m²</td>
                  <td>{r.netVolumeM3 !== null ? `${r.netVolumeM3.toFixed(3)} m³` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {scheduleTab === "openings" && <div className="alteration-schedule-view schedule-openings" role="tabpanel" aria-label="Stage opening schedule">
          <div className="alteration-actions-row">
            <strong>Stage opening schedule ({stage}) · {openingSched.rows.length} openings</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(stageOpeningScheduleCsv(project, basis, stage), `stage-openings-${stage}-${project.id}-r${project.revision}.csv`)}>Download openings CSV</button>
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Total openings</dt><dd>{openingSched.totalOpenings}</dd></div>
            <div><dt>Doors</dt><dd>{openingSched.doorsCount}</dd></div>
            <div><dt>Windows</dt><dd>{openingSched.windowsCount}</dd></div>
            <div><dt>Retained voids</dt><dd>{openingSched.voidsCount}</dd></div>
          </div>
          {annotationAudit.warnings.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Cross-view coordination notices</strong>
            <ul>{annotationAudit.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Stage openings">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Kind</th>
                <th scope="col">Level</th>
                <th scope="col">Host Wall</th>
                <th scope="col">Dimensions</th>
                <th scope="col">Sill</th>
                <th scope="col">Hinge / Swing</th>
                <th scope="col">Lifecycle</th>
                <th scope="col">Disposition</th>
              </tr>
            </thead>
            <tbody>
              {openingSched.rows.length === 0 ? <tr><td colSpan={9}>No openings in this stage.</td></tr> : openingSched.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.tag}</strong></td>
                  <td>{r.kind}</td>
                  <td>{r.levelName}</td>
                  <td>{r.wallName}</td>
                  <td>{r.width} × {r.height} mm</td>
                  <td>{r.sill} mm</td>
                  <td>{r.hinge} / {r.swing}</td>
                  <td>{r.lifecycleStatus}</td>
                  <td>{r.disposition}{r.isReplacement ? " (replacement)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {scheduleTab === "rooms" && <div className="alteration-schedule-view schedule-rooms" role="tabpanel" aria-label="Stage room schedule">
          <div className="alteration-actions-row">
            <strong>Stage room schedule ({stage}) · {roomSched.rows.length} rooms</strong>
            <button type="button" className="schedule-csv-btn" onClick={() => downloadCsv(stageRoomScheduleCsv(project, basis, stage), `stage-rooms-${stage}-${project.id}-r${project.revision}.csv`)}>Download rooms CSV</button>
          </div>
          <div className="alteration-schedule-metrics">
            <div><dt>Total floor area</dt><dd>{roomSched.totalAreaM2.toFixed(2)} m²</dd></div>
            <div><dt>Rooms count</dt><dd>{roomSched.rows.length}</dd></div>
            <div><dt>Orphaned tags</dt><dd>{roomSched.orphanedTags.length}</dd></div>
          </div>
          {roomSched.orphanedTags.length > 0 && <div className="alteration-schedule-unknowns" role="status">
            <strong>Orphaned room tags (outside room boundaries)</strong>
            <ul>{roomSched.orphanedTags.map((t, i) => <li key={i}>Tag "{t.name}" on level {t.levelName} does not lie inside any closed room.</li>)}</ul>
          </div>}
          <table className="alteration-breakdown-table" aria-label="Stage rooms">
            <thead>
              <tr>
                <th scope="col">Room Name</th>
                <th scope="col">Level</th>
                <th scope="col">Floor Area</th>
                <th scope="col">Perimeter</th>
                <th scope="col">Ceiling Height</th>
                <th scope="col">Variance ({stage === "proposed" ? "vs Before" : "Baseline"})</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {roomSched.rows.length === 0 ? <tr><td colSpan={7}>No closed rooms detected in this stage.</td></tr> : roomSched.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.levelName}</td>
                  <td>{r.areaM2.toFixed(2)} m²</td>
                  <td>{r.perimeterM.toFixed(2)} m</td>
                  <td>{r.ceilingHeightM.toFixed(2)} m</td>
                  <td>{r.varianceFromBeforeM2 !== null ? `${r.varianceFromBeforeM2 > 0 ? "+" : ""}${r.varianceFromBeforeM2.toFixed(2)} m²` : "—"}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

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
    <AlterationIssueHistory key={`issues-${project.id}:${project.alterationIssues?.length ?? 0}`} project={project} />
  </details>;
}
