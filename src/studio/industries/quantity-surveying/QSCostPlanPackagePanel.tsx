import { useEffect, useMemo, useRef, useState } from "react";
import { unzipSync } from "fflate";
import { z } from "zod";
import { DELIVERY_RECORD_SCHEMA, DELIVERY_STATES, describeDeliveryState, type DeliveryState } from "../deliveryRecord.ts";
import { quantityFormSchema, type QuantityForm } from "./quantityForm.ts";
import { createQsCostPlanPackage, exportQsCostPlanPackage, parseQsCostPlanPackage, qsPackageDigest, restoreQsCostPlanWorksheet,
  QS_PACKAGE_MAX_BYTES, type QsPackageInput, type QsVerifiedPackage } from "./qsPackageExport.ts";
import "./QSCostPlanPackagePanel.css";

export type QSCostPlanPackagePanelProps = {
  projectId: string;
  value: QuantityForm;
  disabled?: boolean;
  /** The host is the sole writer. False means the replacement was rejected. */
  onRestore: (value: QuantityForm) => boolean;
};
export type QsPackagePanelInputs = {
  title: string; reference: string; revisionLabel: string; preparedBy: string; recipient: string; purpose: string;
  transmittalCreatedAt: string; basisOfEstimate: string; assumptions: string; exclusions: string;
  deliveryId: string; deliveryState: DeliveryState | ""; createdAt: string; reviewedAt: string; issuedAt: string;
};
export const emptyQsPackagePanelInputs = (): QsPackagePanelInputs => ({ title: "", reference: "", revisionLabel: "", preparedBy: "",
  recipient: "", purpose: "", transmittalCreatedAt: "", basisOfEstimate: "", assumptions: "", exclusions: "",
  deliveryId: "", deliveryState: "", createdAt: "", reviewedAt: "", issuedAt: "" });
const parseWorksheet = (raw: unknown) => quantityFormSchema.parse(raw);
const errorText = (error: unknown) => error instanceof Error ? error.message : "The package operation failed. Existing worksheet and selected file are preserved.";
const noteLines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

/** Select the latest frozen revision and its exact predecessor. No new pricing,
 * current-time metadata or classification defaults are silently invented. */
export function qsPackageInputFromForm(projectId: string, raw: QuantityForm, inputs: QsPackagePanelInputs): QsPackageInput<QuantityForm> {
  const worksheet = parseWorksheet(raw), state = worksheet.pricing;
  if (!projectId || !state || state.projectId !== projectId) throw Error("A cost worksheet for the current project is required.");
  const current = state.snapshots.at(-1);
  if (!current) throw Error("Save a cost revision before preparing a package.");
  if (!inputs.deliveryState) throw Error("Choose the delivery state explicitly.");
  if (!DELIVERY_STATES.includes(inputs.deliveryState)) throw Error("Unsupported delivery state.");
  return { worksheet, current, previous: state.snapshots.at(-2) ?? null,
    transmittal: { title: inputs.title, reference: inputs.reference, revisionLabel: inputs.revisionLabel,
      preparedBy: inputs.preparedBy, recipient: inputs.recipient, purpose: inputs.purpose, createdAt: inputs.transmittalCreatedAt },
    basisOfEstimate: noteLines(inputs.basisOfEstimate), assumptions: noteLines(inputs.assumptions), exclusions: noteLines(inputs.exclusions),
    delivery: { format: DELIVERY_RECORD_SCHEMA, id: inputs.deliveryId.trim(), kind: "quantity-surveying", projectId,
      state: inputs.deliveryState, revision: current.input.revision, createdAt: inputs.createdAt,
      ...(inputs.reviewedAt ? { reviewedAt: inputs.reviewedAt } : {}), ...(inputs.issuedAt ? { issuedAt: inputs.issuedAt } : {}),
      sourceBinding: worksheet.binding ?? null, status: "active" } };
}
export async function prepareQsPackagePanelExport(projectId: string, form: QuantityForm, inputs: QsPackagePanelInputs) {
  const value = await createQsCostPlanPackage(qsPackageInputFromForm(projectId, form, inputs), parseWorksheet);
  return { value, artifacts: await exportQsCostPlanPackage(value, parseWorksheet) };
}

