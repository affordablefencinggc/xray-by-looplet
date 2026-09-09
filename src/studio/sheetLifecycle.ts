import { z } from "zod";
import type { DocumentRevision, FencingJob } from "./domain.ts";
import { sheetBookmarkSchema, type SheetBookmark } from "./sheetBookmarks.ts";

const identitySchema = z.object({
  jobId: z.string().min(1), documentId: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), importedAt: z.string().datetime({ offset: true }),
  pageCount: z.number().int().positive().max(10000),
}).strict();
export type SheetSourceIdentity = z.infer<typeof identitySchema>;
const lifecycleSchema = z.object({
  format: z.literal("xray.sheet-lifecycle/v1"), identity: identitySchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  pages: z.array(z.object({ pageIndex: z.number().int().nonnegative(), name: z.string().min(1).max(120), archived: z.boolean(),
    discipline: z.string().trim().min(1).max(80).optional(), bookmarks: z.array(sheetBookmarkSchema).max(20).optional(),
  }).strict()).max(10000),
}).strict();
export type SheetLifecycle = z.infer<typeof lifecycleSchema>;
export type SheetAction = { type: "rename"; pageIndex: number; name: string; discipline?: string } | { type: "archive" | "recover"; pageIndex: number } | { type: "move"; pageIndex: number; direction: -1 | 1 }
  | {type:"discipline";pageIndex:number;discipline:string} | {type:"group"}
  | {type:"bookmark";pageIndex:number;bookmark:SheetBookmark} | {type:"remove-bookmark";pageIndex:number;bookmarkId:string};
export type SheetStorage = Pick<Storage, "getItem" | "setItem">;

