import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlanBinary } from "./documentContract";

type Point = { x: number; y: number };
type DxfPath = { d: string; closed: boolean };

export type DxfSvgGeometry = {
  viewBox: string;
  paths: DxfPath[];
  entityCount: number;
  pointCount: number;
};

type DxfPair = { code: number; value: string };

const MAX_DXF_POINTS = 100_000;

function decodeDxf(input: string | Uint8Array) {
  return typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: false }).decode(input);
}

function pairsFromDxf(input: string | Uint8Array): DxfPair[] {
  const lines = decodeDxf(input).replace(/\r/g, "").split("\n");
  const pairs: DxfPair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (Number.isFinite(code)) pairs.push({ code, value: lines[index + 1].trim() });
  }
  return pairs;
}

function numberAt(pairs: DxfPair[], code: number) {
  const raw = pairs.find((pair) => pair.code === code)?.value;
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function flagAt(pairs: DxfPair[]) {
  return Number.parseInt(pairs.find((pair) => pair.code === 70)?.value ?? "0", 10) || 0;
}

function lightweightPoints(pairs: DxfPair[]) {
  const points: Point[] = [];
  let pendingX: number | null = null;
  for (const pair of pairs) {
    if (pair.code === 10) {
      const value = Number(pair.value);
      pendingX = Number.isFinite(value) ? value : null;
    } else if (pair.code === 20 && pendingX !== null) {
      const y = Number(pair.value);
      if (Number.isFinite(y)) points.push({ x: pendingX, y });
      pendingX = null;
    }
    if (points.length >= MAX_DXF_POINTS) break;
  }
  return points;
}

function entityEnd(pairs: DxfPair[], start: number) {
  let index = start + 1;
  while (index < pairs.length && pairs[index].code !== 0) index += 1;
  return index;
}

function entitiesSection(pairs: DxfPair[]) {
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index].code === 0 && pairs[index].value.toUpperCase() === "SECTION" && pairs[index + 1].code === 2 && pairs[index + 1].value.toUpperCase() === "ENTITIES") {
      const start = index + 2;
      let end = start;
      while (end < pairs.length && !(pairs[end].code === 0 && pairs[end].value.toUpperCase() === "ENDSEC")) end += 1;
      return pairs.slice(start, end);
    }
  }
  return pairs;
}

