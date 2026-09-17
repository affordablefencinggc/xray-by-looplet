import { create } from "zustand";
import { isAssistantGatedTool } from "./skills.ts";

/**
 * Permissions the way Claude does them: a mode (ask before edits / edit freely / read only) instead of
 * a per-message checkbox, and — in ask mode — a prompt in the chat for each state-changing tool call
 * with "Allow once", "Allow for this chat" and "Deny". Read-only tools never ask. Tools that change
 * live workspace state without editing the project (navigation, viewer changes, renders) are judged on
 * the same rule as edits. The mode persists per browser; "for this chat" grants live until the chat
 * is cleared or continued, or until the workspace moves to another project, which is also another
 * chat (scopeChatGrants).
 */
export type PermissionMode = "ask" | "auto" | "readonly";
export type PermissionDecision = "once" | "chat" | "deny";
export type PermissionVerdict = "allowed" | "ask" | "blocked";
export type PermissionRequest = { id: string; toolName: string; title: string; summary: string; requestedAt: number };
export const PERMISSION_MODE_KEY = "xray:assistant-permissions:v1";
export const PERMISSION_MODES: ReadonlyArray<{ mode: PermissionMode; label: string; hint: string }> = [
  { mode: "ask", label: "Ask before edits", hint: "The assistant asks before it changes the project or moves the workspace; reading is always allowed." },
  { mode: "auto", label: "Edit freely", hint: "Design edits, sheet changes, calibration, imports, exports, navigation and renders run without asking." },
  { mode: "readonly", label: "Read only", hint: "The assistant can read and explain, but cannot change the project, move the workspace or generate a render." },
];
export const DENIED_MESSAGE = "The user declined this action. Nothing was changed; ask before retrying.";
export const READONLY_MESSAGE = "Read-only mode: the user has not allowed changes. Nothing was changed.";
export const STOPPED_MESSAGE = "Stopped before the user decided. Nothing was changed.";

export function readPermissionMode(raw: string | null | undefined): PermissionMode {
  return raw === "auto" || raw === "readonly" || raw === "ask" ? raw : "ask";
}

export function permissionVerdict(toolName: string, mode: PermissionMode, grantedForChat: ReadonlySet<string>): PermissionVerdict {
  if (!isAssistantGatedTool(toolName)) return "allowed";
  if (mode === "readonly") return "blocked";
  if (mode === "auto" || grantedForChat.has(toolName)) return "allowed";
  return "ask";
}

/** Exported so the test can prove every tool that reaches the prompt has one, and that no row is dead. */
export const TOOL_TITLES: Record<string, string> = {
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
  // Effectful non-edits (skills.ts EFFECTFUL_TOOLS): they change what is on screen or spend a render.
  navigate_workspace: "Move the workspace",
  show_design_in_model: "Show the design in the 3D model",
  hide_designed_model: "Return the Model viewer to source reconstructions",
  control_draftsman: "Drive the drafting animation",
  generate_render_visualisation: "Generate a render illustration",
};
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Every top-level argument `describeToolIntent` reads. Held as data so the containment test can check
 * it against the real catalogue in appTools: a key no gated tool declares is a prompt branch that can
 * never fire, which is how this shipped (the prompt read `sheetIndex`, `knownDistanceM`, `reviewer`
 * and `decidedBy`, and no tool sends any of them). Add the key here when you add a branch.
 */
export const INTENT_KEYS = [
  "operations", "action", "sheet", "pageIndex", "name", "bookName", "format", "kind", "decision",
  "actor", "knownDistance", "points", "replaceLocked", "expectedRevision",
  // The effectful class's own arguments (skills.ts EFFECTFUL_TOOLS). A prompt that names the tool but
  // not the destination asks the user to approve a pane, a view or a render they were never told
  // about, so these are read for the same reason the keys above are.
  "pane", "view", "displayMode", "direction",
] as const;

