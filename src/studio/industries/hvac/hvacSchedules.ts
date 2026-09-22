import { isFittingKind } from "./hvacFittings.ts";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { advanceDelivery, deliveryRecordSchema, DELIVERY_RECORD_SCHEMA, type DeliveryRecord } from "../deliveryRecord.ts";
import { evaluateHvacNetwork, hvacNetworkSchema, isPipeNode } from "./hvacNetwork.ts";
import type { IndustrySourceBinding } from "../sourceBinding.ts";

export function calculateHvacSchedules(input: unknown) {
  const checked = evaluateHvacNetwork(input);
  const limitMs = checked.network.occupancy === "residential" ? 6 : 8;
  const allowance = (run: typeof checked.runs[number]) => run.lengthM === null || run.pressureAllowancePaPerM === null ? null : run.lengthM * run.pressureAllowancePaPerM;
  return { ...checked, limitMs,
    airflow: checked.runs.filter(run => run.service !== "pipe").map(run => {
      const velocityMs = run.airflowLs === null || run.areaM2 === null ? null : run.airflowLs / 1000 / run.areaM2;
      return { id: run.id, velocityMs, velocityStatus: velocityMs === null ? "unknown" : velocityMs > limitMs ? "review-noise" : "within-project-threshold", pressureAllowancePa: allowance(run) };
    }),
    pipeFlow: checked.runs.filter(run => run.service === "pipe").map(run => ({ id: run.id, outsideDiameterM: run.widthM, insideDiameterM: run.innerDiameterM ?? null,
      flowLs: run.pipeFlowLs ?? null, velocityMs: run.pipeFlowLs == null || run.areaM2 === null ? null : run.pipeFlowLs / 1000 / run.areaM2,
      status: "no-pipe-design-limit" as const, pressureAllowancePa: allowance(run) })),
    commissioning: checked.network.nodes.filter(n => n.kind !== "junction" && !isFittingKind(n.kind)).map(n => {
      const service = isPipeNode(n.kind) ? "pipe" : "duct";
      const designLs = service === "pipe" ? n.designPipeFlowLs ?? null : n.designAirflowLs;
      const minimumLs = designLs === null ? null : designLs * .9;
      const maximumLs = designLs === null ? null : designLs * 1.1;
      const measuredLs = n.measuredLs ?? null;
      const tolerance = 1e-6;
      const status = measuredLs === null ? "not-tested" as const
        : designLs === null || minimumLs === null || maximumLs === null ? "unknown" as const
        : measuredLs >= minimumLs - tolerance && measuredLs <= maximumLs + tolerance ? "within-tolerance" as const : "outside-tolerance" as const;
      return { id: n.id, zone: n.zone, kind: n.kind, tag: n.equipmentTag, service, designLs, minimumLs, maximumLs, measuredLs, status };
    }),
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
async function digest(text: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2, "0")).join(""); }
export async function createHvacPackage(input: unknown, projectId: string, binding: IndustrySourceBinding | null, createdAt = new Date().toISOString()) {
  const network = hvacNetworkSchema.parse(input);
  const content = { format: "xray.hvac-draft-package/v1" as const, projectId, sourceBinding: binding, network, schedules: calculateHvacSchedules(network) };
  const contentSha256 = await digest(canonical(content));
  const delivery = deliveryRecordSchema.parse({ format: DELIVERY_RECORD_SCHEMA, id: `hvac-${contentSha256.slice(0, 16)}`, kind: "hvac-commissioning", projectId,
    state: "draft-export", revision: 1, createdAt, sourceBinding: binding, contentSha256 });
  return { content, delivery };
}
export type HvacPackage = Awaited<ReturnType<typeof createHvacPackage>>;
export async function verifyHvacPackage(value: HvacPackage) {
  const delivery: DeliveryRecord = deliveryRecordSchema.parse(value.delivery);
  if (delivery.kind !== "hvac-commissioning" || value.content.format !== "xray.hvac-draft-package/v1" || delivery.projectId !== value.content.projectId || canonical(delivery.sourceBinding) !== canonical(value.content.sourceBinding)) throw Error("HVAC package delivery metadata does not match its content.");
  if (canonical(calculateHvacSchedules(value.content.network)) !== canonical(value.content.schedules)) throw Error("HVAC schedule no longer matches its inputs.");
  if (await digest(canonical(value.content)) !== delivery.contentSha256) throw Error("HVAC package SHA-256 mismatch.");
  return { ...value, delivery };
}
async function advanceHvacPackage(value: HvacPackage, nextState: DeliveryRecord["state"], options: { reviewedAt?: string; issuedAt?: string } = {}) {
  const checked = await verifyHvacPackage(value);
  return verifyHvacPackage({ ...checked, delivery: advanceDelivery(checked.delivery, nextState, options) });
}
export function saveHvacDraft(value: HvacPackage) {
  return advanceHvacPackage(value, "saved-draft");
}
export function reviewHvacPackage(value: HvacPackage, reviewedAt: string) {
  return advanceHvacPackage(value, "reviewed-estimate", { reviewedAt });
}
export function issueHvacPackage(value: HvacPackage, issuedAt: string) {
  return advanceHvacPackage(value, "issued-deliverable", { issuedAt });
}
const csvCell = (v: unknown) => { const s = v === null ? "unknown" : String(v); return `"${/^[\s]*[=+\-@]/.test(s) ? "'" : ""}${s.replaceAll('"', '""')}"`; };
export async function hvacPackageCsv(value: HvacPackage) {
  await verifyHvacPackage(value);
  const { schedules: s } = value.content;
  const rows: unknown[][] = [[value.delivery.state === "issued-deliverable" ? "HVAC issue - frozen declared record; not an independent commissioning certificate" : value.delivery.state === "reviewed-estimate" ? "HVAC review - frozen declared record; not an independent commissioning certificate" : "HVAC draft - unverified; not a commissioning certificate", value.delivery.contentSha256], ["Reference", s.network.reference], ["Evidence", s.network.evidence],
    ["Node", "Zone", "Kind", "Equipment tag", "Service", "Design L/s", "Minimum L/s (-10%)", "Maximum L/s (+10%)", "Measured L/s", "Status"],
    ...s.commissioning.map(n => [n.id, n.zone, n.kind, n.tag, n.service, n.designLs, n.minimumLs, n.maximumLs, n.measuredLs, n.status]),
    [], ["Run", "Velocity m/s", "Check", "Entered pressure allowance Pa"], ...s.airflow.map(r => [r.id, r.velocityMs, r.velocityStatus, r.pressureAllowancePa]),
    [], ["Pipe run", "Outside diameter m", "Inside diameter m", "Pipe flow L/s", "Velocity m/s", "Check", "Entered pressure allowance Pa"], ...s.pipeFlow.map(r => [r.id, r.outsideDiameterM, r.insideDiameterM, r.flowLs, r.velocityMs, r.status, r.pressureAllowancePa]),
    [], ["Fitting node", "Type", "Service", "Source reference", "Ports", "Conservative clearance"], ...s.fittings.map(f => [f.id, f.kind, f.service, f.reference, f.ports.length, f.clash ? "review-potential-clash" : "no-bounded-clash"]),
    [], ["Network issue", "Target", "Message"], ...s.issues.map(i => [i.code, i.target, i.message]),
    [], ["Network inputs (metres; flow L/s)", canonical(s.network)], ["Delivery metadata", canonical(value.delivery)]];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
export async function hvacPackagePdf(value: HvacPackage) {
  await verifyHvacPackage(value);
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]), y = 796;
  const line = (text: string) => {
    // Built-in font has no arbitrary Unicode glyphs. JSON attachment retains original text.
    const printable = text.replace(/[^\x20-\x7e]/g, "?");
    for (let i = 0; i < Math.max(1, printable.length); i += 88) { if (y < 48) { page = pdf.addPage([595, 842]); y = 796; } page.drawText(printable.slice(i, i + 88), { x: 36, y, size: 10, font }); y -= 16; }
  };
  const s = value.content.schedules;
  const issued = value.delivery.state === "issued-deliverable";
  const reviewed = value.delivery.state === "reviewed-estimate";
  const measured = s.commissioning.some(row => row.measuredLs !== null);
  line(issued ? "HVAC equipment and commissioning issue" : reviewed ? "HVAC equipment and commissioning review" : "HVAC equipment and commissioning draft");
  line(measured ? "Declared measurements are compared with the +/-10% design range. This record does not certify independent commissioning." : "UNVERIFIED - no measured results, certification or verified quote eligibility.");
  line(`Project: ${value.content.projectId} | Source: ${s.network.reference} | ${s.network.evidence}`);
  line(`SHA-256: ${value.delivery.contentSha256}`); line("Integrity seal identifies content, not engineering approval."); line("");
  line("Equipment / terminal schedule: design L/s; allowable test range +/-10%");
  for (const n of s.commissioning) line(`${n.id} | ${n.zone} | ${n.kind} ${n.tag} | ${n.service} | ${n.designLs ?? "unknown"} | ${n.minimumLs?.toFixed(2) ?? "unknown"} to ${n.maximumLs?.toFixed(2) ?? "unknown"} | ${n.measuredLs ?? "unknown"} | ${n.status}`);
  line(""); line(`Airflow review (project threshold ${s.limitMs} m/s; not a code assessment)`);
  for (const r of s.airflow) line(`${r.id} | ${r.velocityMs?.toFixed(3) ?? "unknown"} m/s | ${r.velocityStatus} | Pressure allowance ${r.pressureAllowancePa?.toFixed(2) ?? "unknown"} Pa`);
  if (s.pipeFlow.length) { line(""); line("Pipe flow - inside diameter used for velocity; no design limit assessed"); for (const r of s.pipeFlow) line(`${r.id} | OD ${r.outsideDiameterM} m | ID ${r.insideDiameterM ?? "unknown"} m | ${r.flowLs ?? "unknown"} L/s | ${r.velocityMs?.toFixed(3) ?? "unknown"} m/s | Allowance ${r.pressureAllowancePa?.toFixed(2) ?? "unknown"} Pa`); }
  if (s.fittings.length) { line(""); line("Declared coordination fittings - conservative clearance; no fabrication quantities"); for (const f of s.fittings) line(`${f.id} | ${f.kind} | ${f.service} | ${f.reference} | ${f.ports.length} ports | ${f.clash ? "REVIEW POTENTIAL CLASH" : "no bounded clash"}`); }
  line("Pressure allowance uses the entered Pa/m only; no friction or fitting solver."); line(""); line("Network review");
  if (!s.issues.length) line("No issues detected by these bounded checks. Professional review still required.");
  for (const i of s.issues) line(`${i.target}: ${i.code} - ${i.message}`);
  line("Beam checks use conservative envelopes. Full source schedule is attached as JSON.");
  await pdf.attach(new TextEncoder().encode(JSON.stringify(value, null, 2)), "hvac-draft-package.json", { mimeType: "application/json", description: "Original inputs, schedules, provenance and SHA-256 delivery record" });
  return pdf.save();
}
