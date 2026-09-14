import { useId, useMemo, useState } from "react";
import type { ArchitectProject } from "./model";
import { alterationSchedule, alterationScheduleCsv, setElementLifecycle, setOpeningDemolitionDisposition, setWallRepairBasis } from "./lifecycle";
import "./alterationPanel.css";

const statuses = ["existing", "new", "demolished", "repaired"] as const;
type Status = (typeof statuses)[number];
const labels = { unassigned: "Unassigned", existing: "Existing", new: "New", demolished: "Demolished", repaired: "Repaired" };
type ScheduleRow = ReturnType<typeof alterationSchedule>["rows"][number];
type Props = {
  project: ArchitectProject;
  onChange: (next: ArchitectProject) => boolean;
  onSelect: (id: string | null) => void;
  selected: string | null;
};

function AssignmentEditor({ project, row, onChange }: {
  project: ArchitectProject; row: ScheduleRow; onChange: Props["onChange"];
}) {
  const referenceId = useId();
  const errorId = useId();
  const [status, setStatus] = useState<Status | "">(row.status === "unassigned" ? "" : row.status);
  const [reference, setReference] = useState(row.reference);
  const [error, setError] = useState("");
  const dispositionId = useId();
  const [dispositionReference, setDispositionReference] = useState(row.demolitionDisposition?.reference ?? "");
  const [dispositionKind, setDispositionKind] = useState<"retain-void" | "infill">(row.demolitionDisposition?.kind ?? "retain-void");
  const [repairHeight, setRepairHeight] = useState(row.repairBasis ? String(row.repairBasis.height) : "");
  const [repairReference, setRepairReference] = useState(row.repairBasis?.reference ?? "");
  const repairReferenceId = useId();
  const saveRepair = (clear: boolean) => {
    if (!clear && (!repairReference.trim() || !repairHeight.trim() || !Number.isFinite(Number(repairHeight)) || Number(repairHeight) <= 0)) {
      setError("Enter a positive before-repair height in millimetres and its reference."); return;
    }
    try {
      if (!onChange(setWallRepairBasis(project, row.id, clear ? null : { height: Number(repairHeight), reference: repairReference.trim() }))) {
        setError("The before-repair basis was not saved. Check the workspace save message and try again."); return;
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The before-repair basis could not be saved."); }
  };
  const retainVoid = (clear: boolean) => {
    if (!clear && !dispositionReference.trim()) { setError("Enter a reference confirming the selected opening disposition."); return; }
    try {
      if (!onChange(setOpeningDemolitionDisposition(project, row.id, clear ? null : { kind: dispositionKind, reference: dispositionReference.trim() }))) {
        setError("The opening disposition was not saved. Check the workspace save message and try again."); return;
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The opening disposition could not be saved."); }
  };
  const apply = (clear: boolean) => {
    if (!clear && (!status || !reference.trim())) {
      setError("Choose a work status and enter a survey or client brief reference.");
      return;
    }
    try {
      if (!onChange(setElementLifecycle(project, row.id, clear ? null : { status: status as Status, reference: reference.trim() }))) {
        setError("The assignment was not saved. Check the workspace save message and try again."); return;
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assignment could not be saved.");
    }
  };
  return <div className="alteration-editor">
    <p><strong>{row.name}</strong> · {row.kind}</p>
    <label>Work status
      <select aria-label="Alteration work status" value={status} onChange={(event) => { setStatus(event.target.value as Status | ""); setError(""); }}>
        <option value="">Choose status</option>
        {statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
      </select>
    </label>
    <label htmlFor={referenceId}>Survey / client brief reference (required)</label>
    <textarea id={referenceId} value={reference} maxLength={500} rows={2}
      aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
      placeholder="Document name, revision and page or brief item"
      onChange={(event) => { setReference(event.target.value); setError(""); }} />
    <div className="alteration-actions">
      <button type="button" className="alteration-apply" onClick={() => apply(false)}>Apply work status</button>
      <button type="button" disabled={row.status === "unassigned"} onClick={() => apply(true)}>Clear assignment</button>
    </div>
    {row.kind === "opening" && row.status === "demolished" && project.openings.some((opening) => opening.id === row.id && (opening.kind === "door" || opening.kind === "window")) && <div className="alteration-disposition">
      <strong>Demolished opening disposition</strong>
      <label>Opening disposition
        <select aria-label="Opening disposition" value={dispositionKind} onChange={(event) => { setDispositionKind(event.target.value as "retain-void" | "infill"); setError(""); }}>
          <option value="retain-void">Retain empty aperture</option>
          <option value="infill">Full infill with host wall layers</option>
        </select>
      </label>
      <p>{dispositionKind === "infill" ? "Close the full aperture in the proposed stage using the host wall's existing authored layers. Partial infill and different infill materials are not supported." : "Remove the door or window while retaining the hole in its host wall."}</p>
      <label htmlFor={dispositionId}>Opening disposition reference (required)</label>
      <textarea id={dispositionId} value={dispositionReference} maxLength={500} rows={2} onChange={(event) => { setDispositionReference(event.target.value); setError(""); }} />
      <div className="alteration-actions">
        <button type="button" onClick={() => retainVoid(false)}>{dispositionKind === "infill" ? "Save full infill" : "Save retained void"}</button>
        <button type="button" disabled={!row.demolitionDisposition} onClick={() => retainVoid(true)}>Clear opening disposition</button>
      </div>
      <p>{row.demolitionDisposition ? `Saved ${row.demolitionDisposition.kind}: ${row.demolitionDisposition.reference}` : "No disposition recorded."}</p>
    </div>}
    {row.kind === "wall" && row.status === "repaired" && <div className="alteration-disposition">
      <strong>Before-repair wall height</strong>
      <p>Supply the earlier height of this wall. Its proposed height and layer stack stay as authored. Other changes to the before shape are not supported.</p>
      <label>Before-repair height (mm)
        <input type="number" min="0.001" max="1000000" step="any" value={repairHeight} onChange={(event) => { setRepairHeight(event.target.value); setError(""); }} />
      </label>
      <label htmlFor={repairReferenceId}>Before-repair reference (required)</label>
      <textarea id={repairReferenceId} value={repairReference} maxLength={500} rows={2} onChange={(event) => { setRepairReference(event.target.value); setError(""); }} />
      <div className="alteration-actions">
        <button type="button" onClick={() => saveRepair(false)}>Save before-repair height</button>
        <button type="button" disabled={!row.repairBasis} onClick={() => saveRepair(true)}>Clear before-repair basis</button>
      </div>
      <p>{row.repairBasis ? `Saved: ${row.repairBasis.height} mm; ${row.repairBasis.reference}` : "No independent before-repair height recorded."}</p>
    </div>}
    {error && <p className="alteration-error" id={errorId} role="alert">{error}</p>}
  </div>;
}

export function AlterationPanel({ project, selected, onSelect, onChange }: Props) {
  const schedule = useMemo(() => alterationSchedule(project), [project]);
  const selectedRow = schedule.rows.find((row) => row.id === selected);
  const downloadSchedule = () => {
    const url = URL.createObjectURL(new Blob([alterationScheduleCsv(project)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `alteration-schedule-${project.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-r${project.revision}.csv`;
    document.body.appendChild(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  return <details className="alteration-panel">
    <summary>Alteration schedule · {schedule.rows.length} elements</summary>
    <p className="alteration-note">Assign existing, new, demolished or repaired work to walls, openings, slabs and roofs. References are user supplied; this remains a draft schedule, not verified quantities or an approved issue set.</p>
    <p className="alteration-note">Classification only; quantities and drawings are not phase-filtered. Material sync is blocked until phase quantities are reviewed.</p>
    <button type="button" onClick={downloadSchedule} disabled={!schedule.rows.length}>Download alteration CSV</button>
    <dl className="alteration-counts" aria-label="Work status counts">
      {(["unassigned", ...statuses] as const).map((status) => <div key={status}><dt>{labels[status]}</dt><dd>{schedule.counts[status]}</dd></div>)}
    </dl>
    {selectedRow ? <AssignmentEditor
      key={JSON.stringify([project.id, project.revision, selectedRow])}
      project={project} row={selectedRow} onChange={onChange} />
      : <p className="alteration-note">{schedule.rows.length ? "Select a wall, opening, slab or roof below to assign its work status." : "Add a wall, opening, slab or roof to begin the alteration schedule."}</p>}
    {schedule.warnings.length > 0 && <div className="alteration-warnings" role="status">
      <strong>Coordination review required</strong>
      <ul>{schedule.warnings.map((warning, index) => <li key={`${warning.elementId}-${warning.code}-${index}`}>{warning.message}</li>)}</ul>
    </div>}
    {schedule.rows.length > 0 && <div className="alteration-table" role="region" aria-label="Alteration elements" tabIndex={0}>
      <table>
        <caption>Element assignments — counts only</caption>
        <thead><tr><th scope="col">Element</th><th scope="col">Status</th><th scope="col">Reference</th></tr></thead>
        <tbody>{schedule.rows.map((row) => <tr key={row.id} data-selected={row.id === selected}>
          <td><button type="button" aria-pressed={row.id === selected} onClick={() => onSelect(row.id)}>{row.name}</button>
            <small>{row.kind} · {project.levels.find((level) => level.id === row.levelId)?.name ?? row.levelId}</small></td>
          <td>{labels[row.status]}</td><td>{row.reference || "No reference"}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </details>;
}
