import { useEffect, useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { useStudio } from "./store";
import { MaterialRegisterPanel } from "./MaterialRegisterPanel";
import type { MaterialLine } from "./construction/materialRegister";
import { ALTITUDE_SHA, TAKEOFF_DEFINITIONS, persistTakeoff, restoreTakeoff, rowQuantity, stockTotals, updateTakeoffRow,
  type TakeoffRow, type TakeoffSession } from "./construction/altitudeTakeoff";

const number = (n: number | null, unit = "") => n === null ? "Unknown" : `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}`;

export function SourceTakeoffPanel() {
  const s = useStudio();
  const [session, setSession] = useState<TakeoffSession | null>(null);
  const [selected, setSelected] = useState("residential-entrance");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"counts" | "materials">("counts");
  const [materialEditing, setMaterialEditing] = useState(false);
  const projectId = s.job.id;
  useEffect(() => { setSession(restoreTakeoff(window.localStorage, projectId)); }, [projectId]);
  if (!session) return <p role="status">Restoring source takeoff…</p>;
  const inventory = session.value;
  const totals = stockTotals(inventory);
  const row = inventory.rows.find(r => r.id === selected)!;
  const def = TAKEOFF_DEFINITIONS.find(d => d.id === selected)!;
  const activeDoc = s.job.documents.find(d => d.id === s.job.activeDocumentId);
  const sourceReady = activeDoc?.sha256 === ALTITUDE_SHA && s.activePlanBinary?.sha256 === ALTITUDE_SHA && s.activePlanBinary.documentId === activeDoc.id;
  function save(nextRow?: TakeoffRow) {
    if (!session || !sourceReady) return;
    try {
      const next = nextRow ? updateTakeoffRow(session.value, nextRow) : session.value;
      const saved = persistTakeoff(window.localStorage, session, next);
      setSession(saved);
      setMessage(saved.error ? "" : "Saved to this project. Available after reload.");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  function exportInventory() {
    const data = { ...inventory, status: "Preliminary typical-floor takeoff; incomplete building coverage", sourceDocument: activeDoc?.name,
      groups: inventory.rows.map(r => ({ ...r, definition: TAKEOFF_DEFINITIONS.find(d => d.id === r.id), quantity: rowQuantity(r) })), stock: totals };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "altitude-source-takeoff.json"; a.click(); URL.revokeObjectURL(url);
  }
  function saveMaterials(materials: MaterialLine[]): string | null {
    if (!session || !sourceReady) return "Open the original drawing before saving materials.";
    const saved = persistTakeoff(window.localStorage, session, { ...session.value, revision: session.value.revision + 1, materials });
    setSession(saved);
    return saved.error;
  }
  return <section className="source-takeoff" aria-label="Altitude source takeoff">
    <header className="takeoff-heading">
      <div><span className="kicker">Source takeoff · Altitude</span><h1>Counted from the tower drawings</h1>
        <p>Preliminary · typical floors only · 15 December 2015 design guidance</p></div>
      <div className="takeoff-actions">
        <button className="pill" onClick={() => save()} disabled={session.blocked || !sourceReady || materialEditing}>Save inventory</button>
        <button className="pill" onClick={exportInventory} disabled={session.blocked || materialEditing}><Download size={15} /> Export count</button>
      </div>
    </header>
    {session.error && <div role="alert" className="takeoff-notice">
      <p>{session.error}</p>
      <button className="pill" onClick={() => { setSession(restoreTakeoff(window.localStorage, projectId)); setMessage(""); }}>Retry restore</button>
    </div>}
    <p role="status" className="takeoff-save-status">{message || (session.blocked ? "Prepared reference counts shown below; saved inventory could not be loaded." : session.raw ? "Saved inventory restored for this drawing." : "Prepared source counts. Save inventory to keep this takeoff in the project.")}</p>
    <nav className="takeoff-filters" aria-label="Inventory views">
      <button className="pill" aria-pressed={tab === "counts"} disabled={materialEditing} onClick={() => setTab("counts")}>Drawing allowances</button>
      <button className="pill" aria-pressed={tab === "materials"} onClick={() => setTab("materials")}>Materials & storage</button>
    </nav>
    {materialEditing && <p className="takeoff-help">Save material or cancel changes below before switching inventory views or exporting.</p>}
    {tab === "materials" && <MaterialRegisterPanel inventory={inventory} blocked={session.blocked || !sourceReady} onSave={saveMaterials} onEditingChange={setMaterialEditing} />}
    <div hidden={tab !== "counts"} className="takeoff-count-view">
    <div className="takeoff-summary">
      <div><span>Entrance allowances</span><strong>{number(inventory.rows.filter(r => r.id.endsWith("entrance")).every(r => rowQuantity(r) !== null) ? inventory.rows.filter(r => r.id.endsWith("entrance")).reduce((sum, r) => sum + rowQuantity(r)!, 0) : null)}</strong><small>Inferred from units/rooms · not door leaves</small></div>
      <div><span>Uncounted groups</span><strong>{inventory.rows.filter(r => r.countPerFloor === null).length}</strong><small>Unknown quantities stay visible</small></div>
      <div><span>Known packed volume</span><strong>{number(totals.knownVolumeM3, " m³")}</strong><small>{totals.volumeCoverage} / {totals.totalGroups} groups have packaging</small></div>
      <div><span>Known specified weight</span><strong>{number(totals.knownWeightKg, " kg")}</strong><small>{totals.weightCoverage} / {totals.totalGroups} groups have weight</small></div>
    </div>
    <p className="takeoff-boundary">Volume and weight are partial subtotals for the groups entered here. Whole-building stock totals remain unknown. Packaging must cover the counted item; an entrance opening is not automatically one door leaf. Aisles and handling space are excluded.</p>
    <div className="takeoff-layout">
      <div className="takeoff-list">
        <nav className="takeoff-filters" aria-label="Takeoff categories">{["All", "Doors", "Windows", "Structure"].map(c => <button className="pill" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</nav>
        {inventory.rows.filter(r => category === "All" || TAKEOFF_DEFINITIONS.find(d => d.id === r.id)!.category === category).map(r => {
          const d = TAKEOFF_DEFINITIONS.find(d => d.id === r.id)!;
          return <button key={r.id} className="takeoff-row" aria-pressed={selected === r.id} onClick={() => { setSelected(r.id); setMessage(""); }}>
            <span><b>{d.name}</b><small>Page {d.page} · {r.countPerFloor === null ? "Count unresolved" : `${r.countPerFloor} per floor × ${d.floors.length} floors`}</small></span>
            <span className="takeoff-row-total"><b>{number(rowQuantity(r))}</b><small>{r.review === "reviewed" ? "Count reviewed" : "Needs review"}</small></span>
          </button>;
        })}
        <div className="takeoff-boundary"><b>Coverage</b><p>Entrance counts cover residential floors 8–30 / 44–48 and hotel floors 33–43. Podium, amenity floors, internal doors, plant and connection hardware are not included.</p><p>Earlier EDG 2 comparison layouts and repeated drawing views are excluded.</p></div>
      </div>
      <aside className="takeoff-inspector" aria-label="Takeoff inspector">
        <span className="kicker">{def.category} · revision {row.revision}</span><h2>{def.name}</h2>
        <p>{def.basis}</p>
        <button className="pill" disabled={!sourceReady} onClick={() => { if (sourceReady) { s.setSheet(def.page - 1); s.setPane("sheets"); } }}><ArrowUpRight size={15} /> View source page {def.page}</button>
        <details><summary>Included floors and evidence</summary><p>Floors {def.floors.join(", ")}</p><p>{activeDoc?.name}</p><p className="takeoff-hash">SHA-256 {ALTITUDE_SHA}</p></details>
        <div className="takeoff-notice"><b>Still needed</b><p>{def.missing}</p></div>
        <TakeoffEditor key={`${row.id}:${row.revision}`} row={row} blocked={session.blocked || !sourceReady} onSave={save} />
      </aside>
    </div>
    </div>
  </section>;
}

function TakeoffEditor({ row, blocked, onSave }: { row: TakeoffRow; blocked: boolean; onSave: (row: TakeoffRow) => void }) {
  const [draft, setDraft] = useState(row);
  const stock = draft.stock;
  return <form className="takeoff-editor" onSubmit={e => { e.preventDefault(); onSave(draft); }}>
    <label>Count per typical floor<input type="number" min="0" max="100000" step="1" value={draft.countPerFloor ?? ""} placeholder="Unknown" onChange={e => setDraft({ ...draft, countPerFloor: e.target.value === "" ? null : Number(e.target.value) })} /></label>
    <label>Count / review note<textarea aria-label="Count / review note" value={draft.note} placeholder="Reference the schedule or explain a count adjustment" maxLength={2000} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
    <label className="takeoff-check"><input type="checkbox" checked={draft.review === "reviewed"} onChange={e => setDraft({ ...draft, review: e.target.checked ? "reviewed" : "pending" })} /> Count reviewed against source</label>
    <p className="takeoff-help">A changed count or packaging specification requires review again. Reviewing the count does not resolve the missing specifications above.</p>
    <fieldset><legend>Packed stock and specified weight</legend>
      <p className="takeoff-help">Enter supplier packaging for each counted item. For entrances, state whether the package includes the complete door assembly. Blank means unknown.</p>
      <div className="takeoff-input-grid">{([
        ["unitsPerPackage", "Counted items per package", 1], ["lengthM", "Package length (m)", "any"], ["widthM", "Package width (m)", "any"],
        ["heightM", "Package height (m)", "any"], ["unitWeightKg", "Specified weight per item (kg)", "any"],
      ] as const).map(([key, label, step]) => <label key={key}>{label}<input type="number" min={key === "unitsPerPackage" ? 1 : 0.000001} max={key === "unitsPerPackage" ? 1e6 : 1e9} step={step} value={stock[key] ?? ""} placeholder="Unknown" onChange={e => setDraft({ ...draft, stock: { ...stock, [key]: e.target.value === "" ? null : Number(e.target.value) } })} /></label>)}</div>
      <label>Supplier / specification reference<textarea aria-label="Supplier / specification reference" maxLength={1000} value={stock.reference} placeholder="Source, product and what one package covers" onChange={e => setDraft({ ...draft, stock: { ...stock, reference: e.target.value } })} /></label>
    </fieldset>
    <button className="pill" type="submit" disabled={blocked}>Save group</button>
  </form>;
}
