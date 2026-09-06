import { useEffect, useState } from "react";
import { Download, FileSearch } from "lucide-react";
import { useStudio } from "./store";
import { inspectPlanBytes } from "./documents";
import { CONNECTION_SOURCE, CONNECTION_SCOPE, CONNECTION_EXCLUSIONS, CONNECTION_UNKNOWN, CONNECTION_EVIDENCE, TRIAL_CONNECTIONS,
  restoreTrial, saveTrial, trialExport, type TrialSession } from "./construction/connectionTrial";

export function OpenConnectionTrial() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function open() {
    const before = useStudio.getState();
    setBusy(true); setError("");
    try {
      const response = await fetch(CONNECTION_SOURCE.localUrl);
      if (!response.ok) throw Error("The reference drawing could not be loaded.");
      const imported = await inspectPlanBytes({ name: "Thornton Fire Station 8 structural.pdf", bytes: new Uint8Array(await response.arrayBuffer()), source: "web" });
      if (imported.binary.sha256 !== CONNECTION_SOURCE.sha256) throw Error("Reference drawing identity does not match. Nothing was imported.");
      const current = useStudio.getState();
      if (current.job.id !== before.job.id || current.activePlanBinary !== before.activePlanBinary) throw Error("The active project or drawing changed while loading. Please try again.");
      await current.importPlan(imported);
      useStudio.getState().setPane("components");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="connection-trial-entry"><button className="pill" onClick={open} disabled={busy}><FileSearch size={16} />{busy ? "Opening verified drawing…" : "Open structural bolt-count trial"}</button><span>Real bid drawings · one roof span · preliminary</span>{error && <p role="alert">{error}</p>}</div>;
}

export function ConnectionTrialPanel() {
  const s = useStudio(), projectId = s.job.id;
  const [session, setSession] = useState<TrialSession | null>(null);
  const [selected, setSelected] = useState(TRIAL_CONNECTIONS[0].id);
  const [note, setNote] = useState(""), [reviewed, setReviewed] = useState(false);
  const [view, setView] = useState(0), [message, setMessage] = useState("");
  useEffect(() => { setSession(restoreTrial(localStorage, projectId)); }, [projectId]);
  const saved = session?.value.reviews.find(r => r.id === selected);
  useEffect(() => { setNote(saved?.note ?? ""); setReviewed(saved?.reviewed ?? false); }, [saved]);
  if (!session || !saved) return <p role="status">Restoring connection review…</p>;
  const active = s.job.documents.find(d => d.id === s.job.activeDocumentId);
  const sourceReady = active?.sha256 === CONNECTION_SOURCE.sha256 && s.activePlanBinary?.sha256 === CONNECTION_SOURCE.sha256 && s.activePlanBinary.documentId === active.id;
  const dirty = note !== saved.note || reviewed !== saved.reviewed;
  const connection = TRIAL_CONNECTIONS.find(c => c.id === selected)!;
  const evidence = CONNECTION_EVIDENCE[view];
  function save() {
    if (!session || !saved || !sourceReady) return;
    const next = { ...session.value, reviews: session.value.reviews.map(r => r.id === selected ? { ...r, note, reviewed, revision: r.revision + 1 } : r) };
    const result = saveTrial(localStorage, session, next);
    setSession(result); setMessage(result.error ? "" : "Review saved to this project. It will survive reload.");
  }
  function exportCount() {
    if (!session || session.blocked || dirty || !sourceReady) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(trialExport(session.value), null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "thornton-roof-connection-count.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="source-takeoff connection-trial" aria-label="Structural connection counting trial">
    <header className="takeoff-heading"><div><span className="kicker">Source takeoff / connection trial</span><h1>Follow every bolt to the drawing</h1><p>Thornton Fire Station 8 · structural bid set · 27 September 2024 · low-rise test project</p></div>
      <button className="pill" disabled={session.blocked || dirty || !sourceReady} onClick={exportCount}><Download size={16} />Export connection count</button></header>
    <div className="takeoff-summary"><div><span>Interior beams traced</span><strong>8</strong><small>One selected roof span</small></div><div><span>Unique beam ends</span><strong>16</strong><small>Two ends per physical beam</small></div><div><span>Scheduled bolts</span><strong>32</strong><small>7/8″ diameter · ASTM A325N</small></div><div><span>Connections reviewed</span><strong>{session.value.reviews.filter(r => r.reviewed).length} / 16</strong><small>Preliminary until reviewed</small></div></div>
    <p className="takeoff-boundary"><b>Bounded count.</b> {CONNECTION_SCOPE}</p>
    {session.error && <div className="takeoff-notice" role="alert">{session.error}<button className="pill" onClick={() => { setSession(restoreTrial(localStorage, projectId)); setMessage(""); }}>Retry restore</button></div>}
    {!sourceReady && <p role="alert">Open the verified original drawing to review or export this count.</p>}
    <div className="connection-review-layout"><div className="connection-evidence-column">
      <figure className="connection-evidence"><div className="connection-image"><img src={`/sources/thornton-connection-trial/${evidence.id}.png`} alt={`${evidence.sheet}: ${evidence.title}`} />
        {view === 0 && TRIAL_CONNECTIONS.map(c => <button key={c.id} disabled={dirty} className="connection-marker" aria-label={`Inspect beam ${c.beam} ${c.end === "N" ? "north" : "south"} connection`} aria-pressed={selected === c.id} style={{ left: `${(c.point.x - .385) / .16 * 100}%`, top: `${(c.point.y - .452) / .091 * 100}%` }} onClick={() => { setSelected(c.id); setMessage(""); }}>{c.beam.slice(1)}{c.end}</button>)}
      </div><figcaption>{evidence.sheet} · PDF page {evidence.page} · {evidence.title}</figcaption></figure>
      <nav className="takeoff-filters" aria-label="Connection evidence">{CONNECTION_EVIDENCE.map((e, i) => <button className="pill" key={e.id} aria-pressed={view === i} onClick={() => setView(i)}>{e.title}</button>)}<button className="pill" disabled={!sourceReady || dirty} onClick={() => { s.setSheet(evidence.page - 1); s.setPane("sheets"); }}>Open full source sheet</button></nav>
      <div className="connection-beam-grid" aria-label="Physical beam ends">{TRIAL_CONNECTIONS.map(c => <button key={c.id} className="pill" disabled={dirty} aria-pressed={selected === c.id} onClick={() => { setSelected(c.id); setMessage(""); }}>Beam {c.beam} · {c.end}{session.value.reviews.find(r => r.id === c.id)?.reviewed ? " ✓" : ""}</button>)}</div>
      <div className="takeoff-boundary"><b>How the count is derived</b><p>8 beams × 2 ends × 2 bolts = 32 bolts. Detail 1/S5.1 uses the lesser nominal depth: W10 meeting W24 gives D = 10″. The 8–11″ row on S0.6 specifies two bolts. Repeated detail views are supporting evidence for the same connection.</p><p>{CONNECTION_EXCLUSIONS}</p></div>
    </div><aside className="takeoff-inspector" aria-label="Connection inspector"><span className="kicker">Physical connection</span><h2>Beam {connection.beam} · {connection.end === "N" ? "north" : "south"} end</h2><code className="takeoff-hash">{connection.id}</code><p>W10×22 to W24×94 · single shear plate<br /><b>2 × 7/8″ ASTM A325N bolts</b></p><p>Revision {saved.revision} · {saved.reviewed ? "Count reviewed" : "Needs review"}</p>
      <div className="takeoff-editor"><label>Review note<textarea aria-label="Review note" value={note} maxLength={2000} disabled={session.blocked || !sourceReady} onChange={e => { setNote(e.target.value); setReviewed(false); }} placeholder="Record the sheet and detail checked, and any exception." /></label><label className="takeoff-check"><input type="checkbox" checked={reviewed} disabled={session.blocked || !sourceReady || !note.trim()} onChange={e => setReviewed(e.target.checked)} />I checked this connection count against the source</label><div className="takeoff-actions"><button className="pill" disabled={session.blocked || !sourceReady || !dirty} onClick={save}>Save connection review</button>{dirty && <button className="pill" onClick={() => { setNote(saved.note); setReviewed(saved.reviewed); }}>Cancel edit</button>}</div></div>
      <p role="status" className="takeoff-save-status">{dirty ? "Unsaved review — save or cancel before selecting another connection or exporting." : message || (session.raw ? "Saved review restored." : "Prepared source count; review pending.")}</p>
      <details open><summary>Unresolved material information</summary><ul>{CONNECTION_UNKNOWN.map(item => <li key={item}>{item}: <b>unknown</b></li>)}</ul><p>These quantities are not established by this trial’s references. Unknown values are exported as null, never zero. No purchasing total is released.</p></details>
      <details><summary>Document identity & scope</summary><a href={CONNECTION_SOURCE.url} target="_blank" rel="noreferrer">Official City of Thornton drawing set</a><p>{CONNECTION_SOURCE.pages} pages · issue {CONNECTION_SOURCE.issue}</p><p className="takeoff-hash">SHA-256 {CONNECTION_SOURCE.sha256}</p><p>Source coordinates are evidence markers, not scaled measurements. No high-rise reconstruction is inferred from this test.</p></details>
    </aside></div>
  </section>;
}
