import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from "pdf-lib";
import { primitives, arcPath, ringsPath, type Primitive } from "./drawing.ts";
import { validateProject, type ArchitectProject, type Point } from "./model.ts";
import { fitTextMeasured } from "./titleBlock.ts";
export const paperSize = (p: ArchitectProject): Point =>
  p.sheet.size === "A1" ? [841, 594] : [420, 297];
export function drawingBounds(items: Primitive[]) {
  const pts = items.flatMap(
    (i) =>
      i.rings?.flat() ??
      i.points ??
      (i.center
        ? [
            i.center,
            ...(i.radius
              ? ([
                  [i.center[0] - i.radius, i.center[1] - i.radius],
                  [i.center[0] + i.radius, i.center[1] + i.radius],
                ] as Point[])
              : []),
          ]
        : []),
  );
  return pts.length
    ? {
        min: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))] as Point,
        max: [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] as Point,
      }
    : { min: [0, 0] as Point, max: [9000, 6000] as Point };
}
export function sheetViewports(p: ArchitectProject) {
  const [w, h] = paperSize(p);
  return p.sheet.viewports.length
    ? p.sheet.viewports
    : [
        {
          id: "default-plan",
          view: "plan" as const,
          levelId: p.levels[0].id,
          x: 12,
          y: 12,
          width: w - 24,
          height: h - 62,
          scale: p.sheet.scale,
        },
      ];
}
export function viewportBox(p: ArchitectProject, v: ReturnType<typeof sheetViewports>[number]) {
  const items = primitives(p, v.levelId, v.view),
    b = drawingBounds(items),
    width = v.width * Number(v.scale),
    height = (v.height - 8) * Number(v.scale);
  return {
    items,
    box: [(b.min[0] + b.max[0] - width) / 2, (b.min[1] + b.max[1] - height) / 2, width, height],
  };
}
const colour = (hex = "#333333") => {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
};
export async function exportDrawingPdf(project: ArchitectProject) {
  const p = validateProject(project),
    doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    [w, h] = paperSize(p),
    mm = 72 / 25.4,
    page = doc.addPage([w * mm, h * mm]);
  doc.setTitle(p.name + " / " + p.sheet.number);
  doc.setSubject("Authored architectural design. Print at 100%. Review required.");
  doc.setCreator("X-Ray architectural sketch");
  const text = (value: string, x: number, y: number, size = 9) =>
    page.drawText(value, { x: x * mm, y: (h - y) * mm, size, font, color: rgb(0.16, 0.19, 0.21) });
  page.drawRectangle({
    x: 8 * mm,
    y: 8 * mm,
    width: (w - 16) * mm,
    height: (h - 16) * mm,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.5,
  });
  for (const v of sheetViewports(p)) {
    const { items, box } = viewportBox(p, v),
      s = mm / Number(v.scale),
      ox = v.x * mm - box[0] * s,
      oy = (h - v.y) * mm + box[1] * s;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(v.x * mm, (h - v.y - v.height + 8) * mm, v.width * mm, (v.height - 8) * mm),
      clip(),
      endPath(),
    );
    for (const item of items) {
      const stroke = colour(item.stroke),
        thickness = Math.max(0.18, Math.min(0.9, (item.width ?? 10) * s));
      if (item.kind === "text") {
        const size = Math.max(5.5, (item.size ?? 150) * s),
          value = item.text ?? "",
          width = font.widthOfTextAtSize(value, size);
        page.drawText(value, {
          x: ox + item.center![0] * s - width / 2,
          y: oy - item.center![1] * s,
          size,
          font,
          color: colour(item.fill),
        });
      } else if (item.kind === "line") {
        page.drawLine({
          start: { x: ox + item.points![0][0] * s, y: oy - item.points![0][1] * s },
          end: { x: ox + item.points![1][0] * s, y: oy - item.points![1][1] * s },
          thickness,
          color: stroke,
          dashArray: item.dash ? [3, 2] : undefined,
        });
      } else if (item.kind === "circle") {
        page.drawCircle({
          x: ox + item.center![0] * s,
          y: oy - item.center![1] * s,
          size: item.radius! * s,
          borderColor: stroke,
          borderWidth: thickness,
          color: item.fill ? colour(item.fill) : undefined,
        });
      } else
        page.drawSvgPath(item.kind === "arc" ? arcPath(item) : ringsPath(item.rings!), {
          x: ox,
          y: oy,
          scale: s,
          borderColor: stroke,
          borderWidth: thickness / s,
          color: item.fill ? colour(item.fill) : undefined,
        });
    }
    page.pushOperators(popGraphicsState());
    text(
      v.view.toUpperCase() +
        " / " +
        p.levels.find((l) => l.id === v.levelId)!.name +
        " / 1:" +
        v.scale,
      v.x,
      v.y + v.height - 2,
      8,
    );
  }
  page.drawLine({
    start: { x: 8 * mm, y: 42 * mm },
    end: { x: (w - 8) * mm, y: 42 * mm },
    thickness: 0.7,
    color: rgb(0.3, 0.3, 0.3),
  });
  // D-07: fit each linked field to its column using the embedded font's own
  // metrics, so a long name or address cannot run under the sheet number in the
  // exported drawing. Measured in points, matching font.widthOfTextAtSize.
  const leftAvailable = (w - 100 - 14 - 6) * mm,
    rightAvailable = (100 - 8 - 6) * mm,
    fit = (value: string, size: number, available: number) =>
      fitTextMeasured(value, size, available, (v, s) => font.widthOfTextAtSize(v, s)).text;
  text(fit(p.name, 13, leftAvailable), 14, h - 32, 13);
  text(fit(p.address || "Project address not specified", 8, leftAvailable), 14, h - 25, 8);
  text(fit("DESIGN REVIEW / not for construction", 8, leftAvailable), 14, h - 17, 8);
  text(
    fit(p.sheet.number + " | REV " + p.designRevision + " | " + p.sheet.size, 11, rightAvailable),
    w - 100,
    h - 31,
    11,
  );
  text(fit("Model revision " + p.revision + " | print at 100%", 8, rightAvailable), w - 100, h - 24, 8);
  const scale = Number(p.sheet.scale),
    bar = 5000 / scale,
    x = w - 100,
    y = h - 14;
  page.drawLine({
    start: { x: x * mm, y: (h - y) * mm },
    end: { x: (x + bar) * mm, y: (h - y) * mm },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2),
  });
  text("0                         5 m / 1:" + scale, x, y + 4, 6);
  const a = ((p.sheet.northAngle - 90) * Math.PI) / 180,
    nx = w - 18,
    ny = h - 29;
  page.drawLine({
    start: { x: nx * mm, y: (h - ny) * mm },
    end: { x: (nx + Math.cos(a) * 9) * mm, y: (h - ny - Math.sin(a) * 9) * mm },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  text("N", nx - 1, ny - 11, 8);
  return doc.save();
}
export function saveDownload(data: string | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(
      new Blob([typeof data === "string" ? data : new Uint8Array(data).buffer], { type }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
import { designQuantities } from "./geometry.ts";
export async function exportMaterialSnapshotPdf(p: ArchitectProject) {
  const doc = await PDFDocument.load(await exportDrawingPdf(p)),
    font = await doc.embedFont(StandardFonts.Helvetica),
    rows = designQuantities(p).rows.filter((r) => r.areaM2 > 1e-9);
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  for (let start = 0; start < rows.length; start += 12) {
    const page = doc.addPage([595.276, 841.89]);
    page.drawText("AUTHORED DESIGN / QUANTITY EVIDENCE", { x: 35, y: 805, size: 13, font });
    page.drawText(`Model revision ${p.revision} / requires design review`, {
      x: 35,
      y: 785,
      size: 9,
      font,
    });
    for (let i = start; i < Math.min(start + 12, rows.length); i++) {
      const r = rows[i],
        y = 750 - (i - start) * 57;
      page.drawText(`${i + 1}. ${r.name.slice(0, 86)}`, { x: 35, y, size: 9, font });
      page.drawText(
        `${r.areaM2.toFixed(6)} m2 net | material ${r.materialVolumeM3?.toFixed(6) ?? "unknown"} m3 | ${r.weightKg?.toFixed(3) ?? "unknown"} kg`,
        { x: 35, y: y - 13, size: 8, font },
      );
      page.drawText(`Physical design key: ${r.id}`, { x: 35, y: y - 25, size: 6, font });
      page.drawText(
        "Net solid geometry; hosted openings deducted, wall junction overlaps removed.",
        { x: 35, y: y - 37, size: 7, font },
      );
    }
    page.drawText(
      "Design quantities only. Packing, hidden assembly members and compliance are not inferred.",
      { x: 35, y: 32, size: 8, font },
    );
  }
  return { bytes: await doc.save(), pageCount: doc.getPageCount() };
}
