import { z } from "zod";

export const ALTITUDE_SHA = "0136bfd4e943f648a74ce0877e5c20ea835b045a679483f465f0a1738a6805a7";
const residentialFloors = [...Array.from({ length: 23 }, (_, i) => i + 8), 44, 45, 46, 47, 48];
const hotelFloors = Array.from({ length: 11 }, (_, i) => i + 33);
export const TAKEOFF_DEFINITIONS = [
  { id: "residential-entrance", name: "Apartment entrance allowances", category: "Doors", page: 48, floors: residentialFloors, observed: 9,
    basis: "Nine labelled apartments on the current main plan (5 one-bedroom, 3 two-bedroom, 1 three-bedroom). Allowance assumes one entrance per apartment, not a verified door-symbol count. Floors 8-30 and 44-48. EDG 2 inset excluded.",
    missing: "Door schedule, leaf count, sizes, frame specification and fire rating. Internal apartment doors are not drawn." },
  { id: "hotel-entrance", name: "Hotel entrance allowances", category: "Doors", page: 50, floors: hotelFloors, observed: 19,
    basis: "Nineteen labelled guestrooms, including suites 14 and 19. Allowance assumes one entrance per guestroom, subject to the door schedule. Floors 33-43. EDG 2 inset excluded.",
    missing: "Door schedule, leaf count, sizes, frame specification and fire rating. Internal guestroom doors are not drawn." },
  { id: "residential-windows", name: "Residential window units", category: "Windows", page: 48, floors: residentialFloors, observed: null,
    basis: "The typical plan shows the facade outline; individual window units cannot be reliably separated.",
    missing: "Window/curtain-wall schedule and coordinated elevations; perimeter length is not a window count." },
  { id: "hotel-windows", name: "Hotel window units", category: "Windows", page: 50, floors: hotelFloors, observed: null,
    basis: "The typical plan shows the facade outline; individual window units cannot be reliably separated.",
    missing: "Window/curtain-wall schedule and coordinated elevations." },
  { id: "structural-members", name: "Structural members", category: "Structure", page: 48, floors: [...residentialFloors, ...hotelFloors], observed: null,
    basis: "Dark marks are visible on the architectural plans. Their structural classification and continuity between levels are unconfirmed.",
    missing: "Structural plans, legend, member schedule, sections and connection details. Repeated plan marks are not unique physical columns." },
] as const;

const positive = z.number().finite().positive().max(1e9).nullable();
export const stockInputSchema = z.object({
  unitsPerPackage: z.number().int().positive().max(1e6).nullable(),
  lengthM: positive, widthM: positive, heightM: positive,
  unitWeightKg: positive,
  reference: z.string().max(1000),
}).strict().refine(v => ![v.unitsPerPackage, v.lengthM, v.widthM, v.heightM, v.unitWeightKg].some(n => n !== null) || v.reference.trim().length > 0,
  "Add a supplier/specification reference for entered packaging or weight.");
