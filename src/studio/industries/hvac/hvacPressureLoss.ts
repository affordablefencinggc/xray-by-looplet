import { isFittingKind } from "./hvacFittings.ts";
import type { evaluateHvacNetwork } from "./hvacNetwork.ts";
import { HVAC_ESTIMATE_LABEL } from "./hvacPolicy.ts";

type CheckedNetwork = ReturnType<typeof evaluateHvacNetwork>;
type Run = CheckedNetwork["runs"][number];
const velocity = (run: Run) => {
  const flow = run.service === "pipe" ? run.pipeFlowLs : run.airflowLs;
  return flow == null || run.areaM2 === null ? null : flow / 1000 / run.areaM2;
};
const finiteLoss = (value: number | null, reasons: string[]) => {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER)) reasons.push("Pressure loss outside supported numeric range");
  return reasons.length ? null : value;
};

/**
 * Declared, steady incompressible-flow estimates. Darcy (NOT Fanning) f and K are
 * supplied by the estimator; no defaults, factor lookup, network balance or fan sizing.
 * DOE-HDBK-1012/3-92, HT-03 pp32/34, equations 3-14/15: multiply head loss by rho*g.
 * https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1012-92_VOL3.pdf
 * Rectangular hydraulic diameter = 4A/wetted perimeter = 2wh/(w+h).
 */
export function calculateHvacPressureLoss(checked: CheckedNetwork) {
  const { network, runs, issues } = checked;
  const duplicates = issues.some(issue => issue.code === "duplicate-id");
  const invalidRun = (run: Run) => duplicates || issues.some(issue =>
    (["missing-node", "zero-length", "service"].includes(issue.code) && [run.id, run.from, run.to].includes(issue.target)) ||
    (["fitting", "transition"].includes(issue.code) && [run.from, run.to].includes(issue.target)));
  const straight = runs.map(run => {
    const reasons: string[] = [];
    const velocityMs = velocity(run), densityKgM3 = run.fluidDensityKgM3 ?? null, factor = run.darcyFrictionFactor ?? null;
    const hydraulicDiameterM = run.service === "pipe" ? run.innerDiameterM ?? null : run.shape === "round" ? run.widthM : 2 * run.widthM * run.heightM / (run.widthM + run.heightM);
    if (invalidRun(run) || run.straightLengthM === null) reasons.push("Run geometry or fluid connection needs review");
    if (velocityMs === null) reasons.push("Flow or inside diameter missing");
    if (densityKgM3 === null) reasons.push("Fluid density missing");
    if (factor === null) reasons.push("Darcy friction factor missing");
    if (!run.pressureSourceReference) reasons.push("Pressure input source reference missing");
    const calculated = reasons.length || hydraulicDiameterM === null ? null : factor! * run.straightLengthM! / hydraulicDiameterM * densityKgM3! * velocityMs! ** 2 / 2;
    const lossPa = finiteLoss(calculated, reasons);
    return { id: run.id, service: run.service ?? "duct", straightLengthM: run.straightLengthM, hydraulicDiameterM, velocityMs, densityKgM3,
      darcyFrictionFactor: factor, reference: run.pressureSourceReference ?? "", lossPa, reasons };
  });
  const fittings = network.nodes.filter(node => isFittingKind(node.kind) || ["junction", "damper", "valve"].includes(node.kind)).flatMap(node => {
    // An unscheduled fitting remains visible as unknown, never silently zero loss.
    const paths = node.lossPaths?.length ? node.lossPaths : [{ inletEdgeId: "", outletEdgeId: "", velocityEdgeId: "", coefficientK: null, reference: "" }];
    return paths.map((path, index) => {
      const reasons: string[] = [];
      const inlet = runs.find(run => run.id === path.inletEdgeId), outlet = runs.find(run => run.id === path.outletEdgeId), basis = runs.find(run => run.id === path.velocityEdgeId);
      const connected = inlet && outlet && inlet.id !== outlet.id && inlet.to === node.id && outlet.from === node.id &&
        (inlet.service ?? "duct") === (outlet.service ?? "duct") && [inlet.id, outlet.id].includes(path.velocityEdgeId);
      if (!connected) reasons.push("Select an incoming and outgoing run and a velocity basis on that path");
      if (duplicates || (inlet && invalidRun(inlet)) || (outlet && invalidRun(outlet))) reasons.push("Fitting geometry or fluid connection needs review");
      if (paths.some((other, i) => i !== index && other.inletEdgeId === path.inletEdgeId && other.outletEdgeId === path.outletEdgeId)) reasons.push("Duplicate fitting flow path");
      const velocityMs = basis ? velocity(basis) : null, densityKgM3 = basis?.fluidDensityKgM3 ?? null;
      if (velocityMs === null) reasons.push("Reference flow or inside diameter missing");
      if (densityKgM3 === null || !basis?.pressureSourceReference) reasons.push("Referenced fluid density and source required");
      if (path.coefficientK === null) reasons.push("Fitting loss coefficient K missing");
      if (!path.reference) reasons.push("Fitting coefficient source reference missing");
      const calculated = reasons.length ? null : path.coefficientK! * densityKgM3! * velocityMs! ** 2 / 2;
      const lossPa = finiteLoss(calculated, reasons);
      return { nodeId: node.id, kind: node.kind, ...path, velocityMs, densityKgM3, lossPa, reasons };
    });
  });
  return { estimateLabel: HVAC_ESTIMATE_LABEL, method: "declared-darcy-and-k-v1" as const, straight, fittings,
    limits: "Per-run and per-path estimates only. No sum across branches, network balancing, fan/pump selection, static-pressure regain or compressible-flow assessment. Entered Pa/m allowances remain separate." };
}
