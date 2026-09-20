import { useRef, useState } from "react";
import { hvacNetworkSchema, isPipeNode, type HvacNetwork } from "./hvacNetwork.ts";
import { isFittingKind } from "./hvacFittings.ts";
import { HVACNetworkViewer } from "./HVACNetworkViewer.tsx";
import { calculateHvacSchedules, createHvacPackage, hvacPackageCsv, hvacPackagePdf, type HvacPackage } from "./hvacSchedules.ts";
import type { IndustrySourceBinding } from "../sourceBinding.ts";

const example: HvacNetwork = { reference: "SAMPLE - replace with your drawing reference", evidence: "sample", occupancy: "residential", nodes: [
  { id: "AHU-1", zone: "Plant", kind: "equipment", equipmentTag: "AHU-1", x: 0, y: 2.8, z: 0, designAirflowLs: 900 },
  { id: "J-1", zone: "East", kind: "junction", equipmentTag: "", x: 4, y: 2.8, z: 0, designAirflowLs: null },
  { id: "GR-1", zone: "West", kind: "diffuser", equipmentTag: "GR-1", x: 4, y: 2.8, z: 3, designAirflowLs: 450 }],
  edges: [{ id: "S-1", from: "AHU-1", to: "J-1", shape: "rectangular", widthM: .4, heightM: .3, insulationM: .025, availablePlenumM: .32, airflowLs: 900, pressureAllowancePaPerM: null },
    { id: "S-2", from: "J-1", to: "GR-1", shape: "rectangular", widthM: .2, heightM: .2, insulationM: .025, availablePlenumM: .4, airflowLs: 450, pressureAllowancePaPerM: 1.2 }],
  beams: [{ id: "B-1", min: [1.5, 2.65, -.5], max: [2, 3.1, .5] }] };

