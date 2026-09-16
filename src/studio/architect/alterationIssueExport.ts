import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { type ArchitectProject } from "./model.ts";
import { retrieveAlterationIssue, type AlterationIssueRecord } from "./alterationIssues.ts";
import { resolveAlterationStage } from "./alterationStage.ts";
import { primitives, type View } from "./drawing.ts";
import { drawingBounds } from "./sheets.ts";
import { fitTextMeasured } from "./titleBlock.ts";
import {
  calculateStageOpeningSchedule,
  calculateStageRoomSchedule,
} from "./alterationCoordination.ts";
import {
  calculateDemolitionSchedule,
  calculateSalvageDisposalSchedule,
  calculateRepairSchedule,
  calculateAlterationMaterialSchedule,
} from "./alterationSchedules.ts";

const MM = 72 / 25.4;

function displayText(value: string, font: PDFFont): string {
  return Array.from(value).map((character) => {
    if (character === "\\") return "\\\\";
    const code = character.codePointAt(0)!;
    if (code < 32 || code === 127) return `\\u{${code.toString(16)}}`;
    try {
      font.encodeText(character);
      return character;
    } catch {
      return `\\u{${code.toString(16)}}`;
    }
  }).join("");
}

function drawWatermarkIfSuperseded(page: PDFPage, font: PDFFont, width: number, height: number, text = "SUPERSEDED") {
  page.drawText(text, {
    x: width * 0.18,
    y: height * 0.28,
    size: 72,
    font,
    color: rgb(0.85, 0.2, 0.2),
    rotate: degrees(35),
    opacity: 0.35,
  });
}

/**
 * Export a complete, frozen issued alteration set as a multi-page PDF deliverable.
 */
