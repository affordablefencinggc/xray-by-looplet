import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PriceBookLibrary } from "../../pricing/priceBooks";
import type { QsEntityGeometry } from "./qsItemBinding";
import type { QuantityForm } from "./quantityForm";
import {
  QS_COST_INPUT_FORMAT, QS_CURRENCIES, appendQsRateRevision, calculateQsCostPlan, normalizeQsRateUnit, qsFxRateSchema,
  type QsCostBlocker, type QsCostResult, type QsCostSnapshot, type QsCostTotals, type QsRatePin, type QsRateRevision,
} from "./qsRateBook";
import { compareQsCostPlans } from "./qsDeltaComparison";
import { appendQsWorksheetSnapshot, type QsWorksheetAssignment, type QsWorksheetState } from "./qsWorksheetState";
import "./QSWorksheet.css";

export type QSWorksheetProps = {
  projectId: string;
  rows: QuantityForm["items"];
  entities: ReadonlyMap<string, QsEntityGeometry>;
  priceBooks: PriceBookLibrary;
  value: QsWorksheetState;
  /** False means the host rejected the edit before its persistence queue. */
  onChange: (value: QsWorksheetState) => boolean | void;
  disabled?: boolean;
};

type PinDraft = { bookId: string; bookRevision: string; sourceLine: string };
type RateDraft = {
  material: PinDraft; labour: PinDraft; labourMode: "" | "excluded" | "pinned";
  labourAssumption: string; wastagePercent: string; markupPercent: string;
};
const emptyPin = (): PinDraft => ({ bookId: "", bookRevision: "", sourceLine: "" });
const pinDraft = (pin: QsRatePin | null | undefined): PinDraft => pin
  ? { bookId: pin.bookId, bookRevision: String(pin.bookRevision), sourceLine: String(pin.sourceLine) } : emptyPin();
const rateDraft = (rate?: QsRateRevision): RateDraft => ({
  material: pinDraft(rate?.material), labour: pinDraft(rate?.labour), labourMode: rate ? rate.labour ? "pinned" : "excluded" : "",
  labourAssumption: rate?.labourAssumption ?? "", wastagePercent: rate?.wastagePercent ?? "0", markupPercent: rate?.markupPercent ?? "0",
});
function parsePin(draft: PinDraft, component: string): QsRatePin {
  if (!draft.bookId || !draft.bookRevision || !draft.sourceLine) throw Error(`Choose the ${component} supplier book, revision and source line.`);
  return { bookId: draft.bookId, bookRevision: Number(draft.bookRevision), sourceLine: Number(draft.sourceLine) };
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : "The cost calculation could not be completed.";
}
/** Formatting only: monetary calculation and rounding stay in qsRateBook. */
export function formatQsMoney(minor: number, currency: string, signed = false): string {
  const integer = BigInt(minor), absolute = integer < 0n ? -integer : integer;
  return `${currency} ${integer < 0n ? "−" : signed && integer > 0n ? "+" : ""}${(absolute / 100n).toLocaleString("en-AU")}.${String(absolute % 100n).padStart(2, "0")}`;
}

