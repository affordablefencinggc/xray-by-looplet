import { useEffect, useRef, useState } from "react";
import { TAKEOFF_DEFINITIONS, takeoffKey, type TakeoffSession } from "./construction/altitudeTakeoff";
import { materialErrorMessage, MATERIAL_UNITS, type MaterialLine } from "./construction/materialRegister";
import { TRANSFER_LIMIT_BYTES, BACKUP_LIMIT_BYTES, materialCsvTemplate, parseMaterialCsv, parseTakeoffBackup, previewBackupRestore, previewMaterialImport, takeoffBackup, type TransferPreview } from "./construction/takeoffTransfer";

function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
const show = (v: unknown) => v === null || v === undefined || v === "" ? "Unknown" : String(v);
const fields: [keyof MaterialLine, string][] = [["description", "Description"], ["quantity", "Quantity"], ["unit", "Unit"], ["unitsPerPackage", "Quantity per package"], ["lengthM", "Package length m"], ["widthM", "Package width m"], ["heightM", "Package height m"], ["specifiedWeightKg", "Specified kg"], ["weightBasis", "Weight applies to"], ["reference", "Source reference"]];
type Selection = { name: string; session: TakeoffSession } & ({ kind: "csv"; lines: MaterialLine[] } | { kind: "backup"; backup: ReturnType<typeof parseTakeoffBackup> });

