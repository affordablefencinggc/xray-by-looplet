import { priceBookLibrarySchema, priceLineAmount, type BomMapping, type PriceBookLibrary } from "./priceBooks.ts";

/** The committed material-register lines the worksheet may price. Only a current (not invalidated) snapshot is passed. */
export type BomPricingSource = {
  commitRevision: number;
  lines: ReadonlyArray<{ key: string; description: string; quantity: string; unit: string }>;
};
export type BomPricingChange =
  | { kind: "added"; key: string; quantity: string }
  | { kind: "updated"; key: string; from: string; to: string }
  | { kind: "removed"; key: string; quantity: string };

/** Material register key: the item code, or the group key for an uncoded line. */
export function bomLineKey(line: { itemCode: string | null; groupKey: string }) { return line.itemCode ?? line.groupKey; }

const SCALE = 1_000_000n;
function scaled(value: string, places: number) {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > places) throw Error(`Expected at most ${places} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0") || "0");
}
function formatScaled(value: bigint) {
  const whole = value / SCALE, fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
/**
 * Material quantity × factor in exact decimal arithmetic. "up" rounds to the next whole purchase unit;
 * "exact" rounds half-up to the worksheet's six decimal places.
 */
export function derivedQuantity(bomQuantity: string, factor: string, rounding: BomMapping["rounding"]): string {
  const places = Math.max(6, bomQuantity.split(".")[1]?.length ?? 0);
  const product = scaled(bomQuantity, places) * scaled(factor, 6); // scale 10^(places+6)
  const toSix = 10n ** BigInt(places);
  if (rounding === "up") {
    const unit = toSix * SCALE;
    return ((product + unit - 1n) / unit).toString();
  }
  return formatScaled((product + toSix / 2n) / toSix);
}

export function setBomMapping(library: PriceBookLibrary, mapping: BomMapping): PriceBookLibrary {
  const current = priceBookLibrarySchema.parse(library);
  const book = current.books.find(b => b.id === mapping.bookId);
  if (!book || book.archived || !book.revisions.find(r => r.revision === mapping.bookRevision)?.rows.some(r => r.sourceLine === mapping.sourceLine))
    throw Error("Choose an active saved rate for this material.");
  const mappings = [...(current.bomMappings ?? []).filter(m => m.key !== mapping.key), mapping];
  return priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1, bomMappings: mappings });
}

export function clearBomMapping(library: PriceBookLibrary, key: string): PriceBookLibrary {
  const current = priceBookLibrarySchema.parse(library);
  if (!(current.bomMappings ?? []).some(m => m.key === key)) throw Error("That material is not mapped.");
  return priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1, bomMappings: (current.bomMappings ?? []).filter(m => m.key !== key) });
}

/**
 * Brings BOM-linked worksheet lines in line with the current material register and mappings.
 * Manual lines are never touched. A linked line keeps its identity when its quantity or rate changes,
 * and is removed when its material or mapping no longer exists. Returns the input unchanged when
 * nothing differs, so callers can skip saving.
 */
export function syncBomPricedLines(library: PriceBookLibrary, source: BomPricingSource, makeId = () => crypto.randomUUID(), now = new Date().toISOString()):
  { library: PriceBookLibrary; changes: BomPricingChange[] } {
  const current = priceBookLibrarySchema.parse(library);
  const byKey = new Map(source.lines.map(line => [line.key, line]));
  const changes: BomPricingChange[] = [];
  const worksheet: PriceBookLibrary["worksheet"] = [];
  const handled = new Set<string>();
  for (const line of current.worksheet) {
    if (!line.bom) { worksheet.push(line); continue; }
    const mapping = current.bomMappings?.find(m => m.key === line.bom!.key), material = byKey.get(line.bom.key);
    if (!mapping || !material) { changes.push({ kind: "removed", key: line.bom.key, quantity: line.quantity }); continue; }
    handled.add(mapping.key);
    const quantity = derivedQuantity(material.quantity, mapping.factor, mapping.rounding);
    const next = { ...line, bookId: mapping.bookId, bookRevision: mapping.bookRevision, sourceLine: mapping.sourceLine, quantity,
      bom: { key: mapping.key, commitRevision: source.commitRevision, bomQuantity: material.quantity, unit: material.unit, factor: mapping.factor, rounding: mapping.rounding } };
    if (JSON.stringify(next) !== JSON.stringify(line)) {
      if (quantity !== line.quantity) changes.push({ kind: "updated", key: mapping.key, from: line.quantity, to: quantity });
    }
    worksheet.push(next);
  }
  for (const mapping of current.bomMappings ?? []) {
    const material = byKey.get(mapping.key);
    if (handled.has(mapping.key) || !material) continue;
    const quantity = derivedQuantity(material.quantity, mapping.factor, mapping.rounding);
    worksheet.push({ id: makeId(), bookId: mapping.bookId, bookRevision: mapping.bookRevision, sourceLine: mapping.sourceLine, quantity, addedAt: now,
      bom: { key: mapping.key, commitRevision: source.commitRevision, bomQuantity: material.quantity, unit: material.unit, factor: mapping.factor, rounding: mapping.rounding } });
    changes.push({ kind: "added", key: mapping.key, quantity });
  }
  if (JSON.stringify(worksheet) === JSON.stringify(current.worksheet)) return { library: current, changes: [] };
  for (const line of worksheet) {
    const revision = current.books.find(b => b.id === line.bookId)?.revisions.find(r => r.revision === line.bookRevision);
    const row = revision?.rows.find(r => r.sourceLine === line.sourceLine);
    if (!revision || !row) throw Error("A mapped rate is missing from its price book.");
    priceLineAmount(row.rate, line.quantity, revision.metadata.amountDecimals);
  }
  return { library: priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1, worksheet }), changes };
}
