import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { MATERIAL_UNITS, materialErrorMessage, materialLineSchema, materialLineTotals, materialRegisterCsv, materialRegisterTotals, newMaterialLine, saveMaterialLine, type MaterialLine } from "./construction/materialRegister";
import type { SourceTakeoff } from "./construction/altitudeTakeoff";

const display = (n: number | null, unit = "") => n === null ? "Unknown" : `${n > 0 && n < .001 ? n.toPrecision(3) : n.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}`;
export function MaterialRegisterPanel({ inventory, blocked, onSave, onEditingChange }: {
  inventory: SourceTakeoff; blocked: boolean; onSave: (materials: MaterialLine[]) => string | null; onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<MaterialLine | null>(null);
  const [status, setStatus] = useState("");
  function edit(line: MaterialLine | null) { setEditing(line); onEditingChange(line !== null); }
  const totals = materialRegisterTotals(inventory.materials);
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([materialRegisterCsv(inventory.materials, inventory)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "altitude-material-register.csv"; link.click(); URL.revokeObjectURL(url);
  }
  function save(draft: MaterialLine) {
    try {
      const lines = saveMaterialLine(inventory.materials, draft), error = onSave(lines);
      if (error) return error;
      edit(null); setStatus("Material saved to this project. Quantities and packaging will be restored after reload."); return null;
    } catch (error) { return materialErrorMessage(error); }
  }
  return <section aria-label="Material register" className="material-register">
    <div className="takeoff-heading"><div><h2>Materials & storage</h2><p>Actual stock lines from schedules, orders or suppliers. Inferred door allowances are not added to this list.</p></div>
      <div className="takeoff-actions"><button className="pill" disabled={blocked || editing !== null} onClick={() => { edit(newMaterialLine(crypto.randomUUID())); setStatus(""); }}><Plus size={15} /> Add material</button>
        <button className="pill" disabled={blocked || inventory.materials.length === 0 || editing !== null} onClick={exportCsv}><Download size={15} /> Export materials CSV</button></div></div>
    <div className="takeoff-summary">
      <div><span>Stock lines</span><strong>{totals.lineCount}</strong><small>Each stock code is counted once</small></div>
      <div><span>{totals.volumeComplete ? "Listed stock volume" : "Known stock volume"}</span><strong>{display(totals.knownVolumeM3, " m³")}</strong><small>{totals.volumeCoverage} / {totals.lineCount} lines have calculable volume</small></div>
      <div><span>{totals.weightComplete ? "Listed specified weight" : "Known specified weight"}</span><strong>{display(totals.knownWeightKg, " kg")}</strong><small>{totals.weightCoverage} / {totals.lineCount} lines have calculable weight</small></div>
      <div><span>Coverage</span><strong>{totals.lineCount === 0 ? "Not entered" : totals.volumeComplete && totals.weightComplete ? "Listed lines" : "Partial"}</strong><small>Whole-building completeness is not established</small></div>
    </div>
    <p className="takeoff-boundary">Storage uses whole package counts, rounded up, and the supplied outer dimensions. Unit-based weight uses the stock quantity; package-based weight uses whole packs. A partially filled last pack may weigh less than the full-pack estimate. Aisles, stacking restrictions and handling space are not included.</p>
    {status && <p role="status">{status}</p>}
    {editing ? <MaterialEditor key={`${editing.id}:${editing.revision}`} line={editing} blocked={blocked} onSave={save} onCancel={() => edit(null)} /> :
      inventory.materials.length === 0 ? <div className="material-empty"><h3>No stock list entered yet</h3><p>Add the first material using its actual quantity and a schedule or supplier reference. Dimensions and weight can stay blank until specified.</p><p>The tower's design-guidance PDF does not supply a material order.</p></div> :
        <div className="material-lines">{inventory.materials.map(line => {
          const t = materialLineTotals(line);
          return <button className="material-line" disabled={blocked} key={line.id} onClick={() => { edit(line); setStatus(""); }}>
            <span><b>{line.description}</b><small>{line.stockCode} · revision {line.revision}</small><small>{line.reference}</small></span>
            <span><b>{display(line.quantity)} {MATERIAL_UNITS[line.unit]}</b><small>{display(t.packageCount)} packages</small></span>
            <span><b>{display(t.volumeM3, " m³")}</b><small>{display(t.weightKg, " kg")}</small></span>
          </button>;
        })}</div>}
  </section>;
}

function MaterialEditor({ line, blocked, onSave, onCancel }: {
  line: MaterialLine; blocked: boolean; onSave: (draft: MaterialLine) => string | null; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(line), [error, setError] = useState<string | null>(null);
  const preview = materialLineSchema.safeParse({ ...draft, stockCode: draft.stockCode.trim() || "preview", description: draft.description.trim() || "preview", reference: draft.reference.trim() || "preview" });
  const totals = preview.success ? materialLineTotals(preview.data) : { packageCount: null, volumeM3: null, weightKg: null };
  function numeric(key: "quantity" | "unitsPerPackage" | "lengthM" | "widthM" | "heightM" | "specifiedWeightKg", label: string) {
    return <label key={key}>{label}<input type="number" aria-label={label} disabled={key === "specifiedWeightKg" && draft.unit === "kg" && draft.weightBasis === "unit"} min={key === "quantity" ? 0 : key === "unitsPerPackage" && draft.unit === "each" ? 1 : .000001} max={1e9} step={draft.unit === "each" && ["quantity", "unitsPerPackage"].includes(key) ? 1 : "any"} value={draft[key] ?? ""} placeholder="Unknown" onChange={e => setDraft({ ...draft, [key]: e.target.value === "" ? null : Number(e.target.value) })} /></label>;
  }
  return <form className="takeoff-editor material-editor" onSubmit={e => { e.preventDefault(); setError(onSave(draft)); }}>
    <h3>{line.description ? "Edit material" : "Add material"}</h3>
    <div className="material-editor-grid">
      <label>Stock code / order line<input aria-label="Stock code / order line" value={draft.stockCode} maxLength={100} required onChange={e => setDraft({ ...draft, stockCode: e.target.value })} /></label>
      <label>Material description<input aria-label="Material description" value={draft.description} maxLength={300} required onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      {numeric("quantity", "Stock quantity")}
      <label>Quantity unit<select aria-label="Quantity unit" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value as MaterialLine["unit"], specifiedWeightKg: e.target.value === "kg" && draft.weightBasis === "unit" ? null : draft.specifiedWeightKg })}>{Object.entries(MATERIAL_UNITS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {numeric("unitsPerPackage", `Quantity per package (${MATERIAL_UNITS[draft.unit]})`)}
      {numeric("lengthM", "Outer package length (m)")}{numeric("widthM", "Outer package width (m)")}{numeric("heightM", "Outer package height (m)")}
      {numeric("specifiedWeightKg", "Specified weight (kg)")}
      <label>Weight applies to<select aria-label="Weight applies to" value={draft.weightBasis} onChange={e => setDraft({ ...draft, weightBasis: e.target.value as MaterialLine["weightBasis"], specifiedWeightKg: e.target.value === "unit" && draft.unit === "kg" ? null : draft.specifiedWeightKg })}><option value="unit">One {MATERIAL_UNITS[draft.unit]} of stock</option><option value="package">One full package</option></select></label>
    </div>
    <label>Schedule / order / supplier reference<textarea aria-label="Schedule / order / supplier reference" required maxLength={2000} value={draft.reference} placeholder="Document, revision and line/page; include the source of packaging and weight" onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label>
    <div className="material-preview" aria-label="Material calculation preview"><span>Packages <b>{display(totals.packageCount)}</b></span><span>Packed volume <b>{display(totals.volumeM3, " m³")}</b></span><span>Specified weight <b>{display(totals.weightKg, " kg")}</b></span></div>
    <p className="takeoff-help">Preview uses this unsaved line only. Stock entered in kg already gives its unit-based weight. No packing density is inferred. A zero stock quantity contributes zero; blanks remain unknown.</p>
    {error && <p role="alert" className="takeoff-notice">{error}</p>}
    <div className="takeoff-actions"><button className="pill" disabled={blocked} type="submit">Save material</button><button className="pill" type="button" onClick={onCancel}>Cancel changes</button></div>
  </form>;
}
