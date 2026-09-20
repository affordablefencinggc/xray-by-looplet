import { useState } from "react";
import { emptyDuctMaterialRow, evaluateDuctMaterialRow, reviewDuctMaterialRow, type DuctMaterialRow } from "./ductMaterialTable.ts";

export function DuctMaterialTable({ rows, onChange, disabled }: { rows: DuctMaterialRow[]; onChange: (rows: DuctMaterialRow[]) => void; disabled: boolean }) {
  const [error, setError] = useState("");
  const update = (id: string, patch: Partial<DuctMaterialRow>) => { setError(""); onChange(rows.map(row => row.id === id ? { ...row, ...patch } : row)); };
  const input = (row: DuctMaterialRow, key: "gauge" | "thickness" | "density" | "reference" | "sourceId" | "sourceRevision" | "sourceSha256" | "reviewer", label: string, index: number) => <label key={key}>{label}<input aria-label={`Material ${index + 1} ${label}`} value={row[key]} onChange={e => update(row.id, { [key]: e.target.value })} /></label>;
  return <fieldset disabled={disabled} aria-label="Reviewed duct material table">
    <legend>Reviewed material table</legend>
    <p className="industry-note">Enter gauge, thickness and bulk density from your supplier's table. Review the exact values before assigning a row to a duct section. No gauge conversion or density is guessed. These are declared inputs, not authenticated source measurements.</p>
    {rows.map((row, index) => { const evaluated = evaluateDuctMaterialRow(row); return <fieldset key={row.id}>
      <legend>Material row {index + 1}</legend>
      <div className="industry-fields">
        <label>Material<select aria-label={`Material ${index + 1} type`} value={row.material} onChange={e => update(row.id, { material: e.target.value as DuctMaterialRow["material"] })}><option value="">Choose material</option><option value="galvanized-steel">Galvanized steel</option><option value="aluminum">Aluminum</option><option value="stainless-steel">Stainless steel</option></select></label>
        {input(row, "gauge", "Gauge label", index)}{input(row, "thickness", "Thickness", index)}
        <label>Thickness unit<select aria-label={`Material ${index + 1} thickness unit`} value={row.thicknessUnit} onChange={e => update(row.id, { thicknessUnit: e.target.value as "mm" | "m" })}><option value="mm">mm</option><option value="m">m</option></select></label>
        {input(row, "density", "Bulk density (kg/m3)", index)}{input(row, "reference", "Table reference", index)}{input(row, "sourceId", "Source identifier", index)}{input(row, "sourceRevision", "Source revision", index)}{input(row, "sourceSha256", "Source SHA-256", index)}
        <label>Material evidence<select aria-label={`Material ${index + 1} evidence`} value={row.evidence} onChange={e => update(row.id, { evidence: e.target.value as DuctMaterialRow["evidence"] })}><option value="declared">Declared supplier inputs</option><option value="inferred">Inferred - not review eligible</option><option value="sample">Sample - not review eligible</option></select></label>
        {input(row, "reviewer", "Reviewer name", index)}
      </div>
      <p role="status" data-material-row={row.id}>Sheet mass: <strong>{evaluated.status === "declared" ? `${evaluated.sheetMassKgPerM2.value.toLocaleString(undefined, { maximumFractionDigits: 6 })} kg/m² · reviewed declaration` : `unknown · ${evaluated.reasons.join(", ")}`}</strong></p>
      {evaluated.status === "declared" && <p className="industry-note">Reviewed by {evaluated.basis?.review?.reviewedBy} at {evaluated.basis?.review?.reviewedAt}. Editing material values or source identity requires a new review.</p>}
      <div className="industry-actions"><button type="button" onClick={() => { try { const next = reviewDuctMaterialRow(row); setError(""); onChange(rows.map(r => r.id === row.id ? next : r)); } catch { setError(`Material row ${index + 1}: supply material, gauge, positive thickness/density, a table reference, source identity with a 64-character SHA-256 and reviewer name. Only declared inputs can be reviewed.`); } }}>Review material row {index + 1}</button>
        <button type="button" onClick={() => onChange(rows.filter(r => r.id !== row.id))}>Remove material row {index + 1}</button></div>
    </fieldset>; })}
    <button type="button" disabled={rows.length >= 100} onClick={() => onChange([...rows, emptyDuctMaterialRow(crypto.randomUUID())])}>Add material row</button>
    {error && <p role="alert" className="industry-error">{error}</p>}
  </fieldset>;
}