function collectDxfPolylines(input: string | Uint8Array) {
  const pairs = entitiesSection(pairsFromDxf(input));
  const polylines: { points: Point[]; closed: boolean }[] = [];
  let index = 0;
  let pointCount = 0;

  const add = (points: Point[], closed = false) => {
    const remaining = MAX_DXF_POINTS - pointCount;
    const safePoints = points.slice(0, remaining).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (safePoints.length < 2) return;
    polylines.push({ points: safePoints, closed });
    pointCount += safePoints.length;
  };

  while (index < pairs.length && pointCount < MAX_DXF_POINTS) {
    if (pairs[index].code !== 0) {
      index += 1;
      continue;
    }
    const type = pairs[index].value.toUpperCase();
    const end = entityEnd(pairs, index);
    const body = pairs.slice(index + 1, end);

    if (type === "LINE") {
      const x1 = numberAt(body, 10);
      const y1 = numberAt(body, 20);
      const x2 = numberAt(body, 11);
      const y2 = numberAt(body, 21);
      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) add([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
      index = end;
      continue;
    }

    if (type === "LWPOLYLINE") {
      add(lightweightPoints(body), (flagAt(body) & 1) === 1);
      index = end;
      continue;
    }

    if (type === "POLYLINE") {
      const points: Point[] = [];
      const closed = (flagAt(body) & 1) === 1;
      index = end;
      while (index < pairs.length && pairs[index].code === 0) {
        const childType = pairs[index].value.toUpperCase();
        const childEnd = entityEnd(pairs, index);
        if (childType === "VERTEX") {
          const vertex = pairs.slice(index + 1, childEnd);
          const x = numberAt(vertex, 10);
          const y = numberAt(vertex, 20);
          if (x !== null && y !== null) points.push({ x, y });
          index = childEnd;
          continue;
        }
        if (childType === "SEQEND") index = childEnd;
        break;
      }
      add(points, closed);
      continue;
    }

    index = end;
  }
  return polylines;
}

function fmt(value: number) {
  return Number(value.toFixed(4)).toString();
}

/** Parse supported ASCII DXF linework into bounded SVG path data. */
export function dxfToSvgGeometry(input: string | Uint8Array): DxfSvgGeometry | null {
  const polylines = collectDxfPolylines(input);
  if (!polylines.length) return null;
  const points = polylines.flatMap((polyline) => polyline.points);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = Math.max(width, height) * 0.04;
  const paths = polylines.map((polyline) => ({
    d: polyline.points.map((point, index) => `${index === 0 ? "M" : "L"} ${fmt(point.x - minX + padding)} ${fmt(maxY - point.y + padding)}`).join(" ") + (polyline.closed ? " Z" : ""),
    closed: polyline.closed,
  }));
  return {
    viewBox: `0 0 ${fmt(width + padding * 2)} ${fmt(height + padding * 2)}`,
    paths,
    entityCount: paths.length,
    pointCount: points.length,
  };
}

export type DocumentPreviewProps = {
  binary: PlanBinary | null;
  pageIndex?: number;
  pageCount?: number | null;
  className?: string;
  loading?: boolean;
  error?: string | null;
  children?: ReactNode;
};

export function DocumentPreview({ binary, pageIndex = 0, pageCount = null, className = "", loading = false, error = null, children }: DocumentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const dxf = useMemo(() => binary?.kind === "dxf" ? dxfToSvgGeometry(binary.bytes) : null, [binary]);

  useEffect(() => {
    setLoadError(false);
    if (!binary || binary.kind === "dxf") {
      setObjectUrl(null);
      return;
    }
    const mimeType = binary.kind === "pdf" ? "application/pdf" : "image/svg+xml";
    const url = URL.createObjectURL(new Blob([Uint8Array.from(binary.bytes)], { type: binary.mimeType || mimeType }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [binary]);

  const page = Math.max(1, Math.floor(pageIndex) + 1);
  const classes = `document-preview ${className}`.trim();
  let source: ReactNode;

  if (error) {
    source = <PreviewMessage title="Plan preview needs attention" detail={error} alert />;
  } else if (loading) {
    source = <PreviewMessage title="Retrieving verified plan" detail="Checking the stored file bytes before previewing this source." />;
  } else if (!binary) {
    source = <PreviewMessage title="Plan preview unavailable" detail="Import a PDF, DXF or SVG plan to view its source here." />;
  } else if (binary.kind === "svg") {
    source = objectUrl && !loadError ? <img src={objectUrl} alt={`${binary.name} source plan`} onError={() => setLoadError(true)} /> : <PreviewMessage title="SVG preview unavailable" detail="The imported SVG could not be displayed by this browser." />;
  } else if (binary.kind === "pdf") {
    source = objectUrl ? <object data={`${objectUrl}#page=${page}&view=FitH`} type="application/pdf" aria-label={`${binary.name}, PDF page ${page}`}><PreviewMessage title="PDF preview unavailable" detail="This browser does not support embedded PDF pages. The imported file remains attached to the job." /></object> : <PreviewMessage title="Preparing PDF preview" detail={`Loading page ${page}.`} />;
  } else if (binary.kind === "dxf") {
    source = dxf ? <svg viewBox={dxf.viewBox} role="img" aria-label={`${binary.name}, DXF linework`} preserveAspectRatio="xMidYMid meet"><g>{dxf.paths.map((path, index) => <path key={`${index}-${path.d}`} d={path.d} />)}</g></svg> : <PreviewMessage title="DXF preview unavailable" detail="No supported LINE, LWPOLYLINE or POLYLINE geometry was found in this ASCII DXF." />;
  } else {
    source = <PreviewMessage title="Plan format unsupported" detail="This preview supports PDF, SVG and ASCII DXF sources." />;
  }

  return <figure className={classes} aria-busy={loading || undefined}>
    {binary ? <figcaption className="document-preview-caption">
      <span className="document-preview-name">{binary.name}</span>
      <span className="document-preview-page">Page {page}{pageCount ? ` of ${pageCount}` : ""}</span>
      <span className="document-preview-kind">{binary.kind.toUpperCase()} · {formatFileSize(binary.sizeBytes)}</span>
      <code className="document-preview-hash" title={binary.sha256}>SHA-256 {binary.sha256}</code>
    </figcaption> : null}
    <div className="document-preview-source" aria-live="polite">{source}</div>
    {children ? <div className="document-preview-overlay">{children}</div> : null}
  </figure>;
}

function PreviewMessage({ title, detail, alert = false }: { title: string; detail: string; alert?: boolean }) {
  return <div className="document-preview-message" role={alert ? "alert" : "status"}><strong>{title}</strong><span>{detail}</span></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
