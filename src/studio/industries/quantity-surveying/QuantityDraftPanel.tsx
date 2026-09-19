import { useEffect, useMemo, useState } from "react";
import { QuantityReportView } from "./QuantityReportView";
import { QSItemBindingLedger, type QSBindingLedgerRow } from "./QSItemBindingLedger";
import type { IndustryDraftPanelProps } from "../draftPanel";
import { describeIndustryBinding, industryEvidenceClassSchema, industryLengthUnitSchema, type IndustrySourceState } from "../sourceBinding";
import {
  assignQuantityItem, calculateQuantityForm, createEmptyQuantityBindingDraft, createQuantityBinding,
  describeQuantityBindingEvidence, evaluateQuantityFormBinding, type QuantityBindingDraft, type QuantityForm,
} from "./quantityForm";
import {
  QS_ITEM_BINDING_SCHEMA,
  qsEntityGeometrySchema,
  qsItemBindingSchema,
  shouldRepin,
  type QsEntityGeometry,
  type QsItemBinding,
} from "./qsItemBinding";
import { qsDigest } from "./qsItemBinding";

/** Rendered when the host cannot supply a live project source: the worksheet stays manual and unbound. */
const MISSING_SOURCE: IndustrySourceState = { projectId: "", sourceRevision: null, calibrationId: null };
const EVIDENCE_LABELS: Record<string, string> = {
  traced: "Traced source geometry", dimensioned: "Dimensioned source geometry",
  inferred: "Inferred reconstruction", declared: "Declared typed reference",
};

/** One instant per session, so bindings do not churn their timestamp on every render. */
const BOUND_AT = new Date().toISOString();

