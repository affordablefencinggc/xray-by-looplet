import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { validateProject, type ArchitectProject } from "./model.ts";
import type { View } from "./drawing.ts";
import { exportDrawingPdf } from "./sheets.ts";
import { sha256Hex } from "./designedScene.ts";
import { resolveAlterationStage, type AlterationBasis, type AlterationStage } from "./alterationStage.ts";

export type AlterationExportOptions = { levelId: string; view: View };
const views: View[] = ["plan", "north", "south", "east", "west", "section"];
const MM = 72 / 25.4;
const WARNING = "DRAFT / NOT ISSUED / NOT FOR CONSTRUCTION";

/** Reversible visible notation avoids Helvetica silently losing unsupported
 * glyphs. Literal backslashes are doubled so Unicode escapes stay unambiguous.
 */
function displayText(value: string, font: PDFFont): string {
  return Array.from(value).map((character) => {
    if (character === "\\") return "\\\\";
    const code = character.codePointAt(0)!;
    if (code < 32 || code === 127) return `\\u{${code.toString(16)}}`;
    try { font.encodeText(character); return character; }
    catch { return `\\u{${code.toString(16)}}`; }
  }).join("");
}

function lines(value: string, font: PDFFont, size: number, width: number): string[] {
  const result: string[] = [];
  let line = "";
  for (const character of value) {
    if (line && font.widthOfTextAtSize(line + character, size) > width) {
      result.push(line); line = "";
    }
    line += character;
  }
  if (line || !result.length) result.push(line);
  return result;
}

/** Export a reviewed, current ephemeral stage. This is deliberately separate
 * from issue export: no issue record, history, quantity or approval is created.
 */
