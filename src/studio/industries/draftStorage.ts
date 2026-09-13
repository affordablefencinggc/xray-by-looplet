import { z } from 'zod';

export const industryDraftIds = ['roofing', 'hvac', 'quantity-surveying'] as const;
export type IndustryDraftId = typeof industryDraftIds[number];
const id = z.string().min(1).max(200);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const slot = z.object({ revision: revision.refine(v => v > 0), form: z.record(z.string(), z.unknown()) }).strict();
const librarySchema = z.object({
  format: z.literal('xray.industry-drafts/1'), projectId: id, revision, generation: z.string().uuid().optional(),
  drafts: z.object({ roofing: slot.optional(), hvac: slot.optional(), 'quantity-surveying': slot.optional() }).strict(),
}).strict();
export type IndustryDraftLibrary = z.infer<typeof librarySchema>;
export const industryDraftKey = (projectId: string) => `xray.industry-drafts.v1:${id.parse(projectId)}`;

export function parseIndustryDraftLibrary(raw: string, projectId: string): IndustryDraftLibrary {
  if (raw.length > 2_000_000) throw Error('Saved industry drafts exceed the supported size. Original data is preserved.');
  const library = librarySchema.parse(JSON.parse(raw));
  if (library.projectId !== projectId) throw Error('These drafts belong to another project. Original data is preserved.');
  return library;
}

/** Compare this form's revision; unrelated industry drafts are merged without replacement. */
export function updateIndustryDraft(raw: string | null, projectId: string, industry: IndustryDraftId, expectedRevision: number, form: Record<string, unknown>, expectedGeneration: string | null = null): IndustryDraftLibrary {
  id.parse(projectId); z.enum(industryDraftIds).parse(industry); revision.parse(expectedRevision);
  const previous: IndustryDraftLibrary = raw === null ? { format: 'xray.industry-drafts/1', projectId, revision: 0, drafts: {} } : parseIndustryDraftLibrary(raw, projectId);
  if ((previous.generation ?? null) !== expectedGeneration) throw Error('Project drafts were restored or replaced. Your inputs remain visible; download them before reloading.');
  const current = previous.drafts[industry];
  if ((current?.revision ?? 0) !== expectedRevision) throw Error('This draft changed in another window. Your inputs remain visible; download them before reloading.');
  const next = librarySchema.parse({ ...previous, revision: previous.revision + 1,
    drafts: { ...previous.drafts, [industry]: { revision: expectedRevision + 1, form } } });
  return parseIndustryDraftLibrary(JSON.stringify(next), projectId);
}

export function readIndustryDraftLibrary(projectId: string): IndustryDraftLibrary | null {
  const raw = localStorage.getItem(industryDraftKey(projectId));
  return raw === null ? null : parseIndustryDraftLibrary(raw, projectId);
}

export async function saveIndustryDraft(projectId: string, industry: IndustryDraftId, expectedRevision: number, form: Record<string, unknown>, expectedGeneration: string | null): Promise<{ revision: number; generation: string | null }> {
  if (!navigator.locks) throw Error('This browser cannot safely save concurrent draft edits. Your inputs remain visible and can be downloaded.');
  const key = industryDraftKey(projectId);
  return navigator.locks.request(key, { mode: 'exclusive' }, () => {
    const next = updateIndustryDraft(localStorage.getItem(key), projectId, industry, expectedRevision, form, expectedGeneration);
    localStorage.setItem(key, JSON.stringify(next));
    return { revision: next.drafts[industry]!.revision, generation: next.generation ?? null };
  });
}
