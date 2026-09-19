import {
  canonicalQsJson, compareText, freeze, parseQsCostSnapshot, priceQsComponents,
  type QsCostSnapshot, type QsPricedItem,
} from "./qsRateBook.ts";

export type QsCostDeltaRow = {
  itemId: string; description: string; status: "new" | "removed" | "modified" | "unchanged";
  before: QsPricedItem | null; after: QsPricedItem | null;
  /** Null for additions/removals or incompatible units. Never sums unlike units. */
  quantityDelta: string | null;
  /** Exact financial attribution in integer minor units, including tax. */
  quantityMinor: number; rateMinor: number; scopeMinor: number; totalMinor: number;
  /** Includes proposed options, even when excluded from the accepted tender. */
  proposalDeltaMinor: number;
};
export type QsCostDelta = {
  format: "xray.qs-cost-delta/v1"; projectId: string;
  currency: QsCostSnapshot["input"]["currency"];
  previousRevision: number; currentRevision: number;
  attribution: "quantity-at-old-rate-then-rate-at-new-quantity;scope-membership-separate/v1";
  rows: QsCostDeltaRow[];
  totals: { quantityMinor: number; rateMinor: number; scopeMinor: number; totalMinor: number };
  baseDeltaMinor: number;
  options: { id: string; label: string; beforeActive: boolean; afterActive: boolean; proposalDeltaMinor: number; acceptedDeltaMinor: number }[];
};

/** Compare independently revalidated immutable snapshots. The counterfactual is
 * old rate/policy at the new measured quantity: quantity is attributed first,
 * then all rate/allowance/markup/tax changes. Add/remove, changed entity/unit,
 * option reassignment and option activation are scope. Each cent is assigned
 * once; proposed options remain visible without changing the base tender. */
