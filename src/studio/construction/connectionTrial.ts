import { z } from "zod";

export const CONNECTION_SOURCE = {
  sha256: "28fe1e51d38cbb1347e5875870b60bcd4ed9a9a0b9dc66e1bf5a611ce3f693f6",
  title: "Thornton Fire Station 8", issue: "2024-09-27", pages: 23,
  url: "https://solicitations.thorntonco.gov/files/filerecords/view/vendorattachment/21725/05-cot-fire-station--8-structure-bid-set.pdf",
  localUrl: "/sources/thornton-connection-trial/structural.pdf",
} as const;
export const CONNECTION_SCOPE = "Eight interior W10×22 beams in the second apparatus-bay roof span from the north, between W24×94 girders at elevations 125′-0¾″ and 125′-4″. S2.2, between grids E–G and 7–8. The two outermost beam lines are excluded.";
export const CONNECTION_UNKNOWN = ["Bolt length / grip", "Nut specification and quantity", "Washer specification and quantity", "Specified hardware weight (kg)", "Packed storage volume (m³)"];
export const CONNECTION_EXCLUSIONS = "Other roof spans, outermost beam lines, girder ends, bracing, deck fixings, anchor rods, joists, stairs and all other building hardware. This is a manually traced drawing trial, not automatic whole-building extraction or a procurement release.";
export const CONNECTION_EVIDENCE = [
  { id: "plan", sheet: "S2.2", page: 10, title: "Physical beam locations", crop: [.385, .452, .16, .091] },
  { id: "schedule", sheet: "S0.6", page: 6, title: "Bolted connection schedule", crop: [.62, .427, .21, .32] },
  { id: "detail", sheet: "S5.1 · detail 1", page: 18, title: "Wide-flange beam to beam", crop: [.665, .045, .211, .293] },
] as const;

// Nominal depth, not measured depth. S5.1/1 explicitly uses the lesser beam depth.
export function scheduledBoltCount(beamDepthIn: number, supportDepthIn: number): number {
  const d = Math.min(beamDepthIn, supportDepthIn);
  if (![beamDepthIn, supportDepthIn].every(n => Number.isInteger(n) && n > 0 && n <= 36)) throw Error("Depth is outside the verified schedule.");
  return d <= 11 ? 2 : d <= 14 ? 3 : d <= 17 ? 4 : d <= 20 ? 5 : d <= 23 ? 6 : d <= 29 ? 7 : d <= 32 ? 8 : d <= 35 ? 9 : 10;
}
export const TRIAL_CONNECTIONS = Array.from({ length: 8 }, (_, index) => ["N", "S"].map(end => ({
  id: `FS8-S2.2-B2-I${index + 1}-${end}`,
  beam: `I${index + 1}`, end, beamDepthIn: 10, supportDepthIn: 24,
  // Normalized positions on the original page, solely for evidence navigation.
  point: { x: (782 + index * (233 / 7)) / 1920, y: (end === "N" ? 596 : 684) / 1280 },
  evidence: ["plan", "schedule", "detail"],
}))).flat();
export function compileTrial(connections = TRIAL_CONNECTIONS) {
  const ids = new Set<string>();
  const physical = new Set<string>();
  const bolts = connections.flatMap(connection => {
    const location = `FS8-S2.2-B2-${connection.beam}-${connection.end}`;
    if (ids.has(connection.id) || physical.has(location)) throw Error("Duplicate physical connection.");
    ids.add(connection.id);
    physical.add(location);
    return Array.from({ length: scheduledBoltCount(connection.beamDepthIn, connection.supportDepthIn) }, (_, i) => ({
      stableIdentifier: `${location}/bolt-${i + 1}`, connectionId: connection.id,
      description: '7/8-inch diameter ASTM A325N bolt', quantity: 1,
      lengthMm: null, specifiedWeightKg: null, packedVolumeM3: null,
      evidence: [...new Set(connection.evidence)],
    }));
  });
  return { connectionCount: ids.size, boltCount: bolts.length, bolts };
}

const reviewSchema = z.object({ id: z.string(), reviewed: z.boolean(), note: z.string().max(2000), revision: z.number().int().positive() }).strict()
  .refine(r => !r.reviewed || r.note.trim().length > 0, "Add a review note before accepting a connection.");
export const trialSchema = z.object({
  schema: z.literal("xray.connection-trial/v1"), sourceSha256: z.literal(CONNECTION_SOURCE.sha256),
  definitionRevision: z.literal(1), projectId: z.string().min(1), reviews: z.array(reviewSchema).length(16),
}).strict().refine(v => new Set(v.reviews.map(r => r.id)).size === 16 && v.reviews.every(r => TRIAL_CONNECTIONS.some(c => c.id === r.id)), "Duplicate, missing or unknown physical connection.");
export type ConnectionTrial = z.infer<typeof trialSchema>;
export type TrialSession = { value: ConnectionTrial; raw: string | null; blocked: boolean; error: string | null };
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export const trialKey = (projectId: string) => `xray:connection-trial:${encodeURIComponent(projectId)}:${CONNECTION_SOURCE.sha256}`;
export const createTrial = (projectId: string): ConnectionTrial => trialSchema.parse({ schema: "xray.connection-trial/v1", sourceSha256: CONNECTION_SOURCE.sha256, definitionRevision: 1, projectId,
  reviews: TRIAL_CONNECTIONS.map(c => ({ id: c.id, reviewed: false, note: "", revision: 1 })) });
export function restoreTrial(storage: StoragePort, projectId: string): TrialSession {
  let raw: string | null = null;
  try {
    raw = storage.getItem(trialKey(projectId));
    const value = raw === null ? createTrial(projectId) : trialSchema.parse(JSON.parse(raw));
    if (value.projectId !== projectId) throw Error("Wrong project.");
    return { value, raw, blocked: false, error: null };
  } catch { return { value: createTrial(projectId), raw, blocked: true, error: "Saved review could not be restored. Original data is preserved; saving and export are blocked until recovery." }; }
}
export function saveTrial(storage: StoragePort, session: TrialSession, value: ConnectionTrial): TrialSession {
  if (session.blocked) return session;
  try {
    const parsed = trialSchema.parse(value), key = trialKey(session.value.projectId);
    if (parsed.projectId !== session.value.projectId) throw Error("Project identity changed.");
    if (storage.getItem(key) !== session.raw) return { ...session, blocked: true, error: "Saved review changed in another session. Saving is blocked. Retry restore to recover it." };
    const raw = JSON.stringify(parsed);
    storage.setItem(key, raw);
    return { value: parsed, raw, blocked: false, error: null };
  } catch (error) { return { ...session, error: `Review was not saved: ${error instanceof Error ? error.message : String(error)}` }; }
}
export function trialExport(value: ConnectionTrial) {
  const parsed = trialSchema.parse(value);
  return { ...parsed, source: CONNECTION_SOURCE, scope: CONNECTION_SCOPE, exclusions: CONNECTION_EXCLUSIONS,
    status: "Preliminary bounded connection count; not a whole-building bill of materials",
    method: "Manually traced physical beam ends × scheduled bolts; repeated detail views do not add physical instances",
    evidence: CONNECTION_EVIDENCE, connections: TRIAL_CONNECTIONS, ...compileTrial(),
    unresolved: CONNECTION_UNKNOWN, nuts: null, washers: null, specifiedWeightKg: null, packedVolumeM3: null };
}