export async function exportAlterationIssueSetPdf(
  project: ArchitectProject,
  issueId: string,
): Promise<Uint8Array> {
  const { record, source } = retrieveAlterationIssue(project, issueId);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = (val: string) => displayText(val, font);
  const safeBold = (val: string) => displayText(val, fontBold);

  const a3Width = 420 * MM;
  const a3Height = 297 * MM;

  // -------------------------------------------------------------
  // Page 1: Cover Sheet & Coordinated Issue Register
  // -------------------------------------------------------------
  const cover = doc.addPage([a3Width, a3Height]);
  let cursorY = a3Height - 40;

  // Header
  cover.drawText("COORDINATED ALTERATION DRAWING ISSUE SET", {
    x: 35,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.18),
  });
  cursorY -= 22;

  const statusColor = record.status === "superseded" ? rgb(0.85, 0.2, 0.2) : rgb(0.12, 0.45, 0.25);
  const statusLabel = record.status === "superseded"
    ? `SUPERSEDED — Replaced by Rev ${record.supersededByRevision ?? "N/A"}`
    : "OFFICIAL ISSUE — CURRENT REVISION";

  cover.drawText(statusLabel, {
    x: 35,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: statusColor,
  });
  cursorY -= 28;

  // Project and Issue Metadata Block
  const metaLines = [
    `Project: ${record.projectName} (${record.projectId})`,
    `Address: ${record.projectAddress || "Not specified"}`,
    `Design Revision: ${record.designRevision} | Model Revision: ${record.projectRevision}`,
    `Issue Purpose: ${record.purpose}`,
    `Date Issued: ${new Date(record.issuedAt).toUTCString()}`,
    `Alteration Basis Reference: ${record.basis.reference}`,
    `Shared Annotations: ${record.sharedAnnotationsAudited ? "Audited & Coordinated" : "Carried as Reference"}`,
  ];

  for (const line of metaLines) {
    const fitted = fitTextMeasured(safe(line), 10, a3Width - 70, (v, s) => font.widthOfTextAtSize(v, s)).text;
    cover.drawText(fitted, { x: 35, y: cursorY, size: 10, font });
    cursorY -= 15;
  }
  cursorY -= 15;

  // Summary Quantities Table
  cover.drawText("ALTERATION WORK SUMMARY", { x: 35, y: cursorY, size: 12, font: fontBold });
  cursorY -= 18;

  const quantRows = [
    ["Metric", "Before Stage", "Proposed Stage", "Alteration Scope"],
    [
      "Wall Solid Volume",
      `${record.beforeSummary.wallSolidVolumeM3.toFixed(3)} m³`,
      `${record.proposedSummary.wallSolidVolumeM3.toFixed(3)} m³`,
      `Net Change: ${(record.proposedSummary.wallSolidVolumeM3 - record.beforeSummary.wallSolidVolumeM3).toFixed(3)} m³`,
    ],
    [
      "Total Room Area",
      `${record.beforeSummary.totalRoomAreaM2.toFixed(2)} m² (${record.beforeSummary.roomsCount} rooms)`,
      `${record.proposedSummary.totalRoomAreaM2.toFixed(2)} m² (${record.proposedSummary.roomsCount} rooms)`,
      `Variance: ${(record.proposedSummary.totalRoomAreaM2 - record.beforeSummary.totalRoomAreaM2).toFixed(2)} m²`,
    ],
    [
      "Demolition Scope",
      `${record.schedulesSummary.demolitionRowsCount} elements`,
      "—",
      `Gross Solid Volume: ${record.schedulesSummary.demolitionVolumeM3.toFixed(3)} m³`,
    ],
    [
      "Salvage & Disposal",
      "—",
      "—",
      `Gross Bulked Volume: ${record.schedulesSummary.salvageDisposalVolumeM3.toFixed(3)} m³`,
    ],
    [
      "New & Repair Materials",
      "—",
      `${record.schedulesSummary.materialRowsCount} layer specifications`,
      `Order Area: ${record.schedulesSummary.materialOrderAreaM2.toFixed(2)} m²`,
    ],
  ];

  const colWidths = [140, 135, 155, 300];
  const colX = [35, 180, 320, 480];
  for (let i = 0; i < quantRows.length; i++) {
    const row = quantRows[i];
    const isHeader = i === 0;
    const rowFont = isHeader ? fontBold : font;
    for (let c = 0; c < row.length; c++) {
      const fittedCell = fitTextMeasured(safe(row[c]), 9, colWidths[c], (v, s) => rowFont.widthOfTextAtSize(v, s)).text;
      cover.drawText(fittedCell, { x: colX[c], y: cursorY, size: 9, font: rowFont });
    }
    cursorY -= 15;
  }
  cursorY -= 15;

  // Issue Sheet Register
  cover.drawText("COORDINATED DRAWING REGISTER", { x: 35, y: cursorY, size: 12, font: fontBold });
  cursorY -= 18;

  const regHeaders = ["Sheet Number", "Title / View Description", "Stage", "Scale"];
  const regCols = [35, 140, 520, 680];
  for (let c = 0; c < regHeaders.length; c++) {
    cover.drawText(regHeaders[c], { x: regCols[c], y: cursorY, size: 9, font: fontBold });
  }
  cursorY -= 14;

  for (let i = 0; i < record.sheets.length; i++) {
    const sheet = record.sheets[i];
    if (cursorY - 14 < 40 && i < record.sheets.length - 1) {
      cover.drawText(
        safe(`... and ${record.sheets.length - i} further registered sheets omitted from cover register summary (see drawing pages)`),
        { x: regCols[0], y: cursorY, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
      );
      cursorY -= 14;
      break;
    }
    const fitNum = fitTextMeasured(safe(sheet.number), 9, 95, (v, s) => font.widthOfTextAtSize(v, s)).text;
    const fitName = fitTextMeasured(safe(sheet.name), 9, 365, (v, s) => font.widthOfTextAtSize(v, s)).text;
    cover.drawText(fitNum, { x: regCols[0], y: cursorY, size: 9, font });
    cover.drawText(fitName, { x: regCols[1], y: cursorY, size: 9, font });
    cover.drawText(sheet.stage.toUpperCase(), { x: regCols[2], y: cursorY, size: 9, font });
    cover.drawText(sheet.scale, { x: regCols[3], y: cursorY, size: 9, font });
    cursorY -= 14;
    if (cursorY < 40) break;
  }

  if (record.status === "superseded") {
    drawWatermarkIfSuperseded(cover, fontBold, a3Width, a3Height);
  }

  // -------------------------------------------------------------
  // Drawing Sheet Pages: One page per registered sheet
  // -------------------------------------------------------------
  for (const sheet of record.sheets) {
    const page = doc.addPage([a3Width, a3Height]);
    const sheetStage = sheet.stage === "before" ? "before" : "proposed";
    const res = resolveAlterationStage(source, record.basis, sheetStage);

    if (res.ready) {
      const items = primitives(res.model, sheet.levelId, sheet.view as View);
      const bounds = drawingBounds(items);
      const dw = Math.max(bounds.max[0] - bounds.min[0], 1000);
      const dh = Math.max(bounds.max[1] - bounds.min[1], 1000);
      const margin = 50 * MM;
      const drawAreaW = a3Width - 2 * margin;
      const drawAreaH = a3Height - 2 * margin;
      const scaleFactor = Math.min(drawAreaW / dw, drawAreaH / dh);

      // Render simplified primitives representation
      for (const item of items) {
        const pts = item.points;
        if (item.kind === "line" && pts && pts.length >= 2) {
          for (let pIdx = 0; pIdx < pts.length - 1; pIdx++) {
            const p1 = pts[pIdx];
            const p2 = pts[pIdx + 1];
            const x1 = margin + (p1[0] - bounds.min[0]) * scaleFactor;
            const y1 = margin + (p1[1] - bounds.min[1]) * scaleFactor;
            const x2 = margin + (p2[0] - bounds.min[0]) * scaleFactor;
            const y2 = margin + (p2[1] - bounds.min[1]) * scaleFactor;
            page.drawLine({
              start: { x: x1, y: y1 },
              end: { x: x2, y: y2 },
              thickness: 1,
              color: rgb(0.2, 0.2, 0.2),
            });
          }
        }
      }
    }

    // Title Block (bottom-right standard architectural block)
    const tbW = 240 * MM;
    const tbH = 32 * MM;
    const tbX = a3Width - tbW - 20;
    const tbY = 20;

    page.drawRectangle({
      x: tbX,
      y: tbY,
      width: tbW,
      height: tbH,
      borderColor: rgb(0.1, 0.1, 0.1),
      borderWidth: 1,
      color: rgb(0.97, 0.97, 0.97),
    });

    const fitSheetName = fitTextMeasured(safeBold(sheet.name), 11, tbW - 20, (v, s) => fontBold.widthOfTextAtSize(v, s)).text;
    page.drawText(fitSheetName, { x: tbX + 10, y: tbY + tbH - 15, size: 11, font: fontBold });

    const sheetMetaStr = `Sheet: ${sheet.number} | Stage: ${sheet.stage.toUpperCase()} | Scale: ${sheet.scale}`;
    const fitSheetMeta = fitTextMeasured(safe(sheetMetaStr), 9, tbW - 20, (v, s) => font.widthOfTextAtSize(v, s)).text;
    page.drawText(fitSheetMeta, {
      x: tbX + 10,
      y: tbY + tbH - 30,
      size: 9,
      font,
    });

    const revPurposeProjectStr = `Rev: ${record.designRevision} | Purpose: ${record.purpose} | Project: ${record.projectName}`;
    const fitRevPurpose = fitTextMeasured(safe(revPurposeProjectStr), 8, tbW - 20, (v, s) => font.widthOfTextAtSize(v, s)).text;
    page.drawText(fitRevPurpose, {
      x: tbX + 10,
      y: tbY + tbH - 45,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    if (record.status === "superseded") {
      drawWatermarkIfSuperseded(page, fontBold, a3Width, a3Height);
    }
  }

  // -------------------------------------------------------------
  // Appendix Page: Schedule Appendices
  // -------------------------------------------------------------
  const schedPage = doc.addPage([a3Width, a3Height]);
  let appCursorY = a3Height - 40;

  schedPage.drawText("COORDINATED SCHEDULE APPENDICES", {
    x: 35,
    y: appCursorY,
    size: 16,
    font: fontBold,
  });
  appCursorY -= 22;

  const appSubHead = `Project: ${record.projectName} (Rev ${record.designRevision}) — Issued Schedule Tables`;
  schedPage.drawText(fitTextMeasured(safe(appSubHead), 10, a3Width - 70, (v, s) => font.widthOfTextAtSize(v, s)).text, {
    x: 35,
    y: appCursorY,
    size: 10,
    font,
  });
  appCursorY -= 25;

  // Demolition Schedule Table
  const demoSched = calculateDemolitionSchedule(source, record.basis);
  schedPage.drawText(`1. Demolition Schedule (${demoSched.rows.length} items)`, {
    x: 35,
    y: appCursorY,
    size: 11,
    font: fontBold,
  });
  appCursorY -= 15;

  const demoDisplayed = demoSched.rows.slice(0, 10);
  for (const row of demoDisplayed) {
    const vol = row.volumeM3 !== null ? `${row.volumeM3.toFixed(3)} m³` : "—";
    const line = `• ${row.name} (${row.kind}) | Level: ${row.levelName} | Volume: ${vol} | Disposition: ${row.disposition}`;
    const fittedLine = fitTextMeasured(safe(line), 8, a3Width - 80, (v, s) => font.widthOfTextAtSize(v, s)).text;
    schedPage.drawText(fittedLine, { x: 45, y: appCursorY, size: 8, font });
    appCursorY -= 12;
  }
  if (demoSched.rows.length > demoDisplayed.length) {
    schedPage.drawText(
      safe(`... and ${demoSched.rows.length - demoDisplayed.length} further demolition items omitted from summary page (see full schedule export)`),
      { x: 45, y: appCursorY, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
    );
    appCursorY -= 12;
  }
  appCursorY -= 15;

  // Opening Schedule Table
  const proposedOpenings = calculateStageOpeningSchedule(source, record.basis, "proposed");
  schedPage.drawText(`2. Proposed Openings Schedule (${proposedOpenings.rows.length} apertures)`, {
    x: 35,
    y: appCursorY,
    size: 11,
    font: fontBold,
  });
  appCursorY -= 15;

  const openingsDisplayed = proposedOpenings.rows.slice(0, 10);
  for (const row of openingsDisplayed) {
    const line = `• [${row.tag}] ${row.kind} (${row.width}x${row.height}mm, sill ${row.sill}mm) | Wall: ${row.wallName} | Disposition: ${row.disposition}`;
    const fittedLine = fitTextMeasured(safe(line), 8, a3Width - 80, (v, s) => font.widthOfTextAtSize(v, s)).text;
    schedPage.drawText(fittedLine, { x: 45, y: appCursorY, size: 8, font });
    appCursorY -= 12;
  }
  if (proposedOpenings.rows.length > openingsDisplayed.length) {
    schedPage.drawText(
      safe(`... and ${proposedOpenings.rows.length - openingsDisplayed.length} further opening apertures omitted from summary page (see full schedule export)`),
      { x: 45, y: appCursorY, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
    );
    appCursorY -= 12;
  }
  appCursorY -= 15;

  // Room Schedule Table
  const proposedRooms = calculateStageRoomSchedule(source, record.basis, "proposed");
  schedPage.drawText(`3. Proposed Room Schedule (${proposedRooms.rows.length} rooms)`, {
    x: 35,
    y: appCursorY,
    size: 11,
    font: fontBold,
  });
  appCursorY -= 15;

  const roomsDisplayed = proposedRooms.rows.slice(0, 10);
  for (const row of roomsDisplayed) {
    const varianceStr = row.varianceFromBeforeM2 !== null ? ` | Variance: ${row.varianceFromBeforeM2 > 0 ? "+" : ""}${row.varianceFromBeforeM2.toFixed(2)} m²` : "";
    const line = `• ${row.name} | Area: ${row.areaM2.toFixed(2)} m² | Perim: ${row.perimeterM.toFixed(2)} m${varianceStr} (${row.status})`;
    const fittedLine = fitTextMeasured(safe(line), 8, a3Width - 80, (v, s) => font.widthOfTextAtSize(v, s)).text;
    schedPage.drawText(fittedLine, { x: 45, y: appCursorY, size: 8, font });
    appCursorY -= 12;
  }
  if (proposedRooms.rows.length > roomsDisplayed.length) {
    schedPage.drawText(
      safe(`... and ${proposedRooms.rows.length - roomsDisplayed.length} further rooms omitted from summary page (see full schedule export)`),
      { x: 45, y: appCursorY, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
    );
    appCursorY -= 12;
  }

  if (record.status === "superseded") {
    drawWatermarkIfSuperseded(schedPage, fontBold, a3Width, a3Height);
  }

  return await doc.save();
}