export function sheetSourceIdentity(jobId: string, document: DocumentRevision): SheetSourceIdentity | null {
  if (document.source === "sample" || !document.sha256 || !document.pageCount) return null;
  const parsed = identitySchema.safeParse({ jobId, documentId: document.id, sha256: document.sha256, importedAt: document.importedAt, pageCount: document.pageCount });
  return parsed.success ? parsed.data : null;
}
export function sheetLifecycleStorageKey(identity: SheetSourceIdentity): string {
  return `xray.sheet-lifecycle.v1:${JSON.stringify([identity.jobId, identity.documentId, identity.sha256, identity.importedAt, identity.pageCount])}`;
}
export function createSheetLifecycle(identity: SheetSourceIdentity): SheetLifecycle {
  identitySchema.parse(identity);
  return { format: "xray.sheet-lifecycle/v1", identity: { ...identity }, revision: 0,
    pages: Array.from({ length: identity.pageCount }, (_, pageIndex) => ({ pageIndex, name: `Sheet ${pageIndex + 1}`, archived: false })) };
}
export function parseSheetLifecycle(raw: string, identity: SheetSourceIdentity): SheetLifecycle {
  const value = lifecycleSchema.parse(JSON.parse(raw));
  if (sheetLifecycleStorageKey(value.identity) !== sheetLifecycleStorageKey(identity)) throw Error("Sheet organisation belongs to a different source revision.");
  const indices = new Set(value.pages.map(p => p.pageIndex));
  if (value.pages.length !== identity.pageCount || indices.size !== identity.pageCount || value.pages.some(p => p.pageIndex >= identity.pageCount || !p.name.trim() || p.name !== p.name.trim())) throw Error("Saved sheet organisation does not match the source pages.");
  const bookmarks=value.pages.flatMap(p=>p.bookmarks??[]);
  if(new Set(bookmarks.map(b=>b.id)).size!==bookmarks.length)throw Error("Saved views contain duplicate identities.");
  return value;
}
export function readSheetLifecycle(identity: SheetSourceIdentity, storage: Pick<Storage, "getItem">): SheetLifecycle {
  const raw = storage.getItem(sheetLifecycleStorageKey(identity));
  return raw === null ? createSheetLifecycle(identity) : parseSheetLifecycle(raw, identity);
}
export function changeSheetLifecycle(value: SheetLifecycle, action: SheetAction): SheetLifecycle {
  parseSheetLifecycle(JSON.stringify(value), value.identity);
  if(action.type==="group") {
    const pages=[...value.pages].sort((a,b)=>(a.discipline??"\uffff").localeCompare(b.discipline??"\uffff", "en", {sensitivity:"base"}));
    return {...value,revision:value.revision+1,pages};
  }
  const index = value.pages.findIndex(p => p.pageIndex === action.pageIndex);
  if (index < 0) throw Error("That page is no longer part of this source.");
  const next = structuredClone(value), page = next.pages[index];
  if(action.type==="discipline") {
    const discipline=action.discipline.trim();
    if(discipline.length>80)throw Error("Use a discipline name up to 80 characters.");
    if(discipline)page.discipline=discipline;else delete page.discipline;
  } else if(action.type==="bookmark") {
    const bookmark=sheetBookmarkSchema.parse(action.bookmark);
    if(next.pages.some(p=>p.bookmarks?.some(b=>b.id===bookmark.id)))throw Error("That saved view already exists.");
    if((page.bookmarks?.length??0)>=20)throw Error("Keep up to 20 saved views per page. Remove an old view before adding another.");
    page.bookmarks=[...(page.bookmarks??[]),bookmark];
  } else if(action.type==="remove-bookmark") {
    if(!page.bookmarks?.some(b=>b.id===action.bookmarkId))throw Error("That saved view no longer exists. Reload before editing.");
    page.bookmarks=page.bookmarks.filter(b=>b.id!==action.bookmarkId);
    if(!page.bookmarks.length)delete page.bookmarks;
  } else if (action.type === "rename") {
    const name = action.name.trim();
    if (!name || name.length > 120) throw Error("Enter a sheet name between 1 and 120 characters.");
    page.name = name;
    if(action.discipline!==undefined){const discipline=action.discipline.trim();if(discipline.length>80)throw Error("Use a discipline name up to 80 characters.");if(discipline)page.discipline=discipline;else delete page.discipline;}
  } else if (action.type === "move") {
    if (page.archived) throw Error("Recover this sheet before changing its order.");
    // Swap with the neighbouring active sheet, preserving archived slots and source indices.
    let other = index + action.direction;
    while (other >= 0 && other < next.pages.length && next.pages[other].archived) other += action.direction;
    if (other < 0 || other >= next.pages.length) return value;
    [next.pages[index], next.pages[other]] = [next.pages[other], next.pages[index]];
  } else page.archived = action.type === "archive";
  next.revision += 1;
  return next;
}
/** Export every original page in managed order, including archive status and saved view metadata. */
export function exportSheetRegister(value:SheetLifecycle, sourceName:string):string {
  const checked=parseSheetLifecycle(JSON.stringify(value),value.identity);
  return JSON.stringify({format:"xray.sheet-register/v1",sourceName,source:checked.identity,
    sheets:checked.pages.map((page,index)=>({order:index+1,originalPage:page.pageIndex+1,name:page.name,discipline:page.discipline??null,archived:page.archived,bookmarks:page.bookmarks??[]}))},null,2);
}
/** Call within the key's exclusive Web Lock. A stale UI cannot replace another window's edits. */
export function saveSheetLifecycle(previous: SheetLifecycle, action: SheetAction, storage: SheetStorage): SheetLifecycle {
  const current = readSheetLifecycle(previous.identity, storage);
  if (JSON.stringify(current) !== JSON.stringify(previous)) throw Error("Sheet organisation changed in another window. Reload the list before trying again.");
  const next = changeSheetLifecycle(previous, action);
  if (next !== previous) storage.setItem(sheetLifecycleStorageKey(next.identity), JSON.stringify(next));
  return next;
}
type JobSources = Pick<FencingJob, "id" | "documents">;
/** Counts only records linked to this active source page; no estimate/BOM is invalidated by archive. Saved views come from the page's lifecycle value when supplied. */
export function sheetArchiveImpact(job: Pick<FencingJob, "id" | "documents" | "activeDocumentId"> & {
  calibrations: Pick<FencingJob["calibrations"][number], "sheet">[];
  runs: Pick<FencingJob["runs"][number], "id" | "sheet" | "photoIds">[];
  gates: Pick<FencingJob["gates"][number], "id" | "sheet" | "photoIds">[];
  photos: Pick<FencingJob["photos"][number], "id" | "runIds" | "gateIds">[];
  annotations?: { sheet: number; documentId: string }[];
}, identity: SheetSourceIdentity, pageIndex: number, lifecycle?: Pick<SheetLifecycle, "identity" | "pages">) {
  const document = job.documents.find(d => d.id === job.activeDocumentId);
  const actual = document && sheetSourceIdentity(job.id, document);
  if (!actual || sheetLifecycleStorageKey(actual) !== sheetLifecycleStorageKey(identity) || pageIndex < 0 || pageIndex >= identity.pageCount) throw Error("The source drawing changed. Review the sheet again before archiving.");
  if (lifecycle && sheetLifecycleStorageKey(lifecycle.identity) !== sheetLifecycleStorageKey(identity)) throw Error("The source drawing changed. Review the sheet again before archiving.");
  const savedViews = lifecycle?.pages.find(p => p.pageIndex === pageIndex)?.bookmarks?.length ?? 0;
  const runs = job.runs.filter(r => r.sheet === pageIndex), items = job.gates.filter(g => g.sheet === pageIndex);
  const runIds = new Set(runs.map(r => r.id)), itemIds = new Set(items.map(g => g.id));
  const photoIds = new Set([...runs, ...items].flatMap(row => row.photoIds));
  const photos = job.photos.filter(photo => photoIds.has(photo.id) || photo.runIds.some(id => runIds.has(id)) || photo.gateIds.some(id => itemIds.has(id)));
  return { calibrations: job.calibrations.filter(c => c.sheet === pageIndex).length, traces: runs.length, items: items.length,
    annotations: (job.annotations ?? []).filter(a => a.sheet === pageIndex && a.documentId === identity.documentId).length, linkedPhotos: photos.length, savedViews };
}
/** Capture every saved source sidecar, including inactive documents, for a portable backup. */
export function readJobSheetMetadata(job: JobSources, storage: Pick<Storage, "getItem">): string | null {
  const values: SheetLifecycle[] = [];
  for (const document of job.documents) {
    const identity = sheetSourceIdentity(job.id, document);
    if (!identity) continue;
    const raw = storage.getItem(sheetLifecycleStorageKey(identity));
    if (raw !== null) values.push(parseSheetLifecycle(raw, identity));
  }
  return values.length ? JSON.stringify(values) : null;
}
export function validateJobSheetMetadata(raw: string | null, job: JobSources): SheetLifecycle[] {
  if (raw === null) return [];
  const values = z.array(lifecycleSchema).max(10000).parse(JSON.parse(raw));
  const seen = new Set<string>();
  return values.map(value => {
    const source = job.documents.find(d => d.id === value.identity.documentId);
    const identity = source && sheetSourceIdentity(job.id, source);
    if (!identity || seen.has(source.id)) throw Error("Sheet organisation contains an unknown or duplicate source.");
    seen.add(source.id);
    return parseSheetLifecycle(JSON.stringify(value), identity);
  });
}
