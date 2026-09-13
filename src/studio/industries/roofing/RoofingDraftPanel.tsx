import { useId } from "react";
import type { IndustryDraftPanelProps } from "../draftPanel.ts";
import { calculateRoofForm, createEmptyRoofPlane, editRoofForm, roofFormError, type RoofForm, type RoofPlaneForm } from "./roofForm.ts";

export function RoofingDraftPanel({ value, onChange, disabled }: IndustryDraftPanelProps<RoofForm>) {
  const prefix = useId();
  const edit = (planes: RoofForm["planes"]) => onChange(editRoofForm(planes));
  const changePlane = (index: number, patch: Partial<RoofPlaneForm>) => edit(value.planes.map((plane, i) => i === index ? { ...plane, ...patch } : plane));
  let result: ReturnType<typeof calculateRoofForm> | null = null;
  let error: string | null = null;
  if (value.calculated) {
    try { result = calculateRoofForm(value); } catch (cause) { error = roofFormError(cause); }
  }
  const field = (id: string, label: string, current: string, change: (next: string) => void, numeric = false) => (
    <label htmlFor={`${prefix}-${id}`}>{label}
      <input id={`${prefix}-${id}`} type="text" inputMode={numeric ? "decimal" : undefined} value={current}
        onChange={event => change(event.target.value)} maxLength={numeric ? 80 : 1000} />
    </label>
  );
  return <section className="industry-form" aria-label="Draft roofing areas">
    <p className="industry-note">Enter horizontal plan areas and each plane’s pitch from horizontal. References record where your inputs came from; this worksheet does not verify the source or scale.</p>
    <fieldset disabled={disabled}>
      <legend>Roof planes</legend>
      {value.planes.map((plane, index) => <fieldset key={index}>
        <legend>Plane {index + 1}</legend>
        <div className="industry-fields">
          {field(`plane-${index}-name`, "Plane name", plane.id, id => changePlane(index, { id }))}
          {field(`plane-${index}-area`, "Horizontal plan area (m²)", plane.grossPlanAreaM2, grossPlanAreaM2 => changePlane(index, { grossPlanAreaM2 }), true)}
          {field(`plane-${index}-pitch`, "Pitch from horizontal (degrees)", plane.pitchDegrees, pitchDegrees => changePlane(index, { pitchDegrees }), true)}
          {field(`plane-${index}-area-ref`, "Area reference", plane.measurementReference, measurementReference => changePlane(index, { measurementReference }))}
          {field(`plane-${index}-pitch-ref`, "Pitch reference", plane.pitchReference, pitchReference => changePlane(index, { pitchReference }))}
        </div>
        <fieldset>
          <legend>Openings in plane {index + 1}</legend>
          {!plane.openings.length && <p className="industry-note">No openings added. Add each opening’s horizontal area to deduct it from this plane.</p>}
          {plane.openings.map((opening, openingIndex) => <fieldset key={openingIndex}>
            <legend>Opening {openingIndex + 1}</legend>
            <div className="industry-fields">
              {field(`plane-${index}-opening-${openingIndex}-name`, "Opening name", opening.id, id => changePlane(index, { openings: plane.openings.map((item, i) => i === openingIndex ? { ...item, id } : item) }))}
              {field(`plane-${index}-opening-${openingIndex}-area`, "Horizontal opening area (m²)", opening.planAreaM2, planAreaM2 => changePlane(index, { openings: plane.openings.map((item, i) => i === openingIndex ? { ...item, planAreaM2 } : item) }), true)}
              {field(`plane-${index}-opening-${openingIndex}-ref`, "Opening area reference", opening.measurementReference, measurementReference => changePlane(index, { openings: plane.openings.map((item, i) => i === openingIndex ? { ...item, measurementReference } : item) }))}
            </div>
            <button type="button" onClick={() => changePlane(index, { openings: plane.openings.filter((_, i) => i !== openingIndex) })}>Remove opening {openingIndex + 1}</button>
          </fieldset>)}
          <button type="button" onClick={() => changePlane(index, { openings: [...plane.openings, { id: "", planAreaM2: "", measurementReference: "" }] })}>Add opening to plane {index + 1}</button>
        </fieldset>
        <button type="button" onClick={() => edit(value.planes.filter((_, i) => i !== index))}>Remove plane {index + 1}</button>
      </fieldset>)}
      <div className="industry-actions">
        <button type="button" onClick={() => edit([...value.planes, createEmptyRoofPlane()])}>Add roof plane</button>
        <button type="button" onClick={() => onChange({ ...value, calculated: true })}>Calculate draft roof areas</button>
      </div>
    </fieldset>
    {error && <p className="industry-error" role="alert">{error}</p>}
    {result && <section className="industry-result" aria-label="Draft roofing result" aria-live="polite">
      <p><strong>Draft calculation · not eligible for verified quotes</strong></p>
      <div className="industry-table-wrap"><table>
        <caption>True roof areas by plane</caption>
        <thead><tr><th scope="col">Plane</th><th scope="col">Gross m²</th><th scope="col">Openings m²</th><th scope="col">Net m²</th></tr></thead>
        <tbody>{result.planes.map(plane => <tr key={plane.id}><th scope="row">{plane.id}</th><td>{plane.grossTrueAreaM2}</td><td>{plane.openingTrueAreaM2}</td><td>{plane.netTrueAreaM2}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Total</th><td>{result.totals.grossTrueAreaM2}</td><td>{result.totals.openingTrueAreaM2}</td><td>{result.totals.netTrueAreaM2}</td></tr></tfoot>
      </table></div>
      <ul className="industry-note">{result.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
    </section>}
  </section>;
}
