import { z } from "zod";
import type { ArchitectProject } from "./model.ts";

const coordinate = z.number().finite().min(-1e6).max(1e6);
const identity = z.string().min(1).max(100);
export const sheetLayoutSchema = z.object({
  size: z.enum(["A1", "A3"]),
  scale: z.enum(["50", "100", "200"]),
  number: z.string().max(40),
  northAngle: coordinate,
  viewports: z.array(z.object({
    id: identity,
    view: z.enum(["plan", "north", "south", "east", "west", "section"]),
    levelId: identity,
    x: coordinate, y: coordinate,
    width: z.number().finite().positive().max(1e6),
    height: z.number().finite().positive().max(1e6),
    scale: z.enum(["50", "100", "200"]),
  }).strict()).max(12).default([]),
}).strict();
export const authoredSheetSetSchema = z.object({
  format: z.literal("xray.authored-sheet-set/v1"),
  activeId: identity,
  sheets: z.array(z.object({
    id: identity,
    name: z.string().trim().min(1).max(120),
    archived: z.boolean(),
    layout: sheetLayoutSchema,
  }).strict()).min(1).max(200),
}).strict();
export type SheetLayout = z.infer<typeof sheetLayoutSchema>;
export type AuthoredSheetSet = z.infer<typeof authoredSheetSetSchema>;
export type AuthoredSheet = AuthoredSheetSet["sheets"][number];
export type AuthoredSheetArchiveReview = { sheetId: string; projectSnapshot: string; viewports: number; name: string };
export type AuthoredSheetAction =
  | { type: "add" }
  | { type: "duplicate"; sheetId: string }
  | { type: "select" | "recover"; sheetId: string }
  | { type: "rename"; sheetId: string; name: string }
  | { type: "move"; sheetId: string; direction: -1 | 1 }
  | { type: "archive"; review: AuthoredSheetArchiveReview };

/** Fit paper frames only. Drawing/viewport scales and identities are never changed. */
export function resizeSheetPaper(layout: SheetLayout, size: SheetLayout["size"]): SheetLayout {
  const next = sheetLayoutSchema.parse(structuredClone(layout));
  const [width, height] = size === "A1" ? [841, 594] : [420, 297];
  next.size = size;
  for (const viewport of next.viewports) {
    viewport.width = Math.min(viewport.width, width - 16);
    viewport.height = Math.min(viewport.height, height - 52);
    viewport.x = Math.max(8, Math.min(viewport.x, width - viewport.width - 8));
    viewport.y = Math.max(8, Math.min(viewport.y, height - viewport.height - 44));
  }
  return next;
}

/** Legacy projection is read-only: simply opening a design never migrates saved bytes. */
export function authoredSheets(p: ArchitectProject): AuthoredSheetSet {
  return p.sheetSet ?? {
    format: "xray.authored-sheet-set/v1", activeId: "legacy-sheet",
    sheets: [{ id: "legacy-sheet", name: p.sheet.number.trim() || "Drawing sheet", archived: false, layout: p.sheet }],
  };
}

export function validateAuthoredSheets(p: ArchitectProject): void {
  const set = authoredSheets(p), sheetIds = new Set<string>(), viewportIds = new Set<string>();
  const levels = new Set(p.levels.map(level => level.id));
  const active = set.sheets.find(sheet => sheet.id === set.activeId);
  if (!active || active.archived) throw Error("Choose an active drawing sheet.");
  if (p.sheetSet && JSON.stringify(active.layout) !== JSON.stringify(p.sheet))
    throw Error("Active drawing sheet does not match its saved layout.");
  for (const sheet of set.sheets) {
    if (sheetIds.has(sheet.id)) throw Error("Duplicate drawing sheet identity.");
    sheetIds.add(sheet.id);
    for (const viewport of sheet.layout.viewports) {
      if (viewportIds.has(viewport.id)) throw Error("Duplicate viewport identity.");
      viewportIds.add(viewport.id);
      if (!levels.has(viewport.levelId)) throw Error("Sheet viewport refers to a missing level.");
      if (viewport.width < 20 || viewport.height < 20 || viewport.width > 1000 || viewport.height > 1000)
        throw Error("Viewport dimensions must be 20–1000 paper mm.");
    }
  }
}