export function HvacCoordinationPanel({ text, onChange, disabled, stale, projectId, binding }: { text: string; onChange: (text: string) => void; disabled: boolean; stale: boolean; projectId: string; binding: IndustrySourceBinding | null }) {
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ key: string; result: ReturnType<typeof calculateHvacSchedules> } | null>(null);
  const [pack, setPack] = useState<{ key: string; value: HvacPackage; csv: string; pdf: Uint8Array } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify([text, binding, stale, projectId]); const current = useRef(key); current.current = key;
  let network: HvacNetwork | null = null;
  try { const parsed = hvacNetworkSchema.safeParse(JSON.parse(text)); if (parsed.success) network = parsed.data; } catch { /* incomplete saved draft */ }
  const result = review?.key === key && !stale ? review.result : null;
  const available = pack?.key === key && !stale ? pack : null;
  const update = (next: HvacNetwork) => { setError(""); onChange(JSON.stringify(next, null, 2)); };
  const edit = (collection: "nodes" | "edges", index: number, field: string, value: unknown) => {
    if (!network) return false;
    const next = structuredClone(network); Object.assign(next[collection][index], { [field]: value });
    if (collection === "edges" && field === "service") { const edge = next.edges[index]; edge.airflowLs = null; edge.pipeFlowLs = null; edge.innerDiameterM = null; if (value === "pipe") edge.shape = "round"; }
    const checked = hvacNetworkSchema.safeParse(next);
    if (!checked.success) { setError(`${field}: ${checked.error.issues[0].message}`); return false; }
    update(checked.data); return true;
  };
  const numeric = (collection: "nodes" | "edges", index: number, field: string, label: string, value: number | null) => <label key={field}>{label}<input aria-label={`${collection} ${index + 1} ${label}`} inputMode="decimal" key={`${field}:${value}`} defaultValue={value ?? ""} onBlur={event => {
    const raw = event.target.value.trim(); if (!raw && value === null) return;
    const n = raw ? Number(raw) : null;
    if (n !== null && !Number.isFinite(n)) { setError(`${label}: enter a finite number.`); event.target.value = String(value ?? ""); return; }
    if (!edit(collection, index, field, n)) event.target.value = String(value ?? "");
  }} /></label>;
  const download = (name: string, content: BlobPart, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section className="hvac-coordination" aria-label="HVAC network coordination">
    <h3>Network and commissioning</h3>
    <p className="industry-note">Connect equipment and terminals across zones. Coordinates and sizes use metres; separate air and pipe flows use L/s. Pipe outside diameter controls clearance; inside diameter controls velocity. Checks remain a draft for professional review.</p>
    <fieldset disabled={disabled || busy}>
      <legend>Network schedule</legend>
      {!text && <button type="button" onClick={() => update(structuredClone(example))}>Start with labelled sample network</button>}
      <details open={!network && !!text}><summary>Import or edit network schedule</summary><label>Network JSON<textarea aria-label="Network JSON" value={text} onChange={e => onChange(e.target.value)} /></label><p className="industry-note">Portable schedule containing nodes, runs and beam bounds. Invalid or incomplete text is saved, but cannot be calculated or exported.</p></details>
      {network && <>
        <div className="industry-fields"><label>Network source reference<input key={network.reference} defaultValue={network.reference} onBlur={e => { const reference = e.target.value.trim(); if (!reference || reference.length > 120) { setError("Source reference must contain 1 to 120 characters."); e.target.value = network!.reference; } else update({ ...network!, reference }); }} /></label>
          <label>Network evidence<select value={network.evidence} onChange={e => update({ ...network!, evidence: e.target.value as HvacNetwork["evidence"] })}><option value="sample">Sample - not project data</option><option value="declared">Declared inputs - unverified</option></select></label>
          <label>Occupancy threshold<select value={network.occupancy} onChange={e => update({ ...network!, occupancy: e.target.value as HvacNetwork["occupancy"] })}><option value="residential">Residential: 6 m/s</option><option value="commercial">Commercial: 8 m/s</option></select></label></div>
        <p className="industry-note">Thresholds are project review criteria, not an assessment of applicable codes. Round runs use width as diameter. Changing service clears its flow and inside-diameter inputs.</p>
        <details><summary>Equipment and terminals ({network.nodes.length})</summary>{network.nodes.map((node, i) => <fieldset key={i}><legend>{node.id} · {node.zone}</legend><div className="industry-fields">
          {(["id", "zone", "equipmentTag"] as const).map(field => <label key={field}>{field}<input aria-label={`nodes ${i + 1} ${field}`} key={node[field]} defaultValue={node[field]} onBlur={e => { if (!edit("nodes", i, field, e.target.value)) e.target.value = node[field]; }} /></label>)}
          <label>Node type<select aria-label={`Node ${i + 1} type`} value={node.kind} onChange={e => edit("nodes", i, "kind", e.target.value)}>{["equipment", "junction", "reducer", "elbow", "tee", "damper", "diffuser", "pump", "valve", "pipe-terminal"].map(kind => <option key={kind}>{kind}</option>)}</select></label>
          {isFittingKind(node.kind) && <>
            <label>Fitting source reference<input aria-label={`Node ${i + 1} fitting reference`} key={node.fitting?.reference ?? ""} defaultValue={node.fitting?.reference ?? ""} onBlur={e => { const fitting = { radiusM: null, lengthM: null, ...node.fitting, reference: e.target.value }; if (!edit("nodes", i, "fitting", fitting)) e.target.value = node.fitting?.reference ?? ""; }} /></label>
            <label>{node.kind === "elbow" ? "Bend radius (m)" : node.kind === "tee" ? "Centre to port (m)" : "Total reducer length (m)"}<input aria-label={`Node ${i + 1} fitting dimension`} inputMode="decimal" key={String(node.kind === "elbow" ? node.fitting?.radiusM : node.fitting?.lengthM)} defaultValue={(node.kind === "elbow" ? node.fitting?.radiusM : node.fitting?.lengthM) ?? ""} onBlur={e => { const raw = e.target.value.trim(); const field = node.kind === "elbow" ? "radiusM" : "lengthM"; const fitting = { reference: "", radiusM: null, lengthM: null, ...node.fitting, [field]: raw ? Number(raw) : null }; if (!edit("nodes", i, "fitting", fitting)) e.target.value = String(node.fitting?.[field] ?? ""); }} /></label>
          </>}
          {numeric("nodes", i, "x", "X (m)", node.x)}{numeric("nodes", i, "y", "Elevation (m)", node.y)}{numeric("nodes", i, "z", "Z (m)", node.z)}{isPipeNode(node.kind) ? numeric("nodes", i, "designPipeFlowLs", "Design pipe flow (L/s)", node.designPipeFlowLs ?? null) : numeric("nodes", i, "designAirflowLs", "Design airflow (L/s)", node.designAirflowLs)}
        </div><button type="button" disabled={network.nodes.length <= 1} onClick={() => update({ ...network!, nodes: network!.nodes.filter((_, j) => i !== j) })}>Remove node {node.id}</button></fieldset>)}
          <button type="button" disabled={network.nodes.length >= 100} onClick={() => update({ ...network!, nodes: [...network!.nodes, { id: `node-${crypto.randomUUID().slice(0, 8)}`, zone: "Unassigned", kind: "diffuser", x: 0, y: 0, z: 0, designAirflowLs: null, equipmentTag: "" }] })}>Add terminal</button>
        </details>
        <details><summary>Duct and pipe runs ({network.edges.length})</summary>{network.edges.map((edge, i) => <fieldset key={i}><legend>{edge.id}</legend><div className="industry-fields">
          {(["from", "to"] as const).map(field => <label key={field}>{field}<select aria-label={`Run ${i + 1} ${field}`} value={edge[field]} onChange={e => edit("edges", i, field, e.target.value)}>{!network!.nodes.some(node => node.id === edge[field]) && <option value={edge[field]}>Missing: {edge[field]}</option>}{network!.nodes.map((node, j) => <option key={j}>{node.id}</option>)}</select></label>)}
          <label>Service<select aria-label={`Run ${i + 1} service`} value={edge.service ?? "duct"} onChange={e => edit("edges", i, "service", e.target.value)}><option value="duct">Air duct</option><option value="pipe">Pipe</option></select></label>
          <label>Shape<select disabled={edge.service === "pipe"} aria-label={`Run ${i + 1} shape`} value={edge.shape} onChange={e => edit("edges", i, "shape", e.target.value)}><option value="rectangular">Rectangular</option><option value="round">Round</option></select></label>
          {numeric("edges", i, "widthM", "Width or diameter (m)", edge.widthM)}{edge.shape === "rectangular" && numeric("edges", i, "heightM", "Height (m)", edge.heightM)}{numeric("edges", i, "insulationM", "Insulation (m)", edge.insulationM)}{numeric("edges", i, "availablePlenumM", "Ceiling void (m)", edge.availablePlenumM)}{edge.service === "pipe" ? <>{numeric("edges", i, "innerDiameterM", "Inside diameter (m)", edge.innerDiameterM ?? null)}{numeric("edges", i, "pipeFlowLs", "Pipe flow (L/s)", edge.pipeFlowLs ?? null)}</> : numeric("edges", i, "airflowLs", "Airflow (L/s)", edge.airflowLs)}{numeric("edges", i, "pressureAllowancePaPerM", "Entered pressure allowance (Pa/m)", edge.pressureAllowancePaPerM)}
        </div><button type="button" disabled={network.edges.length <= 1} onClick={() => update({ ...network!, edges: network!.edges.filter((_, j) => i !== j) })}>Remove run {edge.id}</button></fieldset>)}
          <button type="button" disabled={network.edges.length >= 200 || network.nodes.length < 2} onClick={() => update({ ...network!, evidence: "sample", edges: [...network!.edges, { ...example.edges[0], id: `run-${crypto.randomUUID().slice(0, 8)}`, from: network!.nodes[0].id, to: network!.nodes[1].id, airflowLs: null, availablePlenumM: null }] })}>Add sample run</button>
        </details>
      </>}
      <div className="industry-actions"><button type="button" disabled={!text || stale} onClick={() => { try { setReview({ key, result: calculateHvacSchedules(JSON.parse(text)) }); setError(""); } catch (e) { setReview(null); setError(e instanceof Error ? e.message : "Invalid network schedule"); } }}>Review network and schedules</button>
        <button type="button" disabled={!result} onClick={async () => { setBusy(true); setError(""); try { const value = await createHvacPackage(JSON.parse(text), projectId, binding); const [csv, pdf] = await Promise.all([hvacPackageCsv(value), hvacPackagePdf(value)]); if (current.current === key) setPack({ key, value, csv, pdf }); } catch (e) { setError(e instanceof Error ? e.message : "Package generation failed"); } finally { setBusy(false); } }}>Prepare sealed draft package</button></div>
    </fieldset>
    {stale && <p role="alert">Network results withheld: the worksheet source binding is stale. Rebind or clear the binding before reviewing again.</p>}
    {error && <p role="alert" className="industry-error">{error}</p>}
    {result && <section aria-label="HVAC coordination result" className="industry-result">
      <p><strong>{result.network.evidence === "sample" ? "Sample network" : "Declared network"} · unverified · not eligible for a verified quote</strong></p>
      <HVACNetworkViewer fittings={result.fittings} beams={result.network.beams} runs={result.runs.flatMap(run => run.start && run.end ? [{ id: run.id, a: run.start, b: run.end, width: run.widthM, height: run.shape === "round" ? run.widthM : run.heightM, round: run.shape === "round", service: run.service, insulation: run.insulationM, clash: result.issues.some(i => i.target === run.id && (i.code === "beam" || i.code === "plenum")) }] : [])} />
      {result.fittings.length > 0 && <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Fitting schedule, scroll horizontally"><table><caption>Declared coordination fittings</caption><thead><tr><th>Node</th><th>Type</th><th>Service</th><th>Source</th><th>Ports</th><th>Clearance</th></tr></thead><tbody>{result.fittings.map((f, i) => <tr key={i}><th>{f.id}</th><td>{f.kind}</td><td>{f.service}</td><td>{f.reference}</td><td>{f.ports.length}</td><td>{f.clash ? "Review potential clash" : "No bounded clash detected"}</td></tr>)}</tbody></table><p className="industry-note">Fitting preview uses declared dimensions and conservative clearance bounds. No fabrication, fitting mass or pressure-loss allowance is derived. Straight lengths stop at fitting ports.</p></div>}
      <h4>Network review · {result.issues.length} issues</h4><ul className="hvac-issues">{result.issues.map((issue, i) => <li key={i}><strong>{issue.target}: {issue.code}</strong> — {issue.message}</li>)}</ul>
      {!result.issues.length && <p>No issues detected by the bounded network checks.</p>}
      <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Airflow schedule, scroll horizontally"><table><caption>Airflow and entered pressure allowances</caption><thead><tr><th>Run</th><th>Velocity (m/s)</th><th>Review</th><th>Allowance (Pa)</th></tr></thead><tbody>{result.airflow.map((row, i) => <tr key={i}><th>{row.id}</th><td>{row.velocityMs?.toFixed(3) ?? "unknown"}</td><td>{row.velocityStatus}</td><td>{row.pressureAllowancePa?.toFixed(2) ?? "unknown"}</td></tr>)}</tbody></table></div>
      {result.pipeFlow.length > 0 && <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Pipe flow schedule, scroll horizontally"><table><caption>Pipe flow and entered pressure allowances</caption><thead><tr><th>Run</th><th>Outside / inside diameter (m)</th><th>Pipe flow (L/s)</th><th>Velocity (m/s)</th><th>Allowance (Pa)</th></tr></thead><tbody>{result.pipeFlow.map((row, i) => <tr key={i}><th>{row.id}</th><td>{row.outsideDiameterM} / {row.insideDiameterM ?? "unknown"}</td><td>{row.flowLs ?? "unknown"}</td><td>{row.velocityMs?.toFixed(3) ?? "unknown"}</td><td>{row.pressureAllowancePa?.toFixed(2) ?? "unknown"}</td></tr>)}</tbody></table><p className="industry-note">Pipe velocity uses declared inside diameter. No pipe design limit, friction or fitting loss is assessed. Air-duct noise thresholds do not apply.</p></div>}
      <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Equipment commissioning schedule, scroll horizontally"><table><caption>Equipment and commissioning · ±10% design range</caption><thead><tr><th>Equipment / terminal</th><th>Zone</th><th>Service</th><th>Design (L/s)</th><th>Test range (L/s)</th><th>Measured</th></tr></thead><tbody>{result.commissioning.map((row, i) => <tr key={i}><th>{row.id} {row.tag}</th><td>{row.zone}</td><td>{row.service}</td><td>{row.designLs ?? "unknown"}</td><td>{row.minimumLs === null ? "unknown" : `${row.minimumLs.toFixed(2)} – ${row.maximumLs!.toFixed(2)}`}</td><td>Not tested</td></tr>)}</tbody></table></div>
    </section>}
    {available && <section aria-label="Sealed HVAC draft package" className="industry-result"><p>Draft package prepared. The seal identifies content; it does not certify the design or commissioning.</p><p className="hvac-seal">SHA-256: {available.value.delivery.contentSha256}</p><div className="industry-actions">
      <button type="button" onClick={() => download("hvac-commissioning-draft.pdf", Uint8Array.from(available.pdf), "application/pdf")}>Download HVAC PDF</button>
      <button type="button" onClick={() => download("hvac-commissioning-draft.csv", available.csv, "text/csv;charset=utf-8")}>Download HVAC CSV</button>
      <button type="button" onClick={() => download("hvac-commissioning-draft.json", JSON.stringify(available.value, null, 2), "application/json")}>Download sealed HVAC JSON</button></div></section>}
  </section>;
}