/** What the assistant is about to do, in plain words built from the tool arguments (never the JSON). */
export function describeToolIntent(toolName: string, args: Record<string, unknown> = {}): { title: string; summary: string } {
  const title = TOOL_TITLES[toolName] ?? toolName.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
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
  // `sheet` is the 0-based page index calibrate_source_sheet and trace_takeoff_run send; `pageIndex`
  // is the 0-based page manage_source_sheet sends. Nothing is named `sheetIndex` or `page`.
  if (num("sheet") !== null) parts.push(`sheet ${num("sheet")! + 1}`);
  if (num("pageIndex") !== null) parts.push(`page ${num("pageIndex")! + 1}`);
  if (str("name")) parts.push(`"${str("name")}"`);
  // import_price_book names the book it is adding; `name` is the backup name for capture_project_backup.
  if (str("bookName")) parts.push(`"${str("bookName")}"`);
  // export_design_file sends `format` (dxf, ifc, drawing-pdf, material-pdf, sheet-register);
  // review_takeoff_item sends `kind` (run or gate). Both are named so neither reads as "on the project".
  if (str("format")) parts.push(str("format")!.toUpperCase());
  if (str("kind")) parts.push(str("kind")!.toUpperCase());
  if (str("decision")) parts.push(`decision: ${str("decision")}`);
  // The reviewer's own name arrives as `actor`; `reviewer` and `decidedBy` are result fields, not arguments.
  if (str("actor")) parts.push(`for ${str("actor")}`);
  const known = args.knownDistance;
  if (known && typeof known === "object" && typeof (known as { value?: unknown }).value === "number") {
    const { value, unit } = known as { value: number; unit?: unknown };
    parts.push(`${value}${typeof unit === "string" && unit ? ` ${unit}` : ""} known distance`);
  }
  // Where the workspace is being moved to (`pane` is navigate_workspace's one required argument), and
  // what is being shown or spent: the render class is gated because a render costs money, so the view
  // it is taken from — and the user's own steer — belong on the card the user decides on.
  if (str("pane")) parts.push(str("pane")!);
  if (str("view")) parts.push(str("view")!.replace(/-/g, " "));
  if (str("displayMode")) parts.push(str("displayMode")!);
  if (str("direction")) parts.push(`"${str("direction")!.slice(0, 80)}"`);
  if (Array.isArray(args.points)) parts.push(plural(args.points.length, "point"));
  if (args.replaceLocked === true) parts.push("replacing a locked calibration");
  if (num("expectedRevision") !== null) parts.push(`on design revision ${num("expectedRevision")}`);
  const summary = parts.length ? parts.join(" · ") : "on the current project";
  return { title, summary: summary.length > 220 ? summary.slice(0, 219) + "…" : summary };
}

type Waiter = { request: PermissionRequest; resolve: (decision: PermissionDecision) => void };
type PermissionState = {
  mode: PermissionMode;
  grantedForChat: Set<string>;
  /** The project whose chat `grantedForChat` belongs to; a grant is "for this chat" and a chat is one project's. */
  grantedProjectId: string | null;
  pending: PermissionRequest | null;
  setMode: (mode: PermissionMode) => void;
  /** Resolves when the user decides; a stop (abort) resolves "deny" without a user click. */
  request: (toolName: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<PermissionDecision>;
  decide: (id: string, decision: PermissionDecision) => void;
  /** Drops the grants when the chat moves to another project; a no-op while the project is unchanged. */
  scopeChatGrants: (projectId: string) => void;
  resetChatGrants: () => void;
};
let waiter: Waiter | null = null;
const storage = () => (typeof localStorage === "undefined" ? null : localStorage);

export const usePermissions = create<PermissionState>((set, get) => ({
  mode: readPermissionMode(storage()?.getItem(PERMISSION_MODE_KEY)),
  grantedForChat: new Set(),
  grantedProjectId: null,
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
  scopeChatGrants: projectId => {
    // The grant Set is one process-global object, and "for this chat" was only ever enforced by the
    // chat-level actions that clear it (resetChatGrants). Opening another project is also another
    // chat, and nothing there cleared it, so a tool the user allowed once in one project's chat ran
    // unasked in a different project's chat. The project is remembered rather than the grant being
    // re-keyed, so re-scoping to the project already in scope is a no-op and a hydration or
    // readiness flip inside one chat cannot silently drop a grant the user did give.
    if (get().grantedProjectId === projectId) return;
    set({ grantedProjectId: projectId, grantedForChat: new Set() });
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
