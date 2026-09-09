import { z } from 'zod';

/** Issued only by pure preparation, before any persistence or controller commit. */
export class ArchitectPreparationRejected extends Error {
  readonly projectId: string;
  readonly designRevision: number;
  constructor(error: unknown, projectId: string, designRevision: number) {
    super(error instanceof Error ? error.message : 'Architectural preparation rejected.');
    this.name = 'ArchitectPreparationRejected'; this.projectId = projectId; this.designRevision = designRevision;
  }
}
const receiptSchema = z.object({ status: z.literal('not-executed'), phase: z.literal('architect-preparation'), projectId: z.string(), designRevision: z.number().int().positive() }).strict();
export function preparationReceipt(error: ArchitectPreparationRejected) {
  return { 'xray.execution': { status: 'not-executed', phase: 'architect-preparation', projectId: error.projectId, designRevision: error.designRevision } };
}
export function isConfirmedRejection(tool: string, result: { isError?: boolean; _meta?: Record<string, unknown> }, snapshot: { projectId: string; designRevision: number | null }): boolean {
  if (!result.isError || !['draw_architect_elements', 'edit_architect_elements'].includes(tool)) return false;
  const receipt = receiptSchema.safeParse(result._meta?.['xray.execution']);
  return receipt.success && receipt.data.projectId === snapshot.projectId && receipt.data.designRevision === snapshot.designRevision;
}