export async function exportAlterationStagePdf(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
  options: AlterationExportOptions,
): Promise<Uint8Array> {
  const original = validateProject(project);
  const resolution = resolveAlterationStage(original, basis, stage);
  if (!resolution.ready) throw Error(resolution.blockers.map((blocker) => blocker.reason).join(" "));
  if (!options || !views.includes(options.view) || !original.levels.some((level) => level.id === options.levelId)) {
    throw Error("Select an existing level and a supported drawing view for the alteration export.");
  }
  // Capture caller-owned selection before the first await; later UI mutations
  // cannot relabel the geometry or its review identity while PDF work runs.
  options = { levelId: options.levelId, view: options.view };
  const stageLabel = stage === "before" ? "BEFORE ALTERATION" : "PROPOSED ALTERATION";
  const selectedLevel = original.levels.find((level) => level.id === options.levelId)!;
  const reviewId = sha256Hex(JSON.stringify({
    fingerprint: basis!.fingerprint, reference: resolution.basisReference,
    stage, levelId: options.levelId, view: options.view,
  })).slice(0, 20);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const safe = (value: string) => displayText(value, font);
  const width = 420 * MM, height = 297 * MM;
  let cover = doc.addPage([width, height]);
  let cursor = height - 42;
  const coverHeader = () => {
    cover.drawText(stageLabel + " / REVIEW NOTES", { x: 35, y: cursor, size: 17, font });
    cursor -= 24;
    cover.drawText(WARNING + " / Review " + reviewId, { x: 35, y: cursor, size: 10, font, color: rgb(0.55, 0.12, 0.1) });
    cursor -= 28;
  };
  coverHeader();
  const paragraph = (value: string) => {
    for (const line of lines(safe(value), font, 10, width - 70)) {
      if (cursor < 40) { cover = doc.addPage([width, height]); cursor = height - 42; coverHeader(); }
      cover.drawText(line, { x: 35, y: cursor, size: 10, font }); cursor -= 14;
    }
    cursor -= 9;
  };
  paragraph("Original project identity: " + original.id);
  paragraph("Original project name: " + original.name);
  paragraph(`Original model revision: ${original.revision} / design revision: ${original.designRevision}`);
  paragraph(`Selected level: ${selectedLevel.name} / identity: ${selectedLevel.id} / view: ${options.view}`);
  paragraph("Geometry review reference (full): " + resolution.basisReference);
  paragraph("Session review declares existing/repaired geometry unchanged across stages. This reference is not a verified survey or a historical issue basis.");
  paragraph("Shared annotations: notes, room tags, grids, drafting marks and section position come from the current all-work project. They have not been independently classified by alteration stage.");
  paragraph("No construction quantities, material procurement, disposal allowances, compliance approval or issued-history claim is made. Shared-volume ownership between classifications remains unresolved.");
  paragraph("Text encoding: unsupported glyphs/control characters use explicit Unicode escapes such as \\u{1f600}; literal backslashes are doubled. Full original Unicode identity/reference and drawing labels are preserved in attached alteration-review.json. Long drawing labels are visibly marked [...] when shortened; review the attachment.");
  paragraph("The drawing keeps its declared scale; geometry outside the selected viewport may be clipped. Print at 100%. Review the complete stage model before relying on a detail.");

  const p = resolution.model;
  const labels: { field: string; original: string; display: string }[] = [];
  const label = (field: string, value: string, max: number): string => {
    const encoded = safe(value);
    const display = encoded.length > max ? encoded.slice(0, max - 6) + " [...]" : encoded;
    labels.push({ field, original: value, display });
    return display;
  };
  p.name = stageLabel + " / DRAFT";
  p.address = "Full project identity and review reference: attached review notes / " + reviewId;
  p.designRevision = label("designRevision", p.designRevision, 40);
  for (const level of p.levels) level.name = label(`level/${level.id}`, level.name, 100);
  for (const tag of p.roomTags) tag.name = label(`roomTag/${tag.id}`, tag.name, 100);
  for (const slab of p.slabs) slab.name = label(`slab/${slab.id}`, slab.name, 120);
  for (const grid of p.grids) grid.label = label(`grid/${grid.id}`, grid.label, 20);
  for (const opening of p.openings) {
    // Opening tags must remain unique after display conversion. Failing clearly
    // is preferable to exporting indistinguishable shortened door/window tags.
    opening.tag = label(`opening/${opening.id}`, opening.tag, 30);
  }
  if (new Set(p.openings.map((opening) => opening.tag.toLowerCase())).size !== p.openings.length) {
    throw Error("Opening labels become ambiguous after PDF text encoding; shorten or distinguish the authored tags before exporting.");
  }
  delete p.sheetSet;
  p.sheet = { size: "A3", scale: original.sheet.scale, number: "DRAFT-" + stage.toUpperCase(), northAngle: original.sheet.northAngle,
    viewports: [{ id: "alteration-stage-view", levelId: options.levelId, view: options.view, x: 12, y: 35, width: 396, height: 207, scale: original.sheet.scale }] };
  let drawingBytes: Uint8Array;
  try { drawingBytes = await exportDrawingPdf(p); }
  catch (error) {
    throw Error("The stage drawing could not be exported safely. Review its display labels and geometry: " + (error instanceof Error ? error.message : String(error)));
  }
  const rendered = await PDFDocument.load(drawingBytes);
  const drawingPages = await doc.copyPages(rendered, rendered.getPageIndices());
  for (const page of drawingPages) {
    doc.addPage(page);
    let y = height - 32;
    const header = [
      `${stageLabel} / ${WARNING} / original model revision ${original.revision}`,
      "Project identity: " + safe(original.id),
      "Review " + reviewId + " / full reference: review notes and attached alteration-review.json",
      "Shared annotations are current, not stage-reviewed. No issued-history or material-quantity claim.",
    ];
    for (const text of header) for (const line of lines(text, font, 8, width - 70)) {
      if (y < height - 95) throw Error("The original project identity does not fit the reserved drawing header safely.");
      page.drawText(line, { x: 35, y, size: 8, font }); y -= 10;
    }
  }
  const attachment = {
    format: "xray.alteration-draft-export/v1", draftOnly: true, issued: false, quoteEligible: false,
    reviewId, stage, projectId: original.id, projectName: original.name, projectRevision: original.revision,
    designRevision: original.designRevision, basisReference: resolution.basisReference,
    levelId: options.levelId, levelName: selectedLevel.name, view: options.view,
    sharedAnnotationsReviewed: false, excludedIds: resolution.excludedIds, displayLabels: labels,
  };
  await doc.attach(new TextEncoder().encode(JSON.stringify(attachment, null, 2)), "alteration-review.json", {
    mimeType: "application/json", description: "Original Unicode review reference and identity; authored draft, not issued history.",
  });
  doc.setTitle(`${stageLabel} / ${original.name} / DRAFT`);
  doc.setSubject(`DRAFT; NOT ISSUED; project ${original.id}; model revision ${original.revision}; review ${reviewId}; full reference: ${resolution.basisReference}`);
  doc.setCreator("X-Ray alteration stage draft export");
  return doc.save();
}