function SupplierPinPicker({ label, value, onChange, priceBooks }: {
  label: string; value: PinDraft; onChange: (value: PinDraft) => void; priceBooks: PriceBookLibrary;
}) {
  const book = priceBooks.books.find(entry => entry.id === value.bookId);
  const revision = book?.revisions.find(entry => String(entry.revision) === value.bookRevision);
  const row = revision?.rows.find(entry => String(entry.sourceLine) === value.sourceLine);
  return <div className="qs-rate-source">
    <h5>{label} supplier source</h5>
    <div className="qs-cost-fields">
      <label>{label} supplier book<select value={value.bookId} onChange={event => onChange({ bookId: event.target.value, bookRevision: "", sourceLine: "" })}>
        <option value="">Choose a supplier book</option>
        {priceBooks.books.map(entry => <option key={entry.id} value={entry.id} disabled={entry.archived}>{entry.name}{entry.archived ? " · archived" : ""}</option>)}
      </select></label>
      <label>{label} supplier revision<select value={value.bookRevision} disabled={!book || book.archived} onChange={event => onChange({ ...value, bookRevision: event.target.value, sourceLine: "" })}>
        <option value="">Choose an exact revision</option>
        {book?.revisions.map(entry => <option key={entry.revision} value={entry.revision}>Revision {entry.revision} · {entry.metadata.effectiveDate} · {entry.metadata.supplier}</option>)}
      </select></label>
      <label>{label} supplier source line<select value={value.sourceLine} disabled={!revision || book?.archived} onChange={event => onChange({ ...value, sourceLine: event.target.value })}>
        <option value="">Choose a source rate</option>
        {revision?.rows.map(entry => <option key={entry.sourceLine} value={entry.sourceLine}>Line {entry.sourceLine} · {entry.stockCode || entry.description} · {entry.rate} {revision.metadata.currency}/{entry.unit}</option>)}
      </select></label>
    </div>
    {revision && row && <dl className="qs-source-provenance">
      <div><dt>Selected rate</dt><dd>{row.description} · {row.rate} {revision.metadata.currency}/{row.unit}</dd></div>
      <div><dt>Supplier tax / GST</dt><dd>{revision.metadata.taxBasis === "unspecified" ? "Not declared — pricing withheld" : `${revision.metadata.taxBasis} · ${revision.metadata.taxPercent === null ? "percentage not declared" : `${revision.metadata.taxPercent}%`}`}</dd></div>
      <div><dt>Source reference</dt><dd>{revision.metadata.sourceReference}</dd></div>
      <div><dt>Effective / imported</dt><dd>{revision.metadata.effectiveDate} / {revision.importedAt}</dd></div>
      <div><dt>Source SHA-256</dt><dd><code>{revision.source.sha256}</code></dd></div>
      {revision.source.worksheet && <div><dt>Workbook locator</dt><dd>{revision.source.worksheet} · header row {revision.source.headerRow} · source line {row.sourceLine}</dd></div>}
    </dl>}
  </div>;
}

function CostTotals({ title, value, currency, testId }: { title: string; value: QsCostTotals; currency: string; testId: string }) {
  return <section className="qs-cost-total" data-testid={testId}>
    <h4>{title}</h4>
    <strong data-total-minor={value.totalMinor}>{formatQsMoney(value.totalMinor, currency)}</strong>
    <dl><div><dt>Material</dt><dd>{formatQsMoney(value.materialMinor, currency)}</dd></div>
      <div><dt>Labour</dt><dd>{formatQsMoney(value.labourMinor, currency)}</dd></div>
      <div><dt>Markup</dt><dd>{formatQsMoney(value.markupMinor, currency)}</dd></div>
      <div><dt>Net</dt><dd>{formatQsMoney(value.netMinor, currency)}</dd></div>
      <div><dt>Tax / GST</dt><dd>{formatQsMoney(value.taxMinor, currency)}</dd></div></dl>
  </section>;
}

/** Keep Tab at this dialog's boundaries. Native modal/Escape behaviour remains
 * in charge; no document listener or background focus interception is added. */
