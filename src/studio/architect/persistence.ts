import { validateProject, emptyProject, type ArchitectProject } from "./model.ts";
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type ArchitectSession = {
  value: ArchitectProject;
  raw: string | null;
  blocked: boolean;
  error: string | null;
};
export const architectKey = (id: string) => "xray:architect:v1:" + encodeURIComponent(id);
export function loadArchitect(id: string, storage: StorageLike): ArchitectSession {
  let raw: string | null = null;
  try {
    raw = storage.getItem(architectKey(id));
    const value = raw === null ? emptyProject(id) : validateProject(JSON.parse(raw));
    if (value.id !== id) throw Error("Wrong project identity.");
    return { value, raw, blocked: false, error: null };
  } catch (e) {
    return {
      value: emptyProject(id),
      raw,
      blocked: true,
      error:
        "Saved design could not be restored. Original bytes preserved; editing and autosave blocked. " +
        (e instanceof Error ? e.message : "Storage unavailable."),
    };
  }
}
export function saveArchitect(
  session: ArchitectSession,
  next: ArchitectProject,
  storage: StorageLike,
  recovery = false,
): ArchitectSession {
  if (session.blocked && !recovery) return session;
  try {
    const value = validateProject(next);
    if (value.id !== session.value.id) throw Error("Design identity changed.");
    const key = architectKey(value.id);
    if (storage.getItem(key) !== session.raw)
      return {
        ...session,
        blocked: true,
        error: "Design changed in another window. Reload before editing.",
      };
    const raw = JSON.stringify(value);
    if (recovery && session.raw !== null)
      storage.setItem(key + ":recovery:" + Date.now(), session.raw);
    storage.setItem(key, raw);
    return { value, raw, blocked: false, error: null };
  } catch (e) {
    return {
      ...session,
      error: "Design was not saved: " + (e instanceof Error ? e.message : "Storage unavailable."),
    };
  }
}
