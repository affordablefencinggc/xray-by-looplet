import { useId, useMemo, useState } from "react";
import type { ArchitectProject } from "./model";
import { alterationSchedule, alterationScheduleCsv, setElementLifecycle, setOpeningDemolitionDisposition } from "./lifecycle";
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
  const retainVoid = (clear: boolean) => {
    if (!clear && !dispositionReference.trim()) { setError("Enter a reference confirming that the opening void is retained."); return; }
    try {
      if (!onChange(setOpeningDemolitionDisposition(project, row.id, clear ? null : { kind: "retain-void", reference: dispositionReference.trim() }))) {
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
      <strong>Demolished opening: retained void</strong>
      <p>The door or window is removed while the hole in its host wall remains. Record an explicit reference for this intent.</p>
      <label htmlFor={dispositionId}>Retained-void reference (required)</label>
      <textarea id={dispositionId} value={dispositionReference} maxLength={500} rows={2} onChange={(event) => { setDispositionReference(event.target.value); setError(""); }} />
      <div className="alteration-actions">
        <button type="button" onClick={() => retainVoid(false)}>Save retained void</button>
        <button type="button" disabled={!row.demolitionDisposition} onClick={() => retainVoid(true)}>Clear void disposition</button>
      </div>
      <p>{row.demolitionDisposition ? `Saved: ${row.demolitionDisposition.reference}` : "No disposition recorded."}</p>
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
