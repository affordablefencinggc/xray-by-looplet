import { useId, useState } from "react";
import { HVACNetworkViewer } from "./HVACNetworkViewer.tsx";
import { HvacCoordinationPanel } from "./HvacCoordinationPanel.tsx";
import type { IndustryDraftPanelProps } from "../draftPanel";
import { describeIndustryBinding, evaluateIndustryBinding } from "../sourceBinding.ts";
import { createDuctSourceBinding, createEmptyDuctSection, describeEvidenceClass, evaluateDuctFormBinding, EVIDENCE_CLASS_LABELS, type DuctBindingInputs, type DuctForm, type DuctSectionForm } from "./ductForm";

export function HvacDraftPanel({ value, onChange, disabled, source }: IndustryDraftPanelProps<DuctForm>) {
  const prefix = useId();
  const [calculation, setCalculation] = useState<{ input: string; error?: string } | null>(null);
  const [bindingInputs, setBindingInputs] = useState<DuctBindingInputs>({ pageIndex: "", evidenceClass: "", reference: "" });
  const [bindingError, setBindingError] = useState("");
  const current = JSON.stringify(value);
  const visible = calculation?.input === current ? calculation : null;
  const binding = value.binding ?? null;
  const evaluation = evaluateIndustryBinding(binding, source);
  // Judged against the live source on every render, so a worksheet that is left open while the
  // source changes stops showing a current-looking total instead of keeping the one it captured.
  const outcome = visible && !visible.error ? evaluateDuctFormBinding(value, source) : null;
  const change = (next: DuctForm) => { setCalculation(null); onChange(next); };
  const update = (index: number, patch: Partial<DuctSectionForm>) => change({ ...value, sections: value.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  const fields = (section: DuctSectionForm, index: number, key: "lengthM" | "widthM" | "heightM" | "diameterM" | "sheetMassKgPerM2" | "insulationThicknessM" | "longitudinalOverlapM", label: string) => (
    <div className="industry-fields" key={key}>
      <label htmlFor={`${prefix}-${index}-${key}`}>{label}<input id={`${prefix}-${index}-${key}`} inputMode="decimal" value={(section[key]?.value ?? "")} onChange={event => update(index, { [key]: { sourceReference: section[key]?.sourceReference ?? "", value: event.target.value } })} /></label>
      <label htmlFor={`${prefix}-${index}-${key}-ref`}>{label} source reference<input id={`${prefix}-${index}-${key}-ref`} value={(section[key]?.sourceReference ?? "")} onChange={event => update(index, { [key]: { value: section[key]?.value ?? "", sourceReference: event.target.value } })} /></label>
    </div>
  );
  const bind = () => {
    try {
      const next = createDuctSourceBinding(bindingInputs, source);
      setBindingError("");
      change({ ...value, binding: next });
    } catch (error) { setBindingError(error instanceof Error ? error.message : "The source binding could not be recorded."); }
  };
  const sourceUnavailable = source.sourceRevision === null;
  return <form className="industry-form" onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try {
      evaluateDuctFormBinding(value, source);
      setCalculation({ input: current });
    } catch (error) { setCalculation({ input: current, error: error instanceof Error ? error.message : "Check the section inputs." }); }
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
        <button type="button" onClick={() => change({ ...value, sections: value.sections.filter((_, i) => i !== index) })}>Remove section {index + 1}</button>
      </fieldset>)}
      <div className="industry-actions"><button type="button" disabled={value.sections.length >= 100} onClick={() => change({ ...value, sections: [...value.sections, createEmptyDuctSection()] })}>Add straight section</button><button type="submit">Calculate duct draft</button></div>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Source binding</legend>
      <p className="industry-note">{describeIndustryBinding(evaluation)}</p>
      {binding === null ? <>
        <div className="industry-fields">
          <label htmlFor={`${prefix}-binding-page`}>Source page index<input id={`${prefix}-binding-page`} inputMode="numeric" value={bindingInputs.pageIndex} aria-describedby={`${prefix}-binding-page-hint`} onChange={event => setBindingInputs({ ...bindingInputs, pageIndex: event.target.value })} /></label>
          <p className="industry-note" id={`${prefix}-binding-page-hint`}>Pages count from 0. Nothing is recorded until you bind.</p>
          <label htmlFor={`${prefix}-binding-evidence`}>Evidence class<select id={`${prefix}-binding-evidence`} value={bindingInputs.evidenceClass} onChange={event => setBindingInputs({ ...bindingInputs, evidenceClass: event.target.value as DuctBindingInputs["evidenceClass"] })}>
            <option value="">Select an evidence class…</option>
            <option value="traced">{EVIDENCE_CLASS_LABELS.traced}</option>
            <option value="dimensioned">{EVIDENCE_CLASS_LABELS.dimensioned}</option>
            <option value="inferred">{EVIDENCE_CLASS_LABELS.inferred}</option>
            <option value="declared">{EVIDENCE_CLASS_LABELS.declared}</option>
          </select></label>
          <label htmlFor={`${prefix}-binding-reference`}>Reference<input id={`${prefix}-binding-reference`} value={bindingInputs.reference} onChange={event => setBindingInputs({ ...bindingInputs, reference: event.target.value })} /></label>
        </div>
        <div className="industry-actions"><button type="button" onClick={bind} disabled={disabled || sourceUnavailable} aria-describedby={sourceUnavailable ? `${prefix}-binding-unavailable` : undefined}>Bind to current project source</button></div>
        {sourceUnavailable && <p className="industry-note" id={`${prefix}-binding-unavailable`}>No project source revision is open, so this worksheet cannot be bound. Enter your measurements and references manually.</p>}
        {bindingError && <p className="industry-error" role="alert">{bindingError}</p>}
      </> : <>
        <div className="industry-fields">
          <p>Reference: <strong>{binding.reference}</strong></p>
          <p>Evidence: <strong>{describeEvidenceClass(binding.evidenceClass)}</strong></p>
          <p>Source: <strong>{binding.sourceName}</strong></p>
        </div>
        <div className="industry-actions"><button type="button" onClick={() => { setBindingError(""); change({ ...value, binding: null }); }}>Clear binding</button></div>
      </>}
    </fieldset>
    {visible?.error && <p className="industry-error" role="alert">{visible.error}</p>}
    {outcome?.evaluation.status === "stale" && <section className="industry-result" role="alert" aria-label="Withheld duct draft result">
      <p><strong>Result withheld</strong></p>
      <p>{describeIndustryBinding(outcome.evaluation)}</p>
      <p className="industry-note">A stale binding cannot report a total. Rebind or clear the binding, then calculate again.</p>
    </section>}
    {outcome?.result && <section className="industry-result" aria-live="polite" aria-label="Duct draft result">
      <p><strong>Draft · not eligible for a verified quote</strong></p>
      <p className="industry-note">{describeIndustryBinding(outcome.evaluation)}{binding && ` ${describeEvidenceClass(binding.evidenceClass)}.`}</p>
      <p>Developed area: <strong>{outcome.result.developedAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m²</strong> · Sheet mass: <strong>{outcome.result.sheetMassKg === null ? "Not calculated — supply mass per area for every section" : `${outcome.result.sheetMassKg.toLocaleString(undefined, { maximumFractionDigits: 6 })} kg`}</strong></p>
      <div className="industry-table-wrap"><table><caption>Straight-section material quantities</caption><thead><tr><th scope="col">Section</th><th scope="col">Area (m²)</th><th scope="col">Mass (kg)</th></tr></thead><tbody>{outcome.result.sections.map(section => <tr key={section.id}><th scope="row">{section.id}</th><td>{section.developedAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.sheetMassKg === null ? "Not supplied" : section.sheetMassKg.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>)}</tbody></table></div>
      {outcome.result.wrap && <section aria-label="External wrap draft result">
        <h3>External insulation wrap</h3>
        <p>Selected straight sections: <strong>{outcome.result.wrap.wrapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m²</strong></p>
        <div className="industry-table-wrap"><table><caption>Outer surface plus one longitudinal lap</caption><thead><tr><th scope="col">Section</th><th scope="col">Outer area (m²)</th><th scope="col">Lap area (m²)</th><th scope="col">Wrap area (m²)</th></tr></thead><tbody>{outcome.result.wrap.sections.map(section => <tr key={section.id}><th scope="row">{section.id}</th><td>{section.outerAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.overlapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{section.wrapAreaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>)}</tbody></table></div>
        <p className="industry-note">Wrap excludes: {outcome.result.wrap.exclusions.join(", ")}. Entered dimensions and references remain unverified.</p>
      </section>}
      <p className="industry-note">Sheet metal excludes: {outcome.result.exclusions.join(", ")}. Entered references are retained in your draft; they have not been verified.</p>
    </section>}
    <HvacCoordinationPanel text={value.networkJson ?? ""} onChange={networkJson => change({ ...value, networkJson })} disabled={disabled} stale={evaluation.status === "stale"} projectId={source.projectId} binding={binding} />
  </form>;
}
