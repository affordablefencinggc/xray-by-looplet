import { useId, useState } from "react";
import type { IndustryDraftPanelProps } from "../draftPanel";
import { calculateDuctForm, createEmptyDuctSection, type DuctForm, type DuctSectionForm } from "./ductForm";

export function HvacDraftPanel({ value, onChange, disabled }: IndustryDraftPanelProps<DuctForm>) {
  const prefix = useId();
  const [calculation, setCalculation] = useState<{ input: string; result?: ReturnType<typeof calculateDuctForm>; error?: string } | null>(null);
  const current = JSON.stringify(value);
  const visible = calculation?.input === current ? calculation : null;
  const change = (next: DuctForm) => { setCalculation(null); onChange(next); };
  const update = (index: number, patch: Partial<DuctSectionForm>) => change({ sections: value.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  const fields = (section: DuctSectionForm, index: number, key: "lengthM" | "widthM" | "heightM" | "diameterM" | "sheetMassKgPerM2" | "insulationThicknessM" | "longitudinalOverlapM", label: string) => (
    <div className="industry-fields" key={key}>
      <label htmlFor={`${prefix}-${index}-${key}`}>{label}<input id={`${prefix}-${index}-${key}`} inputMode="decimal" value={(section[key]?.value ?? "")} onChange={event => update(index, { [key]: { sourceReference: section[key]?.sourceReference ?? "", value: event.target.value } })} /></label>
      <label htmlFor={`${prefix}-${index}-${key}-ref`}>{label} source reference<input id={`${prefix}-${index}-${key}-ref`} value={(section[key]?.sourceReference ?? "")} onChange={event => update(index, { [key]: { value: section[key]?.value ?? "", sourceReference: event.target.value } })} /></label>
    </div>
  );
  return <form className="industry-form" onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { setCalculation({ input: current, result: calculateDuctForm(value) }); }
    catch (error) { setCalculation({ input: current, error: error instanceof Error ? error.message : "Check the section inputs." }); }
  }}>
    <p className="industry-note">Straight duct material draft. Enter dimensions in metres and a reference for each value. This does not select duct sizes or verify a takeoff.</p>
    <fieldset disabled={disabled}>
      <legend>Straight sections</legend>
      {!value.sections.length && <p>Add a section to enter your measurements.</p>}
      {value.sections.map((section, index) => <fieldset key={index}>
        <legend>Section {index + 1}</legend>
        <div className="industry-fields">
          <label htmlFor={`${prefix}-${index}-name`}>Section name<input id={`${prefix}-${index}-name`} value={section.id} onChange={event => update(index, { id: event.target.value })} /></label>
          <label htmlFor={`${prefix}-${index}-shape`}>Shape<select id={`${prefix}-${index}-shape`} value={section.shape} onChange={event => update(index, { shape: event.target.value as DuctSectionForm["shape"] })}><option value="rectangular">Rectangular</option><option value="round">Round</option></select></label>
        </div>
        {fields(section, index, "lengthM", "Length (m)")}
        {section.shape === "rectangular" ? <>{fields(section, index, "widthM", "Width (m)")}{fields(section, index, "heightM", "Height (m)")}</> : fields(section, index, "diameterM", "Diameter (m)")}
        <label><input type="checkbox" checked={section.includeSheetMass} onChange={event => update(index, { includeSheetMass: event.target.checked })} /> Include supplied sheet mass per area</label>
        {section.includeSheetMass && fields(section, index, "sheetMassKgPerM2", "Sheet mass (kg/m²)")}
        <label><input type="checkbox" checked={section.includeWrap ?? false} onChange={event => update(index, { includeWrap: event.target.checked })} /> Include external insulation wrap</label>
        {section.includeWrap && <>
          {fields(section, index, "insulationThicknessM", "Insulation thickness (m)")}
          {fields(section, index, "longitudinalOverlapM", "Longitudinal overlap (m)")}
          <p className="industry-note">Enter the specified thickness and one longitudinal lap width, including an explicit zero if no lap is required. Rectangular wrap uses the outside width and height after adding thickness on both sides.</p>
        </>}
        <button type="button" onClick={() => change({ sections: value.sections.filter((_, i) => i !== index) })}>Remove section {index + 1}</button>
      </fieldset>)}
      <div className="industry-actions"><button type="button" disabled={value.sections.length >= 100} onClick={() => change({ sections: [...value.sections, createEmptyDuctSection()] })}>Add straight section</button><button type="submit">Calculate duct draft</button></div>
    </fieldset>
    {visible?.error && <p className="industry-error" role="alert">{visible.error}</p>}
    {visible?.result && <section className="industry-result" aria-live="polite" aria-label="Duct draft result">
      <p><strong>Draft · not eligible for a verified quote</strong></p>
      <p>Developed area: <strong>{visible.result.developedAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m²</strong> · Sheet mass: <strong>{visible.result.sheetMassKg === null ? "Not calculated — supply mass per area for every section" : `${visible.result.sheetMassKg.toLocaleString(undefined, { maximumFractionDigits: 6 })} kg`}</strong></p>
      <div className="industry-table-wrap"><table><caption>Straight-section material quantities</caption><thead><tr><th scope="col">Section</th><th scope="col">Area (m²)</th><th scope="col">Mass (kg)</th></tr></thead><tbody>{visible.result.sections.map(section => <tr key={section.id}><th scope="row">{section.id}</th><td>{section.developedAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.sheetMassKg === null ? "Not supplied" : section.sheetMassKg.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>)}</tbody></table></div>
      {visible.result.wrap && <section aria-label="External wrap draft result">
        <h3>External insulation wrap</h3>
        <p>Selected straight sections: <strong>{visible.result.wrap.wrapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m²</strong></p>
        <div className="industry-table-wrap"><table><caption>Outer surface plus one longitudinal lap</caption><thead><tr><th scope="col">Section</th><th scope="col">Outer area (m²)</th><th scope="col">Lap area (m²)</th><th scope="col">Wrap area (m²)</th></tr></thead><tbody>{visible.result.wrap.sections.map(section => <tr key={section.id}><th scope="row">{section.id}</th><td>{section.outerAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.overlapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.wrapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>)}</tbody></table></div>
        <p className="industry-note">Wrap excludes: {visible.result.wrap.exclusions.join(", ")}. Entered dimensions and references remain unverified.</p>
      </section>}
      <p className="industry-note">Sheet metal excludes: {visible.result.exclusions.join(", ")}. Entered references are retained in your draft; they have not been verified.</p>
    </section>}
  </form>;
}
