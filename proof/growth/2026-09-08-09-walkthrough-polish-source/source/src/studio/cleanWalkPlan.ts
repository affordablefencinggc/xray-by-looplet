import type { BuildingPart, SourceBuilding } from "./sourceBuilding.ts";
import { floorKey } from "./componentLocation.ts";
import { listWalkFloors } from "./walkStartPlacement.ts";

export type PlanPoint = [number, number];
type V3 = [number, number, number];
type Segment = [PlanPoint, PlanPoint];
export type CleanPlanShape = { id: string; kind: "floor" | "wall" | "door" | "window" | "stair"; loops: PlanPoint[][] };
const EPS=1e-5;
const key=(p:PlanPoint)=>`${Math.round(p[0]/EPS)},${Math.round(p[1]/EPS)}`;
function triangles(part:BuildingPart):V3[][] {
  const result:V3[][]=[];
  for(let i=0;i+2<part.indices.length;i+=3) {
    const points=part.indices.slice(i,i+3).map(n=>part.positions.slice(n*3,n*3+3) as V3);
    if(points.some(p=>p.length!==3||!p.every(Number.isFinite))) return [];
    result.push(points);
  }
  return result;
}
function contours(segments:Segment[]):PlanPoint[][] {
  const edges=new Map<string,Segment>();
  for(const edge of segments) {const a=key(edge[0]),b=key(edge[1]);if(a===b)continue;const id=[a,b].sort().join("/");if(edges.has(id))edges.delete(id);else edges.set(id,edge);}
  const remaining=[...edges.values()], adjacency=new Map<string,Set<number>>();
  remaining.forEach((edge,i)=>edge.forEach(p=>{const k=key(p), set=adjacency.get(k)??new Set();set.add(i);adjacency.set(k,set);}));
  const unused=new Set(remaining.map((_,i)=>i)), result:PlanPoint[][]=[];
  while(unused.size) {
    const first=unused.values().next().value!;unused.delete(first);
    const loop=[...remaining[first]];let cursor=key(loop[1]);
    while(cursor!==key(loop[0])) {
      const next=[...(adjacency.get(cursor)??[])].find(i=>unused.has(i));if(next===undefined)break;
      unused.delete(next);const edge=remaining[next], point=key(edge[0])===cursor?edge[1]:edge[0];loop.push(point);cursor=key(point);
    }
    // Open sections still draw as lines; only actual closed geometry is filled by callers.
    if(loop.length>1)result.push(loop);
  }
  return result;
}
/** Horizontal section of actual triangles. Header geometry above the cut cannot fill a doorway. */
export function sectionContours(part:BuildingPart,elevation:number):PlanPoint[][] {
  const segments:Segment[]=[];
  for(const triangle of triangles(part)) {
    const hits:PlanPoint[]=[];
    for(let i=0;i<3;i++) {
      const a=triangle[i],b=triangle[(i+1)%3], da=a[1]-elevation,db=b[1]-elevation;
      if(Math.abs(da)<EPS)hits.push([a[0],a[2]]);
      if((da<-EPS&&db>EPS)||(da>EPS&&db<-EPS)) {const t=da/(da-db);hits.push([a[0]+t*(b[0]-a[0]),a[2]+t*(b[2]-a[2])]);}
    }
    const unique=[...new Map(hits.map(p=>[key(p),p])).values()];if(unique.length===2)segments.push([unique[0],unique[1]]);
  }
  return contours(segments);
}
function tops(part:BuildingPart,minY:number,maxY:number,highestOnly:boolean):PlanPoint[][] {
  const groups=new Map<number,Segment[]>();
  for(const [a,b,c] of triangles(part)) {
    if(Math.max(a[1],b[1],c[1])-Math.min(a[1],b[1],c[1])>EPS||a[1]<minY-EPS||a[1]>maxY+EPS)continue;
    const normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(normalY<=EPS)continue;
    const y=Math.round(a[1]/EPS), edges=groups.get(y)??[],p:[PlanPoint,PlanPoint,PlanPoint]=[[a[0],a[2]],[b[0],b[2]],[c[0],c[2]]];
    edges.push([p[0],p[1]],[p[1],p[2]],[p[2],p[0]]);groups.set(y,edges);
  }
  const heights=[...groups.keys()];if(!heights.length)return [];
  return (highestOnly?[Math.max(...heights)]:heights).flatMap(y=>contours(groups.get(y)!));
}
export function buildCleanWalkPlan(model:SourceBuilding,floor:string) {
  const elevation=listWalkFloors(model).find(f=>f.id===floor)?.elevation;
  const shapes:CleanPlanShape[]=[],labels:{id:string;text:string;point:PlanPoint}[]=[];
  if(elevation!==undefined)for(const part of model.objects.filter(p=>floorKey(p)===floor)) {
    let kind:CleanPlanShape["kind"]|null=null,loops:PlanPoint[][]=[];
    if(part.category==="room"||part.category==="slab") {kind="floor";loops=tops(part,elevation-.35,elevation+.15,true);}
    else if(part.category==="wall"||part.category==="column") {kind="wall";loops=sectionContours(part,elevation+1);}
    else if(part.category==="door"||part.category==="window") {kind=part.category;loops=sectionContours(part,elevation+1);}
    else if(part.category==="stair") {kind="stair";loops=tops(part,elevation-.35,elevation+4.5,false);}
    if(!kind||!loops.length)continue;
    shapes.push({id:part.id,kind,loops});
    if(part.category==="room") {
      const points=loops.flat(),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
      labels.push({id:part.id,text:part.label.split(" / ")[0].slice(0,28),point:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2]});
    }
  }
  const points=shapes.flatMap(s=>s.loops.flat()),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const bounds: [number,number,number,number]=points.length?[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]:[0,0,1,1];
  return {shapes,labels,bounds,elevation};
}
export const planPath=(loops:PlanPoint[][])=>loops.map(loop=>loop.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ")+(key(loop[0])===key(loop.at(-1)!)?" Z":"")).join(" ");
