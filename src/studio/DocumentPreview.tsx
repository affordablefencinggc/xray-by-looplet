import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PlanBinary } from "./documentContract";
import { parseSvgViewBox, svgSourceBounds, sourceViewport, sourceToCanvas, type SourcePage, type SourcePoint } from "./documentViewport";


export const SourceScopeContext = createContext<((context: CanvasRenderingContext2D) => void) | null>(null);

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
  zoom?: number;
  pan?: SourcePoint;
  showSource?: boolean;
  onSourceReady?: (ready: boolean) => void;
  children?: ReactNode | ((page: SourcePage | null) => ReactNode);
};

type ReadySource = { key: string; page: SourcePage; url: string | null; kind: "svg" | "pdf" | "dxf" };

export function DocumentPreview({ binary, pageIndex = 0, pageCount = null, className = "", loading = false, error = null, zoom = 1, pan = {x:0,y:0}, showSource = true, onSourceReady, children }: DocumentPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({width:0,height:0});
  const [readySource, setReadySource] = useState<ReadySource | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{key:string; message:string}|null>(null);
  const dxf = useMemo(() => binary?.kind === "dxf" ? dxfToSvgGeometry(binary.bytes) : null, [binary]);
  const key = `${binary?.documentId ?? "none"}:${binary?.sha256 ?? ""}:${pageIndex}`;
  const ready = readySource?.key === key ? readySource : null;
  const available = !loading && !error && ready && (ready.kind === "dxf" || loadedKey === key) && failure?.key !== key;
  const page = Math.floor(pageIndex) + 1;

  useEffect(() => {
    const element=viewportRef.current;if(!element)return;
    const measure=()=>setSize({width:element.clientWidth,height:element.clientHeight});
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  }, []);
  useEffect(() => { onSourceReady?.(Boolean(available)); }, [Boolean(available),onSourceReady]);
  useEffect(() => {
    let cancelled=false;let url:string|null=null;
    let destroy:(()=>Promise<void>)|undefined;
    setFailure(null);setLoadedKey(null);setReadySource(null);
    if(!binary || loading || error)return;
    async function prepare() {
      if(!Number.isInteger(pageIndex) || pageIndex<0 || (pageCount && pageIndex>=pageCount))throw Error("The requested source page is unavailable.");
      if(binary!.kind === "dxf") {
        if(!dxf)throw Error("No supported LINE, LWPOLYLINE or POLYLINE geometry was found in this ASCII DXF.");
        const [x,y,width,height]=dxf.viewBox.split(" ").map(Number);
        if(!cancelled)setReadySource({key,kind:"dxf",url:null,page:{bounds:{x,y,width,height},rotation:0,crop:null}});
      } else if(binary!.kind === "svg") {
        const xml=new TextDecoder().decode(binary!.bytes);
        const parsed=new DOMParser().parseFromString(xml,"image/svg+xml");
        if(parsed.querySelector("parsererror") || parsed.documentElement.localName!=="svg" || parsed.documentElement.namespaceURI!=="http://www.w3.org/2000/svg")throw Error("The SVG source is not a valid SVG document.");
        const viewBox=parseSvgViewBox(new XMLSerializer().serializeToString(parsed.documentElement));
        if(!viewBox)throw Error("This SVG has no finite viewBox or absolute page dimensions. Measurement is unavailable; the original file remains attached.");
        const bounds=svgSourceBounds(viewBox,parsed.documentElement.getAttribute("width"),parsed.documentElement.getAttribute("height"));
        url=URL.createObjectURL(new Blob([Uint8Array.from(binary!.bytes)],{type:"image/svg+xml"}));
        if(!cancelled)setReadySource({key,kind:"svg",url,page:{bounds,rotation:0,crop:null}});
      } else {
        const [{getDocument,GlobalWorkerOptions},{default:workerUrl}]=await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
        ]);
        if(cancelled)return;
        GlobalWorkerOptions.workerSrc=workerUrl;
        const task=getDocument({data:Uint8Array.from(binary!.bytes),wasmUrl:new URL("/pdfjs/wasm/",location.href).href,standardFontDataUrl:new URL("/pdfjs/standard_fonts/",location.href).href});destroy=()=>task.destroy();
        const document=await task.promise;
        if(cancelled)return;
        if(page>document.numPages)throw Error("The requested PDF page is unavailable.");
        const pdfPage=await document.getPage(page);
        const intrinsic=pdfPage.getViewport({scale:1});
        const renderScale=Math.min(2,4096/intrinsic.width,4096/intrinsic.height,Math.sqrt(16000000/(intrinsic.width*intrinsic.height)));
        if(!Number.isFinite(renderScale) || renderScale<=0)throw Error("The PDF page has invalid dimensions.");
        const raster=pdfPage.getViewport({scale:renderScale});
        const canvas=window.document.createElement("canvas");canvas.width=Math.ceil(raster.width);canvas.height=Math.ceil(raster.height);
        await pdfPage.render({canvas,viewport:raster}).promise;
        if(cancelled)return;
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("PDF page rendering failed.")),"image/png"));
        if(cancelled)return;
        url=URL.createObjectURL(blob);
        setReadySource({key,kind:"pdf",url,page:{bounds:{x:0,y:0,width:intrinsic.width,height:intrinsic.height},rotation:pdfPage.rotate,crop:[...pdfPage.view]}});
      }
    }
    void prepare().catch(reason=>{if(!cancelled)setFailure({key,message:reason instanceof Error?reason.message:"Source preview failed."});});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);void destroy?.().catch(()=>{});};
  }, [binary,pageIndex,pageCount,loading,error,key,dxf]);

  const viewport=ready?sourceViewport(ready.page.bounds,size.width,size.height,zoom,pan):null;
  const origin=viewport && ready?sourceToCanvas({x:ready.page.bounds.x,y:ready.page.bounds.y},viewport):null;
  const style=viewport && ready && origin?{left:origin.x,top:origin.y,width:ready.page.bounds.width*viewport.scale,height:ready.page.bounds.height*viewport.scale,visibility:showSource?"visible" as const:"hidden" as const}:undefined;
  const paintScopeSource = useMemo(() => {
    if (!available || !ready) return null;
    const frame = sourceViewport(ready.page.bounds, size.width, size.height, zoom, pan);
    if (!frame) return null;
    return (context: CanvasRenderingContext2D) => {
      if (!showSource) return;
      const origin = sourceToCanvas({ x: ready.page.bounds.x, y: ready.page.bounds.y }, frame);
      context.save();
      context.translate(origin.x, origin.y);
      context.scale(frame.scale, frame.scale);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, ready.page.bounds.width, ready.page.bounds.height);
      if (ready.kind === "dxf" && dxf) {
        context.translate(-ready.page.bounds.x, -ready.page.bounds.y);
        context.strokeStyle = "#262b31"; context.lineWidth = 1 / frame.scale;
        for (const path of dxf.paths) context.stroke(new Path2D(path.d));
      } else if (sourceImageRef.current?.complete && sourceImageRef.current.naturalWidth) {
        context.drawImage(sourceImageRef.current, 0, 0, ready.page.bounds.width, ready.page.bounds.height);
      }
      context.restore();
    };
  }, [available, ready, size.width, size.height, zoom, pan.x, pan.y, showSource, dxf]);
  let message:ReactNode=null;
  if(error)message=<PreviewMessage title="Plan preview needs attention" detail={error} alert />;
  else if(loading)message=<PreviewMessage title="Retrieving verified plan" detail="Checking the stored file bytes before previewing this source." />;
  else if(!binary)message=<PreviewMessage title="Plan preview unavailable" detail="Import a PDF, DXF or SVG plan to view its source here." />;
  else if(failure?.key===key)message=<PreviewMessage title="Plan preview unavailable" detail={failure.message} alert />;
  else if(!available)message=<PreviewMessage title="Preparing source page" detail={`Loading page ${page}. Measurement begins when the source is ready.`} />;

  return <figure className={`document-preview ${className}`.trim()} aria-busy={!available || undefined} data-source-ready={Boolean(available)}>
    {binary ? <figcaption className="document-preview-caption">
      <span className="document-preview-name">{binary.name}</span>
      <span className="document-preview-page">Page {page}{pageCount ? ` of ${pageCount}` : ""}</span>
      <span className="document-preview-kind">{binary.kind.toUpperCase()} · {formatFileSize(binary.sizeBytes)}</span>
      <code className="document-preview-hash" title={binary.sha256}>SHA-256 {binary.sha256}</code>
    </figcaption> : null}
    <div className="document-preview-viewport" ref={viewportRef}>
      <div className="document-preview-source" aria-live="polite">
        {ready && viewport && ready.kind === "dxf" && dxf ? <svg className="document-source-page" style={style} viewBox={dxf.viewBox} role="img" aria-label={`${binary?.name}, DXF linework`} preserveAspectRatio="none"><g>{dxf.paths.map((path,index)=><path key={index} d={path.d}/>)}</g></svg> : null}
        {ready?.url && viewport ? <img ref={sourceImageRef} className="document-source-page" style={style} src={ready.url} alt={`${binary?.name} source plan`} data-source-rotation={ready.page.rotation} data-source-crop={ready.page.crop?.join(",")} onLoad={()=>setLoadedKey(key)} onError={()=>setFailure({key,message:"The source image could not be rendered. Original bytes remain attached."})}/> : null}
        {message}
      </div>
      {children ? <SourceScopeContext.Provider value={paintScopeSource}><div className="document-preview-overlay">{typeof children === "function" ? children(available ? ready.page : null) : children}</div></SourceScopeContext.Provider> : null}
    </div>
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