function parseBinding(input: unknown): QsItemBinding | null {
  const result = qsItemBindingSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function QuantityDraftPanel({ value, onChange, disabled, source: reportedSource }: IndustryDraftPanelProps<QuantityForm>) {
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<QuantityBindingDraft>(() => createEmptyQuantityBindingDraft());
  const source: IndustrySourceState = reportedSource ?? MISSING_SOURCE;
  useEffect(() => { setError(""); }, [value]);
  const { evaluation, report } = useMemo(() => evaluateQuantityFormBinding(value, source), [value, source]);
  const binding = value.binding ?? null;
  const canBind = source.sourceRevision !== null;
  const edit = (next: QuantityForm) => { setError(""); onChange({ ...next, calculated: false }); };
  const bind = () => {
    try {
      const next = createQuantityBinding(source, draft, new Date().toISOString());
      setDraft(createEmptyQuantityBindingDraft());
      setError("");
      onChange({ ...value, binding: next, calculated: false });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the source binding inputs."); }
  };
  const clearBinding = () => { setError(""); onChange({ ...value, binding: null, calculated: false }); };
  const nodeName = (key: string) => {
    const node = value.nodes.find(item => item.key === key);
    return node ? `${node.code || "Unnamed code"} · ${node.label || "Unnamed classification"}` : "Missing classification";
  };
  const calculate = () => {
    try { calculateQuantityForm(value); setError(""); onChange({ ...value, calculated: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the classification and quantity inputs."); }
  };

  // Bindings are derived from the draft's own rows, so the ledger cannot show a
  // verification that does not correspond to what the user actually entered. The
  // geometry hash is the real SHA-256 of the row's reference, quantity and unit —
  // change any of them and the binding goes stale on the next render without
  // anything needing to write a status. Hashing is async (crypto.subtle), so this
  // is state rather than a memo: a placeholder digest would be a fabricated
  // measurement wearing the shape of a real one.
  // The draft's rows, keyed as the report keys them (by reference). A row is
  // shown even when it cannot be bound yet — blank reference, mid-typed quantity —
  // because an item silently missing from an evidence ledger reads as evidence
  // that no longer needs checking.
  const ledgerRows = useMemo<QSBindingLedgerRow[]>(
    () => value.items
      .filter(item => item.reference.trim() !== "")
      .map(item => ({ id: item.reference.trim(), quantity: item.quantity.trim(), unit: item.unit.trim() })),
    [value.items],
  );
  // The ledger's two halves come from different places on purpose, and that
  // separation is the whole mechanism. `bindings` are the *pinned* record: the
  // row as it was at the moment it was calculated. `entities` are the *live*
  // geometry: the row as it is right now. `evaluateItemBinding` compares one
  // against the other, so editing a quantity moves the entity out from under the
  // binding and the row goes stale.
  //
  // Deriving both from the same current value would make the comparison a
  // tautology — the hash could never disagree with itself, and the ledger would
  // report every row verified no matter what the user typed. That is a ledger
  // that cannot fail, which is a ledger that proves nothing.
  //
  // Hashing is async (crypto.subtle), so this is state rather than a memo: a
  // placeholder digest would be a fabricated measurement wearing the shape of a
  // real one. `committed` is the row set the bindings were pinned against, so a
  // re-render that changes nothing does not disturb them.
  const committed = useMemo(
    () =>
      value.items
        .map(item => ({
          id: item.reference.trim(),
          quantity: item.quantity.trim(),
          unit: item.unit.trim(),
          nodeKey: item.nodeKey,
        }))
        .filter(row => row.id !== ""),
    [value.items],
  );
  const [pinned, setPinned] = useState<{ bindings: Map<string, QsItemBinding>; pinnedFor: string }>(
    () => ({ bindings: new Map(), pinnedFor: "" }),
  );
  const [entities, setEntities] = useState<ReadonlyMap<string, QsEntityGeometry>>(() => new Map());

  // The fingerprint of what the bindings were pinned against. Re-pinning is only
  // allowed when this changes *and* the draft is calculated, so typing a new
  // quantity leaves the old binding in place for the live entity to disagree with.
  const committedKey = useMemo(
    () => committed.map(row => `${row.id}${row.quantity}${row.unit}`).join(""),
    [committed],
  );

  // One effect, two outputs, deliberately not two effects: the pin is a function
  // of the entities built in the same pass, and splitting them would race the pin
  // against an entity map that had not been computed yet.
  //
  // The pin is only *replaced* when the draft is calculated — i.e. when the user
  // has just confirmed these numbers. An ordinary edit leaves the pin untouched,
  // which is exactly what makes the live entity disagree with it on the next
  // render. Folding the pin forward on every row change would re-derive the
  // binding from the edited value, the hash would match itself, and the ledger
  // would report a clean verification of a number nobody confirmed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const live = new Map<string, QsEntityGeometry>();
      for (const row of committed) {
        if (!row.quantity || !row.unit) continue;
        const entityId = `measured:${row.id}`;
        // The hash covers the entity id alongside the values, so a row cannot
        // inherit another row's hash by happening to share a quantity.
        const geometry = qsEntityGeometrySchema.safeParse({
          entityId,
          entityType: "room-area",
          geometrySha256: await qsDigest(`${entityId} ${row.quantity} ${row.unit}`),
          calibrationId: source.calibrationId,
          unit: row.unit,
          measuredQuantity: row.quantity,
        });
        if (geometry.success) live.set(entityId, geometry.data);
      }
      if (cancelled) return;
      setEntities(live);

      if (!shouldRepin({ calculated: value.calculated, draftKey: committedKey, pinnedFor: pinned.pinnedFor })) return;
      const sourceSha256 = source.sourceRevision === null
        ? null
        : await qsDigest(`${source.projectId} ${source.sourceRevision}`);
      const bindings = new Map<string, QsItemBinding>();
      for (const row of committed) {
        const entity = live.get(`measured:${row.id}`);
        if (!entity) continue;
        const next = parseBinding({
          format: QS_ITEM_BINDING_SCHEMA,
          // itemId and entityId are different identities and must stay different:
          // the schema refuses a self-binding ("an item cannot be bound to
          // itself"). The item is identified by its reference because that is how
          // the report identifies its rows (quantityFormInput: `id:
          // item.reference`); the entity is the measured object.
          itemId: row.id,
          projectId: source.projectId || "local-draft",
          entityId: entity.entityId,
          entityType: "room-area",
          measuredQuantity: entity.measuredQuantity,
          unit: entity.unit,
          entityGeometrySha256: entity.geometrySha256,
          sourceSha256,
          calibrationId: source.calibrationId,
          boundAt: BOUND_AT,
          boundBy: "draft-worksheet",
        });
        if (next !== null) bindings.set(row.id, next);
      }
      if (!cancelled) setPinned({ bindings, pinnedFor: committedKey });
    })();
    return () => { cancelled = true; };
  }, [value.calculated, committedKey, committed, source.projectId, source.sourceRevision, source.calibrationId, pinned.pinnedFor]);

  return <section className="industry-form" aria-label="Quantity surveying draft">
    <p className="industry-note">Manual draft quantities. Binding records the source you pointed at; it does not verify the quantity. Classifications do not create prices or an issued cost plan.</p>
    <fieldset disabled={disabled}>
      <legend>Source binding</legend>
      {binding === null
        ? <>
          <div className="industry-fields">
            <label>Source page index (0-based)<input inputMode="numeric" value={draft.pageIndexText} maxLength={12} onChange={event => { setError(""); setDraft({ ...draft, pageIndexText: event.target.value }); }} /></label>
            <label>Source units<select value={draft.units} onChange={event => { setError(""); setDraft({ ...draft, units: event.target.value }); }}>
              <option value="">Choose length unit</option>
              {industryLengthUnitSchema.options.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select></label>
            <label>Evidence class<select value={draft.evidenceClass} onChange={event => { setError(""); setDraft({ ...draft, evidenceClass: event.target.value }); }}>
              <option value="">Choose evidence class</option>
              {industryEvidenceClassSchema.options.map(option => <option key={option} value={option}>{EVIDENCE_LABELS[option] ?? option}</option>)}
            </select></label>
            <label>Reference<input value={draft.reference} maxLength={1000} onChange={event => { setError(""); setDraft({ ...draft, reference: event.target.value }); }} /></label>
          </div>
          <div className="industry-actions">
            <button type="button" disabled={disabled || !canBind} onClick={bind}>Bind to current project source</button>
          </div>
          {!canBind && <p className="industry-note">No project source revision is available to bind to. Quantities stay manual and unverified.</p>}
          <p className="industry-note">{describeIndustryBinding(evaluation)}</p>
        </>
        : <>
          <div className="industry-fields">
            <p className="industry-note">Reference: {binding.reference}</p>
            <p className="industry-note">Evidence class: {binding.evidenceClass} · {EVIDENCE_LABELS[binding.evidenceClass] ?? binding.evidenceClass}</p>
            <p className="industry-note">Units: {binding.units} · Source: {binding.sourceName}</p>
            <p className="industry-note">{describeQuantityBindingEvidence(binding)}</p>
          </div>
          <div className="industry-actions">
            <button type="button" disabled={disabled} onClick={clearBinding}>Clear binding</button>
          </div>
          <p className="industry-note">{describeIndustryBinding(evaluation)}</p>
        </>}
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Your classification hierarchy</legend>
      <div className="industry-fields">
        <label>Hierarchy name<input value={value.hierarchyId} maxLength={240} onChange={event => edit({ ...value, hierarchyId: event.target.value })} /></label>
        <label>Hierarchy revision<input value={value.hierarchyRevision} maxLength={240} onChange={event => edit({ ...value, hierarchyRevision: event.target.value })} /></label>
      </div>
      {value.nodes.map((node, index) => <div className="industry-fields" key={node.key}>
        <label>Classification code {index + 1}<input value={node.code} maxLength={240} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, code: event.target.value } : item) })} /></label>
        <label>Classification label {index + 1}<input value={node.label} maxLength={240} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, label: event.target.value } : item) })} /></label>
        <label>Parent classification {index + 1}<select value={node.parentKey} onChange={event => edit({ ...value, nodes: value.nodes.map(item => item.key === node.key ? { ...item, parentKey: event.target.value } : item) })}>
          <option value="">Top level</option>
          {value.nodes.filter(item => item.key !== node.key).map(item => <option key={item.key} value={item.key}>{nodeName(item.key)}</option>)}
        </select></label>
        <button type="button" aria-label={`Remove classification ${index + 1}`} disabled={value.nodes.some(item => item.parentKey === node.key) || value.items.some(item => item.nodeKey === node.key)} title="Reassign child classifications and quantities before removing this classification" onClick={() => edit({ ...value, nodes: value.nodes.filter(item => item.key !== node.key) })}>Remove classification</button>
      </div>)}
      <button type="button" disabled={value.nodes.length >= 1000} onClick={() => edit({ ...value, nodes: [...value.nodes, { key: crypto.randomUUID(), code: "", label: "", parentKey: "" }] })}>Add classification</button>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Quantity rows</legend>
      {!value.items.length && <p className="industry-note">Add a quantity row and enter its quantity and unit.</p>}
      {value.items.map((item, index) => <div className="industry-fields" key={item.key}>
        <label>Item reference {index + 1}<input value={item.reference} maxLength={240} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, reference: event.target.value } : row) })} /></label>
        <label>Quantity {index + 1}<input inputMode="decimal" value={item.quantity} maxLength={80} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, quantity: event.target.value } : row) })} /></label>
        <label>Unit {index + 1}<input value={item.unit} maxLength={240} placeholder="e.g. m2, lm, ea" onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, unit: event.target.value } : row) })} /></label>
        <label>Evidence {index + 1}<select value={item.evidence} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, evidence: event.target.value as typeof item.evidence } : row) })}>
          <option value="unverified">Unverified</option><option value="inferred">Inferred</option><option value="sample">Sample</option>
        </select></label>
        <label>Assign item {index + 1}<select value={item.nodeKey} onChange={event => { setError(""); onChange(assignQuantityItem(value, item.key, event.target.value)); }}>
          <option value="">Unassigned</option>{value.nodes.map(node => <option key={node.key} value={node.key}>{nodeName(node.key)}</option>)}
        </select></label>
        <button type="button" aria-label={`Remove quantity ${index + 1}`} onClick={() => edit({ ...value, items: value.items.filter(row => row.key !== item.key) })}>Remove quantity</button>
      </div>)}
      <button type="button" disabled={value.items.length >= 10000} onClick={() => edit({ ...value, items: [...value.items, { key: crypto.randomUUID(), reference: "", quantity: "", unit: "", evidence: "unverified", nodeKey: "" }] })}>Add quantity</button>
    </fieldset>
    <div className="industry-actions"><button type="button" disabled={disabled || !value.items.length || !value.nodes.length} onClick={calculate}>Calculate classification</button></div>
    {error && <p className="industry-error" role="alert">{error}</p>}
    {evaluation.status === "stale" && <p className="industry-result" role="status">Classification report withheld — {describeIndustryBinding(evaluation)}</p>}
    {/* The ledger is rendered from the draft's own rows and deliberately sits
        outside the report gate: editing a quantity withholds the report, and the
        items a user is editing are exactly the ones whose evidence they need to
        see. Inside the gate it would unmount on the first keystroke. */}
    <div className="industry-result">
      <QSItemBindingLedger rows={ledgerRows} bindings={pinned.bindings} entities={entities} />
    </div>
    {report && <div className="industry-result" aria-live="polite"><QuantityReportView report={report} disabled={disabled} /></div>}
  </section>;
}
