import { useId, useState } from "react";
import type { IndustryDraftPanelProps } from "../draftPanel.ts";
import { describeIndustryBinding, type IndustrySourceBinding } from "../sourceBinding.ts";
import {
  createEmptyRoofBindingDraft, createEmptyRoofPlane, createRoofBinding, describeRoofBindingEvidence,
  editRoofForm, evaluateRoofFormBinding, roofFormError, type RoofBindingDraft, type RoofForm, type RoofPlaneForm,
} from "./roofForm.ts";
import { RoofSheetCoveragePanel } from "./RoofSheetCoveragePanel.tsx";
import { createEmptySheetCoverage } from "./sheetCoverage.ts";
import { RoofingWorksheet } from "./RoofingWorksheet.tsx";

const EVIDENCE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "traced", label: "Traced from the source geometry" },
  { value: "dimensioned", label: "Dimensioned on the source" },
  { value: "inferred", label: "Inferred reconstruction" },
  { value: "declared", label: "Declared / typed reference" },
];

const locatorText = (locator: IndustrySourceBinding["locator"]): string =>
  locator.kind === "page" ? `Page index ${locator.pageIndex}`
    : locator.kind === "model" ? `Model element ${locator.elementId}` : `Document section ${locator.section}`;

export function RoofingDraftPanel({ value, onChange, disabled, source }: IndustryDraftPanelProps<RoofForm>) {
  const prefix = useId();
  const [bindingDraft, setBindingDraft] = useState<RoofBindingDraft>(createEmptyRoofBindingDraft);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const edit = (planes: RoofForm["planes"]) => onChange({ ...value, ...editRoofForm(planes) });
  const changePlane = (index: number, patch: Partial<RoofPlaneForm>) => edit(value.planes.map((plane, i) => i === index ? { ...plane, ...patch } : plane));
  const binding = value.binding ?? null;
  const { evaluation, result, error } = evaluateRoofFormBinding(value, source);
  const bind = () => {
    try {
      onChange({ ...value, binding: createRoofBinding(source, bindingDraft, new Date().toISOString()) });
      setBindingError(null);
    } catch (cause) { setBindingError(roofFormError(cause)); }
  };
  const clearBinding = () => { setBindingError(null); onChange({ ...value, binding: null }); };
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
    <fieldset disabled={disabled}>
      <legend>Source binding</legend>
      {evaluation.status === "stale"
        ? <p className="industry-error" role="alert">Draft total withheld. {describeIndustryBinding(evaluation)}</p>
        : <p className="industry-note">{describeIndustryBinding(evaluation)}</p>}
      {binding === null ? <>
        <div className="industry-fields">
          <label htmlFor={`${prefix}-binding-page`}>Source page index (0-based)
            <input id={`${prefix}-binding-page`} type="text" inputMode="numeric" maxLength={80}
              value={bindingDraft.pageIndexText} onChange={event => setBindingDraft({ ...bindingDraft, pageIndexText: event.target.value })} />
          </label>
          <label htmlFor={`${prefix}-binding-evidence`}>Evidence class
            <select id={`${prefix}-binding-evidence`} value={bindingDraft.evidenceClass}
              onChange={event => setBindingDraft({ ...bindingDraft, evidenceClass: event.target.value })}>
              <option value="">Choose how this evidence was obtained…</option>
              {EVIDENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {field("binding-reference", "Reference for this evidence", bindingDraft.reference, reference => setBindingDraft({ ...bindingDraft, reference }), false)}
        </div>
        <div className="industry-actions">
          <button type="button" onClick={bind} disabled={source.sourceRevision === null} aria-describedby={`${prefix}-binding-availability`}>Bind to current project source</button>
        </div>
        <p className="industry-note" id={`${prefix}-binding-availability`}>{source.sourceRevision === null
          ? "This project has no current source revision. Open or add a source before binding; the manual inputs still work and stay unverified."
          : `Binds to “${source.sourceRevision.name ?? source.sourceRevision.id}” as it stands now. Manual inputs still work without a binding and stay unverified.`}</p>
      </> : <>
        <div className="industry-table-wrap"><table>
          <caption>Bound source</caption>
          <tbody>
            <tr><th scope="row">Source</th><td>{binding.sourceName}</td></tr>
            <tr><th scope="row">Evidence class</th><td>{binding.evidenceClass}</td></tr>
            <tr><th scope="row">Reference</th><td>{binding.reference}</td></tr>
            <tr><th scope="row">Locator</th><td>{locatorText(binding.locator)}</td></tr>
            <tr><th scope="row">Units</th><td>{binding.units}</td></tr>
            <tr><th scope="row">Bound at</th><td>{binding.boundAt}</td></tr>
          </tbody>
        </table></div>
        <p className="industry-note">{describeRoofBindingEvidence(binding)}</p>
        <div className="industry-actions">
          <button type="button" onClick={clearBinding}>Clear binding</button>
        </div>
      </>}
      {bindingError && <p className="industry-error" role="alert">{bindingError}</p>}
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
    <RoofSheetCoveragePanel value={value.sheetCoverage ?? createEmptySheetCoverage()} disabled={disabled} source={source}
      onChange={sheetCoverage => onChange({ ...value, sheetCoverage })} />
    <RoofingWorksheet
      draftPlanes={value.planes.map(p => ({
        id: p.id || "Unnamed Plane",
        grossPlanAreaM2: parseFloat(p.grossPlanAreaM2) || 0,
        pitchDegrees: parseFloat(p.pitchDegrees) || 0,
      }))}
      disabled={disabled}
    />
  </section>;
}
