import { z } from "zod";

export const WORKSPACE_ACCESS_LOCK = "xray:editing-workspace:v1";
const mutationSchema = z.object({ storage: z.enum(["local", "materials"]), key: z.string().min(1), label: z.string(), before: z.string().nullable(), after: z.string().nullable() }).strict();
export type RestoreMutation = z.infer<typeof mutationSchema>;
export const restoreOperationSchema = z.object({
  schema: z.literal("xray.restore/v1"), id: z.string().uuid(), revision: z.number().int().positive(),
  createdAt: z.string().datetime(), phase: z.enum(["requested", "prepared", "writing", "committed", "verified", "rolled-back", "recovery-required"]),
  backup: z.string(), expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/), restoreReferenceRates: z.boolean(),
  plan: z.object({ mutations: z.array(mutationSchema), recoveryBackupId: z.string().uuid(), targetId: z.string(), targetName: z.string() }).strict().optional(),
  progress: z.number().int().nonnegative().default(0), message: z.string().default(""),
}).strict();
export type RestoreOperation = z.infer<typeof restoreOperationSchema>;
export type RestorePlan = NonNullable<RestoreOperation["plan"]>;
export type RestorePorts = {
  prepare(operation: RestoreOperation): Promise<RestorePlan>;
  read(mutation: RestoreMutation): Promise<string | null>;
  compareWrite(mutation: RestoreMutation, expected: string | null, value: string | null): Promise<void>;
  ensureAssets(backup: string): Promise<void>;
  verifyAssets(backup: string): Promise<void>;
  journal(next: RestoreOperation, expectedRevision: number): Promise<void>;
};
const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e);
class JournalSaveError extends Error {}

/** All calls run under an exclusive workspace lock, before any editor hydrates. */
export async function executeWorkspaceRestore(initial: RestoreOperation, ports: RestorePorts): Promise<RestoreOperation> {
  let operation = restoreOperationSchema.parse(initial);
  const save = async (change: Partial<RestoreOperation>) => {
    const next = restoreOperationSchema.parse({ ...operation, ...change, revision: operation.revision + 1 });
    try { await ports.journal(next, operation.revision); }
    catch (error) { throw new JournalSaveError(`Restore journal acknowledgement failed. Reload to recover its saved state. ${messageOf(error)}`); }
    operation = next;
  };
  const check = async (side: "before" | "after") => {
    if (!operation.plan) throw Error("Restore journal has no validated storage plan.");
    for (const item of operation.plan.mutations) if (await ports.read(item) !== item[side])
      throw Error(`${item.label} no longer matches the ${side === "before" ? "previous" : "restored"} snapshot. Saved data has been preserved.`);
  };
  const rollback = async (reason: string) => {
    if (!operation.plan) throw Error("Restore journal is missing its recovery plan.");
    try {
      // Active job is last in the plan and therefore restored last too. No editor can mount mid-replay.
      for (const item of operation.plan.mutations) {
        const actual = await ports.read(item);
        if (actual === item.before) continue;
        if (actual !== item.after) throw Error(`${item.label} was changed outside this restore. Recovery will not overwrite it.`);
        await ports.compareWrite(item, item.after, item.before);
      }
      await check("before");
      await save({ phase: "rolled-back", message: `Previous saved workspace recovered. ${reason}` });
    } catch (failure) {
      await save({ phase: "recovery-required", message: `Editing is paused: ${messageOf(failure)}` });
    }
    return operation;
  };

  // An interrupted write never resumes into a half-old/half-new editable workspace.
  if (["prepared", "writing", "recovery-required"].includes(operation.phase)) return rollback("An earlier restore was interrupted.");
  if (operation.phase === "rolled-back") { await check("before"); return operation; }
  if (operation.phase === "verified") {
    await check("after"); await ports.verifyAssets(operation.backup); return operation;
  }
  if (operation.phase === "committed") {
    await check("after"); await ports.ensureAssets(operation.backup); await ports.verifyAssets(operation.backup);
    await save({ phase: "verified", message: "Restored project and original files verified. Open the workspace to continue." });
    return operation;
  }

  // Preparation may fail without touching any active record. The pending request remains cancellable.
  const plan = await ports.prepare(operation);
  await save({ plan, phase: "prepared", message: "Recovery copy and write journal saved." });
  try {
    await check("before");
    await ports.ensureAssets(operation.backup);
    await save({ phase: "writing", message: "Restoring saved project records." });
    for (const [index, item] of plan.mutations.entries()) {
      await ports.compareWrite(item, item.before, item.after);
      if (await ports.read(item) !== item.after) throw Error(`${item.label} was not confirmed saved.`);
      await save({ progress: index + 1 });
    }
    await check("after"); await ports.verifyAssets(operation.backup);
    await save({ phase: "committed", message: "Restored snapshot committed." });
  } catch (error) {
    // A rejected acknowledgement may still have committed. Stop writing and let startup
    // read the durable phase; never roll back on an assumption about journal success.
    if (error instanceof JournalSaveError) throw error;
    return rollback(messageOf(error));
  }
  // After a durable commit, a failed acknowledgement is retried on startup rather than rolled back.
  await save({ phase: "verified", message: "Restored project and original files verified. Open the workspace to continue." });
  return operation;
}
