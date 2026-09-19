import { useEffect, useMemo, useState } from "react";
import { QuantityReportView } from "./QuantityReportView";
import { QSWorksheet } from "./QSWorksheet";
import { QSItemBindingLedger, type QSBindingLedgerRow } from "./QSItemBindingLedger";
import type { IndustryDraftPanelProps, IndustryGeometryEntitySource } from "../draftPanel";
import { describeIndustryBinding, industryEvidenceClassSchema, industryLengthUnitSchema, type IndustrySourceState } from "../sourceBinding";
import {
  assignQuantityItem, calculateQuantityForm, createEmptyQuantityBindingDraft, createQuantityBinding,
  describeQuantityBindingEvidence, evaluateQuantityFormBinding, withMeasuredQuantityBinding, withQuantityPricing, withRestoredQuantityWorksheet, type QuantityBindingDraft, type QuantityForm,
} from "./quantityForm";
import { createEmptyQsWorksheetState, type QsWorksheetState } from "./qsWorksheetState";
import { useQsPricing } from "./qsPricingContext";
import { industryDraftKey } from "../draftStorage";
import {
  QS_ITEM_BINDING_SCHEMA,
  qsEntityGeometrySchema,
  qsItemBindingSchema,
  type QsEntityGeometry,
  type QsItemBinding,
} from "./qsItemBinding";
import { qsDigest } from "./qsItemBinding";
import { useQsMeasuredGeometry } from "./qsMeasuredGeometryContext";
import {
  QS_ENTITY_HIGHLIGHT_SCHEMA,
  QS_HIGHLIGHT_EVENT,
  QS_HIGHLIGHT_SURFACE_SELECTOR,
  qsHighlightRequestSchema,
  type QsHighlightResolution,
} from "./qsEntityHighlight";

/** Rendered when the host cannot supply a live project source: the worksheet stays manual and unbound. */
const MISSING_SOURCE: IndustrySourceState = { projectId: "", sourceRevision: null, calibrationId: null };
const EMPTY_ENTITIES: ReadonlyMap<string, QsEntityGeometry> = new Map();
const EVIDENCE_LABELS: Record<string, string> = {
  traced: "Traced source geometry", dimensioned: "Dimensioned source geometry",
  inferred: "Inferred reconstruction", declared: "Declared typed reference",
};