export type StockInput = z.infer<typeof stockInputSchema>;
const rowSchema = z.object({
  id: z.enum(["residential-entrance", "hotel-entrance", "residential-windows", "hotel-windows", "structural-members"]),
  countPerFloor: z.number().int().nonnegative().max(100000).nullable(),
  revision: z.number().int().positive(),
  review: z.enum(["pending", "reviewed"]),
  note: z.string().max(2000),
  stock: stockInputSchema,
}).strict();
export type TakeoffRow = z.infer<typeof rowSchema>;
export const takeoffSchema = z.object({
  schema: z.literal("xray.source-takeoff/v1"),
  sourceSha256: z.literal(ALTITUDE_SHA),
  projectId: z.string().min(1), revision: z.number().int().positive(),
  rows: z.array(rowSchema).length(TAKEOFF_DEFINITIONS.length),
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.rows.map(r => r.id));
  if (ids.size !== TAKEOFF_DEFINITIONS.length) ctx.addIssue({ code: "custom", message: "Duplicate or missing takeoff group." });
  for (const row of value.rows) {
    const definition = TAKEOFF_DEFINITIONS.find(d => d.id === row.id)!;
    if (row.countPerFloor !== definition.observed && !row.note.trim()) ctx.addIssue({ code: "custom", message: "A changed count needs a source note." });
    if (row.review === "reviewed" && (row.countPerFloor === null || !row.note.trim())) ctx.addIssue({ code: "custom", message: "Review needs a count and a note; unknown is not zero." });
  }
});
export type SourceTakeoff = z.infer<typeof takeoffSchema>;
export function createAltitudeTakeoff(projectId: string): SourceTakeoff {
  return takeoffSchema.parse({ schema: "xray.source-takeoff/v1", sourceSha256: ALTITUDE_SHA, projectId, revision: 1,
    rows: TAKEOFF_DEFINITIONS.map(d => ({ id: d.id, countPerFloor: d.observed, revision: 1, review: "pending", note: "",
      stock: { unitsPerPackage: null, lengthM: null, widthM: null, heightM: null, unitWeightKg: null, reference: "" } })) });
}
export function rowQuantity(row: TakeoffRow): number | null {
  return row.countPerFloor === null ? null : row.countPerFloor * TAKEOFF_DEFINITIONS.find(d => d.id === row.id)!.floors.length;
}
export function updateTakeoffRow(value: SourceTakeoff, next: TakeoffRow): SourceTakeoff {
  const old = value.rows.find(r => r.id === next.id);
  if (!old) throw Error("Unknown takeoff group.");
  const changed = old.countPerFloor !== next.countPerFloor || JSON.stringify(old.stock) !== JSON.stringify(next.stock);
  return takeoffSchema.parse({ ...value, revision: value.revision + 1,
    rows: value.rows.map(r => r.id === next.id ? { ...next, revision: old.revision + 1, review: changed ? "pending" : next.review } : r) });
}
export function stockTotals(value: SourceTakeoff) {
  const rows = value.rows.map(row => {
    const quantity = rowQuantity(row), p = row.stock;
    const packageCount = quantity === null || p.unitsPerPackage === null ? null : Math.ceil(quantity / p.unitsPerPackage);
    const volumeM3 = packageCount === null || p.lengthM === null || p.widthM === null || p.heightM === null ? null : packageCount * p.lengthM * p.widthM * p.heightM;
    const weightKg = quantity === null || p.unitWeightKg === null ? null : quantity * p.unitWeightKg;
    return { id: row.id, quantity, packageCount, volumeM3, weightKg };
  });
  const volumes = rows.filter(r => r.volumeM3 !== null), weights = rows.filter(r => r.weightKg !== null);
  return { rows, knownVolumeM3: volumes.length ? volumes.reduce((s, r) => s + r.volumeM3!, 0) : null,
    knownWeightKg: weights.length ? weights.reduce((s, r) => s + r.weightKg!, 0) : null,
    volumeCoverage: volumes.length, weightCoverage: weights.length, totalGroups: rows.length };
}
export function takeoffKey(projectId: string) { return `xray:source-takeoff:v1:${encodeURIComponent(projectId)}:${ALTITUDE_SHA}`; }
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type TakeoffSession = { value: SourceTakeoff; raw: string | null; blocked: boolean; error: string | null };
export function restoreTakeoff(storage: StoragePort, projectId: string): TakeoffSession {
  let raw: string | null = null;
  try {
    raw = storage.getItem(takeoffKey(projectId));
    const value = raw === null ? createAltitudeTakeoff(projectId) : takeoffSchema.parse(JSON.parse(raw));
    if (value.projectId !== projectId) throw Error("Saved takeoff belongs to another project.");
    return { value, raw, blocked: false, error: null };
  } catch {
    return { value: createAltitudeTakeoff(projectId), raw, blocked: true, error: "Saved takeoff could not be restored. Original data is preserved; saving is blocked. Retry restore after recovery." };
  }
}
export function persistTakeoff(storage: StoragePort, session: TakeoffSession, value: SourceTakeoff): TakeoffSession {
  if (session.blocked) return session;
  try {
    const parsed = takeoffSchema.parse(value);
    if (parsed.projectId !== session.value.projectId) throw Error("Project identity changed.");
    if (storage.getItem(takeoffKey(parsed.projectId)) !== session.raw) {
      return { ...session, blocked: true, error: "Saved takeoff changed in another session. Saving is blocked; retry restore to load it." };
    }
    const raw = JSON.stringify(parsed);
    storage.setItem(takeoffKey(parsed.projectId), raw);
    return { value: parsed, raw, blocked: false, error: null };
  } catch (e) {
    return { ...session, error: `Takeoff was not saved: ${e instanceof Error ? e.message : String(e)}` };
  }
}