function finish(p: ArchitectProject, set: AuthoredSheetSet): ArchitectProject {
  const sheetSet = authoredSheetSetSchema.parse(set);
  const active = sheetSet.sheets.find(sheet => sheet.id === sheetSet.activeId);
  if (!active || active.archived) throw Error("Choose an active drawing sheet.");
  const result = { ...structuredClone(p), sheetSet, sheet: structuredClone(active.layout) };
  validateAuthoredSheets(result);
  return result;
}

export function editActiveSheet(p: ArchitectProject, edit: (layout: SheetLayout) => void): ArchitectProject {
  validateAuthoredSheets(p);
  const set = structuredClone(authoredSheets(p));
  edit(set.sheets.find(sheet => sheet.id === set.activeId)!.layout);
  return finish(p, set);
}

export function reviewAuthoredSheetArchive(p: ArchitectProject, sheetId: string): AuthoredSheetArchiveReview {
  validateAuthoredSheets(p);
  const set = authoredSheets(p), sheet = set.sheets.find(row => row.id === sheetId);
  if (!sheet || sheet.archived) throw Error("This drawing sheet is no longer active.");
  if (set.sheets.filter(row => !row.archived).length < 2) throw Error("Keep at least one active drawing sheet. Add another sheet before archiving this one.");
  return { sheetId, name: sheet.name, projectSnapshot: JSON.stringify(p), viewports: Math.max(1, sheet.layout.viewports.length) };
}

function defaultViewport(p: ArchitectProject, layout: SheetLayout, id: string): SheetLayout["viewports"][number] {
  const [width, height] = layout.size === "A1" ? [841, 594] : [420, 297];
  return { id, view: "plan", levelId: p.levels[0].id, x: 12, y: 12, width: width - 24, height: height - 62, scale: layout.scale };
}

/** Returns an unsaved draft. Call the existing project commit; publish UI state only after success. */
export function changeAuthoredSheets(p: ArchitectProject, action: AuthoredSheetAction, makeId: () => string = () => crypto.randomUUID()): ArchitectProject {
  validateAuthoredSheets(p);
  const set = structuredClone(authoredSheets(p));
  if (action.type === "add" || action.type === "duplicate") {
    if (set.sheets.length >= 200) throw Error("This design already has 200 drawing sheets, including archived sheets.");
    const original = action.type === "duplicate" ? set.sheets.find(row => row.id === action.sheetId) : null;
    if (action.type === "duplicate" && (!original || original.archived)) throw Error("Choose an active sheet to duplicate.");
    const layout: SheetLayout = original ? structuredClone(original.layout) : { size: p.sheet.size, scale: p.sheet.scale, number: "", northAngle: p.sheet.northAngle, viewports: [] };
    let number = set.sheets.length + 1;
    while (set.sheets.some(sheet => sheet.layout.number === `S-${String(number).padStart(3, "0")}`)) number++;
    layout.number = `S-${String(number).padStart(3, "0")}`;
    layout.viewports = layout.viewports.length ? layout.viewports.map(viewport => ({ ...viewport, id: makeId() })) : [defaultViewport(p, layout, makeId())];
    const added: AuthoredSheet = { id: makeId(), name: original ? `${original.name.slice(0, 115)} copy` : `Drawing sheet ${number}`, archived: false, layout };
    set.sheets.push(added); set.activeId = added.id;
  } else {
    const sheetId = action.type === "archive" ? action.review.sheetId : action.sheetId;
    const index = set.sheets.findIndex(row => row.id === sheetId), sheet = set.sheets[index];
    if (!sheet) throw Error("The drawing sheet no longer exists.");
    if (action.type === "archive") {
      if (action.review.projectSnapshot !== JSON.stringify(p)) throw Error("The design changed after this review. Review the sheet again before archiving.");
      reviewAuthoredSheetArchive(p, sheetId);
      sheet.archived = true;
      if (set.activeId === sheet.id) set.activeId = (set.sheets.slice(index + 1).find(row => !row.archived) ?? set.sheets.slice(0, index).reverse().find(row => !row.archived))!.id;
    } else if (action.type === "recover") sheet.archived = false;
    else if (action.type === "rename") sheet.name = action.name;
    else {
      if (sheet.archived) throw Error("Recover this drawing sheet before selecting or moving it.");
      if (action.type === "select") set.activeId = sheet.id;
      else if (action.type === "move") {
        let next = index + action.direction;
        while (set.sheets[next]?.archived) next += action.direction;
        if (set.sheets[next]) [set.sheets[index], set.sheets[next]] = [set.sheets[next], sheet];
      }
    }
  }
  return finish(p, set);
}
