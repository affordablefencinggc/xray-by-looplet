import { useEffect, useMemo, useState } from "react";
import { QuantityReportView } from "./QuantityReportView";
import type { IndustryDraftPanelProps } from "../draftPanel";
import { assignQuantityItem, calculateQuantityForm, type QuantityForm } from "./quantityForm";

export function QuantityDraftPanel({ value, onChange, disabled }: IndustryDraftPanelProps<QuantityForm>) {
  const [error, setError] = useState("");
  useEffect(() => { setError(""); }, [value]);
  const result = useMemo(() => {
    if (!value.calculated) return null;
    try { return calculateQuantityForm(value); } catch { return null; }
  }, [value]);
  const edit = (next: QuantityForm) => { setError(""); onChange({ ...next, calculated: false }); };
  const nodeName = (key: string) => {
    const node = value.nodes.find(item => item.key === key);
    return node ? `${node.code || "Unnamed code"} · ${node.label || "Unnamed classification"}` : "Missing classification";
  };
  const calculate = () => {
    try { calculateQuantityForm(value); setError(""); onChange({ ...value, calculated: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the classification and quantity inputs."); }
  };
  return <section className="industry-form" aria-label="Quantity surveying draft">
    <p className="industry-note">Manual draft quantities. Source references are not attached and quantities are not verified. Classifications do not create prices or an issued cost plan.</p>
    <fieldset disabled={disabled}>
      <legend>Your classification hierarchy</legend>
      <div className="industry-fields">
        <label>Hierarchy name<input value={value.hierarchyId} maxLength={240} onChange={event => edit({ ...value, hierarchyId: event.target.value })} /></label>
        <label>Hierarchy revision<input value={value.hierarchyRevision} maxLength={240} onChange={event => edit({ ...value, hierarchyRevision: event.target.value })} /></label>
      </div>
      {value.nodes.map((node, index) => <div className="industry-fields" key={node.key}>
        <label>Classification code {index + 1}<input value={node.code} maxLength={240} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, code: event.target.value } : item) })} /></label>
        <label>Classification label {index + 1}<input value={node.label} maxLength={240} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, label: event.target.value } : item) })} /></label>
        <label>Parent classification {index + 1}<select value={node.parentKey} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, parentKey: event.target.value } : item) })}>
          <option value="">Top level</option>
          {value.nodes.filter(item => item.key !== node.key).map(item => <option key={item.key} value={item.key}>{nodeName(item.key)}</option>)}
        </select></label>
        <button type="button" aria-label={`Remove classification ${index + 1}`} disabled={value.nodes.some(item => item.parentKey === node.key) || value.items.some(item => item.nodeKey === node.key)} title="Reassign child classifications and quantities before removing this classification" onClick={() => edit({ ...value, nodes: value.nodes.filter(item => item.key !== node.key) })}>Remove classification</button>
      </div>)}
      <button type="button" disabled={value.nodes.length >= 1000} onClick={() => edit({ ...value, nodes: [...value.nodes, { key: crypto.randomUUID(), code: "", label: "", parentKey: "" }] })}>Add classification</button>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Quantity rows</legend>
      {!value.items.length && <p className="industry-note">Add a quantity row and enter its quantity and unit.</p>}
      {value.items.map((item, index) => <div className="industry-fields" key={item.key}>
        <label>Item reference {index + 1}<input value={item.reference} maxLength={240} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, reference: event.target.value } : row) })} /></label>
        <label>Quantity {index + 1}<input inputMode="decimal" value={item.quantity} maxLength={80} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, quantity: event.target.value } : row) })} /></label>
        <label>Unit {index + 1}<input value={item.unit} maxLength={240} placeholder="e.g. m2, lm, ea" onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, unit: event.target.value } : row) })} /></label>
        <label>Evidence {index + 1}<select value={item.evidence} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, evidence: event.target.value as typeof item.evidence } : row) })}>
          <option value="unverified">Unverified</option><option value="inferred">Inferred</option><option value="sample">Sample</option>
        </select></label>
        <label>Assign item {index + 1}<select value={item.nodeKey} onChange={event => { setError(""); onChange(assignQuantityItem(value, item.key, event.target.value)); }}>
          <option value="">Unassigned</option>{value.nodes.map(node => <option key={node.key} value={node.key}>{nodeName(node.key)}</option>)}
        </select></label>
        <button type="button" aria-label={`Remove quantity ${index + 1}`} onClick={() => edit({ ...value, items: value.items.filter(row => row.key !== item.key) })}>Remove quantity</button>
      </div>)}
      <button type="button" disabled={value.items.length >= 10000} onClick={() => edit({ ...value, items: [...value.items, { key: crypto.randomUUID(), reference: "", quantity: "", unit: "", evidence: "unverified", nodeKey: "" }] })}>Add quantity</button>
    </fieldset>
    <div className="industry-actions"><button type="button" disabled={disabled || !value.items.length || !value.nodes.length} onClick={calculate}>Calculate classification</button></div>
    {error && <p className="industry-error" role="alert">{error}</p>}
    {result && <div className="industry-result" aria-live="polite"><QuantityReportView report={result} disabled={disabled} /></div>}
  </section>;
}
