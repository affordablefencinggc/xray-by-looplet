/**
 * Tool receipts in plain words. The chat never shows JSON or raw tool output; each tool row gets a
 * human title, a status and a one-line summary built from the fields a receipt is known to carry.
 * Unknown shapes fall back to the tool's title alone — never to the raw text.
 */
const TITLES: Record<string, string> = {
  calculate_draft_roof_area: "Calculated draft roof areas",
  calculate_draft_duct_material: "Calculated draft duct material",
  classify_draft_quantities: "Classified draft quantities",
  read_project_context: "Read the project context",
  read_source_geometry: "Read PDF coordinates with Python",
  prepare_source_room: "Prepared a source-aligned room overlay",
  search_standards_library: "Searched NCC and housing references",
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
  read_workflow_route: "Read the workflow route",
  read_work_packet: "Read the task record",
  read_work_packet_event: "Read the task history",
  read_assistant_file: "Read an attached file",
};

export type ToolReceiptView = { title: string; status: "running" | "done" | "failed"; summary: string; detail: string | null };

const humanise = (name: string) => name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const bytes = (value: number) => value >= 1024 * 1024 ? `${(value / 1048576).toFixed(1)} MB` : value >= 1024 ? `${Math.round(value / 1024)} KB` : `${value} B`;

const PREFLIGHT_RESULT = "App preflight (not a model call)\n";
const PREFLIGHT_PROGRESS = "App preflight: ";
const receiptBody = (text: string): string => text.startsWith(PREFLIGHT_RESULT)
  ? text.slice(PREFLIGHT_RESULT.length)
  : text.startsWith(PREFLIGHT_PROGRESS + "Running ") ? text.slice(PREFLIGHT_PROGRESS.length) : text;

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

const DRAFT_RECEIPTS: Record<string, string> = {
  calculate_draft_roof_area: "draft-calculation",
  calculate_draft_duct_material: "draft-unverified",
  classify_draft_quantities: "draft-classification",
};
const finiteQuantity = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Summaries use only actual result fields; input references remain in the stored receipt. */
function draftSummary(name: string, r: Record<string, unknown>): string | null {
  if (!Object.hasOwn(DRAFT_RECEIPTS, name)) return null;
  const incomplete = "Calculation receipt incomplete; draft result not verified.";
  if (r.status !== DRAFT_RECEIPTS[name] || r.verifiedQuoteEligible !== false) return incomplete;
  const prefix = "Draft · not for verified quotes · ";
  if (name === "calculate_draft_roof_area") {
    const totals = r.totals;
    if (r.units !== "m2" || !object(totals) || ![totals.grossTrueAreaM2, totals.openingTrueAreaM2, totals.netTrueAreaM2].every(finiteQuantity)) return incomplete;
    return `${prefix}gross ${totals.grossTrueAreaM2} m² · openings ${totals.openingTrueAreaM2} m² · net ${totals.netTrueAreaM2} m²`;
  }
  if (name === "calculate_draft_duct_material") {
    if (!finiteQuantity(r.developedAreaM2) || (r.sheetMassKg !== null && !finiteQuantity(r.sheetMassKg))) return incomplete;
    return `${prefix}${r.developedAreaM2} m² lateral area · ${r.sheetMassKg === null ? "mass not supplied for all sections" : `${r.sheetMassKg} kg sheet mass`}`;
  }
  if (!Array.isArray(r.totals) || !Array.isArray(r.unclassifiedItemIds)) return incomplete;
  const groups: string[] = [];
  for (const total of r.totals) {
    if (!object(total) || typeof total.quantity !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(total.quantity)
      || typeof total.unit !== "string" || !total.unit.trim() || typeof total.evidence !== "string"
      || !["measured", "inferred", "sample", "unverified"].includes(total.evidence)) return incomplete;
    // Keep exact decimal strings and unit/evidence groups; never sum ancestor rollups.
    groups.push(`${total.quantity} ${total.unit} (${total.evidence})`);
  }
  const tail = ` · ${r.unclassifiedItemIds.length} unclassified`;
  const shown: string[] = [];
  for (const group of groups) {
    // Do not truncate a quantity or a unit mid-value to fit the compact receipt.
    if ((prefix + [...shown, group].join("; ") + `; ${groups.length} more groups` + tail).length > 200) break;
    shown.push(group);
  }
  const omitted = groups.length - shown.length;
  return prefix + (shown.join("; ") || (groups.length ? "Detailed totals retained" : "No quantities"))
    + (omitted ? `; ${omitted} more ${omitted === 1 ? "group" : "groups"}` : "") + tail;
}

/** Sentences a person can read; ids are shortened, numbers kept. */
export function summariseReceipt(toolName: string, text: string): string {
  text = receiptBody(text);
  const r = parse(text);
  if (!r) {
    // Structured but unreadable: say so rather than emitting the data. The no-code rule in the
    // operating manual applies to what the assistant surfaces, whatever produced it.
    if (looksStructured(text)) return "";
    // Plain-text results (errors, refusals, search answers): first sentence only, never a blob.
    const first = text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
    return first.length > 160 ? first.slice(0, 159) + "…" : first;
  }
  const calculation = draftSummary(toolName, r);
  if (calculation !== null) return calculation;
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

/**
 * A refusal payload in plain words. The workflow router writes {status, reason, requestedTool, next}
 * for the model to act on; a person needs to know what was skipped and what happens next, never the
 * JSON. The next step is named by its human title so the sentence matches the rest of the chat.
 */
function describeRefusal(r: Record<string, unknown>): string {
  const reason = typeof r.reason === "string" ? r.reason.replace(/\.$/, "") : "This step was not run";
  const next = r.next && typeof r.next === "object" ? (r.next as { tool?: unknown }).tool : undefined;
  const step = typeof next === "string" ? (TITLES[next] ?? humanise(next)) : null;
  const executed = r.status === "not-executed" ? "Not run" : "Stopped";
  return step ? `${executed}: ${reason}. Next step: ${step.toLowerCase()}.` : `${executed}: ${reason}.`;
}

export function describeToolReceipt(entry: { toolName?: string; text: string; failed?: boolean; executionOrigin?: string }): ToolReceiptView {
  const name = entry.toolName ?? "tool";
  const body = receiptBody(entry.text);
  const appPreflight = entry.executionOrigin === "app-preflight" || body !== entry.text;
  const title = (appPreflight ? "App preflight (not a model call): " : "") + (TITLES[name] ?? humanise(name));
  if (/^Running .*…$/.test(body.trim())) return { title, status: "running", summary: "Working…", detail: null };
  if (entry.failed) {
    const r = parse(body);
    // A refusal payload is written for the model to read, not for a person. Rendering it verbatim
    // put raw JSON in the chat, which the no-code-in-the-chat rule exists to prevent. Its known
    // fields are turned into a sentence; unknown structured failures never expose the payload.
    const message = r && typeof r.text === "string" ? r.text
      : r && typeof r.reason === "string"
        ? describeRefusal(r)
        : r || looksStructured(body) ? "This step failed." : body;
    const line = message.trim().split("\n")[0];
    return { title, status: "failed", summary: line.length > 200 ? line.slice(0, 199) + "…" : line, detail: null };
  }
  return { title, status: "done", summary: summariseReceipt(name, body) || "Completed", detail: null };
}
