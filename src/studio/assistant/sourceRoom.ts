import { z } from 'zod';

const pair = z.tuple([z.number().finite(), z.number().finite()]);
export const sourceRoomSchema = z.object({
  boundaryIds: z.array(z.string().min(1).max(200)).min(4).max(12),
  doorLeafId: z.string().min(1).max(200), doorWallIndex: z.number().int().min(0).max(11),
  doorHingeEndpoint: z.enum(['a','b']), doorDirection: z.enum(['forward','backward']),
  doorWidthMm: z.number().positive().max(3000), wallThicknessMm: z.number().positive().max(1000),
  wallHeightMm: z.number().positive().max(10000), doorHeightMm: z.number().positive().max(5000),
  levelName: z.string().min(1).max(100),
}).strict();
type P = [number,number];
const cross=(a:P,b:P)=>a[0]*b[1]-a[1]*b[0];
const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1]];
function intersection(a:P,b:P,c:P,d:P):P {
  const u=sub(b,a),v=sub(d,c),den=cross(u,v);
  if(Math.abs(den)<1e-8)throw Error('Adjacent boundary segments must meet at a corner.');
  const t=cross(sub(c,a),v)/den;
  return [a[0]+t*u[0],a[1]+t*u[1]];
}

/** Deterministic geometry from explicitly selected source wall faces, not LLM coordinates. */
export function prepareSourceRoom(geometry: unknown, input: unknown) {
  const args=sourceRoomSchema.parse(input);
  const g=z.object({sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),page:z.number().int().positive(),
    segments:z.array(z.object({id:z.string(),a:pair,b:pair})),
    scaleMapping:z.object({segmentId:z.string(),knownLengthMm:z.number().positive(),mmPerPt:z.number().positive()}),
  }).parse(geometry);
  if(g.scaleMapping.segmentId!==args.doorLeafId||g.scaleMapping.knownLengthMm!==args.doorWidthMm)throw Error('Scale must be bound to this door leaf and its stated width.');
  if(new Set(args.boundaryIds).size!==args.boundaryIds.length)throw Error('Boundary segments must be distinct.');
  const find=(id:string)=>{const s=g.segments.find(s=>s.id===id);if(!s)throw Error('A selected source segment is missing from this result.');return s;};
  const edges=args.boundaryIds.map(find),factor=g.scaleMapping.mmPerPt;
  for(const e of edges){const d=sub(e.b,e.a);if(Math.min(Math.abs(d[0]),Math.abs(d[1]))>.02)throw Error('This room preparer currently requires orthogonal wall faces.');}
  const inner=edges.map((e,i)=>{const prev=edges[(i+edges.length-1)%edges.length];return intersection(prev.a,prev.b,e.a,e.b);});
  const area=inner.reduce((sum,p,i)=>sum+cross(p,inner[(i+1)%inner.length]),0)/2;
  if(Math.abs(area)<1||Math.abs(area)*factor*factor>1e9)throw Error('Selected boundaries do not define a bounded room.');
  // Refuse corners far from the supplied edge: small doorway gaps may be bridged,
  // but unrelated dimension lines must not generate a distant inferred footprint.
  for(let i=0;i<edges.length;i++)for(const p of [inner[i],inner[(i+1)%inner.length]]){
    const e=edges[i]; const length=Math.hypot(...sub(e.b,e.a));
    if(Math.min(Math.hypot(...sub(p,e.a)),Math.hypot(...sub(p,e.b)))>length+args.doorWidthMm/factor+2)throw Error('Boundary extension exceeds the selected wall and doorway.');
  }
  // Catch non-adjacent intersections, including overlapping collinear edges.
  for(let i=0;i<inner.length;i++)for(let j=i+2;j<inner.length;j++){
    if(i===0&&j===inner.length-1)continue;
    const a=inner[i],b=inner[(i+1)%inner.length],c=inner[j],d=inner[(j+1)%inner.length];
    const orient=(p:P,q:P,r:P)=>cross(sub(q,p),sub(r,p));
    if(orient(a,b,c)*orient(a,b,d)<=0&&orient(c,d,a)*orient(c,d,b)<=0&&
      Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&
      Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))throw Error('Selected room boundary crosses itself.');
  }
  const distance=args.wallThicknessMm/(2*factor),sign=Math.sign(area);
  const outer=inner.map((a,i)=>{const b=inner[(i+1)%inner.length],d=sub(b,a),length=Math.hypot(...d);
    if(length<.01)throw Error('Degenerate source wall.');
    const n:P=[sign*d[1]/length*distance,-sign*d[0]/length*distance];
    return {a:[a[0]+n[0],a[1]+n[1]] as P,b:[b[0]+n[0],b[1]+n[1]] as P};});
  const centers=outer.map((e,i)=>{const prev=outer[(i+outer.length-1)%outer.length];return intersection(prev.a,prev.b,e.a,e.b);});
  const mm=(p:P):P=>[p[0]*factor,p[1]*factor];
  const leaf=find(args.doorLeafId),index=args.doorWallIndex;
  if(index>=centers.length)throw Error('Door wall index is outside the room.');
  const a=mm(centers[index]),b=mm(centers[(index+1)%centers.length]),hinge=mm(leaf[args.doorHingeEndpoint]);
  const d=sub(b,a),length=Math.hypot(...d),unit:P=[d[0]/length,d[1]/length];
  const perpendicular=Math.abs(cross(sub(hinge,a),unit));
  if(perpendicular>args.wallThicknessMm+20)throw Error('Door hinge is not on the selected host wall.');
  const offset=(hinge[0]-a[0])*unit[0]+(hinge[1]-a[1])*unit[1]+(args.doorDirection==='forward'?1:-1)*args.doorWidthMm/2;
  if(offset-args.doorWidthMm/2<0||offset+args.doorWidthMm/2>length)throw Error('Door lies outside its source host wall.');
  const operations=[{kind:'level',ref:'source-room',name:args.levelName,elevationMm:0,heightMm:args.wallHeightMm},
    ...centers.map((p,i)=>({kind:'wall',ref:`face-${i}`,levelId:'source-room',a:mm(p),b:mm(centers[(i+1)%centers.length]),heightMm:args.wallHeightMm,thicknessMm:args.wallThicknessMm,name:`Source face ${edges[i].id}`})),
    {kind:'door',ref:'source-door',wallRef:`face-${index}`,offsetMm:offset,widthMm:args.doorWidthMm,heightMm:args.doorHeightMm,tag:'WIL-820',hinge:args.doorDirection==='forward'?'left':'right',swing:'out'}];
  return {sourceSha256:g.sourceSha256,page:g.page,innerBoundaryPt:inner,centerlinePt:centers,operations,
    sourceSegmentIds:[...args.boundaryIds,args.doorLeafId],scaleMapping:g.scaleMapping,
    internalAreaMm2:Math.abs(area)*factor*factor,
    evidence:'Unverified source interpretation. Wall faces and printed-dimension association selected by the caller; heights/materials remain assumptions. Not verified takeoff.'};
}