const manifestEntrySchema = z.object({ name: z.string(), sizeBytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const previewManifestSchema = z.object({ format: z.literal("xray.qs-package-manifest/v1"), contentSha256: z.string(),
  sealSha256: z.string(), entries: z.array(manifestEntrySchema) }).strict();
export type QsPackagePanelPreview = {
  value: QsVerifiedPackage<QuantityForm>; packageSha256: string; manifestSealSha256: string;
  entries: z.infer<typeof manifestEntrySchema>[];
};
export function assertQsPackageFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 22 || size > QS_PACKAGE_MAX_BYTES) throw Error("Choose a supported cost-plan ZIP no larger than 32 MiB.");
}
/** The package parser verifies quotas, every digest, and the regenerated visible
 * PDF/CSV before any manifest contents are trusted for display. */
export async function inspectQsPackagePanelImport(bytes: Uint8Array): Promise<QsPackagePanelPreview> {
  assertQsPackageFileSize(bytes.length);
  const captured = Uint8Array.from(bytes), value = await parseQsCostPlanPackage(captured, parseWorksheet);
  const files = unzipSync(captured), manifestBytes = files["manifest.json"];
  const manifest = previewManifestSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)));
  const entries = [...manifest.entries, { name: "manifest.json", sizeBytes: manifestBytes.length, sha256: await qsPackageDigest(manifestBytes) }];
  if (entries.length !== Object.keys(files).length) throw Error("The preview does not reconcile with the validated archive.");
  return { value, entries, manifestSealSha256: manifest.sealSha256, packageSha256: await qsPackageDigest(captured) };
}

export type QsPackageTaskScope = { projectId: string; form: QuantityForm; disabled: boolean; inputs: QsPackagePanelInputs };
/** Identity-sensitive cancellation, including A -> B -> A switches. Each new
 * operation supersedes earlier work, even when its promises cannot be aborted. */
export function createQsPackageTaskGate() {
  let scope: QsPackageTaskScope | null = null, generation = 0, active = true;
  return {
    sync(next: QsPackageTaskScope) { if (scope !== next) { scope = next; generation++; } },
    activate() { active = true; generation++; },
    dispose() { active = false; generation++; },
    begin() {
      if (!active || !scope || scope.disabled) throw Error("Package actions are unavailable while project/source/storage checks are pending.");
      const ticket = ++generation, captured = scope;
      return () => active && generation === ticket && scope === captured && !captured.disabled;
    },
  };
}

type Prepared = Awaited<ReturnType<typeof prepareQsPackagePanelExport>> & { scope: QsPackageTaskScope };
export type QsSelectedPackageImport = { id: object; file: File; bytes: Uint8Array | null; preview: QsPackagePanelPreview | null; error: string };
export function qsPackageImportFailure(existing: QsSelectedPackageImport | null, expectedId: object, cause: unknown): QsSelectedPackageImport | null {
  return existing?.id === expectedId ? { ...existing, preview: null, error: errorText(cause) } : existing;
}
/** The restore callback is synchronous and remains the host's persistence boundary. */
export async function restoreInspectedQsPackage(preview: QsPackagePanelPreview, projectId: string, confirmed: boolean,
  onRestore: (next: QuantityForm) => boolean, current: () => boolean): Promise<"accepted" | "cancelled"> {
  if (!confirmed) throw Error("Inspect and explicitly confirm the worksheet replacement before restoring.");
  if (!current()) return "cancelled";
  const next = await restoreQsCostPlanWorksheet(preview.value, projectId, parseWorksheet);
  if (!current()) return "cancelled";
  if (!onRestore(next)) throw Error("The host rejected the restore. The current worksheet and imported bytes are preserved.");
  return "accepted";
}
type DownloadKind = "package" | "pdf" | "csv";
const timestampHint = "ISO date/time with timezone, for example 2026-09-19T12:00:00Z";

