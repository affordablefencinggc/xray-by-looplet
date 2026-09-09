import { create } from "zustand";
import { isAssistantEditTool } from "./skills.ts";

/**
 * Permissions the way Claude does them: a mode (ask before edits / edit freely / read only) instead of
 * a per-message checkbox, and — in ask mode — a prompt in the chat for each state-changing tool call
 * with "Allow once", "Allow for this chat" and "Deny". Read-only tools never ask. The mode persists
 * per browser; "for this chat" grants live until the chat is cleared or continued.
 */
export type PermissionMode = "ask" | "auto" | "readonly";
export type PermissionDecision = "once" | "chat" | "deny";
export type PermissionVerdict = "allowed" | "ask" | "blocked";
export type PermissionRequest = { id: string; toolName: string; title: string; summary: string; requestedAt: number };
export const PERMISSION_MODE_KEY = "xray:assistant-permissions:v1";
export const PERMISSION_MODES: ReadonlyArray<{ mode: PermissionMode; label: string; hint: string }> = [
  { mode: "ask", label: "Ask before edits", hint: "The assistant asks before it changes the project; reading is always allowed." },
  { mode: "auto", label: "Edit freely", hint: "Design edits, sheet changes, calibration, imports and exports run without asking." },
  { mode: "readonly", label: "Read only", hint: "The assistant can read and explain but cannot change anything." },
];
export const DENIED_MESSAGE = "The user declined this action. Nothing was changed; ask before retrying.";
export const READONLY_MESSAGE = "Read-only mode: the user has not allowed changes. Nothing was changed.";
export const STOPPED_MESSAGE = "Stopped before the user decided. Nothing was changed.";

export function readPermissionMode(raw: string | null | undefined): PermissionMode {
  return raw === "auto" || raw === "readonly" || raw === "ask" ? raw : "ask";
}

export function permissionVerdict(toolName: string, mode: PermissionMode, grantedForChat: ReadonlySet<string>): PermissionVerdict {
  if (!isAssistantEditTool(toolName)) return "allowed";
  if (mode === "readonly") return "blocked";
  if (mode === "auto" || grantedForChat.has(toolName)) return "allowed";
  return "ask";
}

const TITLES: Record<string, string> = {
  draw_architect_elements: "Draw design elements",
  edit_architect_elements: "Edit design elements",
  undo_architect_change: "Undo the last design change",
  save_project: "Save the project",
  manage_source_sheet: "Change a sheet",
  capture_project_backup: "Save a workspace backup",
  calibrate_source_sheet: "Calibrate a sheet",
  trace_takeoff_run: "Trace a run",
  review_takeoff_item: "Record a takeoff review",
  remove_takeoff_trace: "Remove a trace",
  import_price_book: "Import a price book",
  export_design_file: "Export a design file",
};
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What the assistant is about to do, in plain words built from the tool arguments (never the JSON). */
export function describeToolIntent(toolName: string, args: Record<string, unknown> = {}): { title: string; summary: string } {
  const title = TITLES[toolName] ?? toolName.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
  const ops = Array.isArray(args.operations) ? (args.operations as Array<{ kind?: unknown }>) : null;
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : null);
  const num = (key: string) => (typeof args[key] === "number" ? (args[key] as number) : null);
  const parts: string[] = [];
  if (ops) {
    const kinds = new Map<string, number>();
    for (const op of ops) { const kind = typeof op?.kind === "string" ? op.kind : "change"; kinds.set(kind, (kinds.get(kind) ?? 0) + 1); }
    parts.push([...kinds].map(([kind, count]) => plural(count, kind)).join(", "));
  }
  if (str("action")) parts.push(str("action")!);
  if (num("sheetIndex") !== null) parts.push(`sheet ${num("sheetIndex")! + 1}`);
  if (num("page") !== null) parts.push(`page ${num("page")}`);
  if (str("name")) parts.push(`"${str("name")}"`);
  if (str("kind")) parts.push(str("kind")!.toUpperCase());
  if (str("decision")) parts.push(`decision: ${str("decision")}`);
  if (str("reviewer") || str("decidedBy")) parts.push(`for ${str("reviewer") ?? str("decidedBy")}`);
  if (num("knownDistanceM") !== null) parts.push(`${num("knownDistanceM")} m known distance`);
  if (args.replaceLocked === true) parts.push("replacing a locked calibration");
  if (num("expectedRevision") !== null) parts.push(`on design revision ${num("expectedRevision")}`);
  const summary = parts.length ? parts.join(" · ") : "on the current project";
  return { title, summary: summary.length > 220 ? summary.slice(0, 219) + "…" : summary };
}

type Waiter = { request: PermissionRequest; resolve: (decision: PermissionDecision) => void };
type PermissionState = {
  mode: PermissionMode;
  grantedForChat: Set<string>;
  pending: PermissionRequest | null;
  setMode: (mode: PermissionMode) => void;
  /** Resolves when the user decides; a stop (abort) resolves "deny" without a user click. */
  request: (toolName: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<PermissionDecision>;
  decide: (id: string, decision: PermissionDecision) => void;
  resetChatGrants: () => void;
};
let waiter: Waiter | null = null;
const storage = () => (typeof localStorage === "undefined" ? null : localStorage);

export const usePermissions = create<PermissionState>((set, get) => ({
  mode: readPermissionMode(storage()?.getItem(PERMISSION_MODE_KEY)),
  grantedForChat: new Set(),
  pending: null,
  setMode: mode => {
    try { storage()?.setItem(PERMISSION_MODE_KEY, mode); } catch { /* storage unavailable */ }
    set({ mode });
  },
  request: (toolName, args, signal) => new Promise<PermissionDecision>(resolve => {
    if (signal?.aborted) { resolve("deny"); return; }
    if (waiter) waiter.resolve("deny"); // one prompt at a time; a superseded prompt is a denial
    const { title, summary } = describeToolIntent(toolName, args);
    const request: PermissionRequest = { id: crypto.randomUUID(), toolName, title, summary, requestedAt: Date.now() };
    const finish = (decision: PermissionDecision) => {
      if (waiter?.request.id !== request.id) return;
      waiter = null;
      set({ pending: null });
      signal?.removeEventListener("abort", onAbort);
      resolve(decision);
    };
    const onAbort = () => finish("deny");
    signal?.addEventListener("abort", onAbort, { once: true });
    waiter = { request, resolve: finish };
    set({ pending: request });
  }),
  decide: (id, decision) => {
    if (!waiter || waiter.request.id !== id) return;
    if (decision === "chat") set({ grantedForChat: new Set([...get().grantedForChat, waiter.request.toolName]) });
    waiter.resolve(decision);
  },
  resetChatGrants: () => set({ grantedForChat: new Set() }),
}));

/** The gate a tool call passes before it runs; returns null when it may run, otherwise the refusal text. */
export async function gateToolCall(toolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string | null> {
  const state = usePermissions.getState();
  const verdict = permissionVerdict(toolName, state.mode, state.grantedForChat);
  if (verdict === "allowed") return null;
  if (verdict === "blocked") return READONLY_MESSAGE;
  const decision = await state.request(toolName, args, signal);
  if (decision === "deny") return signal?.aborted ? STOPPED_MESSAGE : DENIED_MESSAGE;
  return null;
}