export async function sourceRoomOverlay(prepared: ReturnType<typeof prepareSourceRoom>, image: {data:string;mimeType:string}, region: number[]) {
  const img=new Image(); img.src=`data:${image.mimeType};base64,${image.data}`; await img.decode();
  const canvas=document.createElement('canvas'); canvas.width=img.width; canvas.height=img.height;
  const ctx=canvas.getContext('2d'); if(!ctx)throw Error('Overlay canvas unavailable.');
  ctx.drawImage(img,0,0);
  const scale=canvas.width/region[2],factor=prepared.scaleMapping.mmPerPt;
  const toPixel=(p:number[]):P=>[(p[0]/factor-region[0])*scale,(p[1]/factor-region[1])*scale];
  ctx.strokeStyle='rgba(0,120,220,0.65)'; ctx.lineCap='butt';
  const walls=prepared.operations.filter(op=>op.kind==='wall') as Array<{a:P;b:P;ref:string;thicknessMm:number}>;
  const door=prepared.operations.find(op=>op.kind==='door') as {wallRef:string;offsetMm:number;widthMm:number};
  const stroke=(a:P,b:P)=>{ctx.beginPath();ctx.moveTo(...toPixel(a));ctx.lineTo(...toPixel(b));ctx.stroke();};
  for(const wall of walls){ctx.lineWidth=wall.thicknessMm/factor*scale;
    if(wall.ref!==door.wallRef){stroke(wall.a,wall.b);continue;}
    const d=sub(wall.b,wall.a),length=Math.hypot(...d),at=(s:number):P=>[wall.a[0]+d[0]*s/length,wall.a[1]+d[1]*s/length];
    stroke(wall.a,at(door.offsetMm-door.widthMm/2)); stroke(at(door.offsetMm+door.widthMm/2),wall.b);
  }
  return {type:'image' as const,mimeType:'image/png',data:canvas.toDataURL('image/png').split(',')[1]};
}