export function QSCostPlanPackageManifest({ preview }: { preview: QsPackagePanelPreview }) {
  return <><h4>Integrity-checked manifest · {preview.entries.length} files</h4>
    <p className="qs-package-note">{preview.value.transmittal.title} · Project {preview.value.delivery.projectId} · Revision {preview.value.delivery.revision} · {describeDeliveryState(preview.value.delivery.state)}</p>
    <p className="qs-package-note">{preview.value.current.items.length} priced items · {preview.value.worksheet.nodes.length} classification nodes. Classification quantities remain draft; a matching hash is not source verification.</p>
    <dl className="qs-package-hashes"><div><dt>Package SHA-256</dt><dd><code>{preview.packageSha256}</code></dd></div><div><dt>Content SHA-256</dt><dd><code>{preview.value.delivery.contentSha256}</code></dd></div><div><dt>Manifest seal</dt><dd><code>{preview.manifestSealSha256}</code></dd></div></dl>
    <div className="qs-package-table-scroll" tabIndex={0} aria-label="Verified package file hashes"><table><caption>Exact imported files; no worksheet changes yet</caption><thead><tr><th scope="col">File</th><th scope="col">Bytes</th><th scope="col">SHA-256</th></tr></thead><tbody>{preview.entries.map(entry => <tr key={entry.name}><th scope="row">{entry.name}</th><td>{entry.sizeBytes.toLocaleString()}</td><td><code>{entry.sha256}</code></td></tr>)}</tbody></table></div>
  </>;
}

/** No persistence or project mutation occurs until the separate explicit restore
 * action calls the host. Reopening checks integrity, not professional adequacy. */