function parseBinding(input: unknown): QsItemBinding | null {
  const result = qsItemBindingSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function QuantityDraftPanel({ value, onChange, disabled, source: reportedSource, geometryEntities: suppliedGeometry }: IndustryDraftPanelProps<QuantityForm>) {
  const scopedGeometry = useQsMeasuredGeometry();
  const pricingSource = useQsPricing();
  const geometryEntities = suppliedGeometry ?? scopedGeometry;
  const [error, setError] = useState("");
  const [geometryError, setGeometryError] = useState("");
  const [draft, setDraft] = useState<QuantityBindingDraft>(() => createEmptyQuantityBindingDraft());
  const source: IndustrySourceState = reportedSource ?? MISSING_SOURCE;
  const pricing = useMemo(() => value.pricing ?? (source.projectId ? createEmptyQsWorksheetState(source.projectId) : null), [value.pricing, source.projectId]);
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

  // Whether anything is mounted that could draw a highlight. Read from the
  // document rather than guessed from a prop: the canvases live in other panes,
  // and the only honest answer to "can this be shown" is "is it there".
  const [surfacesAvailable, setSurfacesAvailable] = useState(false);
  useEffect(() => {
    const read = () => {
      const surfaces = new Set(
        Array.from(document.querySelectorAll(QS_HIGHLIGHT_SURFACE_SELECTOR))
          .map(element => element.getAttribute("data-qs-highlight-surface")),
      );
      setSurfacesAvailable(surfaces.has("plan-2d") && surfaces.has("model-3d"));
    };
    read();
    // The canvases mount and unmount on pane switches, which are not React
    // renders this component can observe. A MutationObserver is the honest way
    // to notice; polling would sample the answer and sometimes report the wrong one.
    const observer = new MutationObserver(read);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const highlightEntity = (itemId: string, resolution: QsHighlightResolution) => {
    // Nothing resolvable, nothing to send. Emitting anyway would let a canvas
    // record a highlight it never drew.
    if (!resolution.resolvable) return;
    window.dispatchEvent(new CustomEvent(QS_HIGHLIGHT_EVENT, {
      detail: qsHighlightRequestSchema.parse({
        format: QS_ENTITY_HIGHLIGHT_SCHEMA,
        itemId,
        entityId: resolution.entityId,
        requestedAt: new Date().toISOString(),
      }),
    }));
  };

  // The draft's rows are keyed as the report keys them (by reference). Blank
  // references stay out until they can name a binding; every named row is shown,
  // including unbound or mid-edited rows.
  const ledgerRows = useMemo<QSBindingLedgerRow[]>(
    () => value.items
      .filter(item => item.reference.trim() !== "")
      .map(item => ({ id: item.reference.trim(), quantity: item.quantity.trim(), unit: item.unit.trim(), evidence: item.evidence, projectId: source.projectId })),
    [value.items, source.projectId],
  );
  // Live entities and immutable bindings deliberately come from different
  // records. A geometry hash is recomputed from the current project run, while
  // each row retains the hash explicitly accepted by the estimator. The ledger
  // can therefore fail closed after a canvas edit instead of comparing a value
  // with itself. Hashing is asynchronous, so the live map is component state.
  const [entitySnapshot, setEntitySnapshot] = useState<{
    input: readonly IndustryGeometryEntitySource[];
    entities: ReadonlyMap<string, QsEntityGeometry>;
  } | null>(null);
  // A source edit invalidates the old hash map in this render, before the effect
  // can finish hashing its replacement. Pending work must not preserve a green
  // pricing badge from the previous geometry or source.
  const entities = entitySnapshot?.input === geometryEntities ? entitySnapshot.entities : EMPTY_ENTITIES;
  const geometryPending = entitySnapshot?.input !== geometryEntities;
  const pricingUnavailable = !pricingSource || pricingSource.projectId !== source.projectId
    ? "A supplier library for the current project is not connected. Pricing remains withheld."
    : pricingSource.error ?? (pricingSource.loading || !pricingSource.library ? "Loading this project's supplier library. Pricing remains withheld." : null);
  const pricingProjectMismatch = pricing !== null && pricing.projectId !== source.projectId;
  const measurementCopyReady = !disabled && !geometryPending && !pricingUnavailable && !pricingProjectMismatch && Boolean(pricingSource?.sourceReady);
  const copyMeasuredQuantity = (itemKey: string) => {
    try {
      const item = value.items.find(row => row.key === itemKey);
      const next = withMeasuredQuantityBinding(value, itemKey, { source,
        entity: item?.entityBinding ? entities.get(item.entityBinding.entityId) ?? null : null,
        ready: measurementCopyReady, boundAt: new Date().toISOString() });
      setError("");
      onChange(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The current measured quantity could not be copied. Existing inputs were preserved."); }
  };
  const changePricing = (next: QsWorksheetState) => {
    try {
      if (disabled || pricingUnavailable || pricingProjectMismatch || !pricingSource?.sourceReady || geometryPending)
        throw Error("Pricing changes are unavailable until this project's source, geometry and supplier library are ready.");
      const updated = withQuantityPricing(value, next, source.projectId, localStorage.getItem(industryDraftKey(source.projectId)));
      setError("");
      onChange(updated);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cost changes could not be saved. Existing inputs were preserved."); return false; }
  };
  const restoreWorksheet = (next: QuantityForm): boolean => {
    try {
      if (!measurementCopyReady) throw Error("Worksheet restore is unavailable until this project's source, geometry, supplier library and storage are ready.");
      const restored = withRestoredQuantityWorksheet(next, source.projectId, localStorage.getItem(industryDraftKey(source.projectId)));
      setError("");
      onChange(restored);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The worksheet could not be restored. Existing inputs were preserved."); return false; }
  };
  const removeQuantity = (itemKey: string) => {
    const next = { ...value, items: value.items.filter(row => row.key !== itemKey) };
    if (next.pricing) next.pricing = { ...next.pricing, assignments: next.pricing.assignments.filter(row => row.itemKey !== itemKey) };
    edit(next);
  };

  useEffect(() => {
    let cancelled = false;
    setGeometryError("");
    void (async () => {
      const live = new Map<string, QsEntityGeometry>();
      for (const sourceEntity of geometryEntities) {
        const geometry = qsEntityGeometrySchema.safeParse({
          entityId: sourceEntity.entityId,
          entityType: sourceEntity.entityType,
          geometrySha256: await qsDigest(JSON.stringify({
            entityId: sourceEntity.entityId,
            revision: sourceEntity.revision,
            points: sourceEntity.points,
            measuredQuantity: sourceEntity.measuredQuantity,
            unit: sourceEntity.unit,
            calibrationId: sourceEntity.calibrationId,
          })),
          sourceSha256: sourceEntity.sourceSha256,
          calibrationId: sourceEntity.calibrationId,
          unit: sourceEntity.unit,
          measuredQuantity: sourceEntity.measuredQuantity,
        });
        if (geometry.success) live.set(sourceEntity.entityId, geometry.data);
      }
      if (cancelled) return;
      setEntitySnapshot({ input: geometryEntities, entities: live });
    })().catch(() => {
      if (cancelled) return;
      setEntitySnapshot({ input: geometryEntities, entities: EMPTY_ENTITIES });
      setGeometryError("Measured geometry could not be checked. Verification and pricing remain withheld.");
    });
    return () => { cancelled = true; };
  }, [geometryEntities]);

  const bindings = useMemo(() => new Map(
    value.items.flatMap(item => {
      const binding = parseBinding(item.entityBinding);
      return binding && binding.itemId === item.reference.trim() ? [[binding.itemId, binding] as const] : [];
    }),
  ), [value.items]);

  const bindItem = (itemKey: string, entityId: string) => {
    try {
      const item = value.items.find(row => row.key === itemKey);
      const sourceEntity = geometryEntities.find(entity => entity.entityId === entityId);
      const entity = entities.get(entityId);
      if (!item || !sourceEntity || !entity) throw Error("That measured entity is still loading. Try again.");
      if (!item.reference.trim()) throw Error("Enter the item reference before binding measured geometry.");
      const next = qsItemBindingSchema.parse({
        format: QS_ITEM_BINDING_SCHEMA,
        itemId: item.reference.trim(),
        projectId: source.projectId || "local-draft",
        entityId: entity.entityId,
        entityType: entity.entityType,
        measuredQuantity: entity.measuredQuantity,
        unit: entity.unit,
        entityGeometrySha256: entity.geometrySha256,
        sourceSha256: sourceEntity.sourceSha256,
        calibrationId: entity.calibrationId,
        boundAt: new Date().toISOString(),
        boundBy: "estimator-selection",
      });
      setError("");
      onChange({ ...value, calculated: false, items: value.items.map(row => row.key === itemKey ? { ...row, entityBinding: next } : row) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The measured entity could not be bound.");
    }
  };

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
        <label>Item reference {index + 1}<input value={item.reference} maxLength={240} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, reference: event.target.value, entityBinding: null } : row) })} /></label>
        <label>Quantity {index + 1}<input inputMode="decimal" value={item.quantity} maxLength={80} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, quantity: event.target.value } : row) })} /></label>
        <label>Unit {index + 1}<input value={item.unit} maxLength={240} placeholder="e.g. m2, lm, ea" onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, unit: event.target.value } : row) })} /></label>
        <label>Evidence {index + 1}<select value={item.evidence} onChange={event => edit({ ...value, items: value.items.map(row => row.key === item.key ? { ...row, evidence: event.target.value as typeof item.evidence } : row) })}>
          <option value="unverified">Unverified</option><option value="inferred">Inferred</option><option value="sample">Sample</option>
        </select></label>
        <label>Assign item {index + 1}<select value={item.nodeKey} onChange={event => { setError(""); onChange(assignQuantityItem(value, item.key, event.target.value)); }}>
          <option value="">Unassigned</option>{value.nodes.map(node => <option key={node.key} value={node.key}>{nodeName(node.key)}</option>)}
        </select></label>
        <label>Measured entity {index + 1}<select
          data-testid={`qs-entity-select-${index + 1}`}
          value={item.entityBinding?.entityId ?? ""}
          onChange={event => {
            const entityId = event.target.value;
            if (entityId) bindItem(item.key, entityId);
            else onChange({ ...value, calculated: false, items: value.items.map(row => row.key === item.key ? { ...row, entityBinding: null } : row) });
          }}
        >
          <option value="">Not bound to measured geometry</option>
          {geometryEntities.map(entity => <option key={entity.entityId} value={entity.entityId} disabled={!entities.has(entity.entityId)}>
            {entity.label} · {entity.measuredQuantity} {entity.unit}{entity.calibrationId ? "" : " · uncalibrated"}
          </option>)}
        </select></label>
        {item.entityBinding ? <button type="button" onClick={() => {
          if (item.entityBinding) bindItem(item.key, item.entityBinding.entityId);
        }}>Rebind current geometry</button> : null}
        {item.entityBinding ? <button type="button"
          disabled={!measurementCopyReady || item.evidence !== "unverified" || !entities.has(item.entityBinding.entityId)
            || item.entityBinding.projectId !== source.projectId || !source.sourceRevision || !source.calibrationId
            || entities.get(item.entityBinding.entityId)?.sourceSha256 !== source.sourceRevision.sha256
            || entities.get(item.entityBinding.entityId)?.calibrationId !== source.calibrationId}
          onClick={() => copyMeasuredQuantity(item.key)}>Use measured quantity and rebind</button> : null}
        <button type="button" aria-label={`Remove quantity ${index + 1}`} onClick={() => removeQuantity(item.key)}>Remove quantity</button>
      </div>)}
      <button type="button" disabled={value.items.length >= 10000} onClick={() => edit({ ...value, items: [...value.items, { key: crypto.randomUUID(), reference: "", quantity: "", unit: "", evidence: "unverified", nodeKey: "" }] })}>Add quantity</button>
    </fieldset>
    <div className="industry-actions"><button type="button" disabled={disabled || !value.items.length || !value.nodes.length} onClick={calculate}>Calculate classification</button></div>
    {(error || geometryError) && <p className="industry-error" role="alert">{error || geometryError}</p>}
    {evaluation.status === "stale" && <p className="industry-result" role="status">Classification report withheld — {describeIndustryBinding(evaluation)}</p>}
    {/* The ledger is rendered from the draft's own rows and deliberately sits
        outside the report gate: editing a quantity withholds the report, and the
        items a user is editing are exactly the ones whose evidence they need to
        see. Inside the gate it would unmount on the first keystroke. */}
    <div className="industry-result">
      <QSItemBindingLedger
        rows={ledgerRows}
        bindings={bindings}
        entities={entities}
        onHighlight={highlightEntity}
        surfacesAvailable={surfacesAvailable}
      />
    </div>
    <section aria-label="Quantity cost pricing" aria-disabled={Boolean(disabled || pricingUnavailable || pricingProjectMismatch || !pricingSource?.sourceReady || geometryPending)}>
      {pricingProjectMismatch
        ? <p className="industry-error" role="alert">Saved cost choices belong to another project. They are preserved, and pricing changes are blocked.</p>
        : pricingUnavailable
          ? <p className={pricingSource?.error ? "industry-error" : "industry-note"} role={pricingSource?.error ? "alert" : "status"}>{pricingUnavailable}</p>
          : pricing && pricingSource?.library && <>
            {(!pricingSource.sourceReady || geometryPending) && <p className="industry-note" role="status">Checking source geometry. Cost changes remain disabled until current measurements are available.</p>}
            <QSWorksheet key={source.projectId} projectId={source.projectId} rows={value.items} entities={entities}
              priceBooks={pricingSource.library} value={pricing} onChange={changePricing} worksheet={value} onRestoreWorksheet={restoreWorksheet}
              disabled={disabled || !pricingSource.sourceReady || geometryPending} />
          </>}
    </section>
    {report && <div className="industry-result" aria-live="polite"><QuantityReportView report={report} disabled={disabled} /></div>}
  </section>;
}
