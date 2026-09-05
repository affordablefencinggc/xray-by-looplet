/** source-page-v1 uses the displayed source page's intrinsic units, top-left axes.
 * PDF crop/rotation are applied by PDF.js before this viewport; SVG uses its
 * viewBox, DXF the extracted linework bounds. Camera changes never edit points.
 */
export type SourcePoint = { x: number; y: number };
export type SourceBounds = { x: number; y: number; width: number; height: number };
export type SourcePage = { bounds: SourceBounds; rotation: number; crop: readonly number[] | null };
export type SourceViewport = { scale: number; x: number; y: number; bounds: SourceBounds };

export function validSourceBounds(bounds: SourceBounds): boolean {
  return [bounds.x,bounds.y,bounds.width,bounds.height].every(n=>Number.isFinite(n) && Math.abs(n)<=1e9)
    && bounds.width>0 && bounds.height>0;
}

export function sourceViewport(bounds: SourceBounds, width: number, height: number, zoom=1, pan: SourcePoint={x:0,y:0}): SourceViewport | null {
  if(!validSourceBounds(bounds) || ![width,height,zoom,pan.x,pan.y].every(Number.isFinite) || width<=0 || height<=0 || zoom<=0)return null;
  const inset=Math.min(16,width/8,height/8);
  const fit=Math.min((width-2*inset)/bounds.width,(height-2*inset)/bounds.height);
  const scale=fit*zoom;
  const x=width/2+pan.x-(bounds.x+bounds.width/2)*scale,y=height/2+pan.y-(bounds.y+bounds.height/2)*scale;
  if(![scale,x,y,bounds.width*scale,bounds.height*scale].every(Number.isFinite) || scale<=Number.EPSILON || scale>1e12)return null;
  return {bounds,scale,x,y};
}
export function sourceToCanvas(point:SourcePoint,viewport:SourceViewport):SourcePoint {return {x:point.x*viewport.scale+viewport.x,y:point.y*viewport.scale+viewport.y};}
export function canvasToSource(point:SourcePoint,viewport:SourceViewport):SourcePoint {return {x:(point.x-viewport.x)/viewport.scale,y:(point.y-viewport.y)/viewport.scale};}
/** A standalone SVG can letterbox its viewBox inside a differently shaped root
 * viewport. In that case use the actual viewport units, including its margins. */
export function svgSourceBounds(viewBox:SourceBounds, width:string|null, height:string|null):SourceBounds {
  const absolute=(raw:string|null)=>{const match=raw?.trim().match(/^([+\d.eE-]+)(px|pt|pc|mm|cm|in)?$/);if(!match)return NaN;const units:Record<string,number>={px:1,pt:96/72,pc:16,mm:96/25.4,cm:96/2.54,in:96};return Number(match[1])*units[match[2]||'px'];};
  const root={x:0,y:0,width:absolute(width),height:absolute(height)};
  return validSourceBounds(root) && Math.abs(root.width/root.height-viewBox.width/viewBox.height)>1e-9 ? root : viewBox;
}
export function pointOnSource(point:SourcePoint,bounds:SourceBounds):boolean {return point.x>=bounds.x && point.y>=bounds.y && point.x<=bounds.x+bounds.width && point.y<=bounds.y+bounds.height;}

/** Source overlays snap only to reviewed/manual source points, never demo CAD. */
export function snapSourcePoint(point:SourcePoint, candidates:readonly SourcePoint[], radius:number, enabled:boolean) {
  let best=point,distance=radius;
  if(enabled)for(const candidate of candidates){const d=Math.hypot(point.x-candidate.x,point.y-candidate.y);if(d<distance){best=candidate;distance=d;}}
  return {point:{...best},snapped:best!==point,distance:best===point?0:distance,kind:'markup' as const};
}

export function parseSvgViewBox(svg:string):SourceBounds|null {
  // Consume only XML preamble/comments before the real root, never a nested or
  // commented-out svg. Browser callers additionally validate with DOMParser.
  const opening=svg.replace(/^\uFEFF/,"").match(/^\s*(?:(?:<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->)\s*)*(<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>)/);
  const root=opening?.[1];if(!root)return null;
  const attrs=new Map<string,string>();
  for(const match of root.matchAll(/\s([^\s="'<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)){
    if(attrs.has(match[1]))return null;attrs.set(match[1],match[2]??match[3]);
  }
  const viewBox=attrs.get("viewBox");
  if(viewBox){const n=viewBox.trim().split(/[\s,]+/).map(Number);const b={x:n[0],y:n[1],width:n[2],height:n[3]};return n.length===4 && validSourceBounds(b)?b:null;}
  const dimension=(key:string)=>{const raw=attrs.get(key);if(!raw)return NaN;const m=raw.trim().match(/^([+\d.eE-]+)(px|pt|pc|mm|cm|in)?$/);if(!m)return NaN;const factors:Record<string,number>={px:1,pt:96/72,pc:16,mm:96/25.4,cm:96/2.54,in:96};return Number(m[1])*(factors[m[2]||'px']);};
  const b={x:0,y:0,width:dimension('width'),height:dimension('height')};return validSourceBounds(b)?b:null;
}