export function QSCostPlanPackagePanel({ projectId, value, disabled = false, onRestore }: QSCostPlanPackagePanelProps) {
  const [inputs, setInputs] = useState(emptyQsPackagePanelInputs);
  const [inputsProject, setInputsProject] = useState(projectId);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [selected, setSelected] = useState<QsSelectedPackageImport | null>(null);
  const [confirmed, setConfirmed] = useState<{ id: object; scope: QsPackageTaskScope } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scope = useMemo(() => ({ projectId, form: value, disabled: disabled || inputsProject !== projectId, inputs }), [projectId, value, disabled, inputsProject, inputs]);
  const [busy, setBusy] = useState<{ scope: QsPackageTaskScope; label: string } | null>(null);
  const gate = useRef(createQsPackageTaskGate()).current;
  gate.sync(scope);
  const currentRestore = useRef(onRestore); currentRestore.current = onRestore;
  useEffect(() => { gate.activate(); return () => gate.dispose(); }, [gate]);
  useEffect(() => {
    setInputs(emptyQsPackagePanelInputs()); setInputsProject(projectId); setPrepared(null); setConfirmed(null); setError(""); setNotice("");
    // Selected original file/bytes are intentionally retained, even across projects.
    // Its validated project identity still prevents restoring to another project.
  }, [projectId]);
  const working = busy?.scope === scope ? busy.label : "";
  const locked = scope.disabled || !!working;
  const ready = prepared?.scope === scope ? prepared : null;
  const latest = value.pricing?.projectId === projectId ? value.pricing.snapshots.at(-1) : undefined;
  const preview = selected?.preview ?? null;
  const sameProject = preview?.value.delivery.projectId === projectId;
  const restoreConfirmed = confirmed?.id === selected?.id && confirmed?.scope === scope;

  async function prepare() {
    let current: (() => boolean) | undefined;
    try {
      current = gate.begin(); setBusy({ scope, label: "Preparing sealed package…" }); setError(""); setNotice(""); setPrepared(null);
      const result = await prepareQsPackagePanelExport(projectId, value, inputs);
      if (!current()) return;
      setPrepared({ ...result, scope }); setNotice("Package prepared from the saved revision. Choose each download separately.");
    } catch (cause) { if (!current || current()) setError(errorText(cause)); }
    finally { if (current?.()) setBusy(null); }
  }
  async function download(kind: DownloadKind) {
    if (!ready || locked) return;
    let current: (() => boolean) | undefined;
    try {
      current = gate.begin(); setError("");
      const { saveDownload } = await import("../../architect/sheets.ts");
      if (!current()) return;
      const stem = `cost-plan-r${ready.value.delivery.revision}`;
      const payload = kind === "package" ? ready.artifacts.bytes : kind === "pdf" ? ready.artifacts.pdf : ready.artifacts.csv;
      saveDownload(payload, `${stem}.${kind === "package" ? "xray-qs.zip" : kind}`, kind === "package" ? "application/zip" : kind === "pdf" ? "application/pdf" : "text/csv;charset=utf-8");
      setNotice(`${kind === "package" ? "Package" : kind.toUpperCase()} offered to the browser download. Disk save and readback are not established until you reopen the file.`);
    } catch (cause) { if (!current || current()) setError(errorText(cause)); }
  }
  async function validateFile(file: File, retained?: QsSelectedPackageImport) {
    let current: (() => boolean) | undefined;
    const record: QsSelectedPackageImport = retained ?? { id: {}, file, bytes: null, preview: null, error: "" };
    try {
      current = gate.begin(); setBusy({ scope, label: "Checking package contents…" }); setError(""); setNotice(""); setConfirmed(null);
      setSelected({ ...record, preview: null, error: "" });
      assertQsPackageFileSize(file.size);
      const bytes = record.bytes ?? new Uint8Array(await file.arrayBuffer());
      if (!current()) return;
      setSelected({ ...record, bytes, preview: null, error: "" });
      const result = await inspectQsPackagePanelImport(bytes);
      if (!current()) return;
      setSelected({ ...record, bytes, preview: result, error: "" });
    } catch (cause) {
      if (!current || current()) setSelected(existing => qsPackageImportFailure(existing, record.id, cause));
    } finally { if (current?.()) setBusy(null); }
  }
  async function restore() {
    if (!preview || !sameProject || !restoreConfirmed || locked) return;
    let current: (() => boolean) | undefined;
    try {
      current = gate.begin(); setBusy({ scope, label: "Rechecking worksheet before restore…" }); setError(""); setNotice("");
      const outcome = await restoreInspectedQsPackage(preview, projectId, restoreConfirmed, next => currentRestore.current(next), current);
      if (outcome === "cancelled" || !current()) return;
      setConfirmed(null); setNotice("The restored worksheet was submitted to the project host. Check its save indicator; disk persistence is not established by package validation.");
    } catch (cause) { if (!current || current()) setError(errorText(cause)); }
    finally { if (current?.()) setBusy(null); }
  }
  const field = (key: keyof QsPackagePanelInputs, label: string, long = false, timestamp = false) => <label key={key}>{label}
    {long ? <textarea rows={3} value={inputs[key]} maxLength={400100} onChange={event => setInputs({ ...inputs, [key]: event.target.value })} />
      : <input value={inputs[key]} maxLength={timestamp ? 40 : 240} placeholder={timestamp ? timestampHint : undefined} onChange={event => setInputs({ ...inputs, [key]: event.target.value })} />}</label>;

  return <section className="qs-package-panel" aria-label="Cost plan package" aria-busy={!!working}>
    <header><h3>Cost plan package</h3><span>Draft quantities remain draft</span></header>
    <p className="qs-package-note">Sealed files preserve a saved cost revision, classifications and source references. Integrity checks do not certify quantities, classify estimates as verified, or issue anything to a recipient.</p>
    <p className="qs-package-note">{latest ? `Latest saved cost revision: ${latest.input.revision}. Previous revision: ${value.pricing!.snapshots.at(-2)?.input.revision ?? "none (initial revision)"}.` : "Save a measured cost revision before exporting. An existing package can still be inspected."}</p>
    <fieldset disabled={locked || !latest} className="qs-package-section"><legend>Export details</legend>
      <div className="qs-package-fields">{field("title", "Cost plan title")}{field("reference", "Transmittal reference")}{field("revisionLabel", "Revision label")}
        {field("preparedBy", "Prepared by")}{field("recipient", "Intended recipient")}{field("purpose", "Purpose")}{field("transmittalCreatedAt", "Transmittal created at", false, true)}</div>
      <p className="qs-package-note">One statement per line. Enter an explicit “None” where appropriate; empty assumptions or exclusions are not silently supplied.</p>
      <div className="qs-package-fields">{field("basisOfEstimate", "Basis of estimate", true)}{field("assumptions", "Assumptions", true)}{field("exclusions", "Exclusions", true)}</div>
      <details><summary>Delivery identity and review record</summary><div className="qs-package-fields">
        {field("deliveryId", "Delivery identifier")}
        <label>Delivery state<select value={inputs.deliveryState} onChange={event => setInputs({ ...inputs, deliveryState: event.target.value as DeliveryState | "" })}>
          <option value="">Choose delivery state</option>{DELIVERY_STATES.map(state => <option key={state} value={state}>{describeDeliveryState(state)}</option>)}</select></label>
        {field("createdAt", "Delivery created at", false, true)}{field("reviewedAt", "Reviewed at (reviewed or issued only)", false, true)}{field("issuedAt", "Issued at (issued only)", false, true)}
      </div><p className="qs-package-note">Review/issue timestamps are explicit declarations. Choosing a state does not verify the source or send this package. Draft delivery states cannot carry review/issue timestamps.</p></details>
      <button type="button" onClick={() => void prepare()}>Prepare package from saved revision</button>
    </fieldset>
    {ready && <section className="qs-package-section" aria-label="Prepared cost package"><h4>Prepared files</h4>
      <p className="qs-package-note">Content SHA-256 <code>{ready.artifacts.contentSha256}</code></p>
      <div className="qs-package-actions">{(["package", "pdf", "csv"] as const).map(kind => <button key={kind} type="button" disabled={locked} onClick={() => void download(kind)}>Download {kind === "package" ? "package ZIP" : kind.toUpperCase()}</button>)}</div>
    </section>}
    <section className="qs-package-section" aria-label="Reopen cost package"><h4>Reopen and inspect</h4>
      <label>Cost-plan package ZIP (maximum 32 MiB)<input type="file" accept=".zip,application/zip" disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void validateFile(file); }} /></label>
      {selected && <><p className="qs-package-note">Selected: {selected.file.name} · {selected.file.size.toLocaleString()} bytes. {selected.bytes ? "Original imported bytes retained in this panel." : "Original file selection retained."}</p>
        {selected.error && <p className="qs-package-error" role="alert">{selected.error}</p>}
        {!preview && <button type="button" disabled={locked} onClick={() => void validateFile(selected.file, selected)}>Retry validation of retained file</button>}</>}
      {preview && <><QSCostPlanPackageManifest preview={preview} />
        {!sameProject && <p className="qs-package-error" role="alert">This package belongs to another project. Restore is disabled; the current worksheet is unchanged.</p>}
        <label className="qs-package-confirm"><input type="checkbox" disabled={locked || !sameProject} checked={restoreConfirmed} onChange={event => setConfirmed(event.target.checked && selected ? { id: selected.id, scope } : null)} />I have inspected this package and want to replace this project’s entire quantity worksheet, including its pricing history. Unsaved worksheet edits will be replaced.</label>
        <button type="button" disabled={locked || !sameProject || !restoreConfirmed} onClick={() => void restore()}>Restore inspected worksheet to this project</button>
      </>}
    </section>
    {working && <p className="qs-package-note" role="status">{working}</p>}
    {error && <p className="qs-package-error" role="alert">{error}</p>}
    {notice && <p className="qs-package-note" role="status">{notice}</p>}
  </section>;
}
