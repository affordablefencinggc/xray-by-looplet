import { PDFDocument, PageSizes } from "pdf-lib";
import { parseSourceBuilding, type SourceBuilding } from "./sourceBuilding.ts";
import type { DraftsmanStoreyItem } from "./MagicPencilDraftsman.ts";

export interface BlueprintBookSheet {
  id: string; sheetNumber: string; title: string; subtitle: string; scale: string;
  canvas: HTMLCanvasElement; dataUrl: string;
}
export interface BlueprintBookResult {
  title: string; projectNumber: string; sheets: BlueprintBookSheet[];
  generatedAt: string; sourceSha256: string;
  downloadPdf: (filename?: string) => Promise<void>;
  downloadSheet: (sheetId: string, filename?: string) => void;
}
export interface GeneratePlanBookOptions {
  model: SourceBuilding; storeys: DraftsmanStoreyItem[];
  canvasSnapshot?: HTMLCanvasElement; activeStoreyLabel?: string; activeElevation?: number;
  /** Caller compatibility only; rendered dimensions are calculated from model bounds. */
  dimensions?: { widthMm: number; depthMm: number; heightMm: number; widthLabel: string; depthLabel: string; heightLabel: string };
}
type Point = [number, number];
export interface BlueprintTriangle {
  partId: string;
  evidenceState: SourceBuilding["objects"][number]["evidenceState"];
  points: [Point, Point, Point];
}
export interface BlueprintPagePlan {
  id: string; title: string; subtitle: string; scale: "NTS";
  kind: "register" | "plan" | "elevation" | "snapshot";
  triangles: BlueprintTriangle[];
  extent: { min: Point; max: Point };
  notes: string[];
}
export const BLUEPRINT_NOTICE = "ILLUSTRATIVE MODEL PREVIEW - NOT FOR CONSTRUCTION";
const WIDTH = 1200, HEIGHT = 848;
const PLAN_CATEGORIES = new Set(["slab", "wall", "room", "column", "window", "door", "stair"]);

/** Project real triangle vertices. This does not invent cores, partitions or a surveyed grid. */
function triangles(model: SourceBuilding, axes: [number, number], band?: [number, number]): BlueprintTriangle[] {
  const result: BlueprintTriangle[] = [];
  for (const part of model.objects) {
    if (band && !PLAN_CATEGORIES.has(part.category)) continue;
    for (let i = 0; i < part.indices.length; i += 3) {
      const vertices = part.indices.slice(i, i + 3).map(index => part.positions.slice(index * 3, index * 3 + 3));
      // Overlapping-height projection, not a horizontal section or hidden-line extraction.
      if (band && (Math.max(...vertices.map(v => v[1])) < band[0] || Math.min(...vertices.map(v => v[1])) >= band[1])) continue;
      result.push({ partId: part.id, evidenceState: part.evidenceState,
        points: vertices.map(v => [v[axes[0]], v[axes[1]]]) as [Point, Point, Point] });
    }
  }
  return result;
}

