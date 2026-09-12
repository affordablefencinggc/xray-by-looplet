import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { IssueRecord } from "./issueHistory.ts";
import { issuedDrawing } from "./issuedDrawing.ts";
import { exportDrawingPdf } from "./sheets.ts";
import { fitTextMeasured } from "./titleBlock.ts";

/** Recreates a saved issue; never represents these bytes as the original issued file. */
export async function exportIssuedDrawingPdf(issue: IssueRecord, sheetId: string) {
  const model = issuedDrawing(issue, sheetId);
  const sheet = issue.sheets.find(sheet => sheet.sheetId === sheetId)!;
  const document = await PDFDocument.load(await exportDrawingPdf(model));
  const page = document.getPage(0), font = await document.embedFont(StandardFonts.HelveticaBold);
  const superseded = sheet.status === "superseded", mm = 72 / 25.4;
  const status = superseded ? "SUPERSEDED" : "HISTORICAL ISSUE";
  const date = issue.issuedAt.slice(0, 10);
  const label = `${status} | Rev ${issue.designRevision} | issued ${date} | Recreated from saved issue`;
  const fitted = fitTextMeasured(label, 8, page.getWidth() - 24 * mm, (text, size) => font.widthOfTextAtSize(text, size));
  page.drawText(fitted.text, { x: 12 * mm, y: page.getHeight() - 6 * mm, size: 8, font, color: superseded ? rgb(.65, .12, .12) : rgb(.2, .25, .3) });
  if (superseded) {
    const size = page.getWidth() / 13;
    const width = font.widthOfTextAtSize("SUPERSEDED", size);
    page.drawText("SUPERSEDED", { x: (page.getWidth() - width * Math.cos(Math.PI / 7.2)) / 2, y: page.getHeight() / 2 - width * Math.sin(Math.PI / 7.2) / 2, size, font, rotate: degrees(25), color: rgb(.75, .12, .12), opacity: .16 });
    const replacement = `Superseded by Rev ${sheet.supersededByRevision ?? "unknown"} on ${sheet.supersededAt?.slice(0, 10) ?? "date not recorded"}`;
    page.drawText(fitTextMeasured(replacement, 7, page.getWidth() - 24 * mm, (text, size) => font.widthOfTextAtSize(text, size)).text, { x: 12 * mm, y: 4 * mm, size: 7, font, color: rgb(.65, .12, .12) });
  }
  document.setTitle(`${model.name} / ${sheet.number} / Rev ${issue.designRevision} / ${status}`);
  document.setSubject(`Recreated from saved issue ${issue.id}; issued ${issue.issuedAt}; sheet ${sheet.sheetId}; layout SHA-256 ${sheet.layoutHash}. ${status}. Design review required.`);
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return { bytes: await document.save(), filename: `xray-${safe(sheet.number)}-rev-${safe(issue.designRevision)}-${safe(date)}-${superseded ? "superseded" : "issued"}.pdf` };
}