export function TakeoffTransferPanel({ session, disabled, sourceReady, onBusyChange, onApply }: {
  session: TakeoffSession; disabled: boolean; sourceReady: boolean; onBusyChange: (busy: boolean) => void; onApply: (preview: TransferPreview) => string | null;
}) {
  const csvInput = useRef<HTMLInputElement>(null), backupInput = useRef<HTMLInputElement>(null), generation = useRef(0);
  const [selection, setSelection] = useState<Selection | null>(null), [reading, setReading] = useState(false), [error, setError] = useState("");
  const [updateMatches, setUpdateMatches] = useState(false), [page, setPage] = useState(0), [status, setStatus] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    try {
      const prefix = takeoffKey(session.value.projectId) + ":recovery:";
      const latest = Object.keys(window.localStorage).filter(key => key.startsWith(prefix)).sort().at(-1);
      setPrevious(latest ? window.localStorage.getItem(latest) : null);
    } catch { setPrevious(null); }
  }, [session.raw, session.value.projectId]);
  const busy = selection !== null || reading;
  function cancel() { generation.current++; setSelection(null); setReading(false); setError(""); onBusyChange(false); }
  async function select(file: File | undefined, kind: "csv" | "backup") {
    if (!file) return;
    const token = ++generation.current; setReading(true); setSelection(null); setError(""); setStatus(""); setUpdateMatches(false); setPage(0); onBusyChange(true);
    try {
      const limit = kind === "csv" ? TRANSFER_LIMIT_BYTES : BACKUP_LIMIT_BYTES;
      if (file.size > limit) throw Error(`File exceeds the ${limit / 1024 / 1024} MB import limit.`);
      const text = await file.text(); if (token !== generation.current) return;
      setSelection(kind === "csv" ? { kind, name: file.name, session, lines: parseMaterialCsv(text) } : { kind, name: file.name, session, backup: parseTakeoffBackup(text) });
      setReading(false);
    } catch (e) { if (token === generation.current) { setError(materialErrorMessage(e)); setReading(false); onBusyChange(false); } }
  }
  let preview: TransferPreview | null = null, previewError = "";
  if (selection) try { preview = selection.kind === "csv" ? previewMaterialImport(selection.session, selection.lines, updateMatches) : previewBackupRestore(selection.session, selection.backup); } catch (e) { previewError = materialErrorMessage(e); }
  return <section className="takeoff-transfer" aria-label="Import and backup">
    <div className="takeoff-actions">
      <button className="pill" disabled={disabled || busy || session.blocked || !sourceReady} onClick={() => csvInput.current?.click()}>Import materials CSV</button>
      <button className="pill" disabled={busy} onClick={() => download(materialCsvTemplate(), "material-import-template.csv", "text/csv;charset=utf-8")}>Download CSV template</button>
      <button className="pill" disabled={disabled || busy || session.blocked || !sourceReady} onClick={() => download(takeoffBackup(session.value), "altitude-inventory-backup.json")}>Download backup</button>
      <button className="pill" disabled={disabled || busy || !sourceReady} onClick={() => backupInput.current?.click()}>Restore backup</button>
      {previous !== null && <button className="pill" onClick={() => download(previous, "previous-inventory-snapshot.json")}>Download previous snapshot</button>}
      {session.error && session.raw !== null && <button className="pill" onClick={() => download(session.raw!, "preserved-inventory-snapshot.json")}>Download saved snapshot</button>}
    </div>
    <input ref={csvInput} type="file" accept=".csv,text/csv" hidden aria-label="Materials CSV file" onChange={e => { void select(e.target.files?.[0], "csv"); e.target.value = ""; }} />
    <input ref={backupInput} type="file" accept=".json,application/json" hidden aria-label="Inventory backup file" onChange={e => { void select(e.target.files?.[0], "backup"); e.target.value = ""; }} />
    <p className="takeoff-help">CSV: UTF-8, comma-separated, up to 5 MB / 5,000 lines. Use the template or a materials CSV export. Blank quantities stay unknown. JSON backups: up to 25 MB, containing counts, notes and materials; original drawing files are separate.</p>
    {status && <p role="status">{status}</p>}
    {reading && <p role="status">Reading file… <button className="pill" onClick={cancel}>Cancel import</button></p>}
    {(error || previewError) && <p role="alert" className="takeoff-notice transfer-error">{error || previewError}</p>}
    {selection && <div className="takeoff-editor" aria-label="Transfer preview">
      <h2>{selection.kind === "csv" ? "Preview material import" : "Preview backup restore"}</h2><p>{selection.name}</p>
      {selection.kind === "csv" ? <>
        <label className="takeoff-check"><input type="checkbox" checked={updateMatches} onChange={e => { setUpdateMatches(e.target.checked); setPage(0); setError(""); }} /> Update matching stock codes</label>
        <p className="takeoff-help">Matching codes keep their IDs. An update replaces all material fields, including clearing fields that are blank or absent in the CSV. Other stock lines and drawing counts are retained. Exported calculated totals are recomputed; a CSV Project column is informational.</p>
      </> : <p className="takeoff-notice">This replaces all five drawing groups and the material register. Restored counts will need review again. Notes and stock references are restored. The previous saved snapshot must be archived locally before replacement. {preview && preview.fromProject !== session.value.projectId ? `Copies the backup from project ${preview.fromProject} into this project for the same drawing.` : ""}</p>}
      {preview && <>
        <p role="status">{session.blocked && preview.kind === "backup" ? `Existing quantities unavailable. Backup contains ${preview.value.materials.length} material lines and five drawing groups.` : `${preview.changes.filter(c => c.action === "Add").length} added · ${preview.changes.filter(c => c.action === "Update").length} updated · ${preview.changes.filter(c => c.action === "Keep").length} unchanged · ${preview.changes.filter(c => c.action === "Remove").length} removed`}</p>
        {preview.kind === "backup" && <div className="transfer-counts">{preview.value.rows.map(row => {
          const old = session.value.rows.find(r => r.id === row.id)!;
          return <details key={row.id}><summary>{TAKEOFF_DEFINITIONS.find(d => d.id === row.id)!.name}: {session.blocked ? "Unavailable" : show(old.countPerFloor)} → {show(row.countPerFloor)} per floor</summary>
            <p>Restored note: {row.note || "No note"}</p><p>Packaging: {show(row.stock.unitsPerPackage)} items · {show(row.stock.lengthM)} × {show(row.stock.widthM)} × {show(row.stock.heightM)} m · {show(row.stock.unitWeightKg)} kg per item</p><p>Reference: {row.stock.reference || "Unknown"}</p><p>Review after restore: pending</p></details>;
        })}</div>}
        <div className="transfer-lines">{preview.changes.slice(page * 50, (page + 1) * 50).map((change, index) => <details key={`${page}:${index}`}>
          <summary>{session.blocked ? "Restore" : change.action} · {change.code} · {change.after?.description ?? change.before?.description} · {session.blocked ? "Unavailable" : show(change.before?.quantity)} → {show(change.after?.quantity)} {change.after ? MATERIAL_UNITS[change.after.unit] : ""}</summary>
          <div className="transfer-field-head"><b>Field</b><b>Current</b><b>After import</b></div>
          {fields.map(([key, title]) => <div className="transfer-field" key={key}><span>{title}</span><span>{session.blocked ? "Unavailable" : show(change.before?.[key])}</span><span>{show(change.after?.[key])}</span></div>)}
        </details>)}</div>
        {preview.changes.length > 50 && <div className="takeoff-actions"><button className="pill" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous preview page</button><span>Page {page + 1} / {Math.ceil(preview.changes.length / 50)}</span><button className="pill" disabled={(page + 1) * 50 >= preview.changes.length} onClick={() => setPage(page + 1)}>Next preview page</button></div>}
      </>}
      <div className="takeoff-actions"><button className="pill" disabled={!preview || !sourceReady || disabled} onClick={() => {
        if (!preview) return; const failure = onApply(preview);
        if (failure) { setError(failure); return; }
        const restored = preview.kind === "backup", hadPrevious = selection.session.raw !== null; cancel(); setStatus(restored ? `Backup restored. ${hadPrevious ? "Previous saved data retained in a local recovery archive. " : ""}Counts need review.` : "Materials imported and saved. Available after reload.");
      }}>{selection.kind === "csv" ? "Apply material import" : "Replace inventory with backup"}</button><button className="pill" onClick={cancel}>Cancel import</button></div>
    </div>}
  </section>;
}
