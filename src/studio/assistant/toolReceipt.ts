/**
 * Tool receipts in plain words. The chat never shows JSON or raw tool output; each tool row gets a
 * human title, a status and a one-line summary built from the fields a receipt is known to carry.
 * Unknown shapes fall back to the tool's title alone — never to the raw text.
 */
const TITLES: Record<string, string> = {
  read_project_context: "Read the project context",
  navigate_workspace: "Opened a workspace pane",
  read_architect_design: "Read the architectural design",
  draw_architect_elements: "Drew design elements",
  edit_architect_elements: "Edited design elements",
  undo_architect_change: "Undid the last design change",
  capture_workspace_image: "Captured the 3D view",
  save_project: "Saved the project",
  control_draftsman: "Controlled the Magic Pencil",
  read_draftsman_status: "Read the Magic Pencil status",
  read_workbench_structure: "Read how X-Ray is organised",
  read_source_building: "Read the source building",
  read_source_sheets: "Read the sheet register",
  manage_source_sheet: "Organised a sheet",
  read_takeoff_evidence: "Read the takeoff evidence",
  read_price_books: "Read the price books",
  capture_project_backup: "Saved a workspace backup",
  calibrate_source_sheet: "Calibrated a sheet",
  trace_takeoff_run: "Traced a run",
  review_takeoff_item: "Reviewed a takeoff item",
  remove_takeoff_trace: "Removed a trace",
  import_price_book: "Imported a price book",
  export_design_file: "Exported a design file",
  generate_render_visualisation: "Generated a real-life view",
  show_design_in_model: "Put the design into the 3D model viewer",
  hide_designed_model: "Returned the model viewer to its source building",
  web_search: "Searched the web",
};

export type ToolReceiptView = { title: string; status: "running" | "done" | "failed"; summary: string; detail: string | null };

const humanise = (name: string) => name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const bytes = (value: number) => value >= 1024 * 1024 ? `${(value / 1048576).toFixed(1)} MB` : value >= 1024 ? `${Math.round(value / 1024)} KB` : `${value} B`;

function parse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try { const value = JSON.parse(trimmed); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; }
}

/**
 * A body this module cannot read as an object but which is still structured data, not prose.
 * parse() above returns null for a JSON array, and the plain-text branch would then copy the raw
 * blob out verbatim — into the chat for the panel, and into the pinned digest the model reads every
 * turn via contextCapture.ts. An MCP server is free to answer with an array, so this is reachable
 * from outside the repo, and the blob can carry secret-shaped fields.
 */
const looksStructured = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) return false;
  try { return Array.isArray(JSON.parse(trimmed)); } catch { return false; }
};

/** Sentences a person can read; ids are shortened, numbers kept. */
export function summariseReceipt(toolName: string, text: string): string {
  const r = parse(text);
  if (!r) {
    // Structured but unreadable: say so rather than emitting the data. The no-code rule in the
    // operating manual applies to what the assistant surfaces, whatever produced it.
    if (looksStructured(text)) return "";
    // Plain-text results (errors, refusals, search answers): first sentence only, never a blob.
    const first = text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
    return first.length > 160 ? first.slice(0, 159) + "…" : first;
  }
  const parts: string[] = [];
  const num = (key: string) => (typeof r[key] === "number" ? (r[key] as number) : null);
  const arr = (key: string) => (Array.isArray(r[key]) ? (r[key] as unknown[]) : null);
  const str = (key: string) => (typeof r[key] === "string" ? (r[key] as string) : null);
  if (arr("created")) parts.push(`created ${plural(arr("created")!.length, "element")}`);
  if (arr("changed")) parts.push(`changed ${plural(arr("changed")!.length, "element")}`);
  if (arr("removed")) parts.push(`removed ${plural(arr("removed")!.length, "element")}`);
  if (num("designRevision") !== null) parts.push(`design revision ${num("designRevision")}`);
  if (r.saved === true) parts.push("saved");
  if (r.rendered === true) parts.push(`rendered ${num("width") && num("height") ? `${num("width")} × ${num("height")}` : "an image"}${str("model") ? ` with ${str("model")}` : ""}`);
  if (str("fileName")) parts.push(`${str("fileName")}${num("byteLength") !== null ? ` (${bytes(num("byteLength")!)})` : ""}`);
  if (str("sha256")) parts.push(`sha256 ${str("sha256")!.slice(0, 12)}…`);
  if (num("lengthM") !== null) parts.push(`${num("lengthM")!.toFixed(3)} m`);
  if (r.locked === true) parts.push("calibration locked");
  if (str("pane")) parts.push(`pane ${str("pane")}`);
  if (str("projectName")) parts.push(`project "${str("projectName")}"`);
  if (num("projectRevision") !== null) parts.push(`revision ${num("projectRevision")}`);
  if (arr("levels")) parts.push(plural(arr("levels")!.length, "level"));
  if (arr("walls")) parts.push(plural(arr("walls")!.length, "wall"));
  if (arr("sheets")) parts.push(plural(arr("sheets")!.length, "sheet"));
  if (arr("books")) parts.push(plural(arr("books")!.length, "price book"));
  if (arr("blockers")) parts.push(plural(arr("blockers")!.length, "blocker"));
  if (arr("parts")) parts.push(plural(arr("parts")!.length, "part"));
  if (arr("sources")) parts.push(plural(arr("sources")!.length, "source"));
  if (num("matched") !== null && num("returned") !== null) parts.push(`${num("returned")} of ${num("matched")} matched`);
  if (str("name") && !str("fileName")) parts.push(`"${str("name")}"`);
  if (r.available === false && str("reason")) parts.push(str("reason")!.slice(0, 120));
  if (str("note") && !parts.length) parts.push(str("note")!.slice(0, 140));
  if (str("answer") && !parts.length) parts.push(str("answer")!.slice(0, 140));
  const summary = parts.join(" · ");
  return summary.length > 200 ? summary.slice(0, 199) + "…" : summary;
}

export function describeToolReceipt(entry: { toolName?: string; text: string; failed?: boolean }): ToolReceiptView {
  const name = entry.toolName ?? "tool";
  const title = TITLES[name] ?? humanise(name);
  if (/^Running .*…$/.test(entry.text.trim())) return { title, status: "running", summary: "Working…", detail: null };
  if (entry.failed) {
    const r = parse(entry.text);
    const message = (r && typeof r.text === "string" ? r.text : entry.text).trim().split("\n")[0];
    return { title, status: "failed", summary: message.length > 200 ? message.slice(0, 199) + "…" : message, detail: null };
  }
  return { title, status: "done", summary: summariseReceipt(name, entry.text) || "Completed", detail: null };
}