export function keepQsComparisonFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  const dialog = event.currentTarget;
  if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !dialog.open) return;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"))
    .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest('[hidden], [inert], [aria-hidden="true"]')
      && element.getClientRects().length > 0
      && !["hidden", "collapse"].includes(element.ownerDocument.defaultView?.getComputedStyle(element).visibility ?? "visible"))
    // Positive tabindex precedes normal DOM order. Stable sort preserves the
    // DOM order of the controls and the read-only scrollable change table.
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
  const first = controls[0], last = controls[controls.length - 1];
  if (!first || !last) { event.preventDefault(); return; }
  const active = dialog.ownerDocument.activeElement;
  if (active === (event.shiftKey ? first : last) || active === dialog || !dialog.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

/** Controlled cost editor. Quantities, geometry and supplier records are inputs;
 * this component only changes pricing choices and appends immutable revisions. */
export function QSWorksheet({ projectId, rows, entities, priceBooks, value, onChange, disabled = false }: QSWorksheetProps) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedItemKey, setSelectedItemKey] = useState(rows[0]?.key ?? "");
  const activeRow = rows.find(row => row.key === selectedItemKey) ?? rows[0];
  const assignment = value.assignments.find(entry => entry.itemKey === activeRow?.key);
  const pinnedRate = value.rateBook.rates.find(rate => rate.id === assignment?.rateId && rate.revision === assignment?.rateRevision);
  const [draft, setDraft] = useState<RateDraft>(() => rateDraft(pinnedRate));
  const hasUnappliedRateEdits = JSON.stringify(draft) !== JSON.stringify(rateDraft(pinnedRate));
  const [fxDraft, setFxDraft] = useState({ fromCurrency: "", rate: "", sourceReference: "", effectiveAt: "", validUntil: "" });
  const pinnedRateJson = JSON.stringify(pinnedRate ?? null);
  useEffect(() => {
    setDraft(rateDraft(pinnedRateJson === "null" ? undefined : JSON.parse(pinnedRateJson) as QsRateRevision));
    setError("");
  }, [activeRow?.key, pinnedRateJson]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [previousRevision, setPreviousRevision] = useState(1);
  const [currentRevision, setCurrentRevision] = useState("draft");
  const comparisonId = useId();
  const comparisonRef = useRef<HTMLDialogElement>(null);
  const comparisonTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = comparisonRef.current;
    if (!dialog) return;
    if (comparisonOpen && !dialog.open) dialog.showModal();
    if (!comparisonOpen && dialog.open) dialog.close();
  }, [comparisonOpen]);

  const edit = (next: QsWorksheetState): boolean => {
    setError(""); setNotice("");
    try {
      if (disabled) throw Error("Cost changes are disabled while source or storage checks are pending.");
      if (onChange(next) === false) throw Error("The project did not accept this cost change. Existing inputs are preserved; see the worksheet error for details.");
      return true;
    } catch (cause) { setError(message(cause)); return false; }
  };
  const replaceAssignment = (next: QsWorksheetAssignment): QsWorksheetAssignment[] => value.assignments.some(entry => entry.itemKey === next.itemKey)
    ? value.assignments.map(entry => entry.itemKey === next.itemKey ? next : entry) : [...value.assignments, next];
  const calculate = useCallback((createdAt: string): QsCostResult => {
    const blockers: QsCostBlocker[] = [];
    if (!projectId || value.projectId !== projectId || priceBooks.jobId !== projectId)
      blockers.push({ itemId: null, code: "invalid-input", message: "Measured quantities, rate definitions and supplier library must belong to the current project." });
    if (!rows.length) blockers.push({ itemId: null, code: "invalid-input", message: "Add and bind measured quantity rows before calculating a cost plan." });
    if (!value.preparedBy.trim()) blockers.push({ itemId: null, code: "invalid-input", message: "Enter the preparer's name for the cost revision." });
    for (const row of rows) {
      const pin = value.assignments.find(entry => entry.itemKey === row.key);
      if (!pin?.rateId || !pin.rateRevision) blockers.push({ itemId: row.reference || row.key, code: "missing-rate", message: "Save an explicit supplier rate definition for this row." });
    }
    if (blockers.length) return { ok: false, blockers };
    return calculateQsCostPlan({
      format: QS_COST_INPUT_FORMAT, projectId, revision: value.snapshots.length + 1, createdAt,
      createdBy: value.preparedBy.trim(), currency: value.currency, priceBooks, rateBook: value.rateBook,
      options: value.options, activeOptionIds: value.activeOptionIds, fxRates: value.fxRates,
      items: rows.map(row => {
        const pin = value.assignments.find(entry => entry.itemKey === row.key)!;
        return { itemId: row.reference, description: row.reference, quantity: row.quantity, unit: row.unit,
          evidence: row.evidence, binding: row.entityBinding ?? null,
          entity: row.entityBinding ? entities.get(row.entityBinding.entityId) ?? null : null,
          rateId: pin.rateId, rateRevision: pin.rateRevision, optionId: pin.optionId };
      }),
    });
  }, [projectId, rows, entities, priceBooks, value]);
  // A fresh render caused by changed source/rate inputs always recalculates. No
  // ready/verified status is persisted or reused from the last cost revision.
  const result = useMemo(() => calculate(new Date().toISOString()), [calculate]);
  const saveRate = () => {
    if (!activeRow) return;
    try {
      if (!value.preparedBy.trim()) throw Error("Enter the preparer's name before saving a rate revision.");
      if (!activeRow.reference.trim()) throw Error("Enter an item reference before saving its rate definition.");
      const unit = normalizeQsRateUnit(activeRow.unit);
      if (unit === null) throw Error("This measured unit is not supported by the cost calculator. The source measurement unit has not been changed.");
      if (!draft.labourMode) throw Error("Choose whether labour is pinned separately or explicitly excluded.");
      const id = assignment?.rateId ?? crypto.randomUUID();
      const rate: QsRateRevision = {
        id, revision: value.rateBook.rates.filter(entry => entry.id === id).length + 1,
        description: activeRow.reference, unit,
        material: parsePin(draft.material, "material"), labour: draft.labourMode === "pinned" ? parsePin(draft.labour, "labour") : null,
        labourAssumption: draft.labourAssumption, wastagePercent: draft.wastagePercent, markupPercent: draft.markupPercent,
        createdAt: new Date().toISOString(), createdBy: value.preparedBy.trim(),
      };
      const rateBook = appendQsRateRevision(value.rateBook, rate, value.rateBook.revision);
      if (!edit({ ...value, rateBook, assignments: replaceAssignment({ itemKey: activeRow.key, rateId: id, rateRevision: rate.revision, optionId: assignment?.optionId ?? null }) })) return;
      setNotice(`Rate revision ${rate.revision} added for ${activeRow.reference}. The project save status below confirms when it is stored.`);
    } catch (cause) { setError(message(cause)); }
  };
  const saveSnapshot = () => {
    try {
      const current = calculate(new Date().toISOString());
      if (!current.ok) throw Error(current.blockers.map(blocker => blocker.message).join(" "));
      if (!edit(appendQsWorksheetSnapshot(value, current.snapshot))) return;
      setNotice(`Cost revision ${current.snapshot.input.revision} recorded with frozen quantities, supplier pins and option decisions. The project save status below confirms when it is stored.`);
    } catch (cause) { setError(message(cause)); }
  };
  const saveFx = () => {
    try {
      if (!value.preparedBy.trim()) throw Error("Enter the preparer's name to record who reviewed this exchange rate.");
      if (!fxDraft.fromCurrency || !fxDraft.effectiveAt) throw Error("Choose the supplier currency and the exchange rate's effective date and time.");
      const previous = value.fxRates.find(rate => rate.fromCurrency === fxDraft.fromCurrency && rate.toCurrency === value.currency);
      const record = qsFxRateSchema.parse({
        id: previous?.id ?? crypto.randomUUID(), revision: (previous?.revision ?? 0) + 1,
        fromCurrency: fxDraft.fromCurrency, toCurrency: value.currency, rate: fxDraft.rate, sourceReference: fxDraft.sourceReference,
        effectiveAt: new Date(fxDraft.effectiveAt).toISOString(), validUntil: fxDraft.validUntil ? new Date(fxDraft.validUntil).toISOString() : null,
        reviewedAt: new Date().toISOString(), reviewedBy: value.preparedBy.trim(),
      });
      if (!edit({ ...value, fxRates: [...value.fxRates.filter(rate => !(rate.fromCurrency === record.fromCurrency && rate.toCurrency === record.toCurrency)), record] })) return;
      setFxDraft({ fromCurrency: "", rate: "", sourceReference: "", effectiveAt: "", validUntil: "" });
      setNotice(`Selected reviewed ${record.fromCurrency} to ${record.toCurrency} exchange rate revision ${record.revision}. The project save status below confirms when this choice is stored.`);
    } catch (cause) { setError(message(cause)); }
  };
  const selectedCurrent: QsCostSnapshot | null = currentRevision === "draft"
    ? result.ok ? result.snapshot : null
    : value.snapshots.find(snapshot => snapshot.input.revision === Number(currentRevision)) ?? null;
  const earlierSnapshots = value.snapshots.filter(snapshot => snapshot.input.revision < (selectedCurrent?.input.revision ?? value.snapshots.length + 1));
  const selectedPrevious = earlierSnapshots.find(snapshot => snapshot.input.revision === previousRevision) ?? earlierSnapshots[0];
  const comparison = useMemo(() => {
    if (!selectedCurrent) return { error: "Resolve the current pricing blockers or select a saved revision to compare.", delta: null };
    if (!selectedPrevious) return { error: "Save an earlier cost revision before comparing changes.", delta: null };
    try { return { error: "", delta: compareQsCostPlans(selectedPrevious, selectedCurrent) }; }
    catch (cause) { return { error: message(cause), delta: null }; }
  }, [selectedPrevious, selectedCurrent]);

  return <section className="qs-cost-workspace" aria-label="Measured cost plan" data-testid="qs-cost-worksheet">
    <div className="qs-cost-heading"><div><h3>Measured cost plan</h3><p>Pin supplier revisions, review allowances and keep each saved estimate intact.</p></div>
      <span className="qs-cost-draft-badge">Draft estimate</span></div>
    <p className="qs-cost-note">Rates use the existing project price library. Tax / GST follows each pinned supplier revision. This worksheet does not issue or approve a quotation.</p>
    <fieldset disabled={disabled} className="qs-cost-section"><legend>Estimate basis</legend>
      <div className="qs-cost-fields">
        <label>Cost preparer<input value={value.preparedBy} maxLength={240} autoComplete="off" onChange={event => edit({ ...value, preparedBy: event.target.value })} /></label>
        <label>Estimate currency<select value={value.currency} onChange={event => edit({ ...value, currency: event.target.value as QsWorksheetState["currency"] })}>
          {QS_CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}
        </select></label>
      </div>
      <p className="qs-cost-note">Supplier currencies require an explicitly reviewed direct exchange rate when they differ from the estimate currency. Units must match; m²/m2 and m³/m3 are spelling equivalents only.</p>
    </fieldset>

    <fieldset disabled={disabled} className="qs-cost-section"><legend>Reviewed currency conversion</legend>
      <p className="qs-cost-note">Enter the conversion you reviewed. No market rate is fetched or assumed. The preparer's name is recorded as reviewer when you select the rate.</p>
      <div className="qs-cost-fields">
        <label>Exchange source currency<select value={fxDraft.fromCurrency} onChange={event => setFxDraft({ ...fxDraft, fromCurrency: event.target.value })}>
          <option value="">Choose supplier currency</option>{QS_CURRENCIES.filter(currency => currency !== value.currency).map(currency => <option key={currency}>{currency}</option>)}
        </select></label>
        <label>{value.currency} per 1 {fxDraft.fromCurrency || "source currency"}<input aria-label="Reviewed exchange rate" value={fxDraft.rate} inputMode="decimal" maxLength={19} onChange={event => setFxDraft({ ...fxDraft, rate: event.target.value })} /></label>
      </div>
      <label>Exchange source reference<input value={fxDraft.sourceReference} maxLength={1000} onChange={event => setFxDraft({ ...fxDraft, sourceReference: event.target.value })} /></label>
      <div className="qs-cost-fields"><label>Exchange effective time (local)<input type="datetime-local" value={fxDraft.effectiveAt} onChange={event => setFxDraft({ ...fxDraft, effectiveAt: event.target.value })} /></label>
        <label>Exchange valid until (local, blank = no expiry)<input type="datetime-local" value={fxDraft.validUntil} onChange={event => setFxDraft({ ...fxDraft, validUntil: event.target.value })} /></label></div>
      <button type="button" disabled={value.fxRates.length >= 100} onClick={saveFx}>Review and select exchange rate</button>
      {value.fxRates.map(rate => <div className="qs-cost-option" key={`${rate.id}-${rate.revision}`} data-testid={`qs-fx-${rate.fromCurrency}-${rate.toCurrency}`}>
        <p><strong>{rate.fromCurrency} → {rate.toCurrency}: {rate.rate}</strong> · revision {rate.revision}</p>
        <p className="qs-cost-note">{rate.sourceReference} · effective {rate.effectiveAt}{rate.validUntil ? ` until ${rate.validUntil}` : " · no expiry"}. Reviewed by {rate.reviewedBy} at {rate.reviewedAt}.</p>
        <button type="button" onClick={() => edit({ ...value, fxRates: value.fxRates.filter(entry => !(entry.id === rate.id && entry.revision === rate.revision)) })}>Deselect {rate.fromCurrency} to {rate.toCurrency} exchange rate</button>
      </div>)}
    </fieldset>

    <fieldset disabled={disabled || !activeRow} className="qs-cost-section"><legend>Rate definition</legend>
      <label>Cost item to price<select value={activeRow?.key ?? ""} onChange={event => setSelectedItemKey(event.target.value)}>
        {!rows.length && <option value="">No measured quantity rows</option>}
        {rows.map(row => <option key={row.key} value={row.key}>{row.reference || "Unnamed item"} · {row.quantity || "—"} {row.unit || "unit not set"}</option>)}
      </select></label>
      {activeRow && <>
        <p className="qs-cost-note">Measured quantity: <strong>{activeRow.quantity || "not set"} {activeRow.unit || "unit not set"}</strong>. {pinnedRate ? `Pinned contractor revision ${pinnedRate.revision}. Saving appends a revision.` : "No contractor rate is pinned yet."}</p>
        <SupplierPinPicker label="Material" priceBooks={priceBooks} value={draft.material} onChange={material => setDraft({ ...draft, material })} />
        <label>Labour treatment<select value={draft.labourMode} onChange={event => setDraft({ ...draft, labourMode: event.target.value as RateDraft["labourMode"] })}>
          <option value="">Choose labour treatment</option><option value="pinned">Pin a separate labour rate per measured unit</option><option value="excluded">Explicitly exclude separate labour</option>
        </select></label>
        {draft.labourMode === "pinned" && <SupplierPinPicker label="Labour" priceBooks={priceBooks} value={draft.labour} onChange={labour => setDraft({ ...draft, labour })} />}
        <label>Labour basis or exclusion reason<textarea value={draft.labourAssumption} maxLength={1000} rows={2} onChange={event => setDraft({ ...draft, labourAssumption: event.target.value })} /></label>
        <div className="qs-cost-fields">
          <label>Material wastage %<input value={draft.wastagePercent} inputMode="decimal" maxLength={19} onChange={event => setDraft({ ...draft, wastagePercent: event.target.value })} /></label>
          <label>Net cost markup %<input value={draft.markupPercent} inputMode="decimal" maxLength={19} onChange={event => setDraft({ ...draft, markupPercent: event.target.value })} /></label>
          <label>Cost scope<select value={assignment?.optionId ?? ""} onChange={event => edit({ ...value, assignments: replaceAssignment({ itemKey: activeRow.key, rateId: assignment?.rateId ?? null, rateRevision: assignment?.rateRevision ?? null, optionId: event.target.value || null }) })}>
            <option value="">Base tender</option>{value.options.map(option => <option key={option.id} value={option.id}>{option.label || "Unnamed option"}</option>)}
          </select></label>
        </div>
        <p className="qs-cost-note">Wastage applies to material quantities only. Markup applies to net material and labour; tax on markup follows each source's declared percentage.</p>
        {hasUnappliedRateEdits && <p className="qs-cost-warning" role="status">Unapplied rate edits. {pinnedRate ? `Totals still use contractor revision ${pinnedRate.revision} until you save the next revision.` : "Save the rate definition before this row can contribute to totals."}</p>}
        <button type="button" onClick={saveRate}>Save rate revision for {activeRow.reference || "item"}</button>
      </>}
      {!priceBooks.books.some(book => !book.archived) && <p className="qs-cost-warning">Import a supplier CSV or workbook in the project Price Books panel before choosing material or labour rates.</p>}
    </fieldset>

    <fieldset disabled={disabled} className="qs-cost-section"><legend>Alternative options</legend>
      <p className="qs-cost-note">Base tender stays separate. Accepting an option adds only that option to the accepted total.</p>
      {value.options.map((option, index) => <div className="qs-cost-option" key={option.id} data-option-id={option.id}>
        <label>Option {index + 1} label<input value={option.label} maxLength={240} onChange={event => edit({ ...value, options: value.options.map(entry => entry.id === option.id ? { ...entry, label: event.target.value } : entry) })} /></label>
        <label className="qs-cost-check"><input type="checkbox" checked={value.activeOptionIds.includes(option.id)} onChange={event => edit({ ...value, activeOptionIds: event.target.checked ? [...value.activeOptionIds, option.id] : value.activeOptionIds.filter(id => id !== option.id) })} />Accept {option.label || `option ${index + 1}`}</label>
        <button type="button" disabled={value.assignments.some(row => row.optionId === option.id)} title="Reassign this option's rows before removing it" onClick={() => edit({ ...value, options: value.options.filter(entry => entry.id !== option.id), activeOptionIds: value.activeOptionIds.filter(id => id !== option.id) })}>Remove empty option {index + 1}</button>
      </div>)}
      <button type="button" disabled={value.options.length >= 100} onClick={() => edit({ ...value, options: [...value.options, { id: crypto.randomUUID(), label: `Option ${value.options.length + 1}` }] })}>Add alternative option</button>
    </fieldset>

    {error && <p className="qs-cost-warning" role="alert">{error}</p>}
    {notice && <p className="qs-cost-notice" role="status">{notice}</p>}
    {!result.ok ? <section className="qs-cost-blockers" aria-label="Cost plan blockers" data-testid="qs-cost-blockers">
      <h4>Cost totals withheld</h4><ul>{result.blockers.map((blocker, index) => <li key={`${blocker.itemId}-${blocker.code}-${index}`} data-blocker-code={blocker.code}>
        {blocker.itemId && <strong>{blocker.itemId}: </strong>}{blocker.message}
      </li>)}</ul>
    </section> : <>
      <div className="qs-cost-totals"><CostTotals title="Base tender" value={result.snapshot.baseTotal} currency={value.currency} testId="qs-cost-base-total" />
        <CostTotals title="Accepted total" value={result.snapshot.acceptedTotal} currency={value.currency} testId="qs-cost-accepted-total" /></div>
      {result.snapshot.options.map(option => <div key={option.id} className="qs-cost-option-total" data-testid={`qs-cost-option-${option.id}`} data-active={option.active}>
        <span>{option.label} · {option.active ? "accepted" : "proposed — excluded"}</span><strong data-total-minor={option.totals.totalMinor}>{formatQsMoney(option.totals.totalMinor, value.currency)}</strong>
      </div>)}
      <div className="qs-cost-table-scroll" role="region" aria-label="Priced item breakdown" tabIndex={0}><table className="qs-cost-table">
        <caption>Current measured cost breakdown — tax included in each total</caption>
        <thead><tr><th scope="col">Item / supplier pins</th><th scope="col">Measured / material quantity</th><th scope="col">Scope</th><th scope="col">Net</th><th scope="col">Tax / GST</th><th scope="col">Total</th></tr></thead>
        <tbody>{result.snapshot.items.map(item => <tr key={item.itemId} data-testid={`qs-priced-item-${item.itemId}`}>
          <th scope="row">{item.description}<small>Material: {item.materialSource.supplier} · r{item.materialSource.bookRevision} · line {item.materialSource.sourceLine}</small>
            <small>Labour: {item.labourSource ? `${item.labourSource.supplier} · r${item.labourSource.bookRevision} · line ${item.labourSource.sourceLine}` : item.rate.labourAssumption}</small>
            {item.materialSource.exchangeRate && <small>Material FX: {item.materialSource.exchangeRate.fromCurrency} → {item.materialSource.exchangeRate.toCurrency} at {item.materialSource.exchangeRate.rate} · reviewed by {item.materialSource.exchangeRate.reviewedBy}</small>}
            {item.labourSource?.exchangeRate && <small>Labour FX: {item.labourSource.exchangeRate.fromCurrency} → {item.labourSource.exchangeRate.toCurrency} at {item.labourSource.exchangeRate.rate} · reviewed by {item.labourSource.exchangeRate.reviewedBy}</small>}</th>
          <td>{item.quantity} {item.unit}<small>Material incl. wastage: {item.adjustedMaterialQuantity} {item.unit}</small></td>
          <td>{item.optionId ? value.options.find(option => option.id === item.optionId)?.label : "Base"}<small>{item.included ? "Included" : "Proposed only"}</small></td>
          <td>{formatQsMoney(item.netMinor, value.currency)}</td><td>{formatQsMoney(item.taxMinor, value.currency)}</td><td data-total-minor={item.totalMinor}>{formatQsMoney(item.totalMinor, value.currency)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="qs-cost-note">Each component is rounded half up to cents; inclusive tax is extracted before net markup. Displayed totals sum integer minor units.</p>
    </>}

    <div className="qs-cost-actions"><button type="button" disabled={disabled || !result.ok || value.snapshots.length >= 50} onClick={saveSnapshot}>Save immutable cost revision {value.snapshots.length + 1}</button>
      <button type="button" ref={comparisonTrigger} disabled={!value.snapshots.length} aria-expanded={comparisonOpen} aria-controls={comparisonId} onClick={() => setComparisonOpen(true)}>Compare cost revisions</button></div>
    <p className="qs-cost-note" data-testid="qs-cost-history">{value.snapshots.length} recorded cost revision{value.snapshots.length === 1 ? "" : "s"}. Changing geometry, rates or options recalculates the draft and preserves recorded revisions. Project save status is shown below this worksheet.</p>

    <dialog id={comparisonId} className="qs-cost-comparison" ref={comparisonRef} aria-labelledby={`${comparisonId}-title`} onKeyDown={keepQsComparisonFocus} onCancel={event => { event.preventDefault(); setComparisonOpen(false); }} onClose={() => { setComparisonOpen(false); comparisonTrigger.current?.focus(); }}>
      <div className="qs-cost-heading"><div><h3 id={`${comparisonId}-title`}>Cost revision comparison</h3><p>Quantity, rate and scope contributions reconcile to the accepted total change.</p></div><button type="button" aria-label="Close cost revision comparison" onClick={() => setComparisonOpen(false)}>Close</button></div>
      <div className="qs-cost-fields"><label>Earlier cost revision<select value={selectedPrevious?.input.revision ?? ""} onChange={event => setPreviousRevision(Number(event.target.value))}>
        {!earlierSnapshots.length && <option value="">No earlier revision</option>}{earlierSnapshots.map(snapshot => <option key={snapshot.input.revision} value={snapshot.input.revision}>Revision {snapshot.input.revision} · {snapshot.input.createdBy} · {snapshot.input.currency}</option>)}
      </select></label><label>Later cost revision<select value={currentRevision} onChange={event => setCurrentRevision(event.target.value)}>
        <option value="draft">Current draft · revision {value.snapshots.length + 1}</option>{value.snapshots.slice(1).map(snapshot => <option key={snapshot.input.revision} value={snapshot.input.revision}>Recorded revision {snapshot.input.revision} · {snapshot.input.currency}</option>)}
      </select></label></div>
      {comparison.error && <p className="qs-cost-warning" role="status">{comparison.error}</p>}
      {comparison.delta && <>
        <div className="qs-cost-delta-summary" data-testid="qs-cost-delta-totals">
          <span>Quantity <strong>{formatQsMoney(comparison.delta.totals.quantityMinor, comparison.delta.currency, true)}</strong></span>
          <span>Rate / allowance / tax <strong>{formatQsMoney(comparison.delta.totals.rateMinor, comparison.delta.currency, true)}</strong></span>
          <span>Scope / options <strong>{formatQsMoney(comparison.delta.totals.scopeMinor, comparison.delta.currency, true)}</strong></span>
          <span>Accepted change <strong data-total-minor={comparison.delta.totals.totalMinor}>{formatQsMoney(comparison.delta.totals.totalMinor, comparison.delta.currency, true)}</strong></span>
        </div>
        <div className="qs-cost-table-scroll" role="region" aria-label="Cost revision change table" tabIndex={0}><table className="qs-cost-table">
          <caption>Revision {comparison.delta.previousRevision} to {comparison.delta.currentRevision}. Green: new; red: removed; amber: modified.</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Change</th><th scope="col">Quantity</th><th scope="col">Quantity cost Δ</th><th scope="col">Rate cost Δ</th><th scope="col">Scope cost Δ</th><th scope="col">Accepted Δ</th></tr></thead>
          <tbody>{comparison.delta.rows.map(row => <tr key={row.itemId} data-change={row.status} data-testid={`qs-cost-delta-${row.itemId}`}>
            <th scope="row">{row.description}</th><td><span className="qs-cost-change">{row.status === "new" ? "+ New" : row.status === "removed" ? "− Removed" : row.status === "modified" ? "~ Modified" : "Unchanged"}</span></td>
            <td>{row.before ? `${row.before.quantity} ${row.before.unit}` : "—"} → {row.after ? `${row.after.quantity} ${row.after.unit}` : "—"}<small>Δ {row.quantityDelta ?? "scope change"}</small></td>
            <td>{formatQsMoney(row.quantityMinor, comparison.delta!.currency, true)}</td><td>{formatQsMoney(row.rateMinor, comparison.delta!.currency, true)}</td><td>{formatQsMoney(row.scopeMinor, comparison.delta!.currency, true)}</td><td data-total-minor={row.totalMinor}>{formatQsMoney(row.totalMinor, comparison.delta!.currency, true)}</td>
          </tr>)}</tbody>
        </table></div>
        {comparison.delta.options.map(option => <p className="qs-cost-note" key={option.id}>{option.label}: {option.beforeActive ? "accepted" : "proposed"} → {option.afterActive ? "accepted" : "proposed"}. Proposal change {formatQsMoney(option.proposalDeltaMinor, comparison.delta!.currency, true)}; accepted change {formatQsMoney(option.acceptedDeltaMinor, comparison.delta!.currency, true)}.</p>)}
        <p className="qs-cost-note">Quantity is valued at the earlier rate first; remaining rate, allowance and tax changes follow. Added or removed items, entity/unit changes and option membership changes are scope. Unaccepted proposals never inflate the accepted delta.</p>
      </>}
    </dialog>
  </section>;
}
