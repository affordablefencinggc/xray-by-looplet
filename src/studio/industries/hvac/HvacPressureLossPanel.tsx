import type { HvacNetwork } from "./hvacNetwork.ts";
import type { calculateHvacPressureLoss } from "./hvacPressureLoss.ts";
import { HVAC_ESTIMATE_LABEL } from "./hvacPolicy.ts";

type LossPath = NonNullable<HvacNetwork["nodes"][number]["lossPaths"]>[number];
export function HvacPressureInputs({ network, edit }: { network: HvacNetwork; edit: (collection: "nodes" | "edges", index: number, field: string, value: unknown) => boolean }) {
  const numberInput = (label: string, value: number | null, save: (value: number | null) => boolean) => <label>{label}<input aria-label={label} inputMode="decimal" key={String(value)} defaultValue={value ?? ""} onBlur={e => {
    const raw = e.target.value.trim(); if (!save(raw ? Number(raw) : null)) e.target.value = String(value ?? "");
  }} /></label>;
  const pathEdit = (nodeIndex: number, pathIndex: number, patch: Partial<LossPath>) => edit("nodes", nodeIndex, "lossPaths", network.nodes[nodeIndex].lossPaths!.map((path, i) => i === pathIndex ? { ...path, ...patch } : path));
  return <details><summary>Pressure loss inputs</summary>
    <p className="industry-note">{HVAC_ESTIMATE_LABEL}. Supply fluid density and the Darcy friction factor from your design basis. A Fanning factor is different. No fluid properties or fitting coefficients are assumed.</p>
    {network.edges.map((run, i) => <fieldset key={i}><legend>{run.id} pressure basis</legend><div className="industry-fields">
      {numberInput(`${run.id} fluid density (kg/m³)`, run.fluidDensityKgM3 ?? null, value => edit("edges", i, "fluidDensityKgM3", value))}
      {numberInput(`${run.id} Darcy friction factor`, run.darcyFrictionFactor ?? null, value => edit("edges", i, "darcyFrictionFactor", value))}
      <label>Pressure source reference<input aria-label={`${run.id} pressure source reference`} maxLength={1000} key={run.pressureSourceReference ?? ""} defaultValue={run.pressureSourceReference ?? ""} onBlur={e => edit("edges", i, "pressureSourceReference", e.target.value)} /></label>
    </div></fieldset>)}
    <p className="industry-note">Fitting K applies to one directed flow path. Select its incoming run, outgoing run and the run whose velocity defines K. Tee branches require separate coefficients. Blank coefficients remain unknown.</p>
    {network.nodes.map((node, nodeIndex) => ["elbow", "tee", "reducer", "junction", "damper", "valve"].includes(node.kind) && <fieldset key={nodeIndex}><legend>{node.id} fitting losses</legend>
      {(node.lossPaths ?? []).map((path, pathIndex) => <fieldset key={pathIndex}><legend>Path {pathIndex + 1}</legend><div className="industry-fields">
        {(["inletEdgeId", "outletEdgeId", "velocityEdgeId"] as const).map(field => {
          const options = network.edges.filter(edge => field === "inletEdgeId" ? edge.to === node.id : field === "outletEdgeId" ? edge.from === node.id : [path.inletEdgeId, path.outletEdgeId].includes(edge.id));
          const label = field === "inletEdgeId" ? "Incoming run" : field === "outletEdgeId" ? "Outgoing run" : "Velocity basis run";
          return <label key={field}>{label}<select aria-label={`${node.id} path ${pathIndex + 1} ${label}`} value={path[field]} onChange={e => pathEdit(nodeIndex, pathIndex, { [field]: e.target.value })}>
            {!options.some(edge => edge.id === path[field]) && <option value={path[field]}>Choose a run</option>}{options.map(edge => <option key={edge.id}>{edge.id}</option>)}</select></label>;
        })}
        {numberInput(`${node.id} path ${pathIndex + 1} loss coefficient K`, path.coefficientK, value => pathEdit(nodeIndex, pathIndex, { coefficientK: value }))}
        <label>Coefficient source reference<input aria-label={`${node.id} path ${pathIndex + 1} coefficient source`} maxLength={1000} key={path.reference} defaultValue={path.reference} onBlur={e => pathEdit(nodeIndex, pathIndex, { reference: e.target.value })} /></label>
      </div><button type="button" onClick={() => edit("nodes", nodeIndex, "lossPaths", node.lossPaths!.filter((_, i) => i !== pathIndex))}>Remove {node.id} path {pathIndex + 1}</button></fieldset>)}
      <button type="button" disabled={(node.lossPaths?.length ?? 0) >= 20} onClick={() => {
        const incoming = network.edges.find(edge => edge.to === node.id)?.id ?? "unassigned", outgoing = network.edges.find(edge => edge.from === node.id)?.id ?? "unassigned";
        edit("nodes", nodeIndex, "lossPaths", [...(node.lossPaths ?? []), { inletEdgeId: incoming, outletEdgeId: outgoing, velocityEdgeId: incoming, coefficientK: null, reference: "" }]);
      }}>Add {node.id} loss path</button>
    </fieldset>)}
  </details>;
}

export function HvacPressureResults({ result }: { result: ReturnType<typeof calculateHvacPressureLoss> }) {
  return <section aria-label="Pressure loss estimates"><h4>Pressure loss · {HVAC_ESTIMATE_LABEL.toLowerCase()}</h4>
    <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Straight pressure losses, scroll horizontally"><table><caption>Straight runs · Δp = Darcy f × L/Dh × ρv²/2</caption>
      <thead><tr><th>Run</th><th>Trimmed length (m)</th><th>Hydraulic diameter (m)</th><th>Loss (Pa)</th><th>Source / missing inputs</th></tr></thead><tbody>{result.straight.map((r, i) => <tr key={i}><th>{r.id}</th><td>{r.straightLengthM?.toFixed(3) ?? "unknown"}</td><td>{r.hydraulicDiameterM?.toFixed(4) ?? "unknown"}</td><td>{r.lossPa?.toFixed(3) ?? "unknown"}</td><td>{r.reference}<br />{r.reasons.join("; ")}</td></tr>)}</tbody></table></div>
    {!!result.fittings.length && <div className="industry-table-wrap" role="region" tabIndex={0} aria-label="Fitting pressure losses, scroll horizontally"><table><caption>Fitting flow paths · Δp = K × ρv²/2</caption>
      <thead><tr><th>Fitting</th><th>Flow path</th><th>Velocity basis</th><th>K</th><th>Loss (Pa)</th><th>Source / missing inputs</th></tr></thead><tbody>{result.fittings.map((r, i) => <tr key={i}><th>{r.nodeId}</th><td>{r.inletEdgeId || "unknown"} → {r.outletEdgeId || "unknown"}</td><td>{r.velocityEdgeId || "unknown"}</td><td>{r.coefficientK ?? "unknown"}</td><td>{r.lossPa?.toFixed(3) ?? "unknown"}</td><td>{r.reference}<br />{r.reasons.join("; ")}</td></tr>)}</tbody></table></div>}
    <p className="industry-note">{result.limits}</p>
  </section>;
}
