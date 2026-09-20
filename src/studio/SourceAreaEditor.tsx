import { useState } from "react";
import type { FencingJob, SourceAreaMeasurement } from "./domain.ts";
import { measureSourceArea } from "./sourceAreaMeasurement.ts";
import { useStudio } from "./store.ts";
import "./sourceAreaEditor.css";

type Annotation = NonNullable<FencingJob["annotations"]>[number];

export function SourceAreaEditor({ sourceReady, editing, onEdit }: { sourceReady: boolean; editing: boolean; onEdit: () => void }) {
  const s = useStudio();
  const areas = (s.job.annotations ?? []).filter(item => item.kind === "area" && item.sheet === s.sheet && item.documentId === s.job.activeDocumentId);
  const selected = areas.find(item => item.id === s.selectedAreaId);
  if (!areas.length) return null;
  return <section className="source-area-editor" aria-label="Source area measurement" data-testid="source-area-editor">
    <h3>Room and roof measurement</h3>
    <p>Classify a traced area explicitly. A classification does not verify a source or supply missing roof slope evidence.</p>
    <label className="field"><span>Source area</span><select aria-label="Source area" value={selected?.id ?? ""} onChange={event => s.selectSourceArea(event.currentTarget.value || null)}>
      <option value="">Select a traced area</option>
      {areas.map(area => <option key={area.id} value={area.id}>{area.label} · {area.measurement?.entityType ?? "unclassified"}</option>)}
    </select></label>
    {selected && <AreaBasisEditor key={`${selected.id}:${selected.measurement?.revision ?? 0}`} annotation={selected} sourceReady={sourceReady} editing={editing} onEdit={onEdit} />}
  </section>;
}

function AreaBasisEditor({ annotation, sourceReady, editing, onEdit }: { annotation: Annotation; sourceReady: boolean; editing: boolean; onEdit: () => void }) {
  const s = useStudio();
  const measurement = annotation.measurement;
  const [label, setLabel] = useState(annotation.label);
  const [family, setFamily] = useState<"" | SourceAreaMeasurement["entityType"]>(measurement?.entityType ?? "");
  const [pitch, setPitch] = useState(measurement?.roofSlope?.pitchDegrees.toString() ?? "");
  const [azimuth, setAzimuth] = useState(measurement?.roofSlope?.azimuthDegrees.toString() ?? "");
  const [reference, setReference] = useState(measurement?.roofSlope?.source.reference ?? "");
  const [reviewed, setReviewed] = useState(Boolean(measurement?.roofSlope));
  const [error, setError] = useState("");
  const measured = measurement ? measureSourceArea(s.job, annotation, sourceReady && s.assetReadiness.document.state === "ready") : null;
  const document = s.job.documents.find(item => item.id === annotation.documentId);
  const disabled = !sourceReady || s.persistenceRecoveryBlocked || s.projectWriteStale || !s.currentCalibration.locked;
  const apply = () => {
    try {
      if (!family) throw Error("Choose room area or roof plane explicitly.");
      const hasSlope = family === "roof-plane" && (pitch.trim() !== "" || azimuth.trim() !== "" || reference.trim() !== "");
      if (hasSlope && (!reviewed || !pitch.trim() || !azimuth.trim() || !reference.trim() || !document?.sha256))
        throw Error("A roof slope needs pitch, rise direction and a reviewed reference on this source sheet. Otherwise clear all three fields to retain an unknown slope.");
      const next: SourceAreaMeasurement = {
        entityType: family, revision: (measurement?.revision ?? 0) + 1, holes: measurement?.holes ?? [],
        roofSlope: hasSlope ? { pitchDegrees: Number(pitch), azimuthDegrees: Number(azimuth), source: {
          documentId: annotation.documentId, sourceSha256: document!.sha256!, sheet: annotation.sheet, reference: reference.trim(),
        } } : null,
      };
      if (!s.updateSourceArea(annotation.id, measurement?.revision ?? 0, { kind: "basis", label, measurement: next }))
        throw Error(useStudio.getState().traceError ?? "The area basis could not be saved.");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The area basis could not be saved."); }
  };
  return <>
    <fieldset disabled={disabled} className="source-area-fields">
      <label className="field"><span>Area name</span><input aria-label="Area name" value={label} onChange={event => setLabel(event.currentTarget.value)} /></label>
      <label className="field"><span>Measurement family</span><select aria-label="Measurement family" value={family} onChange={event => setFamily(event.currentTarget.value as typeof family)}>
        <option value="">Unclassified</option><option value="room-area">Room area</option><option value="roof-plane">Roof plane</option>
      </select></label>
      {family === "roof-plane" && <>
        <label className="field"><span>Roof pitch (degrees, optional)</span><input aria-label="Roof pitch degrees" type="number" min="0" max="89.999" step="any" value={pitch} onChange={event => { setPitch(event.currentTarget.value); setReviewed(false); }} /></label>
        <label className="field"><span>Rise direction (clockwise from page up)</span><input aria-label="Roof rise direction degrees" type="number" min="0" max="359.999" step="any" value={azimuth} onChange={event => { setAzimuth(event.currentTarget.value); setReviewed(false); }} /></label>
        <label className="field"><span>Slope source reference · sheet {annotation.sheet + 1}</span><input aria-label="Roof slope source reference" value={reference} onChange={event => { setReference(event.currentTarget.value); setReviewed(false); }} /></label>
        <label className="source-area-review"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.currentTarget.checked)} />I checked the pitch and rise direction against this source sheet.</label>
        <p>Unknown slope permits a projected footprint only. The true roof surface remains unverified.</p>
      </>}
      <button type="button" className="pill" onClick={apply}>Apply area basis</button>
      <button type="button" className="pill" disabled={!measurement} aria-pressed={editing} onClick={onEdit}>Move area vertices</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <dl className="source-area-results" data-testid="source-area-result" data-entity-id={annotation.id} data-family={measurement?.entityType ?? "unclassified"} data-measured-quantity={measured?.value ?? ""}>
      <div><dt>Projected net area</dt><dd>{measured?.projectedAreaM2 === null || measured?.projectedAreaM2 === undefined ? "Unavailable" : `${measured.projectedAreaM2} m²`}</dd></div>
      <div><dt>{measurement?.entityType === "roof-plane" ? "True roof surface" : "Measured room area"}</dt><dd>{measured?.value === null || measured?.value === undefined ? "Unverified" : `${measured.value} m²`}</dd></div>
      <div><dt>Source</dt><dd>{document?.name ?? "Missing"} · sheet {annotation.sheet + 1}</dd></div>
      <div><dt>Geometry revision</dt><dd>{measurement?.revision ?? "Unclassified"} · {measurement?.holes.length ?? 0} deductions</dd></div>
    </dl>
    <p role="status">{measured?.reason ?? (measurement ? "Quantity is derived from the current polygon. QS bindings still require explicit review." : "This area is not yet a room or roof measurement.")}</p>
    {editing && measurement && <p>Drag a highlighted vertex on the source plan. Release to save; Escape cancels. Moving a vertex makes existing QS bindings stale.</p>}
  </>;
}