export function compareQsCostPlans(rawPrevious: unknown, rawCurrent: unknown): QsCostDelta {
  const previous = parseQsCostSnapshot(rawPrevious), current = parseQsCostSnapshot(rawCurrent);
  if (previous.input.projectId !== current.input.projectId) throw Error("Cost revisions belong to different projects.");
  if (previous.input.currency !== current.input.currency) throw Error("Cost revisions use different currencies; no implicit FX comparison is permitted.");
  if (current.input.revision <= previous.input.revision) throw Error("Compare against an earlier immutable cost revision.");
  if (current.input.createdAt < previous.input.createdAt) throw Error("The later cost revision cannot predate the earlier revision.");
  for (const oldBook of previous.input.priceBooks.books) {
    const nextBook = current.input.priceBooks.books.find(book => book.id === oldBook.id);
    if (!nextBook || canonicalQsJson(nextBook.revisions.slice(0, oldBook.revisions.length)) !== canonicalQsJson(oldBook.revisions))
      throw Error("Supplier revision history was removed or rewritten; append a new source revision.");
  }
  for (const oldRate of previous.input.rateBook.rates) {
    const nextRate = current.input.rateBook.rates.find(rate => rate.id === oldRate.id && rate.revision === oldRate.revision);
    if (!nextRate || canonicalQsJson(nextRate) !== canonicalQsJson(oldRate)) throw Error("Contractor rate history was removed or rewritten; append a new rate revision.");
  }
  for (const oldFx of previous.input.fxRates) {
    const sameRevision = current.input.fxRates.find(rate => rate.id === oldFx.id && rate.revision === oldFx.revision);
    if (sameRevision && canonicalQsJson(sameRevision) !== canonicalQsJson(oldFx)) throw Error("Exchange-rate provenance was rewritten under the same revision; select a new reviewed FX revision.");
  }
  const oldItems = new Map(previous.items.map(item => [item.itemId, item]));
  const newItems = new Map(current.items.map(item => [item.itemId, item]));
  const ids = [...new Set([...oldItems.keys(), ...newItems.keys()])].sort(compareText);
  const rows = ids.map(itemId => {
    const before = oldItems.get(itemId) ?? null, after = newItems.get(itemId) ?? null;
    const oldAmount = BigInt(before?.included ? before.totalMinor : 0);
    const newAmount = BigInt(after?.included ? after.totalMinor : 0);
    let quantityMinor = 0n, rateMinor = 0n, scopeMinor = 0n;
    const sameScope = before && after && before.unit === after.unit && before.optionId === after.optionId
      && before.binding.entityId === after.binding.entityId && before.included === after.included;
    if (!sameScope) scopeMinor = newAmount - oldAmount;
    else if (before.included && after.included) {
      const counterfactual = BigInt(priceQsComponents(after.quantity, before.rate, before.materialSource, before.labourSource).totalMinor);
      quantityMinor = counterfactual - oldAmount;
      rateMinor = newAmount - counterfactual;
    }
    const totalMinor = newAmount - oldAmount;
    if (quantityMinor + rateMinor + scopeMinor !== totalMinor) throw Error("Item delta does not reconcile.");
    const status: QsCostDeltaRow["status"] = !before ? "new" : !after ? "removed" : canonicalQsJson(before) === canonicalQsJson(after) ? "unchanged" : "modified";
    return { itemId, description: after?.description ?? before!.description, status, before, after,
      quantityDelta: before && after && before.unit === after.unit ? subtractQsDecimal(after.quantity, before.quantity) : null,
      quantityMinor: signedMinor(quantityMinor), rateMinor: signedMinor(rateMinor), scopeMinor: signedMinor(scopeMinor), totalMinor: signedMinor(totalMinor),
      proposalDeltaMinor: signedMinor(BigInt(after?.totalMinor ?? 0) - BigInt(before?.totalMinor ?? 0)) };
  });
  const total = (field: "quantityMinor" | "rateMinor" | "scopeMinor" | "totalMinor") => rows.reduce((sum, row) => sum + BigInt(row[field]), 0n);
  const quantityMinor = total("quantityMinor"), rateMinor = total("rateMinor"), scopeMinor = total("scopeMinor"), totalMinor = total("totalMinor");
  if (quantityMinor + rateMinor + scopeMinor !== totalMinor || totalMinor !== BigInt(current.acceptedTotal.totalMinor) - BigInt(previous.acceptedTotal.totalMinor))
    throw Error("Revision deltas do not reconcile with the accepted totals.");
  const oldOptions = new Map(previous.options.map(option => [option.id, option]));
  const newOptions = new Map(current.options.map(option => [option.id, option]));
  const options = [...new Set([...oldOptions.keys(), ...newOptions.keys()])].sort(compareText).map(id => {
    const before = oldOptions.get(id), after = newOptions.get(id);
    return { id, label: after?.label ?? before!.label, beforeActive: before?.active ?? false, afterActive: after?.active ?? false,
      proposalDeltaMinor: signedMinor(BigInt(after?.totals.totalMinor ?? 0) - BigInt(before?.totals.totalMinor ?? 0)),
      acceptedDeltaMinor: signedMinor(BigInt(after?.active ? after.totals.totalMinor : 0) - BigInt(before?.active ? before.totals.totalMinor : 0)) };
  });
  const baseDeltaMinor = signedMinor(BigInt(current.baseTotal.totalMinor) - BigInt(previous.baseTotal.totalMinor));
  if (BigInt(baseDeltaMinor) + options.reduce((sum, option) => sum + BigInt(option.acceptedDeltaMinor), 0n) !== totalMinor) throw Error("Base and option deltas do not reconcile.");
  return freeze<QsCostDelta>({ format: "xray.qs-cost-delta/v1", projectId: current.input.projectId, currency: current.input.currency,
    previousRevision: previous.input.revision, currentRevision: current.input.revision,
    attribution: "quantity-at-old-rate-then-rate-at-new-quantity;scope-membership-separate/v1", rows,
    totals: { quantityMinor: signedMinor(quantityMinor), rateMinor: signedMinor(rateMinor), scopeMinor: signedMinor(scopeMinor), totalMinor: signedMinor(totalMinor) }, baseDeltaMinor, options });
}

export function subtractQsDecimal(next: string, previous: string): string {
  const [ni, nf = ""] = next.split("."), [pi, pf = ""] = previous.split(".");
  const scale = Math.max(nf.length, pf.length);
  const delta = BigInt(ni + nf.padEnd(scale, "0")) - BigInt(pi + pf.padEnd(scale, "0"));
  const negative = delta < 0n, digits = (negative ? -delta : delta).toString().padStart(scale + 1, "0");
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${scale ? digits.slice(0, -scale) : digits}${fraction ? `.${fraction}` : ""}`;
}
function signedMinor(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Delta exceeds the safe integer minor-unit limit.");
  return Number(value);
}
