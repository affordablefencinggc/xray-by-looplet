import DxfParser from "dxf-parser";
import { emptyProject, validateProject, uuid, type ArchitectProject, type Point } from "./model.ts";
import { primitives } from "./drawing.ts";
const hash = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function exportDxf(project: ArchitectProject) {
  const p = validateProject(project),
    out: string[] = [],
    put = (...values: (string | number)[]) => out.push(...values.map(String));
  for (const l of p.levels)
    for (const item of primitives(p, l.id, "plan")) {
      const layer = "LEVEL_" + l.name.replace(/[^a-z0-9_-]/gi, "_"),
        at = (pt: Point) => [10, pt[0], 20, -pt[1], 30, l.elevation];
      if (item.kind === "line")
        put(
          0,
          "LINE",
          8,
          layer,
          ...at(item.points![0]),
          11,
          item.points![1][0],
          21,
          -item.points![1][1],
          31,
          l.elevation,
        );
      else if (item.kind === "path") {
        for (const ring of item.rings!) {
          const pts =
            ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]
              ? ring.slice(0, -1)
              : ring;
          put(0, "LWPOLYLINE", 8, layer, 90, pts.length, 70, 1, 38, l.elevation);
          for (const pt of pts) put(10, pt[0], 20, -pt[1]);
        }
      } else if (item.kind === "circle")
        put(0, "CIRCLE", 8, layer, ...at(item.center!), 40, item.radius!);
      else if (item.kind === "arc") {
        let start = (-item.endAngle! * 180) / Math.PI,
          end = (-item.startAngle! * 180) / Math.PI;
        if (item.clockwise) [start, end] = [end, start];
        put(
          0,
          "ARC",
          8,
          layer,
          ...at(item.center!),
          40,
          item.radius!,
          50,
          ((start % 360) + 360) % 360,
          51,
          ((end % 360) + 360) % 360,
        );
      } else
        put(
          0,
          "TEXT",
          8,
          layer,
          ...at(item.center!),
          40,
          item.size ?? 150,
          1,
          (item.text ?? "").replace(/[\r\n]/g, " "),
        );
    }
  const body = out.join("\n") + "\n",
    payload = JSON.stringify({ hash: await hash(body), project: p }),
    encoded = btoa(unescape(encodeURIComponent(payload))),
    chunks = encoded.match(/.{1,180}/g) ?? [];
  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1027",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    ...chunks.flatMap((c, i) => ["999", `XRAY_MODEL:${i}:${chunks.length}:${c}`]),
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    body.trimEnd(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\n");
}
export async function importDxf(text: string, jobId: string) {
  if (text.length > 12e6) throw Error("DXF exceeds 12 MB.");
  if (/^AC10\d\d/.test(text))
    throw Error(
      "Binary DWG requires a licensed DWG translator. Export an ASCII DXF from your CAD application.",
    );
  const normalized = text.replace(/\r/g, ""),
    body = normalized.match(/0\nSECTION\n2\nENTITIES\n([\s\S]*?)0\nENDSEC/)?.[1],
    parts = [...normalized.matchAll(/^XRAY_MODEL:(\d+):(\d+):([A-Za-z0-9+/=]+)$/gm)];
  if (parts.length && body) {
    try {
      const encoded = parts
          .sort((a, b) => Number(a[1]) - Number(b[1]))
          .map((p) => p[3])
          .join(""),
        payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      if (payload.hash === (await hash(body))) {
        const p = validateProject(payload.project);
        return { project: { ...p, id: jobId }, warnings: [] as string[], parametric: true };
      }
    } catch {
      /* External edits invalidate metadata; parse actual geometry below. */
    }
  }
  const doc = new DxfParser().parseSync(text);
  if (!doc) throw Error("DXF could not be read.");
  const units = Number(doc.header?.$INSUNITS),
    factor = ({ 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 } as Record<number, number>)[units];
  if (!factor)
    throw Error("DXF must declare millimetres, centimetres, metres, inches or feet ($INSUNITS).");
  const p = emptyProject(jobId);
  p.name = "Imported DXF reference geometry";
  const level = p.levels[0].id,
    warnings = new Set<string>();
  if (parts.length)
    warnings.add(
      "DXF vectors changed: embedded design discarded. Imported actual geometry as references.",
    );
  const pt = (v: { x: number; y: number }): Point => [v.x * factor, -v.y * factor];
  for (const entity of doc.entities) {
    const e = entity as any;
    if (e.type === "LINE" || e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
      if (e.vertices?.some((v: any) => v.bulge)) {
        warnings.add("Bulged polylines skipped; explode these curves in CAD before importing.");
        continue;
      }
      const vertices = e.vertices ?? [];
      for (let i = 0; i < vertices.length - (e.shape ? 0 : 1); i++) {
        const a = pt(vertices[i]),
          b = pt(vertices[(i + 1) % vertices.length]);
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= 1)
          p.lines.push({ id: uuid(), revision: 1, levelId: level, a, b });
      }
    } else if (e.type === "CIRCLE")
      p.circles.push({
        id: uuid(),
        revision: 1,
        levelId: level,
        center: pt(e.center),
        radius: e.radius * factor,
      });
    else if (e.type === "ARC")
      p.arcs.push({
        id: uuid(),
        revision: 1,
        levelId: level,
        center: pt(e.center),
        radius: e.radius * factor,
        startAngle: -e.endAngle,
        endAngle: -e.startAngle,
        clockwise: false,
      });
    else warnings.add(e.type + " entities are not editable reference geometry and were skipped.");
  }
  if (!p.lines.length && !p.circles.length && !p.arcs.length)
    throw Error("No supported reference geometry found.");
  warnings.add("External CAD vectors are references, not inferred wall assemblies.");
  return { project: validateProject(p), warnings: [...warnings], parametric: false };
}
export function csv(rows: (string | number | null)[][]) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = v === null ? "Unknown" : String(v);
          if (/^[=+@\t\r]/.test(s) || /^-[^0-9]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