/** Pure preparation is testable independently and does not pretend to render a canvas. */
export function prepareBlueprintBook(options: GeneratePlanBookOptions) {
  const model = parseSourceBuilding(options.model);
  const storeys = options.storeys.map(level => ({ ...level }));
  if (!storeys.length || storeys.length > 100 || storeys.some((s, i) =>
    !s.label.trim() || s.label.length > 100 || !Number.isFinite(s.elevation) ||
    s.elevation < model.bounds.min[1] - 0.01 || s.elevation > model.bounds.max[1] + 0.01 ||
    (i > 0 && s.elevation <= storeys[i - 1].elevation))) {
    throw Error("Model preview requires an ordered, finite level schedule within model bounds.");
  }
  const title = model.source.title ?? model.source.name.replace(/\.pdf$/i, "");
  const generatedAt = new Date().toISOString(), ground = storeys[0].elevation;
  const selectedUpper = options.activeElevation === undefined ? undefined : storeys.find(s => Math.abs(s.elevation - options.activeElevation!) < 0.001 && s.elevation > ground);
  const upper = selectedUpper ?? storeys[1];
  const endOfBand = (elevation: number) => storeys.find(s => s.elevation > elevation)?.elevation ?? model.bounds.max[1] + 0.001;
  const extent = { min: [model.bounds.min[0], model.bounds.min[2]] as Point, max: [model.bounds.max[0], model.bounds.max[2]] as Point };
  const common = ["NTS: fit to page; do not measure this image.", "Coordinates and dimensions use model metres, not a surveyed datum."];
  const pages: BlueprintPagePlan[] = [
    { id: "S-001", title: "Model and level register", subtitle: "Provided level schedule and source attribution; no approval or revision assigned.", scale: "NTS", kind: "register", triangles: [], extent,
      notes: [...common, "Source SHA-256 identifies an input; it does not certify geometry or compliance."] },
    { id: "S-101", title: "Lowest level model projection", subtitle: `${storeys[0].label}: model Y ${ground.toFixed(2)} to ${endOfBand(ground).toFixed(2)} m`, scale: "NTS", kind: "plan",
      triangles: triangles(model, [0, 2], [ground, endOfBand(ground)]), extent,
      notes: [...common, "Top projection of selected model categories overlapping this height band.", "Not a cut plan: overlapping geometry and triangulation remain; model -Z is up, north unknown."] },
    { id: "S-102", title: "Upper level model projection", subtitle: upper ? `${upper.label}: model Y ${upper.elevation.toFixed(2)} to ${endOfBand(upper.elevation).toFixed(2)} m` : "No distinct upper level supplied; no floor layout generated.", scale: "NTS", kind: "plan",
      triangles: upper ? triangles(model, [0, 2], [upper.elevation, endOfBand(upper.elevation)]) : [], extent,
      notes: [...common, "Actual model triangle projection; repeat floors, cores and partitions are not invented.", "Not a cut plan: overlapping geometry remains; model -Z is up, north unknown."] },
    { id: "S-201", title: "Model elevation projection", subtitle: "Orthographic X/Y projection of all model triangles; not a section cut.", scale: "NTS", kind: "elevation",
      triangles: triangles(model, [0, 1]), extent: { min: [model.bounds.min[0], model.bounds.min[1]], max: [model.bounds.max[0], model.bounds.max[1]] },
      notes: [...common, "Occluded edges remain; no structural, foundation or fire design is supplied."] },
    { id: "S-301", title: "Current model view snapshot", subtitle: "Raster capture of the current camera and visible state, when available.", scale: "NTS", kind: "snapshot", triangles: [], extent,
      notes: [...common, "A raster snapshot is not editable CAD geometry or a verified isometric drawing."] },
  ];
  return { model, storeys, title, generatedAt, pages };
}
function createCanvas(): HTMLCanvasElement {
  if (typeof document === "undefined") throw Error("Model sheet rendering requires a browser canvas.");
  const canvas = document.createElement("canvas"); canvas.width = WIDTH; canvas.height = HEIGHT;
  if (!canvas.getContext("2d")) throw Error("The browser could not create a 2D sheet renderer.");
  return canvas;
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 13, color = "#e2f1f8", maxWidth?: number) {
  ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = "left";
  let shown = value;
  if (maxWidth && ctx.measureText(shown).width > maxWidth) {
    while (shown.length && ctx.measureText(`${shown}…`).width > maxWidth) shown = shown.slice(0, -1);
    shown += "…";
  }
  ctx.fillText(shown, x, y);
}
function frame(ctx: CanvasRenderingContext2D, page: BlueprintPagePlan, title: string, generatedAt: string, sha: string) {
  ctx.fillStyle = "#0b1d33"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#6ba4c8"; ctx.lineWidth = 1; ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);
  text(ctx, title, 48, 57, 16, "#e2f1f8", 1095);
  text(ctx, page.title, 48, 92, 25, "#35e0c2", 1095);
  text(ctx, page.subtitle, 48, 119, 13, "#e2f1f8", 1095);
  page.notes.forEach((note, i) => text(ctx, note, 48, 696 + i * 18, 12, "#a9c7db", 1095));
  ctx.strokeStyle = "#35e0c2"; ctx.strokeRect(40, 774, WIDTH - 80, 42);
  text(ctx, BLUEPRINT_NOTICE, 52, 792, 13, "#35e0c2");
  text(ctx, `${page.id} | SCALE: NTS | Generated ${generatedAt.slice(0, 10)} UTC | Revision: unassigned`, 52, 807, 11);
  text(ctx, `Source hash ${sha.slice(0, 16)}…`, 868, 806, 10, "#a9c7db");
}
function drawProjection(ctx: CanvasRenderingContext2D, page: BlueprintPagePlan) {
  const viewport = { x: 80, y: 155, width: 1040, height: 490 };
  const spanX = page.extent.max[0] - page.extent.min[0], spanY = page.extent.max[1] - page.extent.min[1];
  const scale = Math.min(viewport.width / spanX, viewport.height / spanY);
  const offsetX = viewport.x + (viewport.width - spanX * scale) / 2, offsetY = viewport.y + (viewport.height - spanY * scale) / 2;
  if (!page.triangles.length) { text(ctx, "No model geometry available for this view.", 80, 220, 18); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height); ctx.clip();
  ctx.strokeStyle = "#a9d5ee"; ctx.lineWidth = 0.7;
  for (const triangle of page.triangles) {
    ctx.beginPath();
    triangle.points.forEach(([x, y], i) => {
      const sx = offsetX + (x - page.extent.min[0]) * scale;
      const sy = offsetY + (page.kind === "elevation" ? page.extent.max[1] - y : y - page.extent.min[1]) * scale;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
  text(ctx, `${page.triangles.length.toLocaleString()} source triangles projected; source evidence may be inferred.`, 48, 673, 12, "#a9c7db");
}
/** Actual raster PDF bytes. Physical A4 landscape pages are deliberately NTS. */
export async function buildBlueprintPdf(sheets: ReadonlyArray<Pick<BlueprintBookSheet, "dataUrl">>, metadata: { title: string; generatedAt: string }): Promise<Uint8Array> {
  if (!sheets.length || sheets.length > 100) throw Error("PDF requires between 1 and 100 rendered sheets.");
  const date = new Date(metadata.generatedAt);
  if (!Number.isFinite(date.getTime())) throw Error("PDF generation date is invalid.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(metadata.title); pdf.setSubject(BLUEPRINT_NOTICE); pdf.setCreator("X-Ray illustrative model sheet export");
  pdf.setCreationDate(date); pdf.setModificationDate(date);
  for (const sheet of sheets) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(sheet.dataUrl) || sheet.dataUrl.length > 32 * 1024 * 1024) throw Error("A sheet does not contain a valid bounded PNG image.");
    const image = await pdf.embedPng(sheet.dataUrl);
    const page = pdf.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
    const scale = Math.min(page.getWidth() / image.width, page.getHeight() / image.height), width = image.width * scale, height = image.height * scale;
    page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  }
  return pdf.save();
}
function filenameStem(title: string) {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, "_").slice(0, 100) || "model";
}
function download(href: string, filename: string) {
  if (typeof document === "undefined") throw Error("Downloading model sheets requires a browser.");
  const anchor = document.createElement("a"); anchor.href = href; anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); }
}
export function generatePlanBook(options: GeneratePlanBookOptions): BlueprintBookResult {
  const prepared = prepareBlueprintBook(options), { model, storeys, title, generatedAt } = prepared;
  const sheets = prepared.pages.map(page => {
    const canvas = createCanvas(), ctx = canvas.getContext("2d")!;
    frame(ctx, page, title, generatedAt, model.source.sha256);
    if (page.kind === "register") {
      const [x, y, z] = model.bounds.max.map((v, i) => v - model.bounds.min[i]);
      text(ctx, `Model bounding dimensions: X ${(x * 1000).toFixed(0)} mm | Z ${(z * 1000).toFixed(0)} mm | Y ${(y * 1000).toFixed(0)} mm`, 48, 158, 14);
      text(ctx, `${model.objects.length} source objects | ${storeys.length} supplied levels | Source pages: ${model.source.pageCount}`, 48, 185, 14);
      text(ctx, "MODEL LEVEL REGISTER (model Y in metres; not surveyed RL)", 48, 220, 14, "#35e0c2");
      // All supported levels are shown; a 52-storey model is not silently truncated at 16 rows.
      const rows = Math.min(24, storeys.length), columnWidth = 1104 / Math.ceil(storeys.length / rows);
      storeys.forEach((level, i) => {
        const lx = 48 + Math.floor(i / rows) * columnWidth, ly = 245 + (i % rows) * 18;
        text(ctx, level.label, lx, ly, 11, "#e2f1f8", columnWidth - 92);
        text(ctx, `${level.elevation.toFixed(2)} m`, lx + columnWidth - 87, ly, 11, "#35e0c2");
      });
    } else if (page.kind === "snapshot") {
      const snapshot = options.canvasSnapshot;
      if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
        const scale = Math.min(1104 / snapshot.width, 490 / snapshot.height), width = snapshot.width * scale, height = snapshot.height * scale;
        ctx.drawImage(snapshot, 48 + (1104 - width) / 2, 155 + (490 - height) / 2, width, height);
      } else text(ctx, "No current model snapshot was supplied.", 80, 220, 18);
    } else drawProjection(ctx, page);
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png;base64,")) throw Error("The browser could not encode a model sheet PNG.");
    return { id: page.id, sheetNumber: page.id, title: page.title, subtitle: page.subtitle, scale: page.scale, canvas, dataUrl };
  });
  return {
    title, projectNumber: "Unassigned", sheets, generatedAt, sourceSha256: model.source.sha256,
    async downloadPdf(filename) {
      const bytes = await buildBlueprintPdf(sheets, { title, generatedAt });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      try { download(url, filename ?? `${filenameStem(title)}_Illustrative_Model_Sheets.pdf`); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    },
    downloadSheet(sheetId, filename) {
      const sheet = sheets.find(item => item.id === sheetId);
      if (!sheet) throw Error("The requested model sheet does not exist.");
      download(sheet.dataUrl, filename ?? `${filenameStem(title)}_${sheet.id}.png`);
    },
  };
}
