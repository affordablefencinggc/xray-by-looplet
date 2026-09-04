/**
 * Fail-closed external handoff boundary.
 *
 * The browser has no authenticated server transport, idempotency contract, or
 * durable acknowledgement receipt. These helpers therefore expose measured
 * quantities only and can never claim that pricing or an external push worked.
 */

import type { Markup, Trade } from "./store";

export interface UnpricedQuantityLine {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  trade: string | null;
  source: "recorded-markups";
  pricingStatus: "unavailable";
}

export interface UnpricedQuoteDraft {
  planName: string | null;
  sheet: number;
  scaleM: number;
  lines: UnpricedQuantityLine[];
  pricingStatus: "unavailable";
  handoffStatus: "unavailable";
}

export interface HandoffBlocked {
  success: false;
  url: null;
  reason: string;
}

export const EXTERNAL_HANDOFF_UNAVAILABLE =
  "External handoff is unavailable until an authenticated server transport, idempotency key, and durable receipt are implemented.";

export function buildLoopletQuoteLines(
  markups: Markup[],
  trades: Trade[],
  planName: string | null,
  sheet: number,
): UnpricedQuoteDraft {
  const groups: Array<{
    id: string;
    name: string;
    unit: string;
    kinds: Markup["kind"][];
    trade: Trade | undefined;
    round: (value: number) => number;
  }> = [
    { id: "quantity-length", name: "Recorded length", unit: "m", kinds: ["length", "sketch"], trade: trades[0], round: (value) => Math.round(value * 100) / 100 },
    { id: "quantity-area", name: "Recorded area", unit: "m²", kinds: ["area"], trade: trades[1], round: (value) => Math.round(value * 100) / 100 },
    { id: "quantity-count", name: "Recorded count", unit: "ea", kinds: ["count"], trade: trades[2], round: Math.round },
  ];

  const lines = groups.flatMap((group) => {
    const quantity = group.round(
      markups.filter((markup) => group.kinds.includes(markup.kind)).reduce((total, markup) => total + markup.value, 0),
    );
    if (quantity <= 0) return [];
    return [{
      id: group.id,
      name: group.name,
      quantity,
      unit: group.unit,
      trade: group.trade?.name ?? null,
      source: "recorded-markups" as const,
      pricingStatus: "unavailable" as const,
    }];
  });

  return {
    planName,
    sheet: sheet + 1,
    scaleM: 1,
    lines,
    pricingStatus: "unavailable",
    handoffStatus: "unavailable",
  };
}

export function pushToLoopletCrm(_draft: UnpricedQuoteDraft): HandoffBlocked {
  return { success: false, url: null, reason: EXTERNAL_HANDOFF_UNAVAILABLE };
}
