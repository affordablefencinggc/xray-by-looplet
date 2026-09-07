import {
  createProjectMaterials,
  projectMaterialsSchema,
  type ProjectMaterials,
  type ProjectMaterialsSession,
} from "./construction/projectMaterials.ts";

// Large projects use IndexedDB, avoiding the small localStorage quota. A single
// read-write transaction compares and replaces the prior snapshot atomically.
export const MATERIALS_DB = "xray-project-materials-v1";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MATERIALS_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("inventories");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(Error("Material database is blocked by another open version."));
  });
}
export async function restoreMaterialDatabase(projectId: string): Promise<ProjectMaterialsSession> {
  let raw: string | null = null,
    db: IDBDatabase | undefined;
  try {
    db = await database();
    raw = await new Promise<string | null>((resolve, reject) => {
      const request = db!
        .transaction("inventories", "readonly")
        .objectStore("inventories")
        .get(projectId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    const value =
      raw === null
        ? createProjectMaterials(projectId)
        : projectMaterialsSchema.parse(JSON.parse(raw));
    if (value.projectId !== projectId) throw Error("Wrong project.");
    return { value, raw, blocked: false, error: null };
  } catch {
    return {
      value: createProjectMaterials(projectId),
      raw,
      blocked: true,
      error:
        "Saved material inventory could not be restored. Original data is preserved; writes and exports are blocked until recovery.",
    };
  } finally {
    db?.close();
  }
}
export async function saveMaterialDatabase(
  session: ProjectMaterialsSession,
  value: ProjectMaterials,
  recovery = false,
): Promise<ProjectMaterialsSession> {
  if (session.blocked && !recovery) return session;
  let db: IDBDatabase | undefined,
    conflict = false;
  try {
    const parsed = projectMaterialsSchema.parse(value);
    if (parsed.projectId !== session.value.projectId) throw Error("Project identity changed.");
    const raw = JSON.stringify(parsed);
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction("inventories", "readwrite"),
        store = tx.objectStore("inventories"),
        request = store.get(parsed.projectId);
      let writeError: unknown;
      request.onsuccess = () => {
        try {
          if ((request.result ?? null) !== session.raw) {
            conflict = true;
            tx.abort();
            return;
          }
          if (recovery && session.raw !== null)
            store.put(session.raw, `${parsed.projectId}:recovery:${crypto.randomUUID()}`);
          store.put(raw, parsed.projectId);
        } catch (error) {
          writeError = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          writeError ??
            tx.error ??
            Error(
              conflict
                ? "Inventory changed in another session. Retry restore before writing."
                : "Material transaction aborted.",
            ),
        );
      tx.onerror = () => reject(tx.error);
    });
    return { value: parsed, raw, blocked: false, error: null };
  } catch (e) {
    return {
      ...session,
      blocked: session.blocked || conflict,
      error: `Inventory was not saved: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    db?.close();
  }
}
